/* Local persistence: versioned state in localStorage, JSON export/import. */
(function () {
  const HY = window.HY;
  const U = HY.util;
  const KEY = "hanyu.v1";
  const VERSION = 1;

  function fresh() {
    return {
      version: VERSION,
      createdAt: new Date().toISOString(),
      profile: null,
      settings: {
        voiceURI: "",
        rate: 0.9,
        translation: true,
        theme: "light",
        newPerDay: 15,
        reviewCap: 45,
        reduceMotion: false
      },
      diagnostic: null,
      plan: null,
      cards: {},
      words: {},
      lessons: {},
      sessions: [],
      days: {},
      exams: [],
      writing: [],
      skillStats: { rec: { seen: 0, correct: 0 }, prod: { seen: 0, correct: 0 }, listen: { seen: 0, correct: 0 } },
      current: null,
      onboarded: false,
      meta: { lastOpen: Date.now(), storage: "local", configAt: 0 }
    };
  }

  function migrate(s) {
    if (!s || typeof s !== "object") return fresh();
    const base = fresh();
    const out = Object.assign(base, s);
    out.meta = Object.assign({}, base.meta, s.meta || {});
    out.settings = Object.assign(base.settings, s.settings || {});
    out.skillStats = Object.assign(base.skillStats, s.skillStats || {});
    if (!out.cards || typeof out.cards !== "object") out.cards = {};
    if (!out.words || typeof out.words !== "object") out.words = {};
    if (!out.lessons || typeof out.lessons !== "object") out.lessons = {};
    if (!Array.isArray(out.sessions)) out.sessions = [];
    if (!Array.isArray(out.exams)) out.exams = [];
    if (!Array.isArray(out.writing)) out.writing = [];
    if (!out.days || typeof out.days !== "object") out.days = {};
    out.version = VERSION;
    return out;
  }

  let state = null;
  let mode = "local";
  let dirty = false;
  let timer = null;
  const listeners = [];

  function notifyStorageError(e) {
    mode = "memory";
    state.meta.storage = "memory";
    listeners.forEach((fn) => fn(e));
  }

  const Store = (HY.store = {
    get state() { return state; },
    get storageMode() { return mode; },
    onStorageError(fn) { listeners.push(fn); },

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        state = raw ? migrate(JSON.parse(raw)) : fresh();
        mode = "local";
      } catch (e) {
        state = fresh();
        mode = "memory";
        if (e && e.name !== "SecurityError") console.warn("Could not read saved progress", e);
      }
      state.meta = state.meta || {};
      state.meta.lastOpen = Date.now();
      state.meta.storage = mode;
      return state;
    },

    save(immediate) {
      dirty = true;
      if (immediate) return Store.flush();
      clearTimeout(timer);
      timer = setTimeout(() => Store.flush(), 250);
      return true;
    },

    flush() {
      clearTimeout(timer);
      if (!state) return false;
      state.meta = state.meta || {};
      state.meta.lastOpen = Date.now();
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
        dirty = false;
        if (HY.sync && HY.sync.onLocalSave) HY.sync.onLocalSave();
        return true;
      } catch (e) {
        notifyStorageError(e);
        return false;
      }
    },

    /** Mark profile/settings/plan as intentionally changed, for sync merges. */
    touchConfig() {
      if (!state) return;
      state.meta = state.meta || {};
      state.meta.configAt = Date.now();
      Store.save(true);
    },

    reset() {
      state = fresh();
      try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
      return state;
    },

    replace(newState) {
      state = migrate(newState);
      Store.flush();
      return state;
    },

    exportObject() {
      const copy = JSON.parse(JSON.stringify(state));
      if (copy.meta && copy.meta.sync) {
        const sy = copy.meta.sync;
        copy.meta.sync = {
          url: sy.url, anonKey: sy.anonKey, email: sy.email,
          enabled: sy.enabled, lastSyncAt: sy.lastSyncAt, baseRev: sy.baseRev
        };
      }
      return {
        app: "hanyu-hsk5",
        version: VERSION,
        exportedAt: new Date().toISOString(),
        state: copy
      };
    },

    importObject(obj) {
      if (!obj || typeof obj !== "object") throw new Error("Not a backup file.");
      const s = obj.state || obj;
      if (!s.settings || !s.cards) throw new Error("This file does not look like a Hanyu backup.");
      state = migrate(s);
      Store.flush();
      return state;
    },

    /** Add activity to today's rollup and session list. */
    logActivity({ minutes, reviews, newWords, correct, total, kind }) {
      if (!state) return;
      const key = U.today();
      const d = state.days[key] || (state.days[key] = { minutes: 0, reviews: 0, newWords: 0, correct: 0, total: 0, sessions: 0 });
      d.minutes = Math.round((d.minutes || 0) + (minutes || 0));
      d.reviews = (d.reviews || 0) + (reviews || 0);
      d.newWords = (d.newWords || 0) + (newWords || 0);
      d.correct = (d.correct || 0) + (correct || 0);
      d.total = (d.total || 0) + (total || 0);
      d.sessions = (d.sessions || 0) + 1;
      const last = state.sessions[state.sessions.length - 1];
      const record = { date: key, at: Date.now(), kind: kind || "session", minutes: Math.round(minutes || 0), reviews: reviews || 0, newWords: newWords || 0, correct: correct || 0, total: total || 0 };
      if (last && last.date === record.date && last.kind === record.kind && Date.now() - last.at < 20 * 60000) {
        last.minutes += record.minutes; last.reviews += record.reviews; last.newWords += record.newWords;
        last.correct += record.correct; last.total += record.total; last.at = record.at;
      } else {
        state.sessions.push(record);
        if (state.sessions.length > 400) state.sessions.splice(0, state.sessions.length - 400);
      }
      Store.save();
    },

    totals() {
      const t = { minutes: 0, reviews: 0, newWords: 0, correct: 0, total: 0, days: 0 };
      for (const d of Object.values(state.days)) {
        t.minutes += d.minutes || 0; t.reviews += d.reviews || 0; t.newWords += d.newWords || 0;
        t.correct += d.correct || 0; t.total += d.total || 0;
        if (d.minutes) t.days++;
      }
      return t;
    }
  });

  window.addEventListener("pagehide", () => { if (dirty) Store.flush(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && dirty) Store.flush(); });
})();

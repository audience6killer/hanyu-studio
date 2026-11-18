/* Spaced repetition: three review skills per word, SM-2 style scheduling. */
(function () {
  const HY = window.HY;
  const U = HY.util;
  const SKILLS = ["rec", "prod", "listen"];
  const BASE = { rec: 1, prod: 2, listen: 1 };      // days
  const EASE0 = 2.5;

  const cardKey = (w, skill) => w + "|" + skill;

  const SRS = (HY.srs = {
    SKILLS,
    cardKey,

    introduceWord(state, word, opts) {
      opts = opts || {};
      const now = opts.now || Date.now();
      let rec = state.words[word];
      if (!rec) {
        rec = state.words[word] = {
          w: word,
          lesson: opts.lesson || 0,
          source: opts.source || "book",
          introducedAt: now,
          status: "learning",
          seen: 0,
          correct: 0,
          lapses: 0,
          lastSeen: now
        };
      } else {
        return rec;
      }
      const known = !!opts.known;
      const cards = {
        rec: { due: known ? now + 86400000 : now + 10 * 60000, interval: known ? 1 : 10 / 1440 },
        listen: { due: known ? now + 8 * 3600000 : now + 8 * 3600000, interval: known ? 0.5 : 0.01 },
        prod: { due: known ? now + 2 * 86400000 : now + 2 * 86400000, interval: known ? 2 : 0.01 }
      };
      for (const skill of SKILLS) {
        const key = cardKey(word, skill);
        if (state.cards[key]) continue;
        const c = cards[skill];
        state.cards[key] = {
          w: word, skill, due: c.due, interval: c.interval, ease: EASE0,
          reps: 0, lapses: 0, last: 0, suspended: false, created: now
        };
      }
      return rec;
    },

    card(state, w, skill) { return state.cards[cardKey(w, skill)] || null; },

    dueCards(state, now, opts) {
      opts = opts || {};
      const out = [];
      for (const c of Object.values(state.cards)) {
        if (c.suspended) continue;
        if (opts.skills && !opts.skills.includes(c.skill)) continue;
        if (c.due <= now) out.push(c);
      }
      out.sort((a, b) => (a.due - b.due) || (a.interval - b.interval));
      return opts.limit ? out.slice(0, opts.limit) : out;
    },

    dueCount(state, now, skills) {
      let n = 0;
      for (const c of Object.values(state.cards)) {
        if (!c.suspended && c.due <= now && (!skills || skills.includes(c.skill))) n++;
      }
      return n;
    },

    isMature(c) { return (c.interval || 0) >= 21; },

    grade(state, card, q, now) {
      now = now || Date.now();
      const c = card;
      const first = (c.reps || 0) === 0;
      c.reps = (c.reps || 0) + 1;
      c.ease = c.ease || EASE0;
      if (q === 0) {
        c.lapses = (c.lapses || 0) + 1;
        c.ease = Math.max(1.3, c.ease - 0.2);
        c.interval = 10 / 1440;
      } else if (q === 1) {
        c.interval = first ? 0.5 : Math.max(0.5, (c.interval || 0.5) * 1.2);
        c.ease = Math.max(1.3, c.ease - 0.05);
      } else if (q === 2) {
        c.interval = first ? BASE[c.skill] : (c.interval || 1) * c.ease;
      } else {
        c.interval = first ? BASE[c.skill] * 2 : (c.interval || 1) * c.ease * 1.35;
        c.ease = Math.min(3.2, c.ease + 0.1);
      }
      c.interval = Math.min(c.interval, 730);
      c.due = now + c.interval * 86400000;
      c.last = now;

      const rec = state.words[c.w];
      if (rec) {
        rec.seen = (rec.seen || 0) + 1;
        if (q >= 2) rec.correct = (rec.correct || 0) + 1;
        else rec.lapses = (rec.lapses || 0) + 1;
        rec.lastSeen = now;
        rec.status = SRS.isMature(c) ? "mature" : (c.reps >= 2 ? "review" : "learning");
      }
      const ss = state.skillStats && state.skillStats[c.skill];
      if (ss) { ss.seen = (ss.seen || 0) + 1; if (q >= 2) ss.correct = (ss.correct || 0) + 1; }
      HY.store.save();
      return c;
    },

    statusOf(state, w) {
      const rec = state.words[w];
      if (!rec) return "new";
      const cards = SKILLS.map((s) => state.cards[cardKey(w, s)]).filter(Boolean);
      if (!cards.length) return rec.status || "learning";
      if (cards.every((c) => c.suspended)) return "suspended";
      if (cards.every((c) => SRS.isMature(c))) return "mature";
      if (cards.some((c) => (c.reps || 0) < 2 || (c.interval || 0) < 1)) return "learning";
      return "review";
    },

    counts(state) {
      const out = { introduced: 0, learning: 0, review: 0, mature: 0 };
      for (const w of Object.keys(state.words)) {
        out.introduced++;
        const s = SRS.statusOf(state, w);
        if (s === "mature") out.mature++;
        else if (s === "review") out.review++;
        else if (s === "learning") out.learning++;
      }
      return out;
    },

    forecast(state, days, now) {
      now = now || Date.now();
      const out = new Array(days).fill(0);
      for (const c of Object.values(state.cards)) {
        if (c.suspended) continue;
        const d = Math.floor((c.due - now) / 86400000);
        if (d < 0) out[0]++;
        else if (d < days) out[d]++;
      }
      return out;
    },

    dueBySkill(state, now) {
      const out = { rec: 0, prod: 0, listen: 0 };
      for (const c of Object.values(state.cards)) {
        if (!c.suspended && c.due <= now) out[c.skill] = (out[c.skill] || 0) + 1;
      }
      return out;
    },

    weakWords(state, limit) {
      const rows = [];
      for (const w of Object.keys(state.words)) {
        const rec = state.words[w];
        const cards = SKILLS.map((s) => state.cards[cardKey(w, s)]).filter(Boolean);
        const lapses = cards.reduce((a, c) => a + (c.lapses || 0), 0);
        if (!lapses) continue;
        const acc = rec.seen ? rec.correct / rec.seen : 0;
        rows.push({ w, lapses, acc, seen: rec.seen || 0, lesson: rec.lesson });
      }
      rows.sort((a, b) => (b.lapses - a.lapses) || (a.acc - b.acc));
      return limit ? rows.slice(0, limit) : rows;
    },

    suspendWord(state, w, on) {
      for (const skill of SKILLS) {
        const c = state.cards[cardKey(w, skill)];
        if (c) c.suspended = !!on;
      }
      HY.store.save();
    },

    resetWord(state, w) {
      for (const skill of SKILLS) delete state.cards[cardKey(w, skill)];
      delete state.words[w];
      HY.store.save();
    },

    /** Build 3 plausible English meaning options for a listening/reading card. */
    optionsForMeaning(w, n, seed) {
      const D = HY.data;
      const base = D.lookup(w);
      if (!base) return [];
      const targetPos = (base.pos || "").split("/")[0].replace(".", "");
      const pool = [];
      const seen = new Set([base.en]);
      const all = D.studyWords;
      const rand = U.rng(seed || U.hash(w));
      const samePos = all.filter((x) => x.w !== w && (x.pos || "").includes(targetPos));
      const rest = all.filter((x) => x.w !== w && !(x.pos || "").includes(targetPos));
      const ordered = U.shuffle(samePos, rand).concat(U.shuffle(rest, rand));
      for (const x of ordered) {
        if (seen.has(x.en)) continue;
        seen.add(x.en);
        pool.push(x.en);
        if (pool.length >= n - 1) break;
      }
      return U.shuffle([base.en].concat(pool), rand);
    },

    optionsForWord(meaning, w, n, seed) {
      const D = HY.data;
      const pool = [];
      const seen = new Set([w]);
      const all = D.studyWords.filter((x) => x.w.length >= w.length - 1);
      const rand = U.rng(seed || U.hash(meaning || w));
      for (const x of U.shuffle(all, rand)) {
        if (seen.has(x.w)) continue;
        seen.add(x.w); pool.push(x.w);
        if (pool.length >= n - 1) break;
      }
      return U.shuffle([w].concat(pool), rand);
    },

    optionsForPinyin(py, w, n, seed) {
      const D = HY.data;
      const pool = [];
      const seen = new Set([py]);
      const base = D.lookup(w);
      const all = D.studyWords.filter((x) => (x.w.length === (base ? base.w.length : 2)) && x.py !== py);
      const rand = U.rng(seed || U.hash(w + "py"));
      for (const x of U.shuffle(all, rand)) {
        if (seen.has(x.py)) continue;
        seen.add(x.py); pool.push(x.py);
        if (pool.length >= n - 1) break;
      }
      return U.shuffle([py].concat(pool), rand);
    }
  });
})();

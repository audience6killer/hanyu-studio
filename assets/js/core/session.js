/* Daily session builder and recorder. */
(function () {
  const HY = window.HY;
  const U = HY.util;
  const S = (HY.session = {});
  const STAGES = ["grammar", "reading", "listening", "writing"];
  const STAGE_MIN = { grammar: 6, reading: 8, listening: 10, writing: 12 };
  S.STAGES = STAGES;

  S.lessonState = function (state, n) {
    return state.lessons[n] || (state.lessons[n] = { stages: {}, scores: {}, startedAt: Date.now() });
  };

  S.stageDone = function (state, n, stage) {
    const l = state.lessons[n];
    return !!(l && l.stages && l.stages[stage]);
  };

  S.refreshVocabStage = function (state, n) {
    const lesson = HY.data.lessonByN[n];
    if (!lesson) return false;
    const all = lesson.items.every((w) => state.words[w]);
    if (!all) return false;
    const l = S.lessonState(state, n);
    l.stages.vocab = true;
    l.vocabAt = l.vocabAt || Date.now();
    S.maybeComplete(state, n);
    return true;
  };

  S.maybeComplete = function (state, n) {
    const l = S.lessonState(state, n);
    const all = ["vocab"].concat(STAGES).every((s) => l.stages[s]);
    if (all && !l.completedAt) {
      l.completedAt = Date.now();
      HY.store.save(true);
    }
  };

  S.nextStage = function (state, n) {
    return STAGES.find((s) => !S.stageDone(state, n, s)) || null;
  };

  S.unintroduced = function (state, n) {
    const lesson = HY.data.lessonByN[n];
    if (!lesson) return [];
    return lesson.items.filter((w) => !state.words[w]);
  };

  S.refreshCandidates = function (state, now) {
    const diag = state.diagnostic;
    const profile = state.profile;
    if (!diag || !diag.refresh || !profile) return [];
    const days = U.daysBetween(profile.startDate, U.today());
    if (days > 21) return [];
    const done = new Set(Object.keys(state.words));
    return diag.refresh.filter((w) => !done.has(w));
  };

  S.gapCandidates = function (state) {
    return HY.data.vocab.gap.filter((w) => !state.words[w.w]).map((w) => w.w);
  };

  S.newWordQueue = function (state, quota, now) {
    const out = [];
    const refresh = S.refreshCandidates(state, now);
    if (refresh.length) {
      const n = Math.min(3, quota, refresh.length);
      for (let i = 0; i < n; i++) out.push({ w: refresh[i], source: "hsk4", lesson: 0 });
    }
    let next = HY.plan.nextLesson(state);
    const un = S.unintroduced(state, next);
    for (const w of un) {
      if (out.length >= quota) break;
      out.push({ w, source: "book", lesson: next });
    }
    if (out.length < quota) {
      const week = state.plan ? HY.plan.currentWeek(state.plan) : 1;
      if (week >= 2) {
        for (const w of S.gapCandidates(state)) {
          if (out.length >= quota) break;
          out.push({ w, source: "gap", lesson: 0 });
        }
      }
    }
    // de-dupe
    const seen = new Set();
    return out.filter((x) => { if (seen.has(x.w)) return false; seen.add(x.w); return true; });
  };

  S.estimate = function (items) {
    let sec = 0;
    for (const it of items) {
      if (it.kind === "review") sec += 18;
      else if (it.kind === "learn") sec += 55;
      else sec += (STAGE_MIN[it.step] || 8) * 60;
    }
    return Math.round(sec / 60);
  };

  S.build = function (state, mode, now) {
    mode = mode || "daily";
    now = now || Date.now();
    const targets = HY.plan.dailyTargets(state, now);
    const profile = state.profile || {};
    const targetMinutes = mode === "review" ? 15 : mode === "lesson" ? 20 : (profile.dailyMinutes || 35);
    const items = [];
    const next = HY.plan.nextLesson(state);
    const remainingStages = STAGES.filter((s) => !S.stageDone(state, next, s));
    let takeStages = [];
    if (mode !== "review") {
      takeStages = mode === "lesson" ? remainingStages : remainingStages.slice(0, 1);
      // Pair the two cheapest stages when the day has room; this is what keeps 36 lessons plausible.
      if (mode === "daily" && remainingStages.length > 1 && takeStages.length === 1) {
        const pairCost = (STAGE_MIN[takeStages[0]] || 8) + (STAGE_MIN[remainingStages[1]] || 8);
        if (pairCost <= 15) takeStages.push(remainingStages[1]);
      }
    }
    const stepMin = takeStages.reduce((sum, s) => sum + (STAGE_MIN[s] || 8), 0);

    if (mode !== "lesson") {
      const due = HY.srs.dueCards(state, now, { limit: targets.reviewCap });
      const freshCount = mode === "review" ? 0 : targets.newWords;
      const reserve = freshCount * 0.9 + stepMin;
      const reviewBudget = Math.max(0, targetMinutes - reserve);
      const cap = Math.min(due.length, Math.max(mode === "review" ? 20 : 8, Math.floor((reviewBudget * 60) / 18)));
      for (const c of due.slice(0, cap)) items.push({ kind: "review", cardKey: HY.srs.cardKey(c.w, c.skill), w: c.w, skill: c.skill });
    }

    if (mode === "daily" || mode === "lesson") {
      const quota = mode === "lesson" ? 10 : targets.newWords;
      const news = S.newWordQueue(state, quota, now);
      for (const n of news) items.push({ kind: "learn", w: n.w, source: n.source, lesson: n.lesson });
    }

    if (mode !== "review") {
      for (const stage of takeStages) items.push({ kind: "step", step: stage, lesson: next });
    }

    const session = {
      id: "s" + now,
      date: U.today(),
      mode,
      items,
      idx: 0,
      startedAt: now,
      targetMinutes,
      estimated: S.estimate(items),
      results: { reviews: 0, newWords: 0, correct: 0, total: 0, steps: 0 },
      activeSeconds: 0,
      done: false
    };
    state.current = session;
    HY.store.save();
    return session;
  };

  S.current = function (state) {
    const c = state.current;
    if (!c) return null;
    if (c.date !== U.today()) return null;
    if (c.done) return c;
    return c;
  };

  /** Start a session containing only one activity (used from the lesson page). */
  S.buildStage = function (state, lesson, stage, now) {
    now = now || Date.now();
    const items = [];
    if (stage === "vocab") {
      const un = S.unintroduced(state, lesson).slice(0, 12);
      for (const w of un) items.push({ kind: "learn", w, source: "book", lesson });
    } else {
      items.push({ kind: "step", step: stage, lesson });
    }
    state.current = {
      id: "s" + now, date: U.today(), mode: "lesson", items, idx: 0,
      startedAt: now, targetMinutes: stage === "vocab" ? 12 : (STAGE_MIN[stage] || 10),
      estimated: S.estimate(items), results: { reviews: 0, newWords: 0, correct: 0, total: 0, steps: 0 },
      activeSeconds: 0, done: false, focusStage: stage
    };
    HY.store.save();
    return state.current;
  };

  S.resume = function (state) {
    const c = state.current;
    if (!c || c.done) return null;
    c.idx = Math.min(c.idx || 0, c.items.length);
    return c;
  };

  S.recordReview = function (state, item, correct) {
    const c = state.cards[item.cardKey];
    if (!c) return;
    HY.srs.grade(state, c, correct ? 2 : 0);
    const cur = state.current;
    if (cur) {
      cur.results.reviews++;
      cur.results.total++;
      if (correct) cur.results.correct++;
    }
  };

  S.recordLearn = function (state, item, correct) {
    HY.srs.introduceWord(state, item.w, { lesson: item.lesson, source: item.source, known: correct });
    S.refreshVocabStage(state, item.lesson);
    const cur = state.current;
    if (cur) {
      cur.results.newWords++;
      cur.results.total++;
      if (correct) cur.results.correct++;
    }
  };

  S.recordStep = function (state, item, score, detail) {
    const l = S.lessonState(state, item.lesson);
    l.stages[item.step] = true;
    l.scores[item.step] = score == null ? null : score;
    l.stageAt = l.stageAt || {};
    l.stageAt[item.step] = Date.now();
    if (item.step === "vocab") S.refreshVocabStage(state, item.lesson);
    S.maybeComplete(state, item.lesson);
    const cur = state.current;
    if (cur) cur.results.steps = (cur.results.steps || 0) + 1;
    HY.store.save(true);
  };

  S.advance = function (state) {
    const c = state.current;
    if (!c) return null;
    c.idx++;
    if (c.idx >= c.items.length) return S.finish(state);
    HY.store.save();
    return c.items[c.idx];
  };

  S.finish = function (state, minutes, activeSeconds) {
    const c = state.current;
    if (!c) return null;
    if (!c.done) {
      c.done = true;
      c.endedAt = Date.now();
      const mins = minutes != null ? minutes : Math.max(1, Math.round((Date.now() - c.startedAt) / 60000));
      c.minutes = mins;
      HY.store.logActivity({
        minutes: mins,
        reviews: c.results.reviews,
        newWords: c.results.newWords,
        correct: c.results.correct,
        total: c.results.total,
        kind: c.mode
      });
      state.lastSession = {
        at: Date.now(), minutes: mins, reviews: c.results.reviews, newWords: c.results.newWords,
        correct: c.results.correct, total: c.results.total, steps: c.results.steps, mode: c.mode
      };
      HY.store.save(true);
      if (HY.sync && HY.sync.onSessionEnd) HY.sync.onSessionEnd();
    }
    return c;
  };

  S.addMinutes = function (state, delta) {
    const c = state.current;
    if (!c) return;
    c.activeSeconds = (c.activeSeconds || 0) + delta;
  };

  S.currentMinutes = function (state) {
    const c = state.current;
    if (!c) return 0;
    const secs = c.activeSeconds || Math.max(0, (Date.now() - c.startedAt) / 1000);
    return Math.max(1, Math.round(Math.min(secs / 60, 180)));
  };

  S.itemTitle = function (item) {
    if (!item) return "";
    if (item.kind === "review") return "Review · " + (U.subjectLabel[item.skill] || item.skill);
    if (item.kind === "learn") return "New word";
    if (item.kind === "step") return "Lesson " + item.lesson + " · " + item.step.charAt(0).toUpperCase() + item.step.slice(1);
    return "Study";
  };
})();

/* Six-month study plan: 36 book lessons, checkpoints, adaptive pacing. */
(function () {
  const HY = window.HY;
  const U = HY.util;
  const P = (HY.plan = {});
  const LESSONS = 36;
  const SESSIONS_PER_WEEK = 5;

  P.generate = function (startDate, targetDate, dailyMinutes) {
    const start = startDate || U.today();
    const target = targetDate || U.dayKey(U.addDays(start, 182));
    const days = Math.max(56, U.daysBetween(start, target));
    const weeks = Math.max(8, Math.ceil(days / 7));
    const teachingWeeks = Math.max(6, weeks - 2);
    const lessonsPerWeek = LESSONS / teachingWeeks;
    const perLesson = teachingWeeks / LESSONS; // weeks per lesson
    const checkpoints = [];
    for (let after = 6; after <= 36; after += 6) {
      const startWeek = 1 + Math.floor((after - 1) * perLesson);
      checkpoints.push({
        afterLesson: after,
        week: Math.min(weeks, startWeek + 1),
        type: after === 36 ? "final" : "checkpoint"
      });
    }
    return {
      startDate: start,
      targetDate: target,
      dailyMinutes: dailyMinutes || 35,
      weeks,
      teachingWeeks,
      lessonsPerWeek: Math.round(lessonsPerWeek * 100) / 100,
      perLesson,
      checkpoints,
      generatedAt: Date.now()
    };
  };

  P.weekStart = (plan, week) => U.dayKey(U.addDays(plan.startDate, (week - 1) * 7));
  P.weekEnd = (plan, week) => U.dayKey(U.addDays(plan.startDate, week * 7 - 1));

  P.currentWeek = function (plan, today) {
    if (!plan) return 1;
    const d = U.daysBetween(plan.startDate, today || U.today());
    return U.clamp(Math.floor(d / 7) + 1, 1, plan.weeks);
  };

  P.lessonStartWeek = function (plan, n) {
    return 1 + Math.floor((n - 1) * plan.perLesson);
  };

  P.expectedLessons = function (plan, today) {
    if (!plan) return 0;
    const days = Math.max(0, U.daysBetween(plan.startDate, today || U.today()));
    return U.clamp(Math.floor(days * (plan.lessonsPerWeek / 7)), 0, LESSONS);
  };

  P.completedLessons = function (state) {
    let n = 0;
    for (let i = 1; i <= LESSONS; i++) {
      const l = state.lessons[i];
      if (l && l.completedAt) n++;
    }
    return n;
  };

  P.stageDone = function (state, lesson, stage) {
    const l = state.lessons[lesson];
    return !!(l && l.stages && l.stages[stage]);
  };

  P.lessonComplete = function (state, lesson) {
    const l = state.lessons[lesson];
    if (l && l.completedAt) return true;
    return false;
  };

  P.nextLesson = function (state) {
    for (let i = 1; i <= LESSONS; i++) if (!P.lessonComplete(state, i)) return i;
    return LESSONS;
  };

  P.pace = function (state, today) {
    const plan = state.plan;
    if (!plan) return null;
    const completed = P.completedLessons(state);
    const expected = P.expectedLessons(plan, today);
    const week = P.currentWeek(plan, today);
    const weeksLeft = Math.max(0, plan.weeks - week + 1);
    const lessonsLeft = Math.max(0, LESSONS - completed);
    return {
      completed, expected, delta: completed - expected, week, weeksLeft, lessonsLeft,
      neededPerWeek: weeksLeft ? Math.round((lessonsLeft / weeksLeft) * 100) / 100 : 0,
      onTrack: completed >= expected - 1
    };
  };

  P.dailyTargets = function (state, now) {
    const due = HY.srs.dueCount(state, now || Date.now());
    let newWords = state.settings.newPerDay || 15;
    if (due > 100) newWords = 0;
    else if (due > 70) newWords = Math.min(newWords, 4);
    else if (due > 45) newWords = Math.min(newWords, 8);
    const pace = P.pace(state, U.today());
    if (pace && pace.delta <= -3 && due < 70) newWords += 3;
    return { newWords, due, reviewCap: state.settings.reviewCap || 45 };
  };

  P.weekPlan = function (state, week) {
    const plan = state.plan;
    if (!plan) return [];
    const out = [];
    for (let n = 1; n <= LESSONS; n++) {
      const sw = P.lessonStartWeek(plan, n);
      if (sw === week) out.push(n);
    }
    return out;
  };

  P.checkpointForWeek = function (plan, week) {
    if (!plan) return null;
    return (plan.checkpoints || []).find((c) => c.week === week) || null;
  };

  P.nextCheckpoint = function (state) {
    const plan = state.plan;
    if (!plan) return null;
    const week = P.currentWeek(plan);
    return (plan.checkpoints || []).find((c) => c.week >= week) || plan.checkpoints[plan.checkpoints.length - 1];
  };

  P.projection = function (state, today) {
    const plan = state.plan;
    if (!plan) return null;
    const pace = P.pace(state, today);
    if (!pace) return null;
    const perWeek = pace.week > 1 ? pace.completed / (pace.week - 1) : plan.lessonsPerWeek;
    const rate = Math.max(0.35, perWeek);
    const weeksNeeded = Math.ceil(pace.lessonsLeft / rate);
    return {
      finishDate: U.dayKey(U.addDays(today || U.today(), weeksNeeded * 7)),
      weeksNeeded,
      rate: Math.round(rate * 100) / 100
    };
  };

  P.readiness = function (state) {
    if (!state) return { score: 0 };
    const D = HY.data;
    const official = D.vocab.gap.length + D.vocab.words.filter((w) => w.official).length;
    let knownOfficial = 0;
    for (const w of Object.keys(state.words)) {
      const d = D.lookup(w);
      if (d && (d.official || D.gap[w])) knownOfficial++;
    }
    const vocab = official ? Math.min(1, knownOfficial / official) : 0;
    let seen = 0, correct = 0;
    for (const s of Object.values(state.skillStats || {})) { seen += s.seen || 0; correct += s.correct || 0; }
    const acc = seen ? correct / seen : 0;
    const lessons = P.completedLessons(state) / LESSONS;
    const score = Math.round(100 * (0.5 * vocab + 0.3 * acc + 0.2 * lessons));
    return {
      score, vocab: Math.round(vocab * 100), accuracy: Math.round(acc * 100),
      lessons: Math.round(lessons * 100), knownOfficial, official
    };
  };

  P.todayFocus = function (state) {
    const targets = P.dailyTargets(state);
    const next = P.nextLesson(state);
    const lesson = HY.data.lessonByN[next];
    const stages = ["grammar", "reading", "listening", "writing"];
    const stage = stages.find((s) => !P.stageDone(state, next, s)) || stages[0];
    return { targets, next, lesson, stage, minutes: state.profile ? state.profile.dailyMinutes : 35 };
  };
})();

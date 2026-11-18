/* Progress analytics. */
(function () {
  const HY = window.HY;
  const U = HY.util;
  const C = HY.ui;
  const el = U.el;
  const D = HY.data;

  function render() {
    const s = HY.store.state;
    const totals = HY.store.totals();
    const counts = HY.srs.counts(s);
    const readiness = HY.plan.readiness(s);
    const acc = totals.total ? Math.round((totals.correct / totals.total) * 100) : 0;
    const streak = U.streak(s.days);
    const introBook = Object.keys(s.words).filter((w) => D.words[w]).length;
    const introGap = Object.keys(s.words).filter((w) => D.gap[w]).length;
    const skill = s.skillStats || {};
    const writing = s.writing || [];
    const avgWrite = writing.length ? Math.round(writing.reduce((a, x) => a + x.chars, 0) / writing.length) : 0;
    const officialTotal = D.vocab.gap.length + D.vocab.words.filter((w) => w.official).length;

    const kpis = el("div", { class: "kpi-row" },
      kpi("Study time", U.fmtMin(totals.minutes), totals.days + " active days"),
      kpi("Streak", streak + " d", "consecutive"),
      kpi("Reviews", U.fmtNum(totals.reviews), acc + "% first-try"),
      kpi("Words introduced", U.fmtNum(counts.introduced), introBook + " book · " + introGap + " exam"),
      kpi("Mature cards", U.fmtNum(counts.mature), "interval ≥ 21 d"),
      kpi("Lessons", HY.plan.completedLessons(s) + " / 36", "complete"));

    const consistencyCard = C.card({ title: "Consistency", sub: "Last twelve weeks. Darker means more focused minutes." },
      C.heatmap(s.days, 12),
      el("div", { class: "row between legend-row" },
        el("span", { class: "muted tiny" }, "Each square is a day."),
        el("span", { class: "muted tiny" }, streak + " day streak")));

    const readinessCard = C.card({ title: "Exam readiness", sub: "A rough composite, not a prediction." },
      el("div", { class: "ring-row" },
        C.ring(readiness.score, 118, readiness.score + "%", "readiness"),
        el("div", { class: "fact-list" },
          fact("Official HSK5 words live", readiness.knownOfficial + " / " + officialTotal),
          fact("Vocabulary coverage", readiness.vocab + "%"),
          fact("Review accuracy", readiness.accuracy + "%"),
          fact("Lesson coverage", readiness.lessons + "%"))),
      el("p", { class: "muted small" }, "Readiness weights vocabulary coverage at half. It rises as book words and exam-gap words enter review, not simply as hours accumulate."));

    const skillCard = C.card({ title: "Accuracy by skill" },
      el("div", { class: "skill-rows" },
        skillRow("Reading recognition", skill.rec, "jade"),
        skillRow("Typed recall", skill.prod, "gold"),
        skillRow("Listening", skill.listen, "red")),
      el("p", { class: "muted small" }, "Recall is slowest to build and the best signal for writing. If it lags, type the word rather than skipping the production card."));

    const vocabCard = C.card({ title: "Vocabulary states" },
      el("div", { class: "vocab-states" },
        stateBox("Not introduced", D.studyWords.length - introBook - introGap, "muted"),
        stateBox("Learning", counts.learning, "gold"),
        stateBox("In review", counts.review, "red"),
        stateBox("Mature", counts.mature, "jade")),
      el("div", { class: "divider" }),
      C.meterRow("Book words", introBook, D.vocab.words.length, "red"),
      C.meterRow("HSK5 exam gap", introGap, D.vocab.gap.length, "gold"),
      C.meterRow("HSK4 refresh", Object.keys(s.words).filter((w) => D.hsk4[w]).length, D.vocab.hsk4.length, "jade"));

    const forecastCard = C.card({ title: "Review forecast" },
      C.bars(HY.srs.forecast(s, 14), ["now", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13"], { height: 86, tone: "jade" }),
      el("div", { class: "fact-list compact" },
        fact("Due now", HY.srs.dueCount(s, Date.now())),
        fact("Next 7 days", HY.srs.forecast(s, 7).reduce((a, b) => a + b, 0))));

    const writingCard = C.card({ title: "Writing", sub: "Typed compositions, not handwriting." },
      writing.length ? el("div", {},
        el("div", { class: "fact-list compact" },
          fact("Attempts", writing.length),
          fact("Average length", avgWrite + " chars"),
          fact("Last attempt", U.fmtDay(writing[writing.length - 1].date, "short"))),
        el("div", { class: "attempt-list" }, writing.slice(-3).reverse().map((a) =>
          el("div", { class: "mini-attempt" },
            el("span", { class: "muted small" }, "L" + a.lesson + " · " + a.chars + " chars"),
            el("span", { class: "muted tiny" }, (a.requiredUsed || []).length + "/" + (a.required || []).length + " targets"))))) :
        C.empty("pen", "No compositions yet", "Writing unlocks after the first lesson's words are introduced."));

    const planCard = C.card({ title: "Plan pace", cls: "span-2" },
      planView(s),
      el("div", { class: "row gap" },
        C.btn("Open checkpoints", { kind: "soft", icon: "target", onClick: () => HY.app.go("/exam") }),
        C.btn("Adjust plan", { kind: "ghost", icon: "gear", onClick: () => HY.app.go("/settings") })));

    const mapCard = C.card({ title: "Lesson map", cls: "span-2" },
      el("div", { class: "lesson-map" }, D.lessons.map((L) => {
        const done = HY.plan.lessonComplete(s, L.n);
        const started = L.items.some((w) => s.words[w]);
        return el("a", {
          class: "lm-cell " + (done ? "done" : started ? "active" : ""),
          href: "#/lesson/" + L.n,
          title: "Lesson " + L.n + " · " + L.zh + (done ? " · complete" : started ? " · in progress" : "")
        }, el("span", { class: "lm-n" }, String(L.n)), el("span", { class: "lm-zh", lang: "zh-Hans" }, L.zh));
      })));

    const cards = [consistencyCard, readinessCard, skillCard, vocabCard, forecastCard, writingCard, planCard, mapCard];

    if (s.exams.length) {
      cards.push(C.card({ title: "Checkpoint history", cls: "span-2" },
        el("div", { class: "exam-history" }, s.exams.slice().reverse().map((e) =>
          el("div", { class: "exam-hist-row" },
            el("span", {}, U.fmtDay(e.date, "short")),
            el("span", {}, "Week " + e.week + " · lessons 1–" + e.afterLesson),
            el("strong", { class: e.score >= 65 ? "ok-text" : "bad-text" }, e.score + "%"),
            el("span", { class: "muted small" }, "L " + e.sections.listening.correct + "/" + e.sections.listening.total + " · R " + e.sections.reading.correct + "/" + e.sections.reading.total + " · W " + e.sections.writing.score + "/25"))))));
    }

    const body = el("div", {},
      kpis,
      el("div", { class: "grid cols-2" }, cards));

    return C.page({
      eyebrow: "Progress",
      title: "The long view",
      sub: "Numbers that matter for the exam: how much of the official list is live, how accurately you retrieve it, and whether the plan is still honest.",
      actions: C.btn("Back to today", { kind: "ghost", icon: "home", onClick: () => HY.app.go("/home") }),
      body
    });
  }

  function kpi(label, value, sub) {
    return el("div", { class: "kpi" }, el("span", { class: "kpi-label" }, label), el("strong", { class: "kpi-value" }, value), el("span", { class: "kpi-sub" }, sub));
  }

  function fact(label, value) {
    return el("div", { class: "fact" }, el("span", {}, label), el("strong", {}, value));
  }

  function skillRow(label, st, tone) {
    st = st || { seen: 0, correct: 0 };
    const pct = st.seen ? Math.round((st.correct / st.seen) * 100) : 0;
    return el("div", { class: "skill-row" },
      el("div", { class: "skill-row-top" }, el("span", {}, label), el("strong", {}, pct + "%"), el("span", { class: "muted tiny" }, st.seen + " reviews")),
      el("div", { class: "mini-bar" }, el("div", { class: "mini-bar-fill tone-" + tone, style: { width: pct + "%" } })));
  }

  function stateBox(label, n, tone) {
    return el("div", { class: "state-box tone-" + tone },
      el("strong", {}, U.fmtNum(n)), el("span", {}, label));
  }

  function planView(s) {
    const plan = s.plan;
    if (!plan) return C.empty("calendar", "No plan", "Finish onboarding to generate one.");
    const pace = HY.plan.pace(s);
    const proj = HY.plan.projection(s);
    const cur = HY.plan.currentWeek(plan);
    const weeks = [];
    for (let w = Math.max(1, cur - 1); w <= Math.min(plan.weeks, cur + 3); w++) {
      const lessons = HY.plan.weekPlan(s, w);
      const cp = HY.plan.checkpointForWeek(plan, w);
      weeks.push(el("div", { class: "week-row" + (w === cur ? " current" : "") },
        el("span", { class: "week-n" }, "W" + w),
        el("span", { class: "week-dates" }, U.fmtDay(HY.plan.weekStart(plan, w), "short") + " – " + U.fmtDay(HY.plan.weekEnd(plan, w), "short")),
        el("span", { class: "week-lessons" }, lessons.length ? "Lessons " + lessons.join(", ") : "Review / buffer"),
        el("span", { class: "week-cp" }, cp ? (cp.type === "final" ? "Final mock" : "Checkpoint") : "")));
    }
    return el("div", {},
      el("div", { class: "plan-facts small" },
        el("div", { class: "plan-fact" }, el("strong", {}, String(pace.completed)), el("span", {}, "done")),
        el("div", { class: "plan-fact" }, el("strong", {}, String(pace.expected)), el("span", {}, "expected")),
        el("div", { class: "plan-fact" }, el("strong", {}, (pace.delta > 0 ? "+" : "") + pace.delta), el("span", {}, "vs plan")),
        el("div", { class: "plan-fact" }, el("strong", {}, proj ? U.fmtDay(proj.finishDate, "short") : "—"), el("span", {}, "projected finish"))),
      el("div", { class: "week-list" }, weeks),
      el("p", { class: "muted small" }, "Target date " + U.fmtDay(plan.targetDate, "short") + " · " + plan.lessonsPerWeek + " lessons per teaching week. If pace slips, the app lowers new-word targets before it changes the date."));
  }

  HY.views = HY.views || {};
  HY.views.stats = render;
})();

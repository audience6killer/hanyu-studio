/* Dashboard: today's session, pace, exam readiness, weak spots. */
(function () {
  const HY = window.HY;
  const U = HY.util;
  const C = HY.ui;
  const el = U.el;
  const D = HY.data;

  function startSession(mode) {
    const s = HY.store.state;
    const existing = HY.session.current(s);
    if (existing && !existing.done && (mode || "daily") === existing.mode) { HY.app.go("/session"); return; }
    HY.session.build(s, mode || "daily");
    HY.app.go("/session");
  }

  function todayMinutes() {
    const s = HY.store.state;
    const d = s.days[U.today()];
    return d ? d.minutes || 0 : 0;
  }

  function hero() {
    const s = HY.store.state;
    const cur = HY.session.current(s);
    const targets = HY.plan.dailyTargets(s, Date.now());
    const next = HY.plan.nextLesson(s);
    const lesson = D.lessonByN[next];
    const stage = HY.session.nextStage(s, next) || "review";
    const minutes = todayMinutes();
    const goal = s.profile ? s.profile.dailyMinutes : 35;
    const pct = Math.min(100, Math.round((minutes / goal) * 100));
    const hasSession = cur && !cur.done;
    const reviewed = cur ? cur.results.reviews : 0;
    const learned = cur ? cur.results.newWords : 0;
    const total = cur ? cur.items.length : 0;

    return C.card({ cls: "hero" },
      el("div", { class: "hero-grid" },
        el("div", { class: "hero-main" },
          el("div", { class: "eyebrow" }, hasSession ? "Session in progress" : "Today's desk"),
          el("h2", { class: "hero-title" }, hasSession ? "Pick up where you stopped." : "Thirty-five minutes, then out."),
          el("p", { class: "hero-sub" }, hasSession
            ? "You are " + (cur.idx || 0) + " of " + total + " items in. Everything is saved."
            : "Reviews first, then new words, then a short piece or two of Lesson " + next + ". No tab-hopping, no decisions."),
          el("div", { class: "hero-metrics" },
            metric("Cards due", targets.due, "review queue", "red"),
            metric("New words", hasSession ? learned : targets.newWords, "planned", "jade"),
            metric("Lesson", next, lesson ? stage.charAt(0).toUpperCase() + stage.slice(1) : "—", "gold")),
          el("div", { class: "row gap wrap" },
            C.btn(hasSession ? "Resume session" : "Start today's session", {
              kind: "primary", icon: hasSession ? "play" : "arrowRight", onClick: () => startSession("daily")
            }),
            C.btn("Quick review", { kind: "ghost", icon: "cards", onClick: () => startSession("review") }),
            C.link("Open lesson " + next, "#/lesson/" + next, { cls: "link-inline" }))),
        el("div", { class: "hero-side" },
          C.ring(pct, 116, pct + "%", minutes + " / " + goal + " min"),
          el("div", { class: "hero-note" }, hasSession ? "Resume any time." : "One sitting. Then close the tab.")))
    );
  }

  function metric(label, value, sub, tone) {
    return el("div", { class: "metric tone-" + tone },
      el("span", { class: "metric-label" }, label),
      el("strong", { class: "metric-value" }, String(value)),
      el("span", { class: "metric-sub" }, sub));
  }

  function lessonCard() {
    const s = HY.store.state;
    const next = HY.plan.nextLesson(s);
    const L = D.lessonByN[next];
    if (!L) return C.card({}, C.empty("book", "All lessons complete", "Move to checkpoints and exam-gap words."));
    const introduced = L.items.filter((w) => s.words[w]).length;
    const stages = ["vocab", "grammar", "reading", "listening", "writing"];
    const doneCount = stages.filter((x) => x === "vocab" ? introduced === L.items.length : HY.session.stageDone(s, next, x)).length;
    return C.card({
      title: "Lesson " + next + " · " + L.zh,
      sub: L.en,
      action: C.link("Open", "#/lesson/" + next)
    },
      el("div", { class: "lesson-progress-row" },
        el("div", { class: "lesson-progress-main" },
          el("div", { class: "row between" },
            el("span", { class: "muted small" }, "Vocabulary " + introduced + " / " + L.items.length),
            el("span", { class: "muted small" }, doneCount + " / 5 stages")),
          C.progress(introduced, L.items.length, { tone: "jade", sm: true }))),
      el("div", { class: "stage-row" }, stages.map((x) =>
        el("span", { class: "stage-pill" + (x === "vocab" ? (introduced === L.items.length ? " done" : "") : (HY.session.stageDone(s, next, x) ? " done" : "")) },
          x === "vocab" ? "Words" : x.charAt(0).toUpperCase() + x.slice(1)))),
      el("p", { class: "muted small stage-note" }, "Grammar focus: " + (L.content ? L.content.grammar.point : "—")),
      el("div", { class: "row gap" },
        C.btn("Continue lesson", { kind: "soft", icon: "play", onClick: () => { HY.session.build(s, "lesson"); HY.app.go("/session"); } }),
        C.btn("Browse words", { kind: "ghost", icon: "list", onClick: () => HY.app.go("/lesson/" + next) }))
    );
  }

  function examCard() {
    const s = HY.store.state;
    if (!s.profile) return C.card({ title: "Set up first" }, el("p", {}, "Finish onboarding to generate your plan."));
    const days = Math.max(0, U.daysBetween(U.today(), s.profile.targetDate));
    const r = HY.plan.readiness(s);
    const pace = HY.plan.pace(s);
    const proj = HY.plan.projection(s);
    return C.card({ title: "Exam runway" },
      el("div", { class: "exam-head" },
        el("div", {},
          el("strong", { class: "big-num" }, String(days)),
          el("span", { class: "muted" }, " days to " + U.fmtDay(s.profile.targetDate, "short"))),
        el("span", { class: "pill " + (pace && pace.delta < -2 ? "pill-red" : pace && pace.delta > 2 ? "pill-jade" : "pill-gold") },
          pace ? (pace.delta > 0 ? "+" + pace.delta : pace.delta) + " lessons vs plan" : "No plan")),
      el("div", { class: "fact-list compact" },
        fact("Readiness", r.score + "%"),
        fact("Lessons done", HY.plan.completedLessons(s) + " / 36"),
        fact("Projected finish", proj ? U.fmtDay(proj.finishDate, "short") : "—")),
      el("div", { class: "row gap" },
        C.btn("Checkpoints", { kind: "soft", icon: "target", onClick: () => HY.app.go("/exam") }),
        C.btn("Stats", { kind: "ghost", icon: "chart", onClick: () => HY.app.go("/stats") }))
    );
  }

  function fact(label, value) {
    return el("div", { class: "fact" }, el("span", {}, label), el("strong", {}, value));
  }

  function forecastCard() {
    const s = HY.store.state;
    const f = HY.srs.forecast(s, 7);
    const labels = ["today", "+1", "+2", "+3", "+4", "+5", "+6"];
    return C.card({ title: "Next seven days", sub: "Cards coming due. Keep the queue under control and new words stay pleasant." },
      C.bars(f, labels, { height: 64, tone: "jade" }),
      el("div", { class: "row between legend-row" },
        el("span", { class: "muted small" }, "Total due now"),
        el("strong", {}, String(HY.srs.dueCount(s, Date.now())))));
  }

  function weakCard() {
    const s = HY.store.state;
    const list = HY.srs.weakWords(s, 4);
    if (!list.length) {
      return C.card({ title: "Weak spots" }, C.empty("spark", "Nothing has tripped you yet", "Lapses will surface here once reviews begin."));
    }
    return C.card({ title: "Weak spots", sub: "Words with the most lapses." },
      el("div", { class: "weak-list" }, list.map((x) => {
        const d = D.lookup(x.w) || {};
        return el("div", { class: "weak-row" },
          el("span", { class: "weak-hanzi", lang: "zh-Hans" }, x.w),
          el("div", { class: "weak-main" },
            el("span", { class: "pinyin" }, d.py || ""),
            el("span", { class: "weak-en" }, d.en || "")),
          el("span", { class: "pill pill-red" }, x.lapses + " lapses"));
      })));
  }

  function lastSessionCard() {
    const s = HY.store.state;
    const last = s.lastSession;
    if (!last || U.dayKey(last.at) !== U.today()) return null;
    const acc = last.total ? Math.round((last.correct / last.total) * 100) : 0;
    return C.card({ title: "Last session", cls: "quiet" },
      el("div", { class: "mini-grid" },
        mini(last.minutes + " min", "studied"),
        mini(last.reviews + "", "reviews"),
        mini(last.newWords + "", "new words"),
        mini(acc + "%", "first-try accuracy")));
  }

  function mini(value, label) {
    return el("div", { class: "mini" }, el("strong", {}, value), el("span", {}, label));
  }

  function calls() {
    const s = HY.store.state;
    const out = [];
    if (!HY.tts.hasChinese()) {
      out.push(C.notice("warn", el("div", {}, el("strong", {}, "No Mandarin voice detected. "),
        "Listening still works as text, but audio is central here. ",
        C.link("Open audio settings", "#/settings"))));
    }
    if (HY.store.storageMode !== "local") {
      out.push(C.notice("warn", el("div", {}, el("strong", {}, "Progress is not being saved. "),
        "This browser blocked local storage. Export a backup before closing the tab. ",
        C.link("Backup settings", "#/settings"))));
    }
    if (s.diagnostic && s.diagnostic.recommendedLesson > 1 && HY.plan.completedLessons(s) === 0) {
      out.push(C.notice("info", el("div", {}, el("strong", {}, "Calibration suggests starting at Lesson " + s.diagnostic.recommendedLesson + ". "),
        "You can skip ahead from the lessons page if the first units feel too easy.")));
    }
    if (!s.diagnostic && !(s.meta && s.meta.diagDismissed)) {
      out.push(el("div", { class: "card prompt-card" },
        el("div", { class: "prompt-main" },
          el("strong", {}, "Haven't calibrated yet."),
          el("p", {}, "A 15-minute check finds rusty HSK4 words and sets your review load. Not required, but it saves weeks.")),
        el("div", { class: "row gap" },
          C.btn("Calibrate", { kind: "primary", icon: "target", onClick: () => HY.app.go("/diagnostic") }),
          C.btn("Not now", { kind: "ghost", onClick: () => { s.meta.diagDismissed = true; HY.store.save(); HY.app.refresh(); } }))));
    }
    const wk = HY.plan.currentWeek(s.plan);
    const pace = HY.plan.pace(s);
    if (pace && pace.delta <= -3) {
      out.push(C.notice("warn", el("div", {}, el("strong", {}, "You are " + Math.abs(pace.delta) + " lessons behind the plan. "),
        "Do not skip reviews to catch up. Either lower new words or extend the date; the pace panel will recalculate. ",
        C.link("Adjust the plan", "#/settings"))));
    }
    const cp = HY.plan.checkpointForWeek(s.plan, wk);
    if (cp && !s.exams.some((e) => e.week === cp.week)) {
      out.push(C.notice("info", el("div", {}, el("strong", {}, "Checkpoint window open. "),
        "A timed test over lessons 1–" + cp.afterLesson + " is due this week. ",
        C.link("Take it", "#/exam"))));
    }
    if (HY.sync) {
      if (!HY.sync.configured()) {
        out.push(C.notice("info", el("div", {}, el("strong", {}, "Use this desk on your iPhone. "),
          "Connect a free Supabase project and your progress follows you across devices. ",
          C.link("Set up cloud sync", "#/settings"))));
      } else if (!HY.sync.signedIn()) {
        out.push(C.notice("warn", el("div", {}, el("strong", {}, "Cloud sync is connected but signed out. "),
          "Sign in to merge this device with the cloud copy. ",
          C.link("Open sync settings", "#/settings"))));
      } else if (HY.sync.state.lastError) {
        out.push(C.notice("warn", el("div", {}, el("strong", {}, "Last sync failed. "),
          HY.sync.state.lastError + " ",
          C.link("Open sync settings", "#/settings"))));
      }
    }
    return out;
  }

  function render() {
    const s = HY.store.state;
    const today = U.fmtDay(U.today(), "long");
    const actions = el("div", { class: "row gap" },
      C.btn("Start session", { kind: "primary", icon: "play", onClick: () => startSession("daily") }),
      C.btn("Settings", { kind: "ghost", icon: "gear", onClick: () => HY.app.go("/settings") }));
    const body = el("div", { class: "dash" },
      hero(),
      calls(),
      el("div", { class: "dash-grid" },
        el("div", { class: "dash-main" },
          lessonCard(),
          weakCard(),
          lastSessionCard()),
        el("div", { class: "dash-side" },
          examCard(),
          forecastCard(),
          C.card({ title: "How this week works", cls: "quiet" },
            el("ul", { class: "plain-list" },
              el("li", {}, "Five sessions on your best workdays; two rest days."),
              el("li", {}, "Reviews open every session — they cap new words when the queue is heavy."),
              el("li", {}, "One or two short lesson stages per session: grammar → reading → listening → writing."),
              el("li", {}, "Friday is for a 15-minute checkpoint when the plan calls for one."))))
      )
    );
    return C.page({ eyebrow: today, title: "Your Chinese desk", sub: "Quiet, sequential, and sized to a work break.", actions, body });
  }

  HY.views = HY.views || {};
  HY.views.home = render;
})();

/* Lesson library. */
(function () {
  const HY = window.HY;
  const U = HY.util;
  const C = HY.ui;
  const el = U.el;
  const D = HY.data;

  let volume = "all";
  let filter = "all";

  function info(n) {
    const s = HY.store.state;
    const L = D.lessonByN[n];
    const introduced = L.items.filter((w) => s.words[w]).length;
    const stages = ["vocab", "grammar", "reading", "listening", "writing"];
    const done = stages.filter((x) => x === "vocab" ? introduced === L.items.length : HY.session.stageDone(s, n, x)).length;
    const complete = HY.plan.lessonComplete(s, n);
    return { L, introduced, done, complete, started: introduced > 0 || done > 1 };
  }

  function tile(n) {
    const { L, introduced, done, complete, started } = info(n);
    const status = complete ? "done" : started ? "active" : "new";
    return el("a", { class: "lesson-tile " + status, href: "#/lesson/" + n },
      el("div", { class: "tile-top" },
        el("span", { class: "tile-num" }, String(n).padStart(2, "0")),
        el("span", { class: "tile-status " + status }, complete ? "Complete" : started ? "In progress" : "Not started")),
      el("div", { class: "tile-zh", lang: "zh-Hans" }, L.zh),
      el("div", { class: "tile-en" }, L.en),
      el("div", { class: "tile-grammar" }, L.content ? L.content.grammar.point : ""),
      el("div", { class: "tile-foot" },
        el("span", { class: "tile-words" }, introduced + " / " + L.items.length + " words"),
        el("div", { class: "tile-dots" }, [0, 1, 2, 3, 4].map((i) => el("span", { class: "dot" + (i < done ? " on" : "") })))));
  }

  function render() {
    const s = HY.store.state;
    const completed = HY.plan.completedLessons(s);
    const wordsIn = Object.keys(s.words).length;
    const next = HY.plan.nextLesson(s);
    const volumes = [
      { id: "all", label: "All 36" },
      { id: "1", label: "上册 · 1–18" },
      { id: "2", label: "下册 · 19–36" }
    ];
    const filters = [
      { id: "all", label: "All" },
      { id: "new", label: "Not started" },
      { id: "active", label: "In progress" },
      { id: "done", label: "Complete" }
    ];

    let list = D.lessons.slice();
    if (volume !== "all") list = list.filter((l) => String(l.book) === volume);
    if (filter !== "all") list = list.filter((l) => {
      const i = info(l.n);
      if (filter === "done") return i.complete;
      if (filter === "active") return !i.complete && i.started;
      return !i.started;
    });

    const grid = el("div", { class: "lesson-grid" }, list.map((l) => tile(l.n)));
    const body = el("div", {},
      el("div", { class: "lesson-summary" },
        summaryItem("Book lessons", completed + " / 36", "complete"),
        summaryItem("Book words", U.fmtNum(wordsIn) + " / " + U.fmtNum(D.vocab.words.length), "introduced"),
        summaryItem("Next up", "Lesson " + next, D.lessonByN[next].en)),
      el("div", { class: "toolbar" },
        el("div", { class: "toolbar-group" }, volumes.map((v) =>
          el("button", { class: "seg" + (volume === v.id ? " active" : ""), type: "button", onclick: () => { volume = v.id; HY.app.refresh(); } }, v.label))),
        el("div", { class: "toolbar-group" }, filters.map((f) =>
          el("button", { class: "seg" + (filter === f.id ? " active" : ""), type: "button", onclick: () => { filter = f.id; HY.app.refresh(); } }, f.label)))),
      grid,
      list.length ? null : C.empty("book", "No lessons in this filter", "Try another volume or start the next lesson."));

    return C.page({
      eyebrow: "HSK Standard Course 5",
      title: "The book, lesson by lesson",
      sub: "1,381 core words in textbook order, one grammar focus, one original passage and dictation set per lesson. Lesson 36 is the end of Volume 2.",
      actions: C.btn("Continue Lesson " + next, { kind: "primary", icon: "arrowRight", onClick: () => HY.app.go("/lesson/" + next) }),
      body
    });
  }

  function summaryItem(label, value, sub) {
    return el("div", { class: "summary-item" }, el("span", {}, label), el("strong", {}, value), el("small", {}, sub));
  }

  HY.views = HY.views || {};
  HY.views.lessons = render;
})();

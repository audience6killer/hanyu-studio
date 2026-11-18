/* Review hub: due queue, searchable word bank, grammar index. */
(function () {
  const HY = window.HY;
  const U = HY.util;
  const C = HY.ui;
  const el = U.el;
  const D = HY.data;

  let tab = "due";
  let level = "all";
  let status = "all";
  let lessonFilter = "all";

  function startReview() {
    const s = HY.store.state;
    HY.session.build(s, "review");
    HY.app.go("/session");
  }

  function dueView() {
    const s = HY.store.state;
    const now = Date.now();
    const bySkill = HY.srs.dueBySkill(s, now);
    const total = bySkill.rec + bySkill.prod + bySkill.listen;
    const counts = HY.srs.counts(s);
    const forecast = HY.srs.forecast(s, 7);
    const dueList = HY.srs.dueCards(s, now, { limit: 12 });
    return el("div", { class: "grid cols-2" },
      C.card({ title: "Due now", cls: "due-card" },
        el("div", { class: "due-hero" },
          el("div", {}, el("strong", { class: "big-num" }, String(total)), el("span", { class: "muted" }, " cards")),
          C.btn("Start review", { kind: "primary", icon: "play", disabled: total === 0, onClick: startReview })),
        el("div", { class: "skill-bars" },
          skillLine("Reading", bySkill.rec, "jade"),
          skillLine("Recall (typing)", bySkill.prod, "gold"),
          skillLine("Listening", bySkill.listen, "red")),
        el("p", { class: "muted small" }, "Reviews are interleaved across skills. When the queue is long, new words are capped automatically."),
        el("div", { class: "fact-list compact" },
          fact("Introduced", counts.introduced),
          fact("Learning", counts.learning),
          fact("In review", counts.review),
          fact("Mature", counts.mature))),
      C.card({ title: "Coming up" },
        C.bars(forecast, ["now", "+1", "+2", "+3", "+4", "+5", "+6"], { height: 90, tone: "jade" }),
        el("p", { class: "muted small" }, "Holding the daily queue under about 80 keeps 35-minute sessions comfortable. Above that, the plan stops adding new words until it clears."),
        el("div", { class: "divider" }),
        el("div", { class: "eyebrow" }, "First in line"),
        dueList.length ? el("div", { class: "due-list" }, dueList.map((c) => {
          const d = D.lookup(c.w) || {};
          return el("div", { class: "due-row" },
            el("span", { class: "weak-hanzi", lang: "zh-Hans" }, c.w),
            el("span", { class: "muted" }, d.py || ""),
            el("span", { class: "pill pill-muted" }, U.subjectLabel[c.skill] || c.skill),
            el("span", { class: "muted tiny" }, U.fmtDue(c.due)));
        })) : C.empty("check", "Queue empty", "Nothing due right now.")));
  }

  function skillLine(label, n, tone) {
    return el("div", { class: "skill-line" },
      el("span", {}, label),
      el("div", { class: "mini-bar" }, el("div", { class: "mini-bar-fill tone-" + tone, style: { width: Math.min(100, n * 2) + "%" } })),
      el("strong", {}, String(n)));
  }

  function fact(label, value) {
    return el("div", { class: "fact" }, el("span", {}, label), el("strong", {}, value));
  }

  function bankView() {
    const s = HY.store.state;
    const base = D.studyWords.slice();
    const seen = new Set(base.map((w) => w.w));
    const hsk4 = D.vocab.hsk4.filter((w) => !seen.has(w.w)).map((w) => Object.assign({}, w, { source: "hsk4", lesson: 0 }));
    const all = base.concat(hsk4);
    const listWrap = el("div", { class: "word-bank" });
    let page = 1;
    const perPage = 60;
    const matched = [];

    const search = el("input", { class: "input", placeholder: "Search 汉字, pinyin or English…" });
    const levelSel = el("select", { class: "input select" },
      el("option", { value: "all" }, "All lists"),
      el("option", { value: "book" }, "Book words"),
      el("option", { value: "gap" }, "HSK5 exam gap"),
      el("option", { value: "hsk4" }, "HSK4"));
    const statusSel = el("select", { class: "input select" },
      el("option", { value: "all" }, "Any status"),
      el("option", { value: "new" }, "Not introduced"),
      el("option", { value: "learning" }, "Learning"),
      el("option", { value: "review" }, "In review"),
      el("option", { value: "mature" }, "Mature"));
    const lessonSel = el("select", { class: "input select" },
      el("option", { value: "all" }, "Any lesson"),
      D.lessons.map((L) => el("option", { value: String(L.n) }, "Lesson " + L.n + " · " + L.zh)));

    function filtered() {
      const q = search.value.trim().toLowerCase();
      const lv = levelSel.value;
      const st = statusSel.value;
      const lf = lessonSel.value;
      return all.filter((w) => {
        if (lv !== "all" && w.source !== lv) return false;
        if (st !== "all" && HY.srs.statusOf(s, w.w) !== st) return false;
        if (lf !== "all" && w.lesson !== Number(lf)) return false;
        if (!q) return true;
        return (w.w + " " + w.py + " " + w.en).toLowerCase().includes(q);
      });
    }

    function draw() {
      const rows = filtered();
      listWrap.innerHTML = "";
      const pages = Math.max(1, Math.ceil(rows.length / perPage));
      page = Math.min(page, pages);
      const slice = rows.slice((page - 1) * perPage, page * perPage);
      listWrap.appendChild(el("div", { class: "bank-count" }, U.fmtNum(rows.length) + " words" + (rows.length > perPage ? " · page " + page + " of " + pages : "")));
      if (!slice.length) { listWrap.appendChild(C.empty("search" in window ? "inbox" : "inbox", "Nothing matches", "Try a shorter search or clear the filters.")); return; }
      listWrap.appendChild(el("div", { class: "bank-table" },
        el("div", { class: "bank-head" }, el("span", {}, "Word"), el("span", {}, "Reading"), el("span", {}, "Meaning"), el("span", {}, "List"), el("span", {}, "Status"), el("span", {}, "")),
        slice.map((w) => {
          const status = HY.srs.statusOf(s, w.w);
          return el("div", { class: "bank-row", onclick: () => C.wordModal(w.w) },
            el("span", { class: "vr-hanzi", lang: "zh-Hans" }, w.w),
            el("span", { class: "vr-py" }, el("span", { class: "pinyin" }, w.py), el("span", { class: "muted tiny" }, w.pos || "")),
            el("span", { class: "vr-en" }, w.en),
            el("span", {}, w.source === "book" ? "L" + w.lesson : w.source === "gap" ? "Exam" : "HSK4"),
            el("span", { class: "pill pill-" + (status === "mature" ? "jade" : status === "new" ? "muted" : "gold") }, status),
            C.audio(w.w, { rate: s.settings.rate }));
        })));
      if (pages > 1) {
        listWrap.appendChild(el("div", { class: "pager" },
          C.btn("Previous", { kind: "ghost", size: "sm", disabled: page <= 1, onClick: () => { page--; draw(); } }),
          el("span", { class: "muted small" }, "Page " + page + " / " + pages),
          C.btn("Next", { kind: "ghost", size: "sm", disabled: page >= pages, onClick: () => { page++; draw(); } })));
      }
    }

    [search, levelSel, statusSel, lessonSel].forEach((x) => x.addEventListener("input", () => { page = 1; draw(); }));
    draw();

    return C.card({
      title: "Word bank",
      sub: "Every word in the app: 1,367 book words in lesson order, 390 HSK5 exam-gap words, and 598 HSK4 words for refresh.",
      action: el("div", { class: "row gap" }, C.btn("Start review", { kind: "soft", size: "sm", icon: "play", onClick: startReview }))
    },
      el("div", { class: "filters" }, search, levelSel, statusSel, lessonSel),
      listWrap);
  }

  function grammarView() {
    const points = D.lessons.filter((L) => L.content).map((L) => ({ n: L.n, zh: L.zh, ...L.content.grammar }));
    return C.card({ title: "Grammar index", sub: "One HSK5 pattern per lesson, with structure, examples and drills." },
      el("div", { class: "grammar-index" }, points.map((g) =>
        el("a", { class: "grammar-index-row", href: "#/lesson/" + g.n },
          el("span", { class: "gi-n" }, "L" + g.n),
          el("span", { class: "gi-point", lang: "zh-Hans" }, g.point),
          el("span", { class: "gi-en" }, g.point_en),
          U.icon("chevron", 16)))));
  }

  function render() {
    const s = HY.store.state;
    const due = HY.srs.dueCount(s, Date.now());
    const tabsHtml = C.tabs([
      { id: "due", label: "Due", badge: due },
      { id: "bank", label: "Word bank" },
      { id: "grammar", label: "Grammar" }
    ], tab, (id) => { tab = id; HY.app.refresh(); });

    let body;
    if (tab === "bank") body = bankView();
    else if (tab === "grammar") body = grammarView();
    else body = dueView();

    return C.page({
      eyebrow: "Maintenance",
      title: "Review",
      sub: "Recognition, recall and listening are scheduled separately, so a word you can read but cannot type does not disappear.",
      actions: C.btn("Review " + due + " due", { kind: "primary", icon: "play", disabled: !due, onClick: startReview }),
      body: el("div", {}, tabsHtml, el("div", { class: "tab-body" }, body))
    });
  }

  HY.views = HY.views || {};
  HY.views.review = render;
})();

/* Lesson detail: overview, vocabulary, grammar, reading, listening, writing. */
(function () {
  const HY = window.HY;
  const U = HY.util;
  const C = HY.ui;
  const el = U.el;
  const D = HY.data;

  let tab = "overview";
  let lastN = null;
  let query = "";

  function practice(n, stage) {
    const s = HY.store.state;
    if (stage === "vocab") {
      if (!HY.session.unintroduced(s, n).length) {
        C.toast("Every word in this lesson has been introduced. Use Review for maintenance.", "warn");
        return;
      }
    }
    HY.session.buildStage(s, n, stage);
    HY.app.go("/session");
  }

  function stageState(n, stage) {
    const s = HY.store.state;
    const L = D.lessonByN[n];
    if (stage === "vocab") {
      const introduced = L.items.filter((w) => s.words[w]).length;
      return { done: introduced === L.items.length, label: introduced + " / " + L.items.length + " introduced" };
    }
    const done = HY.session.stageDone(s, n, stage);
    const ls = s.lessons[n];
    const score = ls && ls.scores ? ls.scores[stage] : null;
    return { done, label: done ? (score != null ? "Done · " + score + " pt" : "Done") : "Not practised" };
  }

  function stageRow(n, id, icon, title, desc) {
    const st = stageState(n, id);
    return el("div", { class: "stage-row-item" },
      el("div", { class: "stage-icon" }, U.icon(icon, 20)),
      el("div", { class: "stage-copy" },
        el("strong", {}, title),
        el("p", {}, desc),
        el("span", { class: "stage-status" + (st.done ? " done" : "") }, st.label)),
      C.btn(st.done ? "Practise again" : (id === "vocab" ? "Learn words" : "Start"), {
        kind: st.done ? "ghost" : "soft", size: "sm",
        onClick: () => practice(n, id)
      }));
  }

  function overview(L) {
    const c = L.content;
    const s = HY.store.state;
    const official = L.items.filter((w) => D.words[w] && D.words[w].official).length;
    return el("div", { class: "grid cols-2 lesson-overview" },
      C.card({ title: "Lesson shape" },
        el("div", { class: "fact-list" },
          fact("Core words", L.items.length),
          fact("On the official HSK5 list", official),
          fact("Above-level additions", L.items.length - official),
          fact("Grammar focus", c ? c.grammar.point : "—")),
        el("p", { class: "muted small" }, c ? c.theme : ""),
        el("div", { class: "stage-list" },
          stageRow(L.n, "vocab", "book", "Vocabulary", "Learn 36–48 words with audio, pinyin and a quick check. Each word enters spaced review."),
          stageRow(L.n, "grammar", "compass", "Grammar", "One HSK5 pattern, three examples, two drills."),
          stageRow(L.n, "reading", "eye", "Reading", "An original 200–280 character passage using this lesson's words, with three questions."),
          stageRow(L.n, "listening", "headphones", "Listening", "Five dictation sentences. Type what you hear; punctuation is ignored."),
          stageRow(L.n, "writing", "pen", "Writing", "A typed composition task with target words and a model answer."))),
      el("div", { class: "col gap" },
        C.card({ title: "Word preview", action: C.link("All words", "#/lesson/" + L.n) },
          el("div", { class: "word-preview" }, L.items.slice(0, 8).map((w) => {
            const d = D.words[w] || {};
            return el("button", { class: "preview-row", type: "button", onclick: () => C.wordModal(w) },
              el("span", { class: "preview-hanzi", lang: "zh-Hans" }, w),
              el("span", { class: "preview-main" }, el("span", { class: "pinyin" }, d.py || ""), el("span", { class: "muted tiny" }, d.en || "")),
              el("span", { class: "muted tiny" }, d.pos || ""));
          }))),
        C.card({ title: "How to run the lesson", cls: "quiet" },
          el("ol", { class: "numbered small" },
            el("li", {}, "Words first: one sitting introduces 12–15, not all 40."),
            el("li", {}, "Next session, grammar and reading while the words are fresh."),
            el("li", {}, "Listening the following day, then writing."),
            el("li", {}, "Finish the week with the checkpoint when the plan calls for one.")),
          C.btn("Continue this lesson", { kind: "primary", icon: "play", block: true, onClick: () => {
            HY.session.build(s, "lesson");
            HY.app.go("/session");
          } })))
    );
  }

  function vocab(L) {
    const s = HY.store.state;
    const content = L.content;
    const rows = L.items.map((w) => {
      const d = D.words[w] || D.lookup(w) || {};
      const status = HY.srs.statusOf(s, w);
      return el("div", {
        class: "vocab-row", dataset: { w, search: (w + " " + (d.py || "") + " " + (d.en || "")).toLowerCase() },
        onclick: () => C.wordModal(w)
      },
        el("span", { class: "vr-hanzi", lang: "zh-Hans" }, w),
        el("span", { class: "vr-py" }, el("span", { class: "pinyin" }, d.py || ""), el("span", { class: "muted tiny" }, d.pos || "")),
        el("span", { class: "vr-en" }, d.en || ""),
        el("span", { class: "vr-tags" }, d.official ? C.pill("HSK5", "jade") : d.in6 ? C.pill("above", "gold") : C.pill("book", "muted")),
        el("span", { class: "pill pill-" + (status === "mature" ? "jade" : status === "new" ? "muted" : "gold") }, status),
        C.audio(w, { rate: s.settings.rate }));
    });
    const search = el("input", { class: "input", placeholder: "Search this lesson's words…", value: query });
    search.addEventListener("input", () => {
      query = search.value;
      const q = query.trim().toLowerCase();
      rows.forEach((r) => { r.classList.toggle("hidden", !!q && !r.dataset.search.includes(q)); });
    });
    const header = el("div", { class: "vocab-head" },
      el("span", {}, "Word"), el("span", {}, "Pinyin"), el("span", {}, "Meaning"), el("span", {}, ""), el("span", {}, "Status"), el("span", {}, ""));
    return C.card({
      title: "Vocabulary · " + L.items.length + " words",
      sub: content ? "Grammar in this lesson: " + content.grammar.point : "",
      action: el("div", { class: "row gap" },
        C.btn("Learn remaining", { kind: "primary", size: "sm", onClick: () => practice(L.n, "vocab") }))
    },
      el("div", { class: "vocab-tools" }, search),
      el("div", { class: "vocab-table" }, header, rows));
  }

  function grammar(L) {
    const g = L.content.grammar;
    return el("div", { class: "col gap" },
      C.card({ cls: "grammar-card" },
        el("div", { class: "grammar-head" },
          el("div", { class: "grammar-point", lang: "zh-Hans" }, g.point),
          el("div", { class: "grammar-en" }, g.point_en),
          el("div", { class: "structure" }, g.structure)),
        el("p", { class: "explain" }, g.explain_en),
        C.notice("warn", el("span", {}, el("strong", {}, "Common mistake. "), g.common_mistake)),
        el("div", { class: "examples" }, g.examples.map((ex) =>
          el("div", { class: "example-card" },
            el("div", { class: "example-zh", lang: "zh-Hans" }, ex.zh),
            el("div", { class: "pinyin" }, ex.py),
            el("div", { class: "muted" }, ex.en),
            C.audio(ex.zh, { rate: HY.store.state.settings.rate })))),
        el("div", { class: "row gap" }, C.btn("Practise these drills", { kind: "primary", icon: "play", onClick: () => practice(L.n, "grammar") }))),
      C.card({ title: "Drills" }, g.drills.map((dr, i) => {
        const mc = U.mc(dr, "lesson" + L.n + "g" + i);
        return el("details", { class: "drill-static" },
          el("summary", {}, el("span", { class: "drill-n" }, String(i + 1)), el("span", { lang: "zh-Hans" }, dr.q)),
          el("div", { class: "drill-body" },
            el("ol", { class: "plain-list" }, mc.options.map((o, j) => el("li", { class: j === mc.answer ? "correct" : "" }, String.fromCharCode(65 + j) + ". " + o))),
            el("p", { class: "muted small" }, dr.explain)));
      })));
  }

  function reading(L) {
    const r = L.content.reading;
    const translation = el("div", { class: "translation hidden" }, r.translation);
    const toggle = C.btn("Show translation", { kind: "ghost", size: "sm", icon: "eye", onClick: (e) => {
      translation.classList.toggle("hidden");
      e.currentTarget.textContent = translation.classList.contains("hidden") ? "Show translation" : "Hide translation";
    } });
    return C.card({
      title: r.title,
      sub: "Tap any word or character for pinyin, meaning and audio.",
      action: el("div", { class: "row gap" },
        C.btn("Listen", { kind: "soft", size: "sm", icon: "volume", onClick: () => HY.tts.speak(r.text, { rate: HY.store.state.settings.rate }) }),
        toggle)
    },
      C.passage(r.text),
      translation,
      el("div", { class: "divider" }),
      el("div", { class: "questions" }, r.questions.map((q, i) => {
        const mc = U.mc(q, "lesson" + L.n + "r" + i);
        return el("details", { class: "drill-static" },
          el("summary", {}, el("span", { class: "drill-n" }, String(i + 1)), el("span", { lang: "zh-Hans" }, q.q)),
          el("div", { class: "drill-body" },
            el("ol", { class: "plain-list" }, mc.options.map((o, j) => el("li", { class: j === mc.answer ? "correct" : "" }, String.fromCharCode(65 + j) + ". " + o))),
            el("p", { class: "muted small" }, q.explain)));
      })),
      el("div", { class: "row gap" },
        C.btn("Practise reading questions", { kind: "primary", icon: "play", onClick: () => practice(L.n, "reading") })));
  }

  function listening(L) {
    const ls = L.content.listening;
    return C.card({
      title: "Listening · dictation",
      sub: "Five sentences drawn from this lesson's vocabulary and topic."
    },
      el("p", {}, "The app reads each sentence aloud. You type what you hear; punctuation and spaces are ignored. Replay as often as you like, and slow it down when a tone passes too quickly."),
      el("div", { class: "dictation-facts" },
        fact("Sentences", String(ls.dictation.length)),
        fact("Typing", "Simplified Chinese"),
        fact("Feedback", "Character-level diff")),
      el("div", { class: "row gap" },
        C.btn("Start dictation", { kind: "primary", icon: "headphones", onClick: () => practice(L.n, "listening") }),
        C.btn("Listen to the passage", { kind: "soft", icon: "volume", onClick: () => HY.tts.speak(L.content.reading.text, { rate: HY.store.state.settings.rate }) })),
      C.notice("info", "This is also reading-aloud practice for the ear: the same passage returns in the reading tab, so you hear and see the lesson's language twice."));
  }

  function writing(L) {
    const wr = L.content.writing;
    const s = HY.store.state;
    const attempts = s.writing.filter((x) => x.lesson === L.n).slice().reverse();
    return el("div", { class: "col gap" },
      C.card({ title: "Composition task" },
        el("p", { class: "write-prompt" }, wr.prompt),
        el("div", { class: "required-row" }, el("span", { class: "muted small" }, "Target words:"),
          wr.required_words.map((w) => el("span", { class: "chip chip-jade" }, w, el("span", { class: "chip-pinyin" }, (D.lookup(w) || {}).py || "")))),
        el("div", { class: "fact-list compact" },
          fact("Minimum length", wr.min_chars + " characters"),
          fact("Format", "Typed, no handwriting"),
          fact("Feedback", "Model answer + self-rating")),
        el("div", { class: "row gap" },
          C.btn("Start writing", { kind: "primary", icon: "pen", onClick: () => practice(L.n, "writing") }),
          C.btn("Show model after trying", { kind: "ghost", icon: "eye", onClick: (e) => {
            const m = e.currentTarget.closest(".card").querySelector(".model-reveal");
            m.classList.toggle("hidden");
            e.currentTarget.textContent = m.classList.contains("hidden") ? "Show model after trying" : "Hide model";
          } }))),
      C.card({ title: "Attempts" },
        attempts.length ? el("div", { class: "attempt-list" }, attempts.map((a) =>
          el("details", { class: "attempt" },
            el("summary", {},
              el("span", {}, U.fmtDay(a.date, "short")),
              el("span", {}, a.chars + " characters"),
              el("span", {}, (a.requiredUsed || []).length + " / " + (a.required || []).length + " target words"),
              el("span", { class: "muted" }, a.selfScore != null ? ["Needs work", "Meets the task", "Strong"][a.selfScore] : "unrated")),
            el("div", { class: "attempt-body", lang: "zh-Hans" }, a.text)))) :
          C.empty("pen", "No attempts yet", "The writing stage unlocks after you have met the lesson's words. You can start early if you want."),
        el("div", { class: "model-reveal hidden" },
          el("div", { class: "eyebrow" }, "Model answer"),
          el("div", { class: "model-zh", lang: "zh-Hans" }, wr.model),
          el("p", { class: "muted small" }, wr.tips))));
  }

  function fact(label, value) {
    return el("div", { class: "fact" }, el("span", {}, label), el("strong", {}, value));
  }

  function render(n) {
    n = Number(n);
    const L = D.lessonByN[n];
    if (!L) return C.page({ title: "Lesson not found", body: C.empty("book", "No such lesson", "Pick a lesson from the library.") });
    if (lastN !== n) { tab = "overview"; lastN = n; query = ""; }
    const s = HY.store.state;
    const content = L.content;
    const introduced = L.items.filter((w) => s.words[w]).length;
    const stages = ["vocab", "grammar", "reading", "listening", "writing"];
    const done = stages.filter((x) => x === "vocab" ? introduced === L.items.length : HY.session.stageDone(s, n, x)).length;
    const nextStage = stages.find((x) => x === "vocab" ? introduced < L.items.length : !HY.session.stageDone(s, n, x)) || "writing";
    const tabs = [
      { id: "overview", label: "Overview" },
      { id: "vocab", label: "Vocabulary", badge: L.items.length },
      { id: "grammar", label: "Grammar" },
      { id: "reading", label: "Reading" },
      { id: "listening", label: "Listening" },
      { id: "writing", label: "Writing" }
    ];
    let contentNode;
    if (tab === "vocab") contentNode = vocab(L);
    else if (tab === "grammar") contentNode = content ? grammar(L) : C.empty("compass", "Grammar content missing", "Regenerate content.");
    else if (tab === "reading") contentNode = content ? reading(L) : C.empty("eye", "Reading content missing", "");
    else if (tab === "listening") contentNode = content ? listening(L) : C.empty("headphones", "Listening content missing", "");
    else if (tab === "writing") contentNode = content ? writing(L) : C.empty("pen", "Writing content missing", "");
    else contentNode = overview(L);

    return C.page({
      eyebrow: (L.book === 1 ? "上册 · Volume 1" : "下册 · Volume 2") + " · Lesson " + n,
      title: L.zh,
      sub: L.en,
      actions: el("div", { class: "row gap" },
        C.btn("All lessons", { kind: "ghost", icon: "arrowLeft", onClick: () => HY.app.go("/lessons") }),
        C.btn(HY.plan.lessonComplete(s, n) ? "Lesson complete" : "Continue lesson", {
          kind: "primary", icon: HY.plan.lessonComplete(s, n) ? "check" : "play",
          onClick: () => {
            if (HY.plan.lessonComplete(s, n)) { practice(n, nextStage); return; }
            HY.session.build(s, "lesson");
            HY.app.go("/session");
          }
        })),
      wide: true,
      body: el("div", {},
        el("div", { class: "lesson-status-strip" },
          el("div", { class: "ls-main" },
            el("div", { class: "row between" },
              el("span", { class: "muted small" }, introduced + " of " + L.items.length + " words introduced"),
              el("span", { class: "muted small" }, done + " of 5 stages complete")),
            C.progress(done, 5, { tone: "jade", sm: true })),
          C.btn("Practise " + (nextStage === "vocab" ? "new words" : nextStage), {
            kind: "soft", size: "sm", icon: "play", onClick: () => practice(n, nextStage)
          })),
        C.tabs(tabs, tab, (id) => { tab = id; HY.app.refresh(); }),
        el("div", { class: "tab-body" }, contentNode))
    });
  }

  HY.views = HY.views || {};
  HY.views.lesson = render;
})();

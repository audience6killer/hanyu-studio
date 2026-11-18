/* HSK4→5 calibration: short adaptive check, result, refresh deck. */
(function () {
  const HY = window.HY;
  const U = HY.util;
  const C = HY.ui;
  const el = U.el;
  const D = HY.data;

  const RANK = (arr) => arr.slice().sort((a, b) => (b.freq || 0) - (a.freq || 0)); // hardest first

  function pickHsk4(n, rand, exclude) {
    const pool = D.vocab.hsk4.filter((w) =>
      w.w.length >= 2 && !exclude.has(w.w) && !/proper|place|symbol/.test(w.pos || "") &&
      w.en && w.en.length < 70 && (w.freq || 0) > 0);
    const sorted = RANK(pool);
    const bands = [sorted.slice(0, Math.ceil(sorted.length * 0.34)), sorted.slice(Math.ceil(sorted.length * 0.34), Math.ceil(sorted.length * 0.7)), sorted.slice(Math.ceil(sorted.length * 0.7))];
    const out = [];
    let i = 0;
    while (out.length < n) {
      const band = bands[i % 3];
      const cand = band.filter((w) => !out.includes(w) && !exclude.has(w.w));
      if (!cand.length) { i++; if (i > 6) break; continue; }
      const w = cand[Math.floor(rand() * cand.length)];
      out.push(w); exclude.add(w.w); i++;
    }
    return out;
  }

  function meaningItem(w, seed, level) {
    return {
      kind: "meaning", w: w.w, py: w.py, level: level || HY.data.level(w.w),
      options: HY.srs.optionsForMeaning(w.w, 4, seed),
      answer: null, explain: ""
    };
  }

  function makeMeaningItem(w, seed, level) {
    const it = meaningItem(w, seed, level);
    it.answer = it.options.indexOf(w.en);
    if (it.answer < 0) it.answer = 0;
    return it;
  }

  function pinyinItem(w, seed) {
    const opts = HY.srs.optionsForPinyin(w.py, w.w, 4, seed);
    return { kind: "pinyin", w: w.w, level: "hsk4", options: opts, answer: Math.max(0, opts.indexOf(w.py)) };
  }

  function grammarItem(lesson) {
    const content = D.content(lesson);
    if (!content) return null;
    const drill = content.grammar.drills[0];
    const mc = U.mc(drill, "diag-g" + lesson);
    return {
      kind: "grammar", lesson,
      prompt: content.grammar.point,
      q: drill.q, options: mc.options, answer: mc.answer,
      explain: drill.explain
    };
  }

  function buildItems() {
    const rand = U.rng(Date.now() & 0xffffff);
    const exclude = new Set();
    const a = [];
    const ten = pickHsk4(10, rand, exclude);
    ten.forEach((w, i) => a.push(makeMeaningItem(w, 100 + i, "hsk4")));
    const four = pickHsk4(4, rand, exclude).filter((w) => w.py && /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/.test(w.py));
    four.forEach((w, i) => a.push(pinyinItem(w, 200 + i)));
    while (a.length < 14) {
      const extra = pickHsk4(1, rand, exclude);
      if (!extra.length) break;
      a.push(makeMeaningItem(extra[0], 300 + a.length, "hsk4"));
    }
    return { stageA: a, stageB: [], phase: "A", answers: { A: [], B: [] } };
  }

  function stageB(run) {
    const rand = U.rng(U.hash(run.stageA.map((x) => x.w || x.prompt).join("")) + 7);
    const aItems = run.answers.A;
    const aCorrect = aItems.filter((x) => x.correct).length;
    const acc = aItems.length ? aCorrect / aItems.length : 0;
    const items = [];
    if (acc >= 0.55) {
      const pool = D.lessons.filter((l) => l.n <= 8).flatMap((l) => l.items).filter((w) => D.words[w] && D.words[w].official && w.length >= 2);
      const picked = U.uniqBy(U.shuffle(pool, rand).slice(0, 12), (w) => w).slice(0, 5);
      picked.forEach((w, i) => items.push(makeMeaningItem(D.words[w], 400 + i, "book")));
      for (const n of [1, 2, 3, 4]) {
        const g = grammarItem(n);
        if (g) items.push(g);
      }
    } else {
      const exclude = new Set();
      pickHsk4(5, rand, exclude).forEach((w, i) => items.push(makeMeaningItem(w, 500 + i, "hsk4")));
      for (const n of [1, 2]) {
        const g = grammarItem(n);
        if (g) items.push(g);
      }
    }
    run.stageB = items;
    run.phase = "B";
    return items;
  }

  function allItems(run) {
    return run.stageA.concat(run.stageB || []);
  }

  function phaseItems(run) {
    return run.phase === "A" ? run.stageA : (run.stageB || []);
  }

  function currentItem(run) {
    const list = phaseItems(run);
    return list[run.idx] || null;
  }

  function answerFor(run, item) {
    const phase = run.stageA.includes(item) ? "A" : "B";
    const idx = (phase === "A" ? run.stageA : run.stageB).indexOf(item);
    const a = run.answers[phase][idx];
    return a ? a.correct : false;
  }

  function saveRun(run) {
    const s = HY.store.state;
    s.diagnosticRun = run;
    HY.store.save();
  }

  function finish(run) {
    const s = HY.store.state;
    const list = allItems(run);
    const byKind = { meaning: [0, 0], pinyin: [0, 0], grammar: [0, 0] };
    const wrongWords = [];
    list.forEach((it) => {
      const ok = answerFor(run, it);
      if (byKind[it.kind]) { byKind[it.kind][1]++; if (ok) byKind[it.kind][0]++; }
      if (!ok && it.w) wrongWords.push(it.w);
    });
    const hsk4Items = list.filter((it) => it.level === "hsk4");
    const hsk5Items = list.filter((it) => it.level === "book" || it.level === "gap");
    const hsk4Acc = hsk4Items.length ? hsk4Items.filter((it) => answerFor(run, it)).length / hsk4Items.length : 0;
    const hsk5Acc = hsk5Items.length ? hsk5Items.filter((it) => answerFor(run, it)).length / hsk5Items.length : 0;
    const grammarAcc = byKind.grammar[1] ? byKind.grammar[0] / byKind.grammar[1] : 0;
    const correctTotal = list.filter((it) => answerFor(run, it)).length;
    const overall = list.length ? correctTotal / list.length : 0;
    const recommendedLesson = hsk5Acc >= 0.75 ? 3 : hsk5Acc >= 0.45 ? 2 : 1;
    const refresh = U.uniq(wrongWords).slice(0, 60);
    let band = "Rebuild";
    if (overall >= 0.8 && hsk5Acc >= 0.6) band = "Strong retention";
    else if (overall >= 0.65) band = "Solid base, needs reactivation";
    else if (overall >= 0.45) band = "Rusty but recognisable";
    s.diagnostic = {
      date: U.today(), at: Date.now(), total: list.length,
      correct: correctTotal,
      overall, hsk4Acc, hsk5Acc, grammarAcc,
      kinds: byKind, recommendedLesson, refresh, band,
      reviewLoad: overall >= 0.7 ? "standard" : overall >= 0.5 ? "heavy" : "intensive"
    };
    s.diagnosticRun = null;
    if (s.profile) { s.profile.startDate = U.today(); s.plan = HY.plan.generate(s.profile.startDate, s.profile.targetDate, s.profile.dailyMinutes); }
    HY.store.touchConfig();
  }

  function runView() {
    const s = HY.store.state;
    let run = s.diagnosticRun;
    if (!run || Array.isArray(run.answers)) {
      run = buildItems();
      run.idx = 0;
      saveRun(run);
    }
    let advancing = false;

    const root = el("div", { class: "page medium" });
    const header = el("div", { class: "diag-head" });
    const body = el("div", { class: "diag-body" });
    root.appendChild(header);
    root.appendChild(body);

    function totalCount() { return run.stageA.length + (run.stageB || []).length; }
    function globalIndex() { return (run.phase === "A" ? 0 : run.stageA.length) + run.idx; }

    function cleanup() { document.removeEventListener("keydown", onKey); }

    function renderRun() {
      header.innerHTML = "";
      body.innerHTML = "";
      const item = currentItem(run);
      if (!item) { finish(run); cleanup(); HY.app.go("/diagnostic"); return; }
      const total = totalCount();
      header.appendChild(el("div", { class: "diag-top" },
        el("div", {},
          el("div", { class: "eyebrow" }, "Calibration · " + (run.phase === "A" ? "HSK4 recall" : "HSK5 preview")),
          el("h1", { class: "page-title small" }, "Question " + (globalIndex() + 1) + " of " + total)),
        C.btn("Exit", { kind: "ghost", onClick: () => { cleanup(); HY.app.go("/home"); } })));
      header.appendChild(C.progress(globalIndex(), total, { sm: true }));

      const card = el("div", { class: "card diag-card" });
      const inner = el("div", { class: "card-body" });
      card.appendChild(inner);
      body.appendChild(card);

      if (item.kind === "grammar") {
        inner.appendChild(el("div", { class: "eyebrow" }, "Grammar in context"));
        inner.appendChild(el("div", { class: "diag-q-text", lang: "zh-Hans" }, item.q));
        inner.appendChild(C.optionButtons(item.options, {
          answer: item.answer,
          onPick: (ok) => note(ok, item.explain)
        }));
      } else if (item.kind === "pinyin") {
        inner.appendChild(el("div", { class: "eyebrow" }, "Choose the pinyin"));
        inner.appendChild(el("div", { class: "diag-hanzi", lang: "zh-Hans" }, item.w));
        inner.appendChild(C.optionButtons(item.options, {
          answer: item.answer,
          onPick: (ok) => note(ok, ok ? "" : "Correct pinyin: " + (D.lookup(item.w) || {}).py)
        }));
      } else {
        inner.appendChild(el("div", { class: "eyebrow" }, item.level === "hsk4" ? "HSK4 vocabulary" : "HSK5 preview"));
        inner.appendChild(el("div", { class: "diag-hanzi", lang: "zh-Hans" }, item.w));
        inner.appendChild(el("div", { class: "diag-sub" }, "What does it mean?"));
        inner.appendChild(C.optionButtons(item.options, {
          answer: item.answer,
          onPick: (ok) => note(ok, ok ? "" : "Meaning: " + (D.lookup(item.w) || {}).en)
        }));
      }
    }

    function note(ok, explain) {
      run.answers[run.phase][run.idx] = { correct: ok, w: currentItem(run).w };
      saveRun(run);
      const card = body.querySelector(".card-body");
      if (!card) return;
      const f = el("div", { class: "diag-feedback " + (ok ? "ok" : "bad") },
        el("strong", {}, ok ? "Correct." : "Not quite."),
        explain ? el("span", {}, " " + explain) : null);
      card.appendChild(f);
      const last = run.idx + 1 >= phaseItems(run).length;
      const next = C.btn(last ? "See result" : "Next", { kind: "primary", onClick: advance });
      card.appendChild(el("div", { class: "row end gap" }, next));
      next.focus();
    }

    function advance() {
      if (advancing) return;
      advancing = true;
      const list = phaseItems(run);
      if (run.phase === "A" && run.idx + 1 >= list.length) {
        stageB(run);
        run.idx = 0;
        saveRun(run);
        advancing = false;
        renderRun();
        return;
      }
      if (run.idx + 1 >= list.length) {
        finish(run);
        cleanup();
        HY.app.go("/diagnostic");
        return;
      }
      run.idx++;
      saveRun(run);
      advancing = false;
      renderRun();
    }

    function onKey(e) {
      if (!root.isConnected) { cleanup(); return; }
      if (/input|textarea|select/i.test(e.target.tagName || "")) return;
      if (e.key >= "1" && e.key <= "4") {
        const opts = Array.from(body.querySelectorAll(".mc-option"));
        const b = opts[Number(e.key) - 1];
        if (b && !b.classList.contains("is-locked")) b.click();
      } else if (e.key === "Enter") {
        const btn = body.querySelector(".row.end button");
        if (btn) { e.preventDefault(); btn.click(); }
      }
    }
    document.addEventListener("keydown", onKey);
    renderRun();
    return root;
  }

  function resultView() {
    const s = HY.store.state;
    const d = s.diagnostic;
    const overall = Math.round((d.overall || 0) * 100);
    const h4 = Math.round((d.hsk4Acc || 0) * 100);
    const h5 = Math.round((d.hsk5Acc || 0) * 100);
    const gr = Math.round((d.grammarAcc || 0) * 100);
    return C.page({
      eyebrow: "Calibration result",
      title: d.band,
      sub: "Measured " + U.fmtDay(d.date, "short") + " · " + d.correct + " of " + d.total + " correct",
      actions: C.btn("Retake", { kind: "ghost", icon: "refresh", onClick: () => { HY.store.state.diagnostic = null; HY.store.save(); HY.app.go("/diagnostic"); } }),
      body: el("div", { class: "grid cols-2" },
        C.card({ title: "Where you stand" },
          el("div", { class: "ring-row" },
            C.ring(overall, 110, overall + "%", "overall"),
            el("div", { class: "ring-legend" },
              ringRow("HSK4 recall", h4, "jade"),
              ringRow("HSK5 preview", h5, "gold"),
              ringRow("Grammar", gr, "red")))),
        C.card({ title: "What this changes" },
          el("div", { class: "fact-list" },
            fact("Suggested start", "Lesson " + d.recommendedLesson),
            fact("Refresh deck", d.refresh.length + " rusty HSK4 words"),
            fact("Review load", d.reviewLoad),
            fact("Daily target", "15 new words, then adapt")),
          el("p", { class: "muted small" }, "Rusty HSK4 words are mixed into the first three weeks of new-word time. The plan still begins with Lesson 1; if the first units feel too easy, open a later lesson directly from the library.")),
        C.card({ title: "The first two weeks", cls: "span-2" },
          el("div", { class: "timeline" },
            el("div", { class: "tl-row" }, el("span", { class: "tl-week" }, "Week 1"), el("div", {}, el("strong", {}, "Reactivation + Lesson 1"), el("p", {}, "Short reviews, 12–15 new words a session, grammar and the first reading."))),
            el("div", { class: "tl-row" }, el("span", { class: "tl-week" }, "Week 2"), el("div", {}, el("strong", {}, "Lesson 2–3"), el("p", {}, "Listening dictation joins the mix. Writing starts once you have a lesson's words in memory."))),
            el("div", { class: "tl-row" }, el("span", { class: "tl-week" }, "Week 5"), el("div", {}, el("strong", {}, "First checkpoint"), el("p", {}, "A timed, auto-assembled test over lessons 1–6: listening, reading, grammar, one composition.")))),
          el("div", { class: "row gap" },
            C.btn("Open today", { kind: "primary", icon: "arrowRight", onClick: () => HY.app.go("/home") }),
            C.btn("Review the plan", { kind: "ghost", icon: "calendar", onClick: () => HY.app.go("/stats") })))
      )
    });
  }

  function ringRow(label, pct, tone) {
    return el("div", { class: "ring-row-line" }, el("span", {}, label), el("div", { class: "mini-bar" }, el("div", { class: "mini-bar-fill tone-" + tone, style: { width: pct + "%" } })), el("strong", {}, pct + "%"));
  }

  function fact(label, value) {
    return el("div", { class: "fact" }, el("span", {}, label), el("strong", {}, value));
  }

  function introView() {
    const s = HY.store.state;
    return C.page({
      eyebrow: "Calibration",
      title: "Find your real starting point",
      sub: "About fifteen minutes. No score is shown to anyone; the point is to spend your next six months on the right words.",
      body: el("div", { class: "grid cols-2" },
        C.card({ title: "What happens" },
          el("ol", { class: "numbered" },
            el("li", {}, "Ten HSK4 words and four pinyin checks — recognition, not production."),
            el("li", {}, "If HSK4 recall holds up, five early HSK5 words and four grammar-in-context items."),
            el("li", {}, "Missed words go into a short refresh deck mixed into the first three weeks."),
            el("li", {}, "Your starting lesson and review load are set. You can retake this any time."))),
        C.card({ title: "Before you start" },
          el("p", {}, "Sit somewhere quiet for fifteen minutes. No notes, no dictionary — a guess is more useful than a lookup."),
          el("p", { class: "muted small" }, "The check adapts once: strong HSK4 recall unlocks the HSK5 preview. If it goes badly, the second half stays at HSK4 level."),
          C.btn("Begin calibration", { kind: "primary", icon: "play", onClick: () => { HY.store.state.diagnosticRun = null; HY.store.save(); rerenderRun(); } })))
    });
  }

  function rerenderRun() {
    const outlet = U.$("#view");
    if (!outlet) return;
    outlet.innerHTML = "";
    outlet.appendChild(runView());
  }

  function render() {
    const s = HY.store.state;
    if (!s.profile) { location.hash = "#/onboarding"; return el("div"); }
    if (s.diagnosticRun) return runView();
    if (s.diagnostic) return resultView();
    return introView();
  }

  HY.views = HY.views || {};
  HY.views.diagnostic = render;
})();

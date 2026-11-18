/* Timed checkpoint tests and report. */
(function () {
  const HY = window.HY;
  const U = HY.util;
  const C = HY.ui;
  const el = U.el;
  const D = HY.data;

  const FORMAT = [
    { id: "listening", label: "Listening", minutes: 8 },
    { id: "reading", label: "Reading", minutes: 22 },
    { id: "writing", label: "Writing", minutes: 15 }
  ];

  function avail(state, cp) {
    const done = HY.plan.completedLessons(state);
    return done >= cp.afterLesson;
  }

  function covered(state, cp) {
    const done = HY.plan.completedLessons(state);
    return Math.max(1, Math.min(cp.afterLesson, done + 2));
  }

  function sample(list, n) {
    return U.shuffle(list).slice(0, n);
  }

  function buildExam(state, cp) {
    const upTo = covered(state, cp);
    const lessons = D.lessons.filter((L) => L.n <= upTo && L.content);
    const vocabPool = U.uniqBy(lessons.flatMap((L) => L.items).filter((w) => D.words[w] && D.words[w].en), (w) => w);
    const used = new Set();
    const items = [];

    function vocabItem(section, w) {
      const seed = U.hash(cp.week + section + w);
      const opts = HY.srs.optionsForMeaning(w, 4, seed);
      return {
        section, kind: "vocab", w, options: opts,
        answer: Math.max(0, opts.indexOf(D.words[w].en))
      };
    }

    // Listening: 5 words + one passage with 2 questions
    sample(vocabPool, 5).forEach((w) => { used.add(w); items.push(vocabItem("listening", w)); });
    const listeningLesson = sample(lessons, 1)[0];
    if (listeningLesson) {
      const qs = sample(listeningLesson.content.reading.questions, 2);
      qs.forEach((q, qi) => {
        const mc = U.mc(q, "exam-listening-" + listeningLesson.n + "-" + qi);
        items.push({
          section: "listening", kind: "passage", text: listeningLesson.content.reading.text,
          title: listeningLesson.content.reading.title, q: q.q, options: mc.options,
          answer: mc.answer, explain: q.explain
        });
      });
    }

    // Reading: vocab 6, grammar 5, passages 2x2
    sample(vocabPool.filter((w) => !used.has(w)), 6).forEach((w) => { used.add(w); items.push(vocabItem("reading", w)); });
    const drills = [];
    lessons.forEach((L) => L.content.grammar.drills.forEach((d) => drills.push({ L, d })));
    sample(drills, 5).forEach(({ L, d }) => {
      const mc = U.mc(d, "exam-grammar-" + L.n);
      items.push({
        section: "reading", kind: "grammar", lesson: L.n, q: d.q, options: mc.options,
        answer: mc.answer, explain: d.explain
      });
    });
    sample(lessons, 2).forEach((L) => {
      sample(L.content.reading.questions, 2).forEach((q, qi) => {
        const mc = U.mc(q, "exam-reading-" + L.n + "-" + qi);
        items.push({
          section: "reading", kind: "passage", text: L.content.reading.text, title: L.content.reading.title,
          q: q.q, options: mc.options, answer: mc.answer, explain: q.explain
        });
      });
    });

    // Writing: one prompt from the covered range
    const wl = sample(lessons, 1)[0];
    if (wl) {
      items.push({
        section: "writing", kind: "write", lesson: wl.n,
        prompt: wl.content.writing.prompt, required: wl.content.writing.required_words.slice(),
        min: wl.content.writing.min_chars
      });
    }

    let start = 0;
    const sections = FORMAT.map((f) => {
      const count = items.filter((i) => i.section === f.id).length;
      const sec = Object.assign({}, f, { start, count, endsAt: 0 });
      start += count;
      return sec;
    });
    const run = {
      week: cp.week, afterLesson: cp.afterLesson, type: cp.type || "checkpoint",
      label: (cp.type === "final" ? "Final mock" : "Checkpoint") + " · lessons 1–" + upTo,
      upTo, items, sections, answers: {}, section: 0, idx: 0,
      startedAt: Date.now(), done: false, score: null,
      sectionStartedAt: Date.now(), sectionEndsAt: 0
    };
    run.sectionEndsAt = Date.now() + sections[0].minutes * 60000;
    return run;
  }

  /* ---------------- overview ---------------- */
  function overview() {
    const s = HY.store.state;
    const completed = HY.plan.completedLessons(s);
    const cps = (s.plan ? s.plan.checkpoints : []).map((c) => {
      const done = s.exams.filter((e) => e.week === c.week);
      const isAvail = avail(s, c);
      return { c, done, isAvail };
    });
    return C.page({
      eyebrow: "Exams",
      title: "Checkpoints, not guesswork",
      sub: "Every fifth or sixth lesson, a timed test assembled from what you have actually studied. Scores are indicative — this is not an official HSK paper.",
      body: el("div", {},
        el("div", { class: "grid cols-2" },
        C.card({ title: "What a checkpoint contains" },
          el("div", { class: "fact-list" },
            fact("Listening", "7 items · 8 min"),
            fact("Reading", "15 items · 22 min"),
            fact("Writing", "1 composition · 15 min"),
            fact("Total", "45 min, auto-timed")),
          el("p", { class: "muted small" }, "The real HSK5 runs about two hours: 45 listening items, 45 reading items and a short composition. These checkpoints sample the same skills at a fraction of the length so they fit a work break."),
          C.notice("info", "Listening plays through your browser's Mandarin voice; reading passages are drawn from your lesson content; writing uses a lesson prompt and target words.")),
        C.card({ title: "This week" },
          el("p", {}, completed + " lessons complete. " + (s.exams.length ? s.exams.length + " checkpoints taken so far." : "No checkpoints taken yet.")),
          el("div", { class: "row gap" },
            C.btn("Open progress", { kind: "ghost", icon: "chart", onClick: () => HY.app.go("/stats") })))),
      el("div", { class: "checkpoint-list" }, cps.map(({ c, done, isAvail }) =>
        el("div", { class: "checkpoint" + (done.length ? " done" : isAvail ? " open" : " locked") },
          el("div", { class: "cp-week" }, el("span", { class: "eyebrow" }, "Week " + c.week), el("strong", {}, c.type === "final" ? "Final mock" : "Checkpoint")),
          el("div", { class: "cp-body" },
            el("div", { class: "cp-title" }, "Lessons 1–" + c.afterLesson),
            el("div", { class: "muted small" }, done.length ? "Taken " + U.fmtDay(done[0].date, "short") + " · " + done[0].score + "%" : isAvail ? "Available now" : "Opens after lesson " + c.afterLesson)),
          done.length ? C.pill(done[0].score + "%", done[0].score >= 65 ? "jade" : "red") : null,
          C.btn(done.length ? "Retake" : "Start", {
            kind: isAvail ? "primary" : "ghost", size: "sm", disabled: !isAvail,
            onClick: () => {
              if (!isAvail) return;
              s.examRun = buildExam(s, c);
              HY.store.save();
              HY.app.refresh();
            }
          })))),
      s.exams.length ? C.card({ title: "History", cls: "quiet" },
        el("div", { class: "exam-history" }, s.exams.slice().reverse().map((e) =>
          el("div", { class: "exam-hist-row" },
            el("span", {}, U.fmtDay(e.date, "short")),
            el("span", {}, "W" + e.week + " · lessons 1–" + e.afterLesson),
            el("strong", { class: e.score >= 65 ? "ok-text" : "bad-text" }, e.score + "%"),
            el("span", { class: "muted small" }, "L " + e.sections.listening.correct + "/" + e.sections.listening.total + " · R " + e.sections.reading.correct + "/" + e.sections.reading.total + " · W " + e.sections.writing.score + "/" + e.sections.writing.total))))) : null
    )});
  }

  function fact(label, value) {
    return el("div", { class: "fact" }, el("span", {}, label), el("strong", {}, value));
  }

  /* ---------------- runner ---------------- */
  function runner() {
    const s = HY.store.state;
    const run = s.examRun;
    let timerId = null;
    const root = el("div", { class: "exam-run page" });
    const header = el("div", { class: "exam-header" });
    const body = el("div", { class: "exam-body" });
    const foot = el("div", { class: "exam-foot" });
    root.appendChild(header); root.appendChild(body); root.appendChild(foot);

    function sectionDef() { return run.sections[run.section]; }
    function current() { return run.items[run.idx]; }
    function remaining() { return Math.max(0, run.sectionEndsAt - Date.now()); }

    function drawHeader() {
      header.innerHTML = "";
      const sec = sectionDef();
      header.appendChild(el("div", { class: "exam-top" },
        el("div", {},
          el("div", { class: "eyebrow" }, run.label + " · 45 minutes"),
          el("h1", { class: "page-title small" }, sec.label)),
        el("div", { class: "exam-timer" + (remaining() < 60000 ? " critical" : "") },
          el("span", { class: "muted tiny" }, "section time"),
          el("strong", { id: "exam-timer" }, C.timer(remaining() / 1000)))));
      header.appendChild(el("div", { class: "exam-section-tabs" }, run.sections.map((x, i) =>
        el("span", { class: "exam-sec-tab" + (i === run.section ? " active" : "") + (i < run.section ? " done" : "") }, x.label))));
      header.appendChild(el("div", { class: "exam-progress-line" },
        el("span", { class: "muted tiny" }, (run.idx - sec.start + 1) + " / " + sec.count + " in section · " + Object.keys(run.answers).length + " answered overall"),
        C.progress(run.idx - sec.start + (run.answers[run.idx] != null ? 1 : 0), sec.count, { sm: true })));
    }

    function drawBody() {
      body.innerHTML = "";
      const it = current();
      if (!it) return;
      const card = el("div", { class: "card exam-card" });
      const inner = el("div", { class: "card-body" });
      card.appendChild(inner);
      body.appendChild(card);

      if (it.kind === "vocab" && it.section === "listening") {
        inner.appendChild(el("div", { class: "eyebrow" }, "Listening · choose the meaning"));
        const audio = C.audio(it.w, { rate: s.settings.rate });
        inner.appendChild(el("div", { class: "audio-stage" }, audio, el("span", { class: "muted" }, "One word. Replay if needed.")));
        setTimeout(() => HY.tts.speak(it.w, { rate: s.settings.rate }), 300);
        inner.appendChild(mcOptions(it));
      } else if (it.kind === "vocab") {
        inner.appendChild(el("div", { class: "eyebrow" }, "Reading · choose the meaning"));
        inner.appendChild(el("div", { class: "prompt-hanzi", lang: "zh-Hans" }, it.w));
        inner.appendChild(mcOptions(it));
      } else if (it.kind === "grammar") {
        inner.appendChild(el("div", { class: "eyebrow" }, "Reading · grammar in context · Lesson " + it.lesson));
        inner.appendChild(el("div", { class: "drill-q", lang: "zh-Hans" }, it.q));
        inner.appendChild(mcOptions(it));
      } else if (it.kind === "passage") {
        if (it.section === "listening") {
          inner.appendChild(el("div", { class: "eyebrow" }, "Listening · passage"));
          inner.appendChild(el("div", { class: "audio-stage" }, C.audio(it.text, { rate: s.settings.rate }), el("span", { class: "muted" }, "Listen, then answer.")));
          setTimeout(() => HY.tts.speak(it.text, { rate: s.settings.rate }), 300);
        } else {
          inner.appendChild(el("div", { class: "eyebrow" }, "Reading · " + it.title));
          inner.appendChild(el("div", { class: "passage exam-passage", lang: "zh-Hans" }, (it.text || "").split("\n").map((p) => el("p", {}, p))));
        }
        inner.appendChild(el("div", { class: "drill-q", lang: "zh-Hans" }, it.q));
        inner.appendChild(mcOptions(it));
      } else if (it.kind === "write") {
        inner.appendChild(el("div", { class: "eyebrow" }, "Writing · composition"));
        inner.appendChild(el("p", { class: "write-prompt" }, it.prompt));
        inner.appendChild(el("div", { class: "required-row" }, el("span", { class: "muted small" }, "Use:"),
          it.required.map((w) => el("span", { class: "chip chip-jade" }, w))));
        const ta = el("textarea", { class: "input writing-area hanzi", rows: "8", lang: "zh-Hans", placeholder: "输入你的作文…" });
        ta.value = run.answers[run.idx] || "";
        const counter = el("span", { class: "char-count" }, U.cjkCount(ta.value) + " 字");
        ta.addEventListener("input", () => {
          run.answers[run.idx] = ta.value;
          counter.textContent = U.cjkCount(ta.value) + " 字";
          HY.store.save();
        });
        inner.appendChild(ta);
        inner.appendChild(el("div", { class: "row between write-meta" }, counter,
          el("span", { class: "muted tiny" }, "Target " + it.min + " characters · timed section")));
      }
    }

    function mcOptions(it) {
      const wrap = el("div", { class: "mc-options exam-mc" });
      it.options.forEach((opt, i) => {
        const b = el("button", {
          class: "mc-option" + (run.answers[run.idx] === i ? " selected" : ""),
          type: "button",
          onclick: () => {
            run.answers[run.idx] = i;
            HY.store.save();
            drawBody();
            drawHeader();
          }
        }, el("span", { class: "mc-key", text: "ABCD"[i] }), el("span", { class: "mc-text" }, opt));
        wrap.appendChild(b);
      });
      return wrap;
    }

    function drawFoot() {
      foot.innerHTML = "";
      const sec = sectionDef();
      const atStart = run.idx === sec.start;
      const atEnd = run.idx === sec.start + sec.count - 1;
      foot.appendChild(el("div", { class: "row between exam-nav" },
        el("div", { class: "row gap" },
          C.btn("Previous", { kind: "ghost", disabled: atStart, onClick: () => go(-1) }),
          el("button", { class: "link-btn", type: "button", onclick: () => confirmExit() }, "Leave test")),
        el("div", { class: "row gap" },
          atEnd ? C.btn(sec.id === "writing" ? "Submit test" : "Finish section", { kind: "primary", icon: "arrowRight", onClick: nextSection })
            : C.btn("Next", { kind: "primary", icon: "arrowRight", onClick: () => go(1) }))));
    }

    function go(delta) {
      const sec = sectionDef();
      const target = run.idx + delta;
      if (target < sec.start || target >= sec.start + sec.count) return;
      run.idx = target;
      HY.store.save();
      drawHeader(); drawBody(); drawFoot();
      window.scrollTo(0, 0);
    }

    function nextSection() {
      if (run.section >= run.sections.length - 1) return submit();
      run.section++;
      const sec = sectionDef();
      run.idx = sec.start;
      run.sectionStartedAt = Date.now();
      run.sectionEndsAt = Date.now() + sec.minutes * 60000;
      HY.store.save();
      drawHeader(); drawBody(); drawFoot();
      window.scrollTo(0, 0);
      C.toast(sec.label + " section started — " + sec.minutes + " minutes.");
    }

    function confirmExit() {
      C.confirm("Leave this test?", "Your answers are kept, but the clock will keep running when you return. Abandoned tests cannot be scored.", "Leave").then((ok) => {
        if (ok) { HY.store.save(); HY.app.go("/exam"); }
      });
    }

    function submit() {
      const unanswered = run.items.filter((it, i) => it.kind !== "write" && run.answers[i] == null).length;
      C.confirm("Submit this test?", unanswered ? unanswered + " questions are unanswered. Submit anyway?" : "Your answers are final.", "Submit").then((ok) => {
        if (!ok) return;
        gradeRun(run, s);
        HY.app.refresh();
      });
    }

    function tick() {
      if (!root.isConnected) { if (timerId) clearInterval(timerId); return; }
      const elT = U.$("#exam-timer");
      if (!elT) return;
      const ms = remaining();
      elT.textContent = C.timer(ms / 1000);
      elT.parentElement.classList.toggle("critical", ms < 60000);
      if (ms <= 0) {
        if (run.section < run.sections.length - 1) {
          C.toast("Section time is up. Moving on.", "warn");
          nextSection();
        }
      }
    }

    if (run.done) return report(run);
    drawHeader(); drawBody(); drawFoot();
    document.addEventListener("keydown", (e) => {
      if (!root.isConnected) return;
      if (/input|textarea|select/i.test(e.target.tagName || "")) return;
      if (/^[1-4]$/.test(e.key)) {
        const opts = root.querySelectorAll(".exam-body .mc-option");
        const b = opts[Number(e.key) - 1];
        if (b) b.click();
      } else if (e.key === "Enter") {
        const b = root.querySelector(".exam-foot .btn-primary");
        if (b) { e.preventDefault(); b.click(); }
      }
    });
    timerId = setInterval(tick, 1000);
    return root;
  }

  function gradeRun(run, s) {
    const sections = {
      listening: { correct: 0, total: 0 },
      reading: { correct: 0, total: 0 },
      writing: { correct: 0, total: 0, score: 0, chars: 0, required: 0 }
    };
    run.items.forEach((it, i) => {
      if (it.section === "writing") return;
      sections[it.section].total++;
      if (run.answers[i] === it.answer) sections[it.section].correct++;
    });
    const writeItem = run.items.find((x) => x.kind === "write");
    const wr = writeItem ? run.answers[run.items.indexOf(writeItem)] || "" : "";
    const chars = U.cjkCount(wr);
    if (writeItem) {
      sections.writing.total = 25;
      const lengthScore = Math.min(10, Math.round((chars / Math.max(1, writeItem.min)) * 10));
      const used = writeItem.required.filter((w) => wr.includes(w)).length;
      const reqScore = Math.round((used / Math.max(1, writeItem.required.length)) * 10);
      const sentScore = Math.min(5, U.splitSentences(wr).length >= 3 ? 5 : U.splitSentences(wr).length);
      sections.writing.score = lengthScore + reqScore + sentScore;
      sections.writing.correct = sections.writing.score;
      sections.writing.chars = chars;
      sections.writing.required = used;
      sections.writing.requiredTotal = writeItem.required.length;
    }
    const lp = sections.listening.total ? (sections.listening.correct / sections.listening.total) * 100 : 0;
    const rp = sections.reading.total ? (sections.reading.correct / sections.reading.total) * 100 : 0;
    const wp = sections.writing.total ? (sections.writing.score / sections.writing.total) * 100 : 0;
    const score = Math.round(lp * 0.3 + rp * 0.45 + wp * 0.25);
    run.done = true;
    run.score = score;
    run.graded = { sections, lp, rp, wp };
    s.exams.push({
      date: U.today(), at: Date.now(), week: run.week, afterLesson: run.afterLesson,
      type: run.type, score, sections: JSON.parse(JSON.stringify(sections))
    });
    if (s.exams.length > 40) s.exams.shift();
    HY.store.logActivity({ minutes: 45, reviews: 0, newWords: 0, correct: sections.listening.correct + sections.reading.correct, total: sections.listening.total + sections.reading.total, kind: "exam" });
    HY.store.save(true);
  }

  function band(score) {
    if (score >= 80) return { label: "Strong", tone: "jade", note: "This is comfortably above the checkpoints' pass line. Keep the same rhythm." };
    if (score >= 65) return { label: "On track", tone: "jade", note: "Solid. Focus on the weakest section and keep reviews current." };
    if (score >= 50) return { label: "Developing", tone: "gold", note: "The base is there but not yet reliable. Slow new words slightly and revisit weak lessons." };
    return { label: "Not yet", tone: "red", note: "Treat this as information, not a verdict. Return to the lesson stages behind this test before adding more words." };
  }

  function report(run) {
    const s = HY.store.state;
    const g = run.graded || (s.exams.length ? s.exams[s.exams.length - 1].sections : null);
    if (!run.graded) {
      const last = s.exams[s.exams.length - 1];
      if (!last) return overview();
      run.graded = { sections: last.sections, lp: (last.sections.listening.correct / last.sections.listening.total) * 100, rp: (last.sections.reading.correct / last.sections.reading.total) * 100, wp: (last.sections.writing.score / 25) * 100 };
      run.score = last.score;
    }
    const b = band(run.score);
    return C.page({
      eyebrow: run.label,
      title: "Score: " + run.score + "%",
      sub: b.note,
      actions: el("div", { class: "row gap" },
        C.btn("Mark done", { kind: "ghost", onClick: () => { s.examRun = null; HY.store.save(); HY.app.go("/home"); } }),
        C.btn("Back to checkpoints", { kind: "primary", onClick: () => { s.examRun = null; HY.store.save(); HY.app.go("/exam"); } })),
      body: el("div", {},
        el("div", { class: "grid cols-2" },
        C.card({ title: "Sections" },
          el("div", { class: "section-scores" },
            scoreRow("Listening", g.sections.listening.correct, g.sections.listening.total, Math.round(g.lp)),
            scoreRow("Reading", g.sections.reading.correct, g.sections.reading.total, Math.round(g.rp)),
            scoreRow("Writing", g.sections.writing.score, g.sections.writing.total, Math.round(g.wp))),
          el("div", { class: "callout callout-info" },
            el("strong", {}, "Writing: " + g.sections.writing.chars + " characters, " + g.sections.writing.required + "/" + (g.sections.writing.requiredTotal || 4) + " target words. "),
            "The writing score is a heuristic: length, target-word coverage and sentence count. Ask a tutor or a language partner to check style separately.")),
        C.card({ title: "What to do next" },
          el("p", {}, b.label === "Strong" ? "Move on to the next lessons and keep the checkpoint schedule." : b.label === "Not yet" ? "Review the lesson stages behind this checkpoint, especially vocabulary recall and listening." : "Target your weakest section in the next two sessions."),
          el("div", { class: "row gap" },
            C.btn("Review now", { kind: "soft", icon: "cards", onClick: () => { s.examRun = null; HY.store.save(); HY.app.go("/review"); } }),
            C.btn("Open lessons", { kind: "ghost", icon: "book", onClick: () => { s.examRun = null; HY.store.save(); HY.app.go("/lessons"); } })))),
      el("div", { class: "exam-review" },
        el("div", { class: "eyebrow" }, "Item review"),
        run.items.map((it, i) => {
          if (it.kind === "write") return null;
          const correct = run.answers[i] === it.answer;
          return el("details", { class: "exam-review-row " + (correct ? "ok" : "bad") },
            el("summary", {},
              el("span", { class: "pill " + (correct ? "pill-jade" : "pill-red") }, correct ? "✓" : "✗"),
              el("span", { class: "er-sec" }, it.section === "listening" ? "Listening" : "Reading"),
              el("span", { class: "er-q", lang: "zh-Hans" }, it.kind === "vocab" ? (it.section === "listening" ? it.w : it.w) : it.q),
              el("span", { class: "muted tiny" }, "your answer: " + (run.answers[i] != null ? it.options[run.answers[i]] : "blank"))),
            el("div", { class: "er-body" },
              el("div", { class: "muted small" }, "Correct: " + it.options[it.answer]),
              it.explain ? el("p", { class: "muted small" }, it.explain) : null,
              it.kind === "passage" ? el("div", { class: "passage small", lang: "zh-Hans" }, it.text) : null));
        }))
    )});
  }

  function scoreRow(label, correct, total, pct) {
    return el("div", { class: "score-row" },
      el("span", {}, label),
      el("div", { class: "mini-bar" }, el("div", { class: "mini-bar-fill tone-" + (pct >= 65 ? "jade" : pct >= 50 ? "gold" : "red"), style: { width: pct + "%" } })),
      el("strong", {}, correct + " / " + total),
      el("span", { class: "muted small" }, pct + "%"));
  }

  function render() {
    const s = HY.store.state;
    if (s.examRun) return runner();
    return overview();
  }

  HY.views = HY.views || {};
  HY.views.exam = render;
})();

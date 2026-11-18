/* Guided study session: reviews, new words and one lesson stage. */
(function () {
  const HY = window.HY;
  const U = HY.util;
  const C = HY.ui;
  const el = U.el;
  const D = HY.data;

  function view() {
    const s = HY.store.state;
    let cur = HY.session.current(s);
    if (!cur) {
      cur = s.current;
      if (cur && cur.done) return summary(cur);
      return startEmpty();
    }
    if (cur.done) return summary(cur);
    if (!cur.items.length) return emptyRun();
    return runner(cur);
  }

  function emptyRun() {
    const s = HY.store.state;
    return C.page({
      eyebrow: "Session",
      title: "Nothing queued",
      sub: "Reviews are clear, the current lesson has no new words waiting, and the next stage is complete. Take a checkpoint or read a lesson passage instead.",
      body: el("div", { class: "grid cols-2" },
        C.card({ title: "Keep the streak" },
          el("p", {}, "A short free review still counts. Or open the next lesson and read it once for pleasure."),
          el("div", { class: "row gap" },
            C.btn("Word bank", { kind: "soft", icon: "cards", onClick: () => HY.app.go("/review") }),
            C.btn("Lessons", { kind: "primary", icon: "book", onClick: () => HY.app.go("/lessons") }))),
        C.card({ title: "Checkpoints" },
          el("p", {}, "A timed test over the lessons you have finished."),
          C.btn("Open exams", { kind: "soft", icon: "target", onClick: () => HY.app.go("/exam") })))
    });
  }

  function startEmpty() {
    return C.page({
      title: "Nothing queued",
      sub: "There are no reviews due and no session was started. Pick an entry point.",
      body: el("div", { class: "grid cols-2" },
        C.card({ title: "Start today's session" }, el("p", {}, "Reviews, new words and one lesson stage."),
          C.btn("Start session", { kind: "primary", icon: "play", onClick: () => { HY.session.build(HY.store.state, "daily"); HY.app.refresh(); } })),
        C.card({ title: "Free practice" },
          el("div", { class: "col gap" },
            C.btn("Browse lessons", { kind: "soft", icon: "book", onClick: () => HY.app.go("/lessons") }),
            C.btn("Open review hub", { kind: "soft", icon: "cards", onClick: () => HY.app.go("/review") }),
            C.btn("Take a checkpoint", { kind: "soft", icon: "target", onClick: () => HY.app.go("/exam") }))))
    });
  }

  function runner(cur) {
    const s = HY.store.state;
    const root = el("div", { class: "session" });
    let timerId = null;
    let activeMs = (cur.activeSeconds || 0) * 1000;
    let lastTick = Date.now();
    let answered = false;
    let recorded = false;
    let sub = {};

    const itemHost = el("div", { class: "session-body" });
    const top = el("div", { class: "session-top" });
    root.appendChild(top);
    root.appendChild(itemHost);

    function flush() {
      if (!s.current) return;
      s.current.activeSeconds = Math.round(activeMs / 1000);
      HY.store.save();
    }

    function close() {
      flush();
      if (timerId) clearInterval(timerId);
      document.removeEventListener("keydown", onKey);
      HY.tts.cancel();
    }

    function item() { return cur.items[cur.idx]; }

    function topbar() {
      const it = item();
      const total = cur.items.length;
      const idx = Math.min(cur.idx + 1, total);
      top.innerHTML = "";
      top.appendChild(el("div", { class: "session-top-left" },
        el("div", { class: "eyebrow" }, "Session · " + (cur.mode === "review" ? "review" : cur.mode === "lesson" ? "lesson" : "daily")),
        el("div", { class: "session-title" }, it ? HY.session.itemTitle(it) : "Finished"),
        el("div", { class: "session-progress" }, C.progress(cur.idx, total, { sm: true })),
        el("div", { class: "muted tiny" }, idx + " of " + total + " items")));
      const mins = Math.max(0, Math.round(activeMs / 60000));
      const time = el("span", { class: "timer", title: "Active study time" }, C.timer(Math.floor(activeMs / 1000)));
      top.appendChild(el("div", { class: "session-top-right" },
        el("div", { class: "timer-wrap" }, el("span", { class: "timer-label" }, "time"), time),
        C.btn("Exit", { kind: "ghost", size: "sm", onClick: () => { close(); HY.app.go("/home"); } })));
      time.dataset.timer = "1";
    }

    function tick() {
      if (!root.isConnected) { if (timerId) clearInterval(timerId); document.removeEventListener("keydown", onKey); return; }
      const now = Date.now();
      if (document.visibilityState === "visible") activeMs += Math.min(now - lastTick, 15000);
      lastTick = now;
      const t = top.querySelector("[data-timer]");
      if (t) t.textContent = C.timer(Math.floor(activeMs / 1000));
    }

    function next() {
      if (!root.isConnected) return;
      HY.tts.cancel();
      if (cur.idx + 1 >= cur.items.length) {
        const mins = Math.max(1, Math.round(activeMs / 60000));
        s.current.activeSeconds = Math.round(activeMs / 1000);
        HY.session.finish(s, mins);
        close();
        root.replaceWith(summary(s.current, mins));
        return;
      }
      HY.session.advance(s);
      answered = false; recorded = false; sub = {};
      topbar();
      renderItem();
    }

    function completeStep(score, detail) {
      const it = item();
      if (!it || recorded) return;
      recorded = true;
      HY.session.recordStep(s, it, score, detail);
      next();
    }

    function header(kind) {
      const it = item();
      return el("div", { class: "session-item-head" },
        el("div", { class: "eyebrow" }, kind),
        it && it.kind === "step" ? el("h1", { class: "session-h1" },
          it.step.charAt(0).toUpperCase() + it.step.slice(1)) : null);
    }

    /* ---------------- reviews ---------------- */
    function renderReview(it) {
      const card = s.cards[it.cardKey];
      const w = D.word(it.w) || {};
      if (!card) { next(); return; }
      HY.tts.cancel();
      const wrap = el("div", { class: "card review-card" });
      const inner = el("div", { class: "card-body" });
      wrap.appendChild(inner);
      itemHost.appendChild(wrap);

      if (it.skill === "prod") return renderProduction(inner, it, w, card);
      return renderRecognition(inner, it, w, card);
    }

      function renderRecognition(inner, it, w, card) {
      const listening = it.skill === "listen";
      const seed = U.hash(it.cardKey + "|" + Math.floor((card.due || 0) / 86400000));
      const options = HY.srs.optionsForMeaning(w.w, 4, seed);
      const answer = Math.max(0, options.indexOf(w.en));
      inner.appendChild(header(listening ? "Listening · what does it mean?" : "Reading · what does it mean?"));
      if (listening) {
        inner.appendChild(el("div", { class: "audio-stage" },
          C.audio(w.w, { rate: s.settings.rate }),
          el("span", { class: "muted" }, "Play, then choose the meaning.")));
        setTimeout(() => { if (root.isConnected) HY.tts.speak(w.w, { rate: s.settings.rate }); }, 350);
      } else {
        inner.appendChild(el("div", { class: "prompt-hanzi", lang: "zh-Hans" }, w.w));
        inner.appendChild(el("div", { class: "prompt-hint" }, "What does it mean?"));
      }
      const opts = C.optionButtons(options, {
        answer,
        onPick: (ok) => {
          if (recorded) return;
          recorded = true;
          HY.session.recordReview(s, it, ok);
          reveal(ok, w, inner);
        }
      });
      inner.appendChild(opts);
    }

    function renderProduction(inner, it, w, card) {
      inner.appendChild(header("Recall · type the word"));
      inner.appendChild(el("div", { class: "prod-prompt" },
        el("div", { class: "eyebrow" }, "English meaning"),
        el("div", { class: "prod-en" }, w.en),
        el("div", { class: "muted small" }, (w.pos || "") + " · " + Array.from(w.w).length + " characters")));
      const input = el("input", {
        type: "text", class: "input big-input hanzi", lang: "zh-Hans",
        placeholder: "输入中文…", autocomplete: "off", autocapitalize: "off", spellcheck: "false"
      });
      const actions = el("div", { class: "session-actions" });
      const check = C.btn("Check", { kind: "primary", onClick: () => {
        if (recorded) return;
        const ok = U.sameAnswer(w.w, input.value);
        recorded = true;
        HY.session.recordReview(s, it, ok);
        reveal(ok, w, inner, input.value);
      }});
      const hint = C.btn("Hint", { kind: "ghost", onClick: () => {
        input.value = Array.from(w.w).slice(0, 1).join("");
        input.focus();
        C.toast("First character filled in. Counts as a hint, not a pass.");
      }});
      const give = C.btn("Show answer", { kind: "ghost", onClick: () => {
        if (recorded) return;
        recorded = true;
        HY.session.recordReview(s, it, false);
        reveal(false, w, inner, input.value);
      }});
      inner.appendChild(input);
      actions.appendChild(hint);
      actions.appendChild(give);
      actions.appendChild(check);
      inner.appendChild(actions);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); check.click(); } });
      setTimeout(() => input.focus(), 40);
    }

    function reveal(ok, w, inner, typed) {
      const box = el("div", { class: "answer-box " + (ok ? "ok" : "bad") });
      box.appendChild(el("div", { class: "answer-head" }, ok ? "Correct." : "Not quite."));
      box.appendChild(el("div", { class: "answer-hanzi", lang: "zh-Hans" }, w.w));
      box.appendChild(el("div", { class: "pinyin big" }, w.py));
      box.appendChild(el("div", { class: "answer-en" }, w.en));
      if (typed && !ok) {
        box.appendChild(el("div", { class: "muted small" }, "You typed: "));
        box.appendChild(el("div", { class: "typed-answer", lang: "zh-Hans" }, typed));
      }
      const ex = D.examplesFor(w.w)[0];
      if (ex) box.appendChild(el("div", { class: "answer-ex" }, el("span", { class: "quote-mark" }, "例"), el("span", { lang: "zh-Hans" }, ex.zh)));
      box.appendChild(el("div", { class: "row gap" }, C.audio(w.w, { rate: s.settings.rate })));
      inner.appendChild(box);
      inner.appendChild(el("div", { class: "session-actions" },
        C.btn("Next", { kind: "primary", icon: "arrowRight", onClick: next })));
      const b = inner.querySelector(".session-actions .btn-primary");
      if (b) setTimeout(() => b.focus(), 30);
    }

    /* ---------------- new words ---------------- */
    function renderLearn(it) {
      const w = D.word(it.w) || {};
      const wrap = el("div", { class: "card learn-card" });
      const inner = el("div", { class: "card-body" });
      wrap.appendChild(inner);
      itemHost.appendChild(wrap);
      let phase = 1;

      function draw() {
        inner.innerHTML = "";
        if (phase === 1) {
          inner.appendChild(header(it.source === "gap" ? "New word · HSK5 exam list" : it.source === "hsk4" ? "New word · HSK4 refresh" : "New word · Lesson " + it.lesson));
          inner.appendChild(el("div", { class: "learn-grid" },
            el("div", { class: "learn-main" },
              el("div", { class: "learn-hanzi", lang: "zh-Hans" }, w.w),
              el("div", { class: "learn-pinyin" }, w.py),
              el("div", { class: "learn-en" }, w.en),
              el("div", { class: "learn-meta" },
                C.pill(w.official ? "HSK5 list" : w.in6 ? "Above level" : "Book word", w.official ? "jade" : "gold"),
                w.pos ? C.pill(w.pos, "muted") : null,
                it.lesson ? C.pill("Lesson " + it.lesson, "red") : null)),
            el("div", { class: "learn-side" },
              C.audio(w.w, { rate: s.settings.rate }),
              el("div", { class: "learn-radical" }, el("span", { class: "muted tiny" }, "radical"), el("span", { class: "radical", lang: "zh-Hans" }, w.rad || "—")))));
          const ex = D.examplesFor(w.w)[0];
          if (ex) inner.appendChild(el("div", { class: "example-card" },
            el("div", { class: "example-label" }, "In context"),
            el("div", { class: "example-zh", lang: "zh-Hans" }, ex.zh),
            ex.en ? el("div", { class: "muted small" }, ex.en) : null,
            el("div", { class: "muted tiny" }, ex.src)));
          inner.appendChild(el("div", { class: "session-actions" },
            C.btn("Add to reviews", { kind: "primary", icon: "arrowRight", onClick: () => { phase = 2; draw(); } })));
        } else {
          const seed = U.hash(it.w + "learn");
          const options = HY.srs.optionsForMeaning(w.w, 4, seed);
          const answer = Math.max(0, options.indexOf(w.en));
          inner.appendChild(header("Quick check"));
          inner.appendChild(el("div", { class: "prompt-hanzi small", lang: "zh-Hans" }, w.w));
          inner.appendChild(el("div", { class: "prompt-hint" }, "Choose the meaning. This sets the first review."));
          inner.appendChild(C.optionButtons(options, {
            answer,
            onPick: (ok) => {
              if (recorded) return;
              recorded = true;
              HY.session.recordLearn(s, it, ok);
              const box = el("div", { class: "answer-box " + (ok ? "ok" : "bad") },
                el("div", { class: "answer-head" }, ok ? "Good — first review scheduled for tomorrow." : "No problem — it returns in ten minutes."),
                el("div", { class: "answer-hanzi small", lang: "zh-Hans" }, w.w),
                el("div", { class: "pinyin" }, w.py),
                el("div", { class: "answer-en" }, w.en));
              inner.appendChild(box);
              inner.appendChild(el("div", { class: "session-actions" },
                C.btn("Next", { kind: "primary", icon: "arrowRight", onClick: next })));
              setTimeout(() => { const b = inner.querySelector(".session-actions .btn-primary"); if (b) b.focus(); }, 20);
            }
          }));
        }
      }
      draw();
    }

    /* ---------------- grammar ---------------- */
    function renderGrammar(it) {
      const L = D.content(it.lesson);
      if (!L) return completeStep(0);
      const g = L.grammar;
      const wrap = el("div", { class: "lesson-stage" });
      wrap.appendChild(header("Grammar focus"));
      wrap.appendChild(el("div", { class: "grammar-head" },
        el("div", { class: "grammar-point", lang: "zh-Hans" }, g.point),
        el("div", { class: "grammar-en" }, g.point_en),
        el("div", { class: "structure" }, g.structure)));
      wrap.appendChild(el("p", { class: "explain" }, g.explain_en));
      wrap.appendChild(el("div", { class: "callout callout-mistake" }, el("strong", {}, "Watch out. "), g.common_mistake));
      wrap.appendChild(el("div", { class: "examples" }, g.examples.map((ex) =>
        el("div", { class: "example-card" },
          el("div", { class: "example-zh", lang: "zh-Hans" }, ex.zh),
          el("div", { class: "pinyin" }, ex.py),
          el("div", { class: "muted" }, ex.en),
          el("div", { class: "row gap" }, C.audio(ex.zh, { rate: s.settings.rate }))))));

      const drillWrap = el("div", { class: "drills" });
      wrap.appendChild(drillWrap);
      let idx = 0;
      let score = 0;
      const total = g.drills.length;

      function drawDrill() {
        drillWrap.innerHTML = "";
        if (idx >= total) {
          wrap.appendChild(el("div", { class: "stage-done" },
            el("strong", {}, "Grammar drill done — " + score + " / " + total),
            el("div", { class: "session-actions" }, C.btn("Continue", { kind: "primary", icon: "arrowRight", onClick: () => completeStep(score) }))));
          return;
        }
        const dr = g.drills[idx];
        const mc = U.mc(dr, "g" + it.lesson + "-" + idx);
        drillWrap.appendChild(el("div", { class: "drill-head" }, "Drill " + (idx + 1) + " of " + total));
        drillWrap.appendChild(el("div", { class: "drill-q", lang: "zh-Hans" }, dr.q));
        drillWrap.appendChild(C.optionButtons(mc.options, {
          answer: mc.answer,
          onPick: (ok) => {
            if (ok) score++;
            drillWrap.appendChild(el("div", { class: "callout " + (ok ? "callout-ok" : "callout-bad") },
              el("strong", {}, ok ? "Correct. " : "Not quite. "), dr.explain));
            drillWrap.appendChild(el("div", { class: "session-actions" },
              C.btn(idx + 1 >= total ? "Finish drill" : "Next drill", { kind: "primary", onClick: () => { idx++; drawDrill(); } })));
          }
        }));
      }
      drawDrill();
      itemHost.appendChild(wrap);
    }

    /* ---------------- reading ---------------- */
    function renderReading(it) {
      const L = D.content(it.lesson);
      if (!L) return completeStep(0);
      const r = L.reading;
      const wrap = el("div", { class: "lesson-stage" });
      wrap.appendChild(header("Reading"));
      const tool = el("div", { class: "reading-tools" },
        C.btn("Listen to passage", { kind: "soft", icon: "volume", size: "sm", onClick: () => HY.tts.speak(r.text, { rate: s.settings.rate }) }),
        C.btn("Translation", { kind: "ghost", size: "sm", icon: "eye", onClick: (e) => {
          const t = wrap.querySelector(".translation");
          if (!t) return;
          t.classList.toggle("hidden");
          e.currentTarget.classList.toggle("active");
        } }));
      wrap.appendChild(tool);

      wrap.appendChild(el("h3", { class: "reading-title", lang: "zh-Hans" }, r.title));
      wrap.appendChild(C.passage(r.text));
      wrap.appendChild(el("div", { class: "translation hidden" }, r.translation));
      wrap.appendChild(el("p", { class: "muted tiny" }, "Tap any word or character for pinyin, meaning and audio."));

      const qWrap = el("div", { class: "questions" });
      wrap.appendChild(qWrap);
      let qi = 0, score = 0;
      function drawQ() {
        qWrap.innerHTML = "";
        if (qi >= r.questions.length) {
          wrap.appendChild(el("div", { class: "stage-done" },
            el("strong", {}, "Reading complete — " + score + " / " + r.questions.length),
            el("div", { class: "session-actions" }, C.btn("Continue", { kind: "primary", icon: "arrowRight", onClick: () => completeStep(score) }))));
          return;
        }
        const q = r.questions[qi];
        const mc = U.mc(q, "r" + it.lesson + "-" + qi);
        qWrap.appendChild(el("div", { class: "drill-head" }, "Question " + (qi + 1) + " of " + r.questions.length));
        qWrap.appendChild(el("div", { class: "drill-q", lang: "zh-Hans" }, q.q));
        qWrap.appendChild(C.optionButtons(mc.options, {
          answer: mc.answer,
          onPick: (ok) => {
            if (ok) score++;
            qWrap.appendChild(el("div", { class: "callout " + (ok ? "callout-ok" : "callout-bad") },
              el("strong", {}, ok ? "Correct. " : "Review this detail. "), q.explain));
            qWrap.appendChild(el("div", { class: "session-actions" },
              C.btn(qi + 1 >= r.questions.length ? "Finish reading" : "Next question", { kind: "primary", onClick: () => { qi++; drawQ(); } })));
          }
        }));
      }
      drawQ();
      itemHost.appendChild(wrap);
    }

    /* ---------------- listening ---------------- */
    function renderListening(it) {
      const L = D.content(it.lesson);
      if (!L) return completeStep(0);
      const ds = L.listening.dictation;
      const wrap = el("div", { class: "lesson-stage" });
      wrap.appendChild(header("Listening · dictation"));
      wrap.appendChild(el("p", { class: "muted" }, "Five sentences. Play each as often as you need, type what you hear, then check. Punctuation is ignored."));
      const stage = el("div", { class: "dictation" });
      wrap.appendChild(stage);
      let idx = 0, score = 0;

      function draw() {
        stage.innerHTML = "";
        if (idx >= ds.length) {
          wrap.appendChild(el("div", { class: "stage-done" },
            el("strong", {}, "Dictation done — " + score + " / " + ds.length),
            el("div", { class: "session-actions" }, C.btn("Continue", { kind: "primary", icon: "arrowRight", onClick: () => completeStep(score) }))));
          return;
        }
        const sentence = ds[idx];
        const box = el("div", { class: "dictation-card" });
        box.appendChild(el("div", { class: "drill-head" }, "Sentence " + (idx + 1) + " of " + ds.length));
        const play = C.btn("Play", { kind: "soft", icon: "volume", onClick: () => HY.tts.speak(sentence, { rate: s.settings.rate }) });
        const slow = C.btn("Slow", { kind: "ghost", icon: "speaker", onClick: () => HY.tts.speak(sentence, { rate: Math.max(0.55, s.settings.rate - 0.2) }) });
        box.appendChild(el("div", { class: "row gap" }, play, slow));
        const input = el("input", { type: "text", class: "input big-input hanzi", lang: "zh-Hans", placeholder: "听写…", autocomplete: "off", autocapitalize: "off" });
        const check = C.btn("Check", { kind: "primary", onClick: doCheck });
        box.appendChild(input);
        box.appendChild(el("div", { class: "row end" }, check));
        stage.appendChild(box);

        function doCheck() {
          const ok = U.norm(input.value) === U.norm(sentence);
          if (ok) score++;
          const ops = U.diff(sentence, input.value);
          const diff = el("div", { class: "diff" }, ops.map((o) =>
            el("span", { class: "diff-" + o.t }, o.ch)));
          box.appendChild(el("div", { class: "answer-box " + (ok ? "ok" : "bad") },
            el("div", { class: "answer-head" }, ok ? "Exactly right." : "Compare character by character:"),
            diff,
            el("div", { class: "muted small" }, "Correct sentence:"),
            el("div", { class: "correct-sentence", lang: "zh-Hans" }, sentence),
            el("div", { class: "row gap" }, C.audio(sentence, { rate: s.settings.rate }))));
          check.remove();
          input.disabled = true;
          box.appendChild(el("div", { class: "session-actions" },
            C.btn(idx + 1 >= ds.length ? "Finish dictation" : "Next sentence", { kind: "primary", onClick: () => { idx++; draw(); } })));
        }
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); if (check.isConnected) doCheck(); }
        });
        setTimeout(() => { HY.tts.speak(sentence, { rate: s.settings.rate }); input.focus(); }, 300);
      }
      draw();
      itemHost.appendChild(wrap);
    }

    /* ---------------- writing ---------------- */
    function renderWriting(it) {
      const L = D.content(it.lesson);
      if (!L) return completeStep(0);
      const wr = L.writing;
      const wrap = el("div", { class: "lesson-stage" });
      wrap.appendChild(header("Writing · composition"));
      wrap.appendChild(el("div", { class: "writing-prompt" },
        el("div", { class: "eyebrow" }, "Task"),
        el("p", { class: "write-prompt" }, wr.prompt),
        el("div", { class: "required-row" },
          el("span", { class: "muted small" }, "Use these:"),
          wr.required_words.map((w) => el("button", {
            class: "chip chip-jade", type: "button",
            onclick: () => { insertWord(w); }
          }, w, el("span", { class: "chip-pinyin" }, (D.lookup(w) || {}).py || ""))))));
      const ta = el("textarea", {
        class: "input writing-area hanzi", lang: "zh-Hans", rows: "7",
        placeholder: "在这里写……（" + wr.min_chars + " 字以上）"
      });
      const count = el("span", { class: "char-count" }, "0 字");
      const checks = el("div", { class: "write-checks" });
      const submit = C.btn("Submit composition", { kind: "primary", onClick: submitIt });
      wrap.appendChild(ta);
      wrap.appendChild(el("div", { class: "row between write-meta" }, count, el("span", { class: "muted tiny" }, "Minimum " + wr.min_chars + " characters · typed, no handwriting")));
      wrap.appendChild(checks);
      wrap.appendChild(el("div", { class: "row end" }, submit));

      function insertWord(w) {
        const start = ta.selectionStart || ta.value.length;
        ta.value = ta.value.slice(0, start) + w + ta.value.slice(ta.selectionEnd || start);
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + w.length;
        update();
      }

      function used() { return wr.required_words.filter((w) => ta.value.includes(w)); }

      function update() {
        const n = U.cjkCount(ta.value);
        count.textContent = n + " 字";
        count.classList.toggle("warn", n < wr.min_chars);
        const u = used();
        checks.innerHTML = "";
        checks.appendChild(el("div", { class: "check-row" },
          el("span", { class: n >= wr.min_chars ? "ok-dot" : "bad-dot" }),
          el("span", {}, n >= wr.min_chars ? "Length reached" : (wr.min_chars - n) + " more characters needed")));
        checks.appendChild(el("div", { class: "check-row" },
          el("span", { class: u.length === wr.required_words.length ? "ok-dot" : "bad-dot" }),
          el("span", {}, "Target words: " + u.length + " / " + wr.required_words.length + (u.length ? " — " + u.join("、") : ""))));
        const sents = U.splitSentences(ta.value).length;
        checks.appendChild(el("div", { class: "check-row" },
          el("span", { class: sents >= 3 ? "ok-dot" : "neutral-dot" }),
          el("span", {}, sents + " sentence" + (sents === 1 ? "" : "s") + " · aim for 3–5")));
      }
      ta.addEventListener("input", update);
      update();

      function submitIt() {
        const text = ta.value.trim();
        const n = U.cjkCount(text);
        if (n < 20) { C.toast("Write at least a couple of sentences before submitting.", "warn"); return; }
        const u = used();
        s.writing.push({ lesson: it.lesson, date: U.today(), at: Date.now(), text, chars: n, requiredUsed: u, required: wr.required_words, selfScore: null });
        if (s.writing.length > 300) s.writing.shift();
        HY.store.save();
        wrap.querySelectorAll("textarea, .btn-primary, .chip, .writing-prompt").forEach((x) => { if (x !== ta) x.remove(); });
        ta.disabled = true;
        const result = el("div", { class: "writing-result" },
          el("div", { class: "callout callout-ok" }, el("strong", {}, "Submitted — " + n + " characters, " + u.length + " / " + wr.required_words.length + " target words.")),
          el("div", { class: "model-card" },
            el("div", { class: "eyebrow" }, "Model answer"),
            el("div", { class: "model-zh", lang: "zh-Hans" }, wr.model),
            el("div", { class: "muted small" }, wr.tips)),
          el("div", { class: "row gap" }, C.audio(wr.model, { rate: s.settings.rate })));
        const gradeWrap = el("div", { class: "self-grade" },
          el("div", { class: "eyebrow" }, "How close was your version?"),
          el("div", { class: "row gap wrap" },
            C.btn("Needs work", { kind: "ghost", onClick: () => finishWrite(0) }),
            C.btn("Meets the task", { kind: "soft", onClick: () => finishWrite(1) }),
            C.btn("Strong", { kind: "primary", onClick: () => finishWrite(2) })));
        result.appendChild(gradeWrap);
        wrap.appendChild(result);
        const rec = s.writing[s.writing.length - 1];
        function finishWrite(score) {
          rec.selfScore = score;
          HY.store.save();
          completeStep(score, { chars: n });
        }
      }
      itemHost.appendChild(wrap);
    }

    /* ---------------- dispatch ---------------- */
    function renderItem() {
      itemHost.innerHTML = "";
      const it = item();
      if (!it) return;
      if (it.kind === "review") return renderReview(it);
      if (it.kind === "learn") return renderLearn(it);
      if (it.kind === "step") {
        if (it.step === "grammar") return renderGrammar(it);
        if (it.step === "reading") return renderReading(it);
        if (it.step === "listening") return renderListening(it);
        if (it.step === "writing") return renderWriting(it);
      }
    }

    function onKey(e) {
      if (!root.isConnected) { document.removeEventListener("keydown", onKey); return; }
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "textarea" || tag === "select") return;
      if (tag === "input") return;
      if (/^[1-4]$/.test(e.key)) {
        const opts = Array.from(itemHost.querySelectorAll(".mc-option"));
        const b = opts[Number(e.key) - 1];
        if (b && !b.classList.contains("is-locked")) { e.preventDefault(); b.click(); }
        return;
      }
      if (e.key === "Enter") {
        const prim = itemHost.querySelector(".session-actions .btn-primary, .stage-done .btn-primary, .writing-result .btn");
        if (prim) { e.preventDefault(); prim.click(); }
        return;
      }
      if (e.key === " ") {
        const audio = itemHost.querySelector(".audio-btn");
        if (audio) { e.preventDefault(); audio.click(); }
      }
    }

    topbar();
    renderItem();
    timerId = setInterval(tick, 1000);
    document.addEventListener("keydown", onKey);
    window.addEventListener("pagehide", flush, { once: true });
    return root;
  }

  function summary(cur, minutes) {
    const s = HY.store.state;
    const results = cur ? cur.results : { reviews: 0, newWords: 0, correct: 0, total: 0, steps: 0 };
    const hasReviews = results.total > 0;
    const acc = hasReviews ? Math.round((results.correct / results.total) * 100) : 0;
    const next = HY.plan.nextLesson(s);
    const nextLesson = D.lessonByN[next];
    const stage = HY.session.nextStage(s, next) || "grammar";
    return C.page({
      eyebrow: "Session complete",
      title: "That's the block.",
      sub: "The rest of the day is yours. Reviews will be waiting tomorrow.",
      body: el("div", { class: "grid cols-2" },
        C.card({ title: "This session" },
          el("div", { class: "ring-row" },
            C.ring(hasReviews ? acc : 100, 104, hasReviews ? acc + "%" : "Done", hasReviews ? "accuracy" : results.steps ? "stage" : "session"),
            el("div", { class: "fact-list" },
              fact("Minutes", String(minutes || (cur && cur.minutes) || 0)),
              fact("Reviews", String(results.reviews || 0)),
              fact("New words", String(results.newWords || 0)),
              fact("Lesson stages", String(results.steps || 0))))),
        C.card({ title: "What's next" },
          el("p", {}, "Lesson " + next + " · " + nextLesson.zh + " — " + stage + "."),
          el("div", { class: "row gap" },
            C.btn("Back to today", { kind: "primary", icon: "home", onClick: () => HY.app.go("/home") }),
            C.btn("Open lesson", { kind: "ghost", icon: "book", onClick: () => HY.app.go("/lesson/" + next) })),
          el("div", { class: "divider" }),
          el("p", { class: "muted small" }, "If you have five more minutes: review the words you just met, or read the lesson passage once more without the translation.")))
    });
  }

  function fact(label, value) {
    return el("div", { class: "fact" }, el("span", {}, label), el("strong", {}, value));
  }

  HY.views = HY.views || {};
  HY.views.session = view;
})();

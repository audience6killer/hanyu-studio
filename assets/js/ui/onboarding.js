/* First-run setup: dates, voice, calibration choice, plan preview. */
(function () {
  const HY = window.HY;
  const U = HY.util;
  const C = HY.ui;
  const el = U.el;

  let step = 0;
  let draft = null;

  function init() {
    const s = HY.store.state;
    const target = s.profile ? s.profile.targetDate : U.dayKey(U.addDays(U.today(), 182));
    draft = {
      name: s.profile ? s.profile.name : "",
      targetDate: target,
      dailyMinutes: s.profile ? s.profile.dailyMinutes : 35,
      voiceURI: s.settings.voiceURI || "",
      rate: s.settings.rate || 0.9,
      calibrate: true
    };
  }

  function dots() {
    const names = ["Dates", "Voice", "Calibration", "Plan"];
    return el("ol", { class: "steps" }, names.map((n, i) =>
      el("li", { class: "step" + (i === step ? " active" : "") + (i < step ? " done" : "") },
        el("span", { class: "step-n" }, i < step ? "✓" : String(i + 1)),
        el("span", {}, n))));
  }

  function segmented(options, value, onPick) {
    return el("div", { class: "segmented" }, options.map((o) =>
      el("button", {
        type: "button", class: "seg" + (o.value === value ? " active" : ""),
        onclick: () => onPick(o.value)
      }, o.label, o.sub ? el("small", {}, o.sub) : null)));
  }

  function dateStep() {
    const dateInput = el("input", {
      type: "date", class: "input", value: draft.targetDate,
      min: U.dayKey(U.addDays(U.today(), 56)),
      onchange: (e) => { draft.targetDate = e.target.value; }
    });
    const days = U.daysBetween(U.today(), draft.targetDate);
    const weeks = Math.round(days / 7);
    return C.card({ title: "Set your horizon", sub: "Thirty-six lessons, reviewed properly, is a real project. Pick a date you can defend." },
      el("div", { class: "form-row" },
        el("label", { class: "field" }, el("span", {}, "Exam target"), dateInput,
          el("small", { class: "field-hint" }, weeks + " weeks from today"))),
      el("div", { class: "form-row" },
        el("label", { class: "field" }, el("span", {}, "Weekday study time"),
          segmented([
            { value: 30, label: "30 min", sub: "minimum" },
            { value: 35, label: "35 min", sub: "steady" },
            { value: 45, label: "45 min", sub: "ambitious" }
          ], draft.dailyMinutes, (v) => { draft.dailyMinutes = v; rerender(); }))),
      el("div", { class: "form-row" },
        el("label", { class: "field" }, el("span", { class: "field-hint" }, "The plan assumes five workday sessions a week. Weekends stay free unless you choose to catch up."))),
      C.notice("info", "At 35 minutes a day you get roughly 15 new words, a review block and one lesson stage per session. The plan adapts down automatically when reviews pile up.")
    );
  }

  function voiceStep() {
    const voices = HY.tts.zhVoices();
    const select = el("select", {
      class: "input",
      onchange: (e) => { draft.voiceURI = e.target.value; }
    }, el("option", { value: "" }, "Automatic (best available)"),
      voices.map((v) => el("option", { value: v.voiceURI, selected: v.voiceURI === draft.voiceURI }, v.name + " · " + v.lang)));

    const testBtn = C.btn("Test the voice", {
      kind: "soft", icon: "volume",
      onClick: () => {
        HY.tts.speak("你好，欢迎回来。我们今天开始学习第五级的中文。", { rate: draft.rate, voiceURI: draft.voiceURI })
          .then(() => C.toast("If you heard nothing, try another voice or add a Mandarin voice pack."));
      }
    });

    const rate = el("input", {
      type: "range", min: "0.6", max: "1.2", step: "0.05", value: String(draft.rate), class: "range",
      oninput: (e) => { draft.rate = Number(e.target.value); rateLabel.textContent = draft.rate.toFixed(2) + "×"; }
    });
    const rateLabel = el("span", { class: "range-val" }, draft.rate.toFixed(2) + "×");

    return C.card({ title: "Listening voice", sub: "Listening practice uses your browser's Mandarin speech engine. Nothing is downloaded and no audio leaves your machine." },
      voices.length ? el("div", { class: "form-row" },
        el("label", { class: "field" }, el("span", {}, "Mandarin voice"), select)) :
        C.notice("warn", el("div", {},
          el("strong", {}, "No Mandarin voice found yet."),
          el("p", {}, "On Windows, add one under Settings → Time & Language → Speech → Add voices → Chinese (Simplified). Then restart the browser. Until then, listening still shows text, but audio will not play."))),
      el("div", { class: "form-row inline" }, el("label", { class: "field grow" }, el("span", {}, "Speed"), rate), rateLabel),
      el("div", { class: "row gap" }, testBtn,
        C.btn("Refresh voice list", { kind: "ghost", icon: "refresh", onClick: () => { HY.tts.list(); rerender(); } }))
    );
  }

  function calibrateStep() {
    const take = el("button", {
      type: "button", class: "choice" + (draft.calibrate ? " active" : ""),
      onclick: () => { draft.calibrate = true; rerender(); }
    }, el("span", { class: "choice-title" }, "Take a 15-minute calibration"),
      el("span", { class: "choice-sub" }, "25 questions across HSK4 recall, HSK5 preview, pinyin and grammar. Finds rusty HSK4 words and sets your starting point."));
    const skip = el("button", {
      type: "button", class: "choice" + (!draft.calibrate ? " active" : ""),
      onclick: () => { draft.calibrate = false; rerender(); }
    }, el("span", { class: "choice-title" }, "Skip — start at Lesson 1"),
      el("span", { class: "choice-sub" }, "You can rerun calibration any time from Settings. Review load will be estimated at a standard level."));
    return C.card({ title: "Where are you now?", sub: "You finished HSK4 a while ago. A short calibration stops the plan from wasting time on words you still know." },
      el("div", { class: "choices" }, take, skip),
      C.notice("info", "The calibration is deliberately short. It samples HSK4 recognition, pinyin, early HSK5 vocabulary and grammar in context, then adds the words you miss to a refresh deck.")
    );
  }

  function planStep() {
    const plan = HY.plan.generate(U.today(), draft.targetDate, draft.dailyMinutes);
    const cps = plan.checkpoints.map((c) => "after lesson " + c.afterLesson + " · week " + c.week).join(" · ");
    return C.card({ title: "Your six-month shape", sub: "Vocabulary follows the textbook lesson order. Grammar is one curated HSK5 point per lesson." },
      el("div", { class: "plan-facts" },
        el("div", { class: "plan-fact" }, el("strong", {}, String(plan.weeks)), el("span", {}, "weeks")),
        el("div", { class: "plan-fact" }, el("strong", {}, String(plan.lessonsPerWeek)), el("span", {}, "lessons / week")),
        el("div", { class: "plan-fact" }, el("strong", {}, draft.dailyMinutes + "′"), el("span", {}, "weekday session")),
        el("div", { class: "plan-fact" }, el("strong", {}, "36"), el("span", {}, "book lessons"))),
      el("div", { class: "plan-list" },
        el("p", {}, el("strong", {}, "Coverage. "), "1,381 book words in lesson order, plus the 390 official HSK5 list words your book's core lists do not cover, so exam vocabulary is complete."),
        el("p", {}, el("strong", {}, "Checkpoints. "), cps),
        el("p", {}, el("strong", {}, "Weekly rhythm. "), "Five sessions: reviews, new words, then one or two of grammar, reading, listening and writing. Writing is typed."),
        el("p", {}, el("strong", {}, "If life happens. "), "The dashboard shows pace against plan and offers a catch-up or an extension rather than silently failing you."))
    );
  }

  function rerender() {
    const outlet = U.$("#view");
    if (!outlet) return;
    outlet.innerHTML = "";
    outlet.appendChild(render());
  }

  function render() {
    if (!draft) init();
    const bodies = [dateStep, voiceStep, calibrateStep, planStep];
    const canNext = step !== 0 || U.daysBetween(U.today(), draft.targetDate) >= 56;
    const body = el("div", { class: "onboard" },
      el("div", { class: "onboard-head" },
        el("div", { class: "onboard-kicker" }, "HSK Standard Course 5 · companion"),
        el("h1", { class: "onboard-title" }, "Pick up where you stopped."),
        el("p", { class: "onboard-sub" }, "A quiet desk for reading, listening, vocabulary and typed writing — built around the book you already own.")),
      dots(),
      bodies[step](),
      step === 0 ? el("p", { class: "onboard-restore muted small" },
        "Already syncing on a phone or another computer? ",
        C.link("Restore progress on this device", "#/settings")) : null,
      el("div", { class: "onboard-foot" },
        step > 0 ? C.btn("Back", { kind: "ghost", icon: "arrowLeft", onClick: () => { step--; rerender(); } }) : el("span"),
        C.btn(step === 3 ? "Start studying" : "Continue", {
          kind: "primary", icon: step === 3 ? "play" : "arrowRight", disabled: !canNext,
          onClick: () => {
            if (step < 3) { step++; rerender(); return; }
            start();
          }
        }))
    );

    function start() {
      const s = HY.store.state;
      s.profile = {
        name: draft.name || "",
        startDate: U.today(),
        targetDate: draft.targetDate,
        dailyMinutes: draft.dailyMinutes,
        exam: true
      };
      s.settings.voiceURI = draft.voiceURI;
      s.settings.rate = draft.rate;
      s.plan = HY.plan.generate(s.profile.startDate, s.profile.targetDate, s.profile.dailyMinutes);
      s.onboarded = true;
      HY.store.touchConfig();
      if (draft.calibrate) HY.app.go("/diagnostic");
      else HY.app.go("/home");
    }

    // avoid Date min warning
    return el("div", { class: "page wide" }, body);
  }

  HY.views = HY.views || {};
  HY.views.onboarding = render;
})();

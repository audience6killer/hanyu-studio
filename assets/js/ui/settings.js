/* Settings: plan, study load, audio, data, calibration, about. */
(function () {
  const HY = window.HY;
  const U = HY.util;
  const C = HY.ui;
  const el = U.el;

  function row(label, desc, control) {
    return el("div", { class: "setting-row" },
      el("div", { class: "setting-copy" }, el("strong", {}, label), desc ? el("p", {}, desc) : null),
      el("div", { class: "setting-control" }, control));
  }

  function select(options, value, onChange) {
    const s = el("select", { class: "input select" }, options.map((o) =>
      el("option", { value: String(o.value), selected: String(o.value) === String(value) }, o.label)));
    s.addEventListener("change", () => onChange(s.value));
    return s;
  }

  function toggle(value, onChange) {
    const b = el("button", { class: "switch" + (value ? " on" : ""), type: "button", role: "switch", "aria-checked": value });
    b.appendChild(el("span", { class: "switch-knob" }));
    b.addEventListener("click", () => {
      const next = !b.classList.contains("on");
      b.classList.toggle("on", next);
      b.setAttribute("aria-checked", String(next));
      onChange(next);
    });
    return b;
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
  }

  function cloudCard(s) {
    const cfg = HY.sync.config() || {};
    const st = HY.sync.state;
    const card = C.card({ title: "Cloud sync", sub: "The same progress on this computer and your iPhone. Local-first, always." });
    const body = card.querySelector(".card-body");
    let working = false;
    const add = (...kids) => kids.forEach((k) => { if (k) body.appendChild(k); });
    const guide = C.link("setup guide", "setup.html", { cls: "link-inline" });
    guide.target = "_blank";
    guide.rel = "noopener";

    function authFields(prefillEmail) {
      const urlIn = el("input", { class: "input", type: "url", placeholder: "https://your-project.supabase.co", value: cfg.url || "" });
      const keyIn = el("input", { class: "input", type: "text", placeholder: "anon public key", value: cfg.anonKey || "" });
      const emailIn = el("input", { class: "input", type: "email", placeholder: "you@example.com", value: prefillEmail || cfg.email || "", autocomplete: "username" });
      const passIn = el("input", { class: "input", type: "password", placeholder: "Password (at least 6 characters)", autocomplete: "current-password" });
      return { urlIn, keyIn, emailIn, passIn };
    }

    function field(label, input, wide, hint) {
      return el("label", { class: "field" + (wide ? " span-2" : "") },
        el("span", {}, label), input, hint ? el("small", { class: "field-hint" }, hint) : null);
    }

    async function authenticate(kind, f, buttons) {
      if (working) return;
      working = true;
      const hadProfile = !!HY.store.state.profile;
      (buttons || []).forEach((b) => { b.disabled = true; });
      try {
        HY.sync.saveConfig({ url: f.urlIn.value, anonKey: f.keyIn.value, email: f.emailIn.value.trim(), enabled: true });
        const res = kind === "signup"
          ? await HY.sync.signUp(f.emailIn.value.trim(), f.passIn.value)
          : await HY.sync.signIn(f.emailIn.value.trim(), f.passIn.value);
        f.passIn.value = "";
        if (res && res.needsConfirmation) {
          C.toast("Check your email to confirm the account, then sign in here.", "warn");
        } else {
          try {
            await HY.sync.syncNow({ silent: true });
            C.toast("Signed in. Progress merged and synced.");
          } catch (e) {
            C.toast("Signed in, but sync failed: " + e.message, "warn");
          }
        }
        if (!hadProfile && HY.store.state.profile) {
          HY.app.go("/home");
          return;
        }
        HY.app.refresh();
      } catch (e) {
        C.toast(e.message || "Could not connect.", "warn");
      } finally {
        working = false;
        (buttons || []).forEach((b) => { b.disabled = false; });
      }
    }

    async function manual(fn, success) {
      if (working) return;
      working = true;
      try {
        await fn();
        C.toast(success || "Sync complete.");
      } catch (e) {
        C.toast(e.message || "Sync failed.", "warn");
      } finally {
        working = false;
        HY.app.refresh();
      }
    }

    if (!HY.sync.configured()) {
      const f = authFields();
      const signIn = C.btn("Sign in", { kind: "primary", icon: "cloud", onClick: () => authenticate("signin", f, [signIn, signUp]) });
      const signUp = C.btn("Create account", { kind: "soft", onClick: () => authenticate("signup", f, [signIn, signUp]) });
      add(
        C.notice("info", el("div", {}, el("strong", {}, "Progress is local to this browser. "),
          "Connect your own Supabase project to sync it to your phone. The ", guide, " has the SQL and the hosting steps.")),
        el("div", { class: "sync-grid" },
          field("Project URL", f.urlIn, true, "Supabase → Project Settings → API"),
          field("Anon public key", f.keyIn, true, "The public anon key, not the service_role key"),
          field("Email", f.emailIn),
          field("Password", f.passIn)),
        el("div", { class: "sync-actions" }, signIn, signUp),
        el("p", { class: "muted tiny" }, "Supabase hashes the password; this browser keeps only a session token. Study data is sent only to your project.")
      );
      return card;
    }

    if (!HY.sync.signedIn()) {
      const f = authFields(cfg.email);
      const signIn = C.btn("Sign in", { kind: "primary", icon: "cloud", onClick: () => authenticate("signin", f, [signIn]) });
      add(
        el("div", { class: "sync-status" },
          el("span", { class: "sync-dot idle" }),
          el("div", { class: "sync-status-main" }, el("strong", {}, "Connected to " + cfg.url), el("span", { class: "muted small" }, "Sign in to pull your progress.")),
          el("span", { class: "pill pill-muted" }, "signed out")),
        el("div", { class: "sync-grid" },
          field("Email", f.emailIn),
          field("Password", f.passIn)),
        el("div", { class: "sync-actions" }, signIn,
          C.btn("Change project", { kind: "ghost", icon: "gear", onClick: () => {
            C.confirm("Change the sync project?", "Sign out and forget this project URL and key on this device. Local progress stays.", "Change").then((ok) => {
              if (!ok) return;
              HY.sync.disconnect();
              HY.app.refresh();
            });
          } })),
        el("p", { class: "muted tiny" }, "Use the same email and password on the iPhone. Passwords are never stored by this app.")
      );
      return card;
    }

    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    const tone = offline ? "idle" : st.lastError ? "err" : st.syncing ? "idle" : "ok";
    add(
      el("div", { class: "sync-status" },
        el("span", { class: "sync-dot " + tone }),
        el("div", { class: "sync-status-main" },
          el("strong", {}, HY.sync.statusText()),
          el("span", { class: "muted small" }, cfg.email || "Signed in")),
        el("span", { class: "pill " + (offline ? "pill-muted" : st.lastError ? "pill-red" : "pill-jade") }, "rev " + (cfg.baseRev || 0))),
      offline ? C.notice("info", "Offline. Local progress is safe; sync resumes automatically when the connection returns.") :
        st.lastError ? C.notice("warn", el("div", {}, el("strong", {}, "Last sync failed. "), st.lastError)) : null,
      el("label", { class: "check-inline" },
        el("input", { type: "checkbox", checked: cfg.enabled !== false, onchange: (e) => {
          HY.sync.saveConfig({ enabled: e.target.checked });
          C.toast(e.target.checked ? "Auto-sync on." : "Auto-sync off.", null);
        } }),
        el("span", {}, "Auto-sync after sessions and setting changes")),
      el("div", { class: "sync-actions" },
        C.btn("Sync now", { kind: "primary", icon: "refresh", onClick: () => manual(() => HY.sync.syncNow({}), "Synced.") }),
        C.btn("Upload this device", { kind: "soft", icon: "upload", onClick: () => {
          C.confirm("Upload this device over the cloud copy?", "This device's snapshot replaces the cloud copy. Other devices merge it on their next sync. Export a backup first if unsure.", "Upload").then((ok) => {
            if (ok) manual(() => HY.sync.upload(), "Cloud copy replaced with this device.");
          });
        } }),
        C.btn("Download from cloud", { kind: "ghost", icon: "download", onClick: () => {
          C.confirm("Replace this device with the cloud copy?", "Local progress on this device is replaced. This is the right choice on a fresh phone; export a backup if this device has work you want to keep.", "Download").then((ok) => {
            if (!ok) return;
            manual(() => HY.sync.download().then(() => HY.app.go("/home")), "Cloud copy loaded.");
          });
        } }),
        C.btn("Sign out", { kind: "ghost", icon: "lock", onClick: () => {
          HY.sync.signOut().then(() => {
            C.toast("Signed out. Local progress remains.");
            HY.app.refresh();
          }).catch(() => { C.toast("Signed out locally.", "warn"); HY.app.refresh(); });
        } })),
      el("p", { class: "muted tiny" },
        "Sync merges word cards, lesson stages, daily totals and attempts; newer settings win. ",
        el("span", {}, "Last sync: " + (st.lastSyncAt ? new Date(st.lastSyncAt).toLocaleString() : "not yet") + ". "),
        guide)
    );
    return card;
  }

  function render() {
    const s = HY.store.state;
    if (!s.profile) {
      return C.page({
        eyebrow: "Settings",
        title: "Restore or start setup",
        sub: "If you already sync on another device, pull it down here before creating a new plan.",
        body: el("div", {},
          cloudCard(s),
          C.card({ title: "Study setup" },
            el("p", {}, "No local profile yet. Finish the short onboarding to choose an exam date, voice and plan."),
            C.btn("Open study setup", { kind: "primary", icon: "arrowRight", onClick: () => HY.app.go("/onboarding") })))
      });
    }
    const p = s.profile;
    const plan = s.plan || HY.plan.generate(p.startDate, p.targetDate, p.dailyMinutes);

    const dateInput = el("input", { type: "date", class: "input", value: p.targetDate });
    dateInput.addEventListener("change", () => {
      if (!dateInput.value) return;
      const days = U.daysBetween(p.startDate, dateInput.value);
      if (days < 56) { C.toast("Give yourself at least eight weeks.", "warn"); dateInput.value = p.targetDate; return; }
      p.targetDate = dateInput.value;
      s.plan = HY.plan.generate(p.startDate, p.targetDate, p.dailyMinutes);
      HY.store.touchConfig();
      C.toast("Plan rebuilt for the new date.");
      HY.app.refresh();
    });

    const voices = HY.tts.zhVoices();
    const voiceSel = select([{ value: "", label: "Automatic (best available)" }].concat(voices.map((v) => ({ value: v.voiceURI, label: v.name + " · " + v.lang }))), s.settings.voiceURI, (v) => {
      s.settings.voiceURI = v;
      HY.store.touchConfig();
      HY.tts.speak("声音测试。今天练习第五级的中文。", { voiceURI: v, rate: s.settings.rate });
    });

    const rate = el("input", { type: "range", min: "0.6", max: "1.2", step: "0.05", value: String(s.settings.rate), class: "range" });
    const rateVal = el("span", { class: "range-val" }, s.settings.rate.toFixed(2) + "×");
    rate.addEventListener("input", () => { rateVal.textContent = Number(rate.value).toFixed(2) + "×"; });
    rate.addEventListener("change", () => { s.settings.rate = Number(rate.value); HY.store.touchConfig(); });

    const storage = HY.store.storageMode;
    const counts = HY.srs.counts(s);
    const cards = Object.keys(s.cards).length;

    const body = el("div", {},
      cloudCard(s),
      C.card({ title: "Plan", sub: "Change the horizon and the schedule rebuilds around the lessons you have already finished." },
        row("Target exam date", "Drives the countdown, checkpoint weeks and pace comparison.", dateInput),
        row("Weekday session length", "Used to size reviews, new words and the lesson block.", select([
          { value: 30, label: "30 minutes" }, { value: 35, label: "35 minutes" }, { value: 45, label: "45 minutes" }, { value: 60, label: "60 minutes" }
        ], p.dailyMinutes, (v) => {
          p.dailyMinutes = Number(v);
          s.plan = HY.plan.generate(p.startDate, p.targetDate, p.dailyMinutes);
          HY.store.touchConfig();
          HY.app.refresh();
        })),
        row("Started", "The first day of the plan.", el("span", { class: "value-static" }, U.fmtDay(p.startDate, "long"))),
        row("Rebuild plan", "Keeps progress and re-spaces the remaining lessons.",
          C.btn("Rebuild", { kind: "ghost", icon: "refresh", onClick: () => {
            s.plan = HY.plan.generate(p.startDate, p.targetDate, p.dailyMinutes);
            HY.store.touchConfig();
            C.toast("Plan rebuilt.");
            HY.app.refresh();
          } }))),
      C.card({ title: "Study load" },
        row("New words per session", "Reviews take priority; the app lowers this automatically when the queue is heavy.", select([
          { value: 8, label: "8" }, { value: 10, label: "10" }, { value: 12, label: "12" }, { value: 15, label: "15 (default)" }, { value: 18, label: "18" }, { value: 20, label: "20" }
        ], s.settings.newPerDay, (v) => { s.settings.newPerDay = Number(v); HY.store.touchConfig(); })),
        row("Review ceiling per session", "A hard cap so a backlog cannot swallow the session.", select([
          { value: 25, label: "25" }, { value: 35, label: "35" }, { value: 45, label: "45 (default)" }, { value: 60, label: "60" }, { value: 80, label: "80" }
        ], s.settings.reviewCap, (v) => { s.settings.reviewCap = Number(v); HY.store.touchConfig(); })),
        row("Reduce motion", "Turns off the small transitions.", toggle(!!s.settings.reduceMotion, (v) => { s.settings.reduceMotion = v; document.documentElement.dataset.motion = v ? "reduced" : ""; HY.store.touchConfig(); }))),
      C.card({ title: "Audio" },
        row("Mandarin voice", voices.length ? "Voices installed in this browser." : "No Mandarin voice found. Add a Chinese speech pack or use another browser.", voiceSel),
        el("div", { class: "setting-row" },
          el("div", { class: "setting-copy" }, el("strong", {}, "Speed"), el("p", {}, "Listening dictation has its own slow button.")),
          el("div", { class: "setting-control row gap" }, rate, rateVal)),
        el("div", { class: "row gap" },
          C.btn("Test voice", { kind: "soft", icon: "volume", onClick: () => HY.tts.speak("你好，欢迎回来。我们今天开始学习第五级的中文。", { voiceURI: s.settings.voiceURI, rate: s.settings.rate }) }),
          C.btn("Refresh list", { kind: "ghost", icon: "refresh", onClick: () => HY.app.refresh() })),
        voices.length ? el("p", { class: "muted tiny" }, voices.map((v) => v.name).join(" · ")) : C.notice("warn", "Windows: Settings → Time & Language → Speech → Add voices → Chinese (Simplified). Then restart the browser.")),
      C.card({ title: "Appearance" },
        row("Theme", "A darker desk for evening sessions.", select([{ value: "light", label: "Paper" }, { value: "dark", label: "Ink" }], s.settings.theme, (v) => {
          s.settings.theme = v; applyTheme(v); HY.store.touchConfig();
        }))),
      C.card({ title: "Data", sub: storage === "local" ? "Progress lives in this browser and, when sync is on, in your Supabase project. Export a backup before changing computers." : "Storage is blocked — progress exists only in memory. Export now." },
        el("div", { class: "data-grid" },
          dataStat("Words introduced", counts.introduced),
          dataStat("Review cards", cards),
          dataStat("Sessions", s.sessions.length),
          dataStat("Compositions", s.writing.length),
          dataStat("Checkpoints", s.exams.length),
          dataStat("Storage", storage === "local" ? "local" : "memory")),
        el("div", { class: "row gap wrap" },
          C.btn("Export backup", { kind: "primary", icon: "download", onClick: () => {
            HY.store.flush();
            U.download("hanyu-hsk5-" + U.today() + ".json", JSON.stringify(HY.store.exportObject(), null, 1));
          } }),
          importBtn(),
          C.btn("Reset everything", { kind: "danger", icon: "warn", onClick: () => {
            C.confirm("Reset all progress?", "This deletes every word, review schedule, lesson stage, composition and checkpoint result from this browser. Export a backup first if there is any doubt.", "Delete everything").then((ok) => {
              if (!ok) return;
              HY.store.reset();
              applyTheme("light");
              HY.app.go("/onboarding");
            });
          } })),
        el("p", { class: "muted tiny" }, "Import replaces the current state. The backup contains no personal information beyond your study history.")),
      C.card({ title: "Calibration" },
        s.diagnostic ? el("div", {},
          el("div", { class: "fact-list" },
            fact("Taken", U.fmtDay(s.diagnostic.date, "long")),
            fact("Result", s.diagnostic.band),
            fact("Overall", Math.round(s.diagnostic.overall * 100) + "%"),
            fact("Refresh words", s.diagnostic.refresh.length)),
          C.btn("Retake calibration", { kind: "ghost", icon: "target", onClick: () => {
            C.confirm("Retake calibration?", "The old result is replaced and the plan start date moves to today. Lesson progress stays.", "Retake").then((ok) => {
              if (!ok) return;
              s.diagnostic = null; s.diagnosticRun = null; HY.store.touchConfig(); HY.app.go("/diagnostic");
            });
          } })) : el("div", {},
          el("p", {}, "You skipped the fifteen-minute calibration. It finds rusty HSK4 words and sets a more honest review load."),
          C.btn("Run calibration", { kind: "primary", icon: "target", onClick: () => HY.app.go("/diagnostic") }))),
      C.card({ title: "About & sources" },
        el("p", { class: "small" }, "A personal study desk for HSK Standard Course 5 (HSK 2.0). Vocabulary follows the textbook's lesson order; readings, dictation, grammar explanations and writing prompts are original study material written for this app. It is not affiliated with the textbook publisher, Hanban/CTI, or any exam board."),
        el("ul", { class: "plain-list small" },
          el("li", {}, "Vocabulary glosses adapted from CC-CEDICT (CC BY-SA 3.0)."),
          el("li", {}, "HSK 2.0 level lists via the MIT-licensed complete-hsk-vocabulary project."),
          el("li", {}, "Lesson-by-lesson core word order cross-checked against HanziStroke's HSK Standard Course 5 index."),
          el("li", {}, "Mandarin audio is generated locally by your browser's speech engine; no audio leaves the machine.")),
        el("p", { class: "muted tiny" }, "Version 1.1 · local-first; when sync is connected the app also writes a sanitized snapshot to your Supabase project."))
    );

    applyTheme(s.settings.theme || "light");
    document.documentElement.dataset.motion = s.settings.reduceMotion ? "reduced" : "";

    return C.page({ eyebrow: "Settings", title: "Tune the desk", sub: "Local-first. Cloud sync is optional and goes only to your own Supabase project.", body });
  }

  function importBtn() {
    const input = el("input", { type: "file", accept: ".json,application/json", style: { display: "none" } });
    input.addEventListener("change", async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      try {
        const text = await U.readFile(f);
        const obj = JSON.parse(text);
        const ok = await C.confirm("Replace current progress?", "The backup's history will replace everything currently stored.", "Import and replace");
        if (!ok) { input.value = ""; return; }
        HY.store.importObject(obj);
        HY.store.touchConfig();
        applyTheme(HY.store.state.settings.theme || "light");
        C.toast("Backup restored.");
        HY.app.go("/home");
      } catch (e) {
        C.toast("That file could not be read as a Hanyu backup.", "warn");
      }
      input.value = "";
    });
    const b = C.btn("Import backup", { kind: "soft", icon: "upload", onClick: () => input.click() });
    return el("span", {}, b, input);
  }

  function dataStat(label, value) {
    return el("div", { class: "data-stat" }, el("strong", {}, String(value)), el("span", {}, label));
  }

  function fact(label, value) {
    return el("div", { class: "fact" }, el("span", {}, label), el("strong", {}, value));
  }

  HY.views = HY.views || {};
  HY.views.settings = render;
})();

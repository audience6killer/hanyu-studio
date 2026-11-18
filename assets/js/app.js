/* App shell, routing, navigation chrome. */
(function () {
  const HY = window.HY;
  const U = HY.util;
  const C = HY.ui;
  const el = U.el;

  const ROUTES = [
    { re: /^\/?$/, view: "home", title: "Today" },
    { re: /^\/lessons$/, view: "lessons", title: "Lessons" },
    { re: /^\/lesson\/(\d+)$/, view: "lesson", title: "Lesson" },
    { re: /^\/session$/, view: "session", title: "Study session" },
    { re: /^\/review$/, view: "review", title: "Review" },
    { re: /^\/exam$/, view: "exam", title: "Checkpoints" },
    { re: /^\/stats$/, view: "stats", title: "Progress" },
    { re: /^\/settings$/, view: "settings", title: "Settings" },
    { re: /^\/onboarding$/, view: "onboarding", title: "Set up" },
    { re: /^\/diagnostic$/, view: "diagnostic", title: "Calibration" }
  ];

  const NAV = [
    { view: "home", label: "Today", icon: "home" },
    { view: "lessons", label: "Lessons", icon: "book" },
    { view: "review", label: "Review", icon: "cards" },
    { view: "exam", label: "Exams", icon: "target" },
    { view: "stats", label: "Progress", icon: "chart" },
    { view: "settings", label: "Settings", icon: "gear" }
  ];

  function parse() {
    const raw = location.hash.replace(/^#/, "") || "/";
    for (const r of ROUTES) {
      const m = raw.match(r.re);
      if (m) return { route: r, params: m.slice(1), path: raw };
    }
    return { route: { view: "home", title: "Today" }, params: [], path: "/" };
  }

  function activeView(view) {
    if (view === "lesson" || view === "session") return "lessons";
    if (view === "onboarding") return "home";
    if (view === "diagnostic") return "home";
    return view;
  }

  function sidebar(active) {
    const s = HY.store.state;
    const due = HY.srs.dueCount(s, Date.now());
    const nav = el("nav", { class: "nav" });
    NAV.forEach((n) => {
      const a = el("a", { class: "nav-link" + (active === n.view ? " active" : ""), href: "#/" + n.view },
        U.icon(n.icon, 19),
        el("span", { class: "nav-label" }, n.label),
        n.view === "review" && due ? el("span", { class: "nav-badge" }, String(due)) : null);
      nav.appendChild(a);
    });
    const streak = U.streak(s.days);
    const daysToExam = s.profile ? Math.max(0, U.daysBetween(U.today(), s.profile.targetDate)) : 0;
    return el("aside", { class: "sidebar" },
      el("a", { class: "brand", href: "#/home" },
        el("span", { class: "brand-mark" }, "汉"),
        el("span", { class: "brand-text" },
          el("strong", {}, "HSK5 Studio"),
          el("small", {}, "第五级 · study desk"))),
      nav,
      el("div", { class: "sidebar-foot" },
        el("div", { class: "mini-stat" },
          el("span", { class: "mini-icon" }, U.icon("flame", 16)),
          el("span", {}, streak + " day streak")),
        el("div", { class: "mini-stat" },
          el("span", { class: "mini-icon" }, U.icon("calendar", 16)),
          el("span", {}, s.profile ? daysToExam + " days to exam" : "No exam date yet")),
        el("div", { class: "mini-muted", text: HY.store.storageMode === "local" ? "Saved in this browser" : "Memory only — export a backup" })
      )
    );
  }

  function topbar() {
    const s = HY.store.state;
    const days = s.profile ? Math.max(0, U.daysBetween(U.today(), s.profile.targetDate)) : null;
    const due = HY.srs.dueCount(s, Date.now());
    return el("header", { class: "topbar" },
      el("div", { class: "topbar-left" },
        el("a", { class: "topbar-brand", href: "#/home" }, el("span", { class: "brand-mark small" }, "汉")),
        el("span", { class: "topbar-title", id: "topbar-title" }, HY.app.title || "Today")),
      el("div", { class: "topbar-right" },
        due ? el("a", { class: "top-chip", href: "#/review" }, U.icon("cards", 15), el("span", {}, due + " due")) : null,
        days != null ? el("a", { class: "top-chip", href: "#/exam" }, U.icon("target", 15), el("span", {}, days + "d")) : null,
        el("button", { class: "icon-btn", type: "button", title: "Keyboard shortcuts", "aria-label": "Keyboard shortcuts", onclick: HyHelp },
          U.icon("info", 19))
      )
    );
  }

  function HyHelp() {
    const rows = [
      ["Space", "Play the audio on screen"],
      ["1 – 4", "Choose an answer option"],
      ["Enter", "Continue / next item"],
      ["Esc", "Close a dialog"],
      ["?", "This panel"]
    ];
    const m = C.modal({
      title: "Keyboard shortcuts",
      body: el("div", { class: "shortcut-list" }, rows.map(([k, v]) =>
        el("div", { class: "shortcut-row" }, el("kbd", { class: "kbd" }, k), el("span", {}, v)))),
      actions: C.btn("Close", { kind: "primary", onClick: () => m.close() })
    });
  }

  HY.app = {
    title: "Today",
    go(hash) {
      if (location.hash === "#" + hash) render();
      else location.hash = "#" + hash;
    },
    refresh() { render(); },
    render
  };

  function render() {
    const { route, params } = parse();
    const s = HY.store.state;
    HY.tts.cancel();

    if (!s.profile && route.view !== "onboarding" && route.view !== "settings") {
      location.hash = "#/onboarding";
      return;
    }
    if (s.profile && s.onboarded && route.view === "onboarding") {
      location.hash = "#/home";
      return;
    }
    if (s.profile && !s.plan && route.view !== "onboarding" && route.view !== "settings") {
      s.plan = HY.plan.generate(s.profile.startDate, s.profile.targetDate, s.profile.dailyMinutes);
      HY.store.save();
    }

    HY.app.title = route.view === "lesson" ? "Lesson " + params[0] : route.title;
    const view = HY.views[route.view];
    const outlet = U.$("#view");
    const app = U.$("#app");
    if (!view) {
      outlet.innerHTML = "";
      outlet.appendChild(C.empty("warn", "Missing view", "This screen is not available."));
      return;
    }
    try {
      const node = view.apply(null, params);
      outlet.innerHTML = "";
      outlet.appendChild(node);
      outlet.scrollTop = 0;
      window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      outlet.innerHTML = "";
      outlet.appendChild(C.page({
        title: "Something went wrong",
        body: C.card({}, el("p", {}, "The screen could not render. Your progress is safe."),
          el("pre", { class: "error-pre" }, String(e && e.stack || e)))
      }));
    }
    document.title = HY.app.title + " · HSK5 Studio";

    // chrome
    const active = activeView(route.view);
    if (app) {
      const oldSide = U.$(".sidebar");
      if (oldSide) oldSide.replaceWith(sidebar(active));
      const oldTop = U.$(".topbar");
      if (oldTop) oldTop.replaceWith(topbar());
    }
    U.$$(".nav-link").forEach((a) => {
      if (a.getAttribute("href") === "#/" + active) a.classList.add("active");
    });
  }

  function boot() {
    HY.store.load();
    HY.tts.init();
    HY.store.onStorageError(() => {
      C.toast("Could not save to this browser's storage. Export a backup from Settings.", "warn");
    });
    const outlet = U.$("#view");
    if (outlet) {
      outlet.innerHTML = "";
      outlet.appendChild(el("div", { class: "boot" }, el("span", { class: "brand-mark" }, "汉"), el("span", {}, "Loading your desk…")));
    }
    render();
    if (HY.sync) HY.sync.init();
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
      const register = () => navigator.serviceWorker.register("./sw.js").catch(() => { /* offline shell is optional */ });
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }
    window.addEventListener("hashchange", render);
    document.addEventListener("keydown", (e) => {
      if (e.key === "?" && !/input|textarea/i.test((e.target.tagName || ""))) { e.preventDefault(); HyHelp(); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

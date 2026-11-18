/* Shared UI primitives. */
(function () {
  const HY = window.HY;
  const U = HY.util;
  const el = U.el;
  const C = (HY.ui = HY.ui || {});

  C.icon = U.icon;

  C.page = function (opts) {
    const head = el("div", { class: "page-head" },
      el("div", {},
        opts.eyebrow ? el("div", { class: "eyebrow", text: opts.eyebrow }) : null,
        el("h1", { class: "page-title" }, opts.title),
        opts.sub ? el("p", { class: "page-sub" }, opts.sub) : null
      ),
      opts.actions ? el("div", { class: "page-actions" }, opts.actions) : null
    );
    const main = el("div", { class: "page-body" }, opts.body);
    return el("section", { class: "page" + (opts.wide ? " wide" : "") }, head, main);
  };

  C.card = function (opts, ...kids) {
    opts = opts || {};
    return el("section", { class: "card" + (opts.tone ? " tone-" + opts.tone : "") + (opts.cls ? " " + opts.cls : "") },
      opts.title ? el("div", { class: "card-head" },
        el("div", {},
          el("h2", { class: "card-title" }, opts.title),
          opts.sub ? el("p", { class: "card-sub" }, opts.sub) : null),
        opts.action || null) : null,
      el("div", { class: "card-body" }, kids)
    );
  };

  C.btn = function (label, opts) {
    opts = opts || {};
    const cls = ["btn"];
    if (opts.kind) cls.push("btn-" + opts.kind);
    if (opts.size === "sm") cls.push("btn-sm");
    if (opts.block) cls.push("btn-block");
    if (!label && opts.icon) cls.push("btn-icon");
    const b = el("button", {
      class: cls.join(" "),
      type: "button",
      disabled: opts.disabled || false,
      title: opts.title || "",
      "aria-label": opts.ariaLabel || opts.title || (typeof label === "string" ? label : ""),
      onclick: opts.onClick || null
    }, opts.icon ? U.icon(opts.icon, opts.iconSize || 18) : null, label || null);
    if (opts.data) Object.assign(b.dataset, opts.data);
    return b;
  };

  C.link = function (label, href, opts) {
    opts = opts || {};
    return el("a", { class: "link" + (opts.cls ? " " + opts.cls : ""), href: href }, label);
  };

  C.pill = function (text, kind) {
    return el("span", { class: "pill" + (kind ? " pill-" + kind : "") }, text);
  };

  C.chip = function (text, kind) {
    return el("span", { class: "chip" + (kind ? " chip-" + kind : "") }, text);
  };

  C.kbd = function (key) { return el("kbd", { class: "kbd" }, key); };

  C.progress = function (value, max, opts) {
    opts = opts || {};
    const pct = max ? U.clamp(Math.round((value / max) * 100), 0, 100) : 0;
    return el("div", { class: "bar" + (opts.sm ? " bar-sm" : ""), role: "progressbar", "aria-valuenow": pct, "aria-valuemin": "0", "aria-valuemax": "100" },
      el("div", { class: "bar-fill" + (opts.tone ? " tone-" + opts.tone : ""), style: { width: pct + "%" } })
    );
  };

  C.ring = function (pct, size, label, sub) {
    size = size || 92;
    const r = (size - 12) / 2;
    const circ = 2 * Math.PI * r;
    const dash = circ * U.clamp(pct, 0, 100) / 100;
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);
    svg.setAttribute("width", size); svg.setAttribute("height", size);
    svg.setAttribute("class", "ring");
    const bg = document.createElementNS(NS, "circle");
    bg.setAttribute("cx", size / 2); bg.setAttribute("cy", size / 2); bg.setAttribute("r", r);
    bg.setAttribute("class", "ring-bg");
    const fg = document.createElementNS(NS, "circle");
    fg.setAttribute("cx", size / 2); fg.setAttribute("cy", size / 2); fg.setAttribute("r", r);
    fg.setAttribute("class", "ring-fg");
    fg.setAttribute("stroke-dasharray", dash + " " + circ);
    fg.setAttribute("transform", "rotate(-90 " + size / 2 + " " + size / 2 + ")");
    svg.appendChild(bg); svg.appendChild(fg);
    return el("div", { class: "ring-wrap", style: { width: size + "px", height: size + "px" } },
      svg,
      el("div", { class: "ring-text" },
        el("strong", { text: label }),
        sub ? el("span", { text: sub }) : null));
  };

  C.stat = function (label, value, sub, tone) {
    return el("div", { class: "stat" + (tone ? " tone-" + tone : "") },
      el("div", { class: "stat-label" }, label),
      el("div", { class: "stat-value" }, value),
      sub ? el("div", { class: "stat-sub" }, sub) : null);
  };

  C.empty = function (icon, title, sub, action) {
    return el("div", { class: "empty" },
      el("div", { class: "empty-icon" }, U.icon(icon || "inbox", 28)),
      el("h3", {}, title),
      sub ? el("p", {}, sub) : null,
      action || null);
  };

  C.tabs = function (items, active, onPick) {
    const wrap = el("div", { class: "tabs", role: "tablist" });
    items.forEach((it) => {
      const b = el("button", {
        class: "tab" + (it.id === active ? " active" : ""),
        type: "button", role: "tab", "aria-selected": it.id === active,
        onclick: () => onPick(it.id)
      }, it.label, it.badge != null ? el("span", { class: "tab-badge" }, String(it.badge)) : null);
      wrap.appendChild(b);
    });
    return wrap;
  };

  C.heatmap = function (days, weeks) {
    weeks = weeks || 12;
    const now = new Date();
    const dow = (now.getDay() + 6) % 7; // Mon=0
    const start = new Date(now); start.setDate(now.getDate() - dow - (weeks - 1) * 7);
    const wrap = el("div", { class: "heatmap" });
    const labels = el("div", { class: "hm-labels" }, el("span", {}, "Mon"), el("span", {}, "Wed"), el("span", {}, "Fri"));
    const grid = el("div", { class: "hm-grid", style: { gridTemplateColumns: "repeat(" + weeks + ", 1fr)" } });
    for (let w = 0; w < weeks; w++) {
      const col = el("div", { class: "hm-col" });
      for (let d = 0; d < 7; d++) {
        const dt = new Date(start); dt.setDate(start.getDate() + w * 7 + d);
        const key = U.dayKey(dt);
        const rec = days[key];
        const min = rec ? rec.minutes || 0 : 0;
        let lvl = 0;
        if (min >= 45) lvl = 4; else if (min >= 25) lvl = 3; else if (min >= 10) lvl = 2; else if (min > 0) lvl = 1;
        const cell = el("div", { class: "hm-cell", dataset: { l: lvl }, title: key + " · " + min + " min" });
        col.appendChild(cell);
      }
      grid.appendChild(col);
    }
    wrap.appendChild(grid);
    wrap.appendChild(labels);
    return wrap;
  };

  C.bars = function (values, labels, opts) {
    opts = opts || {};
    const max = Math.max(1, ...values);
    const wrap = el("div", { class: "bars" });
    values.forEach((v, i) => {
      const h = Math.max(2, Math.round((v / max) * (opts.height || 70)));
      wrap.appendChild(el("div", { class: "bar-col", title: (labels && labels[i] ? labels[i] + ": " : "") + v },
        el("div", { class: "bar-track" }, el("div", { class: "bar-fill" + (opts.tone ? " tone-" + opts.tone : ""), style: { height: h + "px" } })),
        labels ? el("span", { class: "bar-label", text: labels[i] }) : null));
    });
    return wrap;
  };

  C.optionButtons = function (options, opts) {
    opts = opts || {};
    const wrap = el("div", { class: "mc-options" });
    const buttons = [];
    options.forEach((opt, i) => {
      const b = el("button", {
        class: "mc-option", type: "button",
        onclick: () => {
          if (wrap.dataset.locked === "1") return;
          wrap.dataset.locked = "1";
          const correct = i === opts.answer;
          buttons.forEach((x, j) => {
            x.classList.add("is-locked");
            if (j === opts.answer) x.classList.add("is-correct");
            if (j === i && !correct) x.classList.add("is-wrong");
          });
          opts.onPick && opts.onPick(correct, i);
        }
      }, el("span", { class: "mc-key", text: "ABCD"[i] }), el("span", { class: "mc-text" }, opt));
      buttons.push(b); wrap.appendChild(b);
    });
    return wrap;
  };

  C.audio = function (text, opts) {
    opts = opts || {};
    const b = C.btn("", {
      kind: "soft", icon: "volume", title: "Play audio (space)",
      onClick: (e) => {
        e.stopPropagation();
        if (b.classList.contains("playing")) { HY.tts.cancel(); b.classList.remove("playing"); return; }
        b.classList.add("playing");
        HY.tts.speak(text, { rate: opts.rate, voiceURI: opts.voiceURI }).then(() => b.classList.remove("playing"));
        setTimeout(() => b.classList.remove("playing"), Math.max(4000, Array.from(text).length * 600));
      }
    });
    b.classList.add("audio-btn");
    b.setAttribute("aria-label", "Play audio");
    return b;
  };

  C.hanzi = function (text, opts) {
    opts = opts || {};
    return el("span", { class: "hanzi" + (opts.cls ? " " + opts.cls : ""), style: opts.size ? { fontSize: opts.size } : null, lang: "zh-Hans" }, text);
  };

  C.pinyin = function (text) { return el("span", { class: "pinyin" }, text); };

  /** A reading passage whose words and characters open the definition dialog. */
  C.passage = function (text, opts) {
    opts = opts || {};
    const wrap = el("div", { class: "passage" + (opts.cls ? " " + opts.cls : ""), lang: "zh-Hans" });
    String(text || "").split("\n").forEach((para) => {
      const line = el("p", {});
      HY.data.tokenize(para).forEach((tok) => {
        if (tok.w) {
          line.appendChild(el("span", {
            class: "tap-word", tabindex: "0", role: "button",
            title: "Pinyin, meaning and audio",
            onclick: () => C.wordModal(tok.w),
            onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); C.wordModal(tok.w); } }
          }, tok.t));
        } else if (tok.t) {
          line.appendChild(document.createTextNode(tok.t));
        }
      });
      wrap.appendChild(line);
    });
    return wrap;
  };

  C.toast = function (msg, kind) {
    let root = U.$("#toast-root");
    if (!root) { root = el("div", { id: "toast-root", class: "toast-root" }); document.body.appendChild(root); }
    const t = el("div", { class: "toast" + (kind ? " toast-" + kind : "") }, msg);
    root.appendChild(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, 2800);
  };

  C.modal = function (opts) {
    const root = U.$("#modal-root") || document.body;
    const close = () => { backdrop.classList.add("out"); setTimeout(() => backdrop.remove(), 180); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    const body = el("div", { class: "modal-body" }, opts.body);
    const foot = opts.actions ? el("div", { class: "modal-foot" }, opts.actions) : null;
    const dialog = el("div", { class: "modal" + (opts.wide ? " modal-wide" : ""), role: "dialog", "aria-modal": "true", "aria-label": opts.title || "Dialog" },
      el("div", { class: "modal-head" },
        el("h2", {}, opts.title || ""),
        C.btn("", { kind: "ghost", icon: "x", onClick: close, ariaLabel: "Close" })),
      body, foot);
    const backdrop = el("div", { class: "modal-backdrop", onclick: (e) => { if (e.target === backdrop) close(); } }, dialog);
    root.appendChild(backdrop);
    document.addEventListener("keydown", onKey);
    setTimeout(() => { const f = dialog.querySelector("button, input, textarea"); if (f) f.focus(); }, 30);
    return { close, dialog };
  };

  C.confirm = function (title, message, okLabel) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (done) return; done = true; m.close(); resolve(v); };
      const m = C.modal({
        title,
        body: el("p", { class: "modal-text" }, message),
        actions: el("div", { class: "row gap" },
          C.btn("Cancel", { kind: "ghost", onClick: () => finish(false) }),
          C.btn(okLabel || "Continue", { kind: "primary", onClick: () => finish(true) }))
      });
    });
  };

  C.notice = function (kind, text) {
    return el("div", { class: "callout callout-" + (kind || "info") }, el("span", { class: "callout-icon" }, U.icon(kind === "warn" ? "warn" : "info", 18)), el("div", {}, text));
  };

  C.meterRow = function (label, value, max, tone) {
    return el("div", { class: "meter-row" },
      el("div", { class: "meter-line" }, el("span", {}, label), el("strong", {}, value + " / " + max)),
      C.progress(value, max, { tone, sm: true }));
  };

  C.divider = () => el("div", { class: "divider" });

  C.timer = function (seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60), r = s % 60;
    return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
  };

  C.wordModal = function (word) {
    const HY = window.HY;
    const U = HY.util;
    const s = HY.store.state;
    // Accept either the hanzi string or a token object, so a stale caller can
    // never turn a tap into a silent no-op.
    const text = typeof word === "string" ? word : (word && (word.w || word.t)) || "";
    if (!text) return;
    const core = HY.data.lookup(text);
    const entry = HY.data.define(text);
    const complete = !!(core && core.py && core.en);
    const chars = Array.from(text).length;
    const isChar = chars === 1;
    const status = complete ? HY.srs.statusOf(s, text) : "";
    const examples = complete ? HY.data.examplesFor(text) : [];
    const cards = complete ? ["rec", "prod", "listen"].map((skill) => s.cards[HY.srs.cardKey(text, skill)]).filter(Boolean) : [];
    const introduced = complete ? !!s.words[text] : false;
    const actions = el("div", { class: "row gap wrap" });
    actions.appendChild(C.audio(text, { rate: s.settings.rate }));
    if (complete && !introduced) {
      actions.appendChild(C.btn("Add to reviews", {
        kind: "primary",
        onClick: () => {
          HY.srs.introduceWord(s, text, { lesson: core.lesson || 0, source: core.lesson ? "book" : (HY.data.hsk4[text] ? "hsk4" : "gap"), known: false });
          HY.store.save(true);
          C.toast("Added to your review queue.");
          m.close();
        }
      }));
    } else if (complete) {
      const suspended = cards.length && cards.every((c) => c.suspended);
      actions.appendChild(C.btn(suspended ? "Resume reviews" : "Suspend reviews", {
        kind: "ghost",
        onClick: () => {
          HY.srs.suspendWord(s, text, !suspended);
          C.toast(suspended ? "Reviews resumed." : "Reviews suspended.");
          m.close();
        }
      }));
    }
    const level = complete ? HY.data.level(text) : "";
    const tags = el("div", { class: "row gap wrap" },
      complete ? C.pill(HY.data.allTags[level] || "Word", level === "book" ? "red" : "gold")
           : C.pill(isChar ? "character" : "reference", "muted"),
      core && core.pos ? C.pill(core.pos, "muted") : null,
      core && core.rad ? C.pill("radical " + core.rad, "muted") : null,
      complete && status !== "new" ? C.pill(status, status === "mature" ? "jade" : "gold") : null);
    const m = C.modal({
      title: core && core.lesson ? "Lesson " + core.lesson + " · word" : (isChar ? "Character" : "Word"),
      wide: true,
      body: el("div", { class: "word-pop" },
        el("div", { class: "word-pop-head" },
          el("div", { class: "word-pop-hanzi", lang: "zh-Hans" }, text),
          el("div", { class: "word-pop-meta" },
            el("div", { class: "pinyin big" }, (entry && entry.py) || "—"),
            el("div", { class: "word-pop-en" }, (entry && entry.en) || "No dictionary entry for this word yet."),
            entry && entry.alts ? el("div", { class: "word-pop-alt" }, "also read " + entry.alts) : null,
            tags)),
        complete && core.defs && core.defs.length > 1 ? el("ul", { class: "plain-list small defs" }, core.defs.slice(0, 4).map((x) => el("li", {}, x))) : null,
        examples.length ? el("div", { class: "examples" }, examples.map((ex) =>
          el("div", { class: "example-card" },
            el("div", { class: "example-zh", lang: "zh-Hans" }, ex.zh),
            ex.en ? el("div", { class: "muted small" }, ex.en) : null,
            el("div", { class: "muted tiny" }, ex.src)))) :
          (complete ? el("p", { class: "muted small" }, "No example in this lesson's materials yet.") : null),
        !core && !isChar ? el("p", { class: "word-pop-note" },
          "Reference word: it is not part of this course's word list, so it cannot be added to reviews.") : null,
        cards.length ? el("div", { class: "card-status" }, cards.map((c) =>
          el("div", { class: "cs-row" },
            el("span", {}, U.subjectLabel[c.skill] || c.skill),
            el("span", { class: "muted" }, "interval " + (c.interval < 1 ? Math.round(c.interval * 24 * 60) + " min" : Math.round(c.interval) + " d")),
            el("span", { class: "muted" }, U.fmtDue(c.due))))) : null,
        actions)
    });
  };
})();

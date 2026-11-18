/* Core utilities, DOM helpers, icons. Classic script: window.HY */
(function () {
  const HY = (window.HY = window.HY || {});
  const U = (HY.util = {});

  U.$ = (sel, root) => (root || document).querySelector(sel);
  U.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function append(node, kids) {
    for (const k of kids) {
      if (k == null || k === false) continue;
      if (Array.isArray(k)) append(node, k);
      else if (k instanceof Node) node.appendChild(k);
      else node.appendChild(document.createTextNode(String(k)));
    }
  }

  U.el = function (tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs && typeof attrs === "object") {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "class") n.className = v;
        else if (k === "text") n.textContent = v;
        else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
        else if (k === "dataset" && typeof v === "object") Object.assign(n.dataset, v);
        else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "html") n.innerHTML = v;
        else n.setAttribute(k, v === true ? "" : v);
      }
    }
    append(n, kids);
    return n;
  };

  U.frag = (...kids) => { const f = document.createDocumentFragment(); append(f, kids); return f; };

  U.svg = function (paths, size, cls) {
    const NS = "http://www.w3.org/2000/svg";
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("width", size || 20);
    s.setAttribute("height", size || 20);
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "1.8");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("aria-hidden", "true");
    if (cls) s.setAttribute("class", cls);
    const ns = "http://www.w3.org/2000/svg";
    for (const p of paths) {
      if (typeof p === "string") {
        const path = document.createElementNS(ns, "path");
        path.setAttribute("d", p);
        s.appendChild(path);
      } else {
        const c = document.createElementNS(ns, p[0]);
        for (const [k, v] of Object.entries(p[1] || {})) c.setAttribute(k, v);
        s.appendChild(c);
      }
    }
    return s;
  };

  const ICONS = {
    home: ["M3 10.5 12 3l9 7.5", "M5 9.5V21h14V9.5", "M9.5 21v-6h5v6"],
    book: ["M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22V4.5Z", "M4 18.5A2.5 2.5 0 0 1 6.5 16H20"],
    cards: ["M4 7h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z", "M7 4h11a2 2 0 0 1 2 2v9"],
    clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"],
    chart: ["M4 20V10", "M10 20V4", "M16 20v-7", "M22 20H2"],
    gear: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"],
    play: ["m8 5 11 7-11 7V5Z"],
    pause: ["M8 5v14", "M16 5v14"],
    volume: ["M11 5 6 9H3v6h3l5 4V5Z", "M15.5 8.5a5 5 0 0 1 0 7", "M18.5 5.5a9 9 0 0 1 0 13"],
    check: ["m5 12.5 4.5 4.5L19 6.5"],
    x: ["M6 6l12 12", "M18 6 6 18"],
    arrowRight: ["M4 12h15", "m13 6 6 6-6 6"],
    arrowLeft: ["M20 12H5", "m11 18-6-6 6-6"],
    refresh: ["M20 11a8 8 0 0 0-13.7-5.7L3 8", "M3 3v5h5", "M4 13a8 8 0 0 0 13.7 5.7L21 16", "M21 21v-5h-5"],
    target: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z", "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"],
    flame: ["M12 22c4.4 0 7-2.9 7-6.5 0-3.2-2.2-5.6-4.3-7.8C13.2 5.9 12 4.2 12 2c-2.4 2.1-4 4.4-4 6.7 0 1.3.4 2.4 1.1 3.3-1.2-.3-2.1-1-2.6-2C5.6 11.5 5 13.3 5 15.5 5 19.1 7.6 22 12 22Z"],
    download: ["M12 3v12", "m7 10 5 5 5-5", "M5 20h14"],
    upload: ["M12 16V4", "m7 9 5-5 5 5", "M5 20h14"],
    menu: ["M3 6h18", "M3 12h18", "M3 18h18"],
    chevron: ["m9 6 6 6-6 6"],
    calendar: ["M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z", "M8 3v4", "M16 3v4", "M4 10h16"],
    pen: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"],
    headphones: ["M4 14v-2a8 8 0 0 1 16 0v2", "M4 14h3v6H5a1 1 0 0 1-1-1v-5Z", "M20 14h-3v6h2a1 1 0 0 0 1-1v-5Z"],
    eye: ["M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
    eyeOff: ["M3 3l18 18", "M10.6 6.2A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a16 16 0 0 1-2.4 3.2", "M6.6 6.6C3.6 8.4 2 12 2 12s3.5 6 10 6a9.7 9.7 0 0 0 4.1-.9"],
    spark: ["M12 3v3", "M12 18v3", "M3 12h3", "M18 12h3", "m5.6 5.6 2.1 2.1", "m16.3 16.3 2.1 2.1", "m18.4 5.6-2.1 2.1", "m7.7 16.3-2.1 2.1"],
    warn: ["M12 3 2 21h20L12 3Z", "M12 9v5", "M12 17.5v.5"],
    plus: ["M12 5v14", "M5 12h14"],
    lock: ["M6 10h12v11H6V10Z", "M9 10V7a3 3 0 0 1 6 0v3"],
    star: ["m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.3 6.1-.9L12 3Z"],
    list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
    speaker: ["M4 9v6h4l5 4V5L8 9H4Z"],
    stop: ["M6 6h12v12H6z"],
    dot: [["circle", { cx: 12, cy: 12, r: 4 }]],
    info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 11v5", "M12 8h.01"],
    cloud: ["M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.4 9.5 3.5 3.5 0 0 0 7 18Z"],
    grid: ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"],
    compass: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "m15.5 8.5-2.2 5-5 2.2 2.2-5 5-2.2Z"],
    inbox: ["M4 4h16v16H4z", "M4 13h4l2 3h4l2-3h4"],
    move: ["M12 3v18", "M3 12h18", "m8 7 4-4 4 4", "m8 17 4 4 4-4", "m7 8-4 4 4 4", "m17 8 4 4-4 4"]
  };

  U.icon = function (name, size, cls) {
    const p = ICONS[name] || ICONS.dot;
    return U.svg(p, size || 20, cls);
  };

  U.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  U.clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  U.dayKey = function (d) {
    const x = d ? new Date(d) : new Date();
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
  };
  U.parseDay = function (key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  };
  U.today = () => U.dayKey();
  U.addDays = function (d, n) {
    const x = typeof d === "string" ? U.parseDay(d) : new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  U.daysBetween = function (a, b) {
    const A = typeof a === "string" ? U.parseDay(a) : a;
    const B = typeof b === "string" ? U.parseDay(b) : b;
    return Math.round((B - A) / 86400000);
  };
  U.fmtDay = function (d, style) {
    const x = typeof d === "string" ? U.parseDay(d) : d;
    const o = style || "short";
    if (o === "short") return x.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    if (o === "weekday") return x.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    if (o === "long") return x.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return x.toLocaleDateString();
  };
  U.fmtDue = function (ts, now) {
    const n = now || Date.now();
    const diff = ts - n;
    if (diff <= -86400000) return U.phraseDays(Math.round(-diff / 86400000)) + " overdue";
    if (diff < 0) return "due";
    if (diff < 3600000) return "in " + Math.max(1, Math.round(diff / 60000)) + " min";
    if (diff < 86400000) return "in " + Math.round(diff / 3600000) + " h";
    return "in " + Math.round(diff / 86400000) + " d";
  };
  U.phraseDays = (n) => (n <= 1 ? "1 day" : n + " days");

  U.hash = function (s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  U.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.shuffle = function (arr, rand) {
    const a = arr.slice();
    const r = rand || Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  U.sample = function (arr, n, rand) { return U.shuffle(arr, rand).slice(0, n); };

  U.uniq = (arr) => Array.from(new Set(arr));
  U.uniqBy = function (arr, fn) {
    const seen = new Set(), out = [];
    for (const x of arr) { const k = fn(x); if (!seen.has(k)) { seen.add(k); out.push(x); } }
    return out;
  };

  U.cjk = (s) => (s || "").match(/[\u4e00-\u9fff]/g) || [];
  U.cjkCount = (s) => U.cjk(s).length;
  U.hasLatin = (s) => /[A-Za-z]/.test(s || "");

  U.norm = function (s) {
    return String(s == null ? "" : s)
      .replace(/[\s\u3000]/g, "")
      .replace(/[，。！？、；：,.!?;:'"“”‘’（）()《》〈〉…—\-·]/g, "");
  };
  U.normPinyin = function (s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  };
  U.sameAnswer = function (expected, actual) {
    const e = U.norm(expected), a = U.norm(actual);
    if (!a) return false;
    if (e === a) return true;
    if (e.replace(/儿$/, "") === a) return true;
    if (e.replace(/儿$/, "") === a.replace(/儿$/, "")) return true;
    return false;
  };

  /** Deterministically shuffle a multiple-choice question's options. */
  U.mc = function (q, salt) {
    const opts = (q && q.options || []).slice();
    if (!opts.length) return { options: [], answer: 0 };
    const correct = opts[U.clamp(q.answer || 0, 0, opts.length - 1)];
    const rand = U.rng(U.hash(String(q.q || q.prompt || "") + "|" + opts.join("|") + "|" + (salt || "")));
    const shuffled = U.shuffle(opts, rand);
    return { options: shuffled, answer: Math.max(0, shuffled.indexOf(correct)) };
  };

  U.diff = function (expected, actual) {    const a = Array.from(expected || ""), b = Array.from(actual || "");
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    const ops = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) { ops.push({ t: "same", ch: a[i - 1] }); i--; j--; }
      else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { ops.push({ t: "add", ch: b[j - 1] }); j--; }
      else { ops.push({ t: "del", ch: a[i - 1] }); i--; }
    }
    return ops.reverse();
  };

  U.splitSentences = function (text) {
    const out = [];
    let cur = "";
    for (const ch of Array.from(text || "")) {
      cur += ch;
      if ("。！？!?；;".includes(ch)) { if (cur.trim()) out.push(cur.trim()); cur = ""; }
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };

  U.fmtMin = function (min) {
    const m = Math.round(min || 0);
    if (m < 60) return m + " min";
    const h = Math.floor(m / 60), r = m % 60;
    return h + " h" + (r ? " " + r + " min" : "");
  };
  U.fmtNum = (n) => new Intl.NumberFormat("en-US").format(n || 0);
  U.pct = function (n, d) { return d ? Math.round((n / d) * 100) : 0; };
  U.percentLabel = (p) => Math.round(p * 100) + "%";

  U.download = function (name, text, mime) {
    const blob = new Blob([text], { type: mime || "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  U.readFile = function (file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(fr.error);
      fr.readAsText(file);
    });
  };

  U.debounce = function (fn, ms) {
    let t;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
  };

  U.streak = function (days, todayKey) {
    let n = 0;
    let d = todayKey || U.today();
    if (!days[d] || !days[d].minutes) d = U.dayKey(U.addDays(d, -1));
    while (days[d] && days[d].minutes > 0) { n++; d = U.dayKey(U.addDays(d, -1)); }
    return n;
  };

  U.subjectLabel = { rec: "Reading", prod: "Recall", listen: "Listening" };
  U.posLabel = function (pos) { return (pos || "").replace(/\.$/, ""); };
})();

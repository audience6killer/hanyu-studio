/* Text-to-speech in Mandarin, with voice pick and sentence chunking. */
(function () {
  const HY = window.HY;
  const U = HY.util;
  const T = (HY.tts = {});
  const supported = typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";
  let voices = [];
  let ready = false;
  const waiters = [];

  T.supported = supported;
  T.ready = () => ready;

  function refresh() {
    if (!supported) return;
    const all = window.speechSynthesis.getVoices() || [];
    if (all.length) voices = all;
    if (voices.length && !ready) { ready = true; waiters.splice(0).forEach((fn) => fn(voices)); }
  }

  function withVoices(fn) {
    if (!supported) return fn([]);
    if (ready) return fn(voices);
    waiters.push(fn);
    setTimeout(() => { refresh(); if (!ready) { ready = true; waiters.splice(0).forEach((f) => f(voices)); } }, 800);
  }

  T.init = function () {
    if (!supported) return;
    refresh();
    try {
      window.speechSynthesis.addEventListener("voiceschanged", refresh);
    } catch (e) {
      window.speechSynthesis.onvoiceschanged = refresh;
    }
  };

  T.list = function () { refresh(); return voices.slice(); };
  T.zhVoices = function () { return T.list().filter((v) => /^zh/i.test(v.lang || "") || /chinese|中文|普通话|國語/i.test(v.name || "")); };

  const PREF = [/xiaoxiao/i, /yunxi/i, /xiaoyi/i, /huihui/i, /yaoyao/i, /kangkang/i, /ting-ting/i, /mei-jia/i, /li-mu/i, /google.*(普通话|中文)/i, /microsoft.*chinese/i];

  T.pickVoice = function (uri) {
    const zh = T.zhVoices();
    if (uri) {
      const byUri = zh.find((v) => v.voiceURI === uri);
      if (byUri) return byUri;
    }
    for (const re of PREF) {
      const v = zh.find((x) => re.test(x.name || ""));
      if (v) return v;
    }
    const cn = zh.find((v) => /zh[-_]CN/i.test(v.lang || ""));
    return cn || zh[0] || null;
  };

  T.current = function (uri) { return T.pickVoice(uri); };
  T.hasChinese = () => T.zhVoices().length > 0;

  T.cancel = function () {
    if (!supported) return;
    try { window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
  };

  function speakOne(text, opts) {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      const v = T.pickVoice(opts.voiceURI);
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "zh-CN"; }
      u.rate = U.clamp(opts.rate == null ? 0.9 : opts.rate, 0.5, 1.4);
      u.pitch = 1;
      u.volume = 1;
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      u.onend = finish;
      u.onerror = finish;
      try { window.speechSynthesis.speak(u); } catch (e) { finish(); }
      setTimeout(finish, Math.max(6000, Array.from(text).length * 800));
    });
  }

  /** Speak text (sentence by sentence). opts: rate, voiceURI, onword? */
  T.speak = async function (text, opts) {
    opts = opts || {};
    if (!supported) return false;
    T.cancel();
    if (!ready) { await new Promise((r) => withVoices(() => r())); }
    const parts = U.splitSentences(text);
    const list = parts.length ? parts : [text];
    for (const p of list) {
      if (!p.trim()) continue;
      await speakOne(p, opts);
    }
    return true;
  };

  T.speakOnce = function (text, opts) { return T.speak(text, Object.assign({}, opts, { single: true })); };

  T.test = async function (opts) {
    const ok = await T.speak("你好，欢迎回来。我们今天开始学习第五级的中文。", opts);
    return ok;
  };

  T.init();
})();

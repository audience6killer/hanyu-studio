import json, re, sys, os, argparse, glob

CJK = re.compile(r"[\u4e00-\u9fff]")
PINYIN = re.compile(r"^[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹ\s'’·]+$")

def cjk_count(s):
    return len(CJK.findall(s or ""))

def parse_range(spec):
    out = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            out.update(range(int(a), int(b) + 1))
        else:
            out.add(int(part))
    return out

def load_vocab():
    data = json.load(open("content/vocab-by-lesson.json", encoding="utf-8"))
    return {d["lesson"]: d for d in data}

def err(errors, lesson, msg):
    errors.append(f"L{lesson:02d}: {msg}")

def check_mc(errors, lesson, label, item, need_options=4):
    if not isinstance(item, dict):
        err(errors, lesson, f"{label} is not an object"); return
    q = item.get("q", "")
    opts = item.get("options", [])
    if not isinstance(q, str) or len(q.strip()) < 4:
        err(errors, lesson, f"{label}.q missing or too short")
    if "____" not in q:
        err(errors, lesson, f"{label}.q has no ____ blank")
    if not isinstance(opts, list) or len(opts) != need_options:
        err(errors, lesson, f"{label}.options must have exactly {need_options} items")
        return
    if len({o.strip() for o in opts}) != need_options:
        err(errors, lesson, f"{label}.options contain duplicates")
    for o in opts:
        if not isinstance(o, str) or not o.strip():
            err(errors, lesson, f"{label}.options contains an empty option")
        elif len(o) > 120:
            err(errors, lesson, f"{label}.option too long: {o[:30]}...")
    ans = item.get("answer")
    if not isinstance(ans, int) or not (0 <= ans < need_options):
        err(errors, lesson, f"{label}.answer must be an int 0-{need_options-1}")
    if not isinstance(item.get("explain"), str) or len(item["explain"].strip()) < 10:
        err(errors, lesson, f"{label}.explain missing or too short")

def validate_lesson(lesson, vocab, errors, stats):
    path = f"content/lesson-{lesson:02d}.json"
    try:
        d = json.load(open(path, encoding="utf-8"))
    except FileNotFoundError:
        err(errors, lesson, "file missing"); return
    except Exception as e:
        err(errors, lesson, f"invalid JSON: {e}"); return

    v = vocab.get(lesson)
    if not v:
        err(errors, lesson, "no vocab record"); return

    if d.get("lesson") != lesson:
        err(errors, lesson, "lesson field does not match filename")
    if d.get("title_zh") != v["zh"]:
        err(errors, lesson, f"title_zh must be {v['zh']!r}")
    if d.get("title_en") != v["en"]:
        err(errors, lesson, f"title_en must be {v['en']!r}")
    if not isinstance(d.get("theme"), str) or len(d["theme"].strip()) < 15:
        err(errors, lesson, "theme missing or too short")

    items = {i["w"]: i for i in v["items"]}
    long_items = {w for w in items if len(w) >= 2}

    # ---- grammar ----
    g = d.get("grammar")
    if not isinstance(g, dict):
        err(errors, lesson, "grammar missing")
    else:
        if g.get("id") != f"g{lesson:02d}":
            err(errors, lesson, f"grammar.id must be g{lesson:02d}")
        for k in ("point", "point_en", "structure"):
            if not isinstance(g.get(k), str) or not g[k].strip():
                err(errors, lesson, f"grammar.{k} missing")
        exp = g.get("explain_en", "")
        if not isinstance(exp, str) or len(exp) < 200:
            err(errors, lesson, "grammar.explain_en should be at least ~200 chars of English")
        if not isinstance(g.get("common_mistake"), str) or len(g["common_mistake"].strip()) < 20:
            err(errors, lesson, "grammar.common_mistake missing or too short")
        exs = g.get("examples")
        if not isinstance(exs, list) or not (2 <= len(exs) <= 4):
            err(errors, lesson, "grammar.examples must have 2-4 entries")
        else:
            for i, ex in enumerate(exs, 1):
                if not isinstance(ex, dict):
                    err(errors, lesson, f"example {i} not an object"); continue
                zh = ex.get("zh", ""); py = ex.get("py", ""); en = ex.get("en", "")
                if cjk_count(zh) < 6:
                    err(errors, lesson, f"example {i}.zh too short")
                if not PINYIN.match(py or "") or len(py) < 4:
                    err(errors, lesson, f"example {i}.py missing/invalid pinyin")
                if not isinstance(en, str) or len(en.strip()) < 8:
                    err(errors, lesson, f"example {i}.en missing or too short")
        drills = g.get("drills")
        if not isinstance(drills, list) or len(drills) != 2:
            err(errors, lesson, "grammar.drills must have exactly 2 entries")
        else:
            for i, dr in enumerate(drills, 1):
                check_mc(errors, lesson, f"grammar.drills[{i}]", dr)

    # ---- reading ----
    r = d.get("reading")
    text = ""
    if not isinstance(r, dict):
        err(errors, lesson, "reading missing")
    else:
        if not isinstance(r.get("title"), str) or cjk_count(r["title"]) < 2:
            err(errors, lesson, "reading.title missing")
        text = r.get("text", "")
        n = cjk_count(text)
        if not (180 <= n <= 300):
            err(errors, lesson, f"reading.text is {n} CJK chars, expected 200-280")
        if not isinstance(r.get("translation"), str) or len(r["translation"]) < 150:
            err(errors, lesson, "reading.translation missing or too short")
        cover = sorted(w for w in long_items if w in text)
        if len(cover) < 8:
            err(errors, lesson, f"reading.text uses only {len(cover)} lesson words (need 8): {cover}")
        qs = r.get("questions")
        if not isinstance(qs, list) or len(qs) != 3:
            err(errors, lesson, "reading.questions must have exactly 3 entries")
        else:
            for i, q in enumerate(qs, 1):
                check_mc(errors, lesson, f"reading.questions[{i}]", q)
                if isinstance(q, dict):
                    for o in q.get("options", []):
                        if cjk_count(o) < 1:
                            err(errors, lesson, f"reading.questions[{i}] options should be Chinese")
                            break

    # ---- listening ----
    ls = d.get("listening")
    if not isinstance(ls, dict):
        err(errors, lesson, "listening missing")
    else:
        ds = ls.get("dictation")
        if not isinstance(ds, list) or len(ds) != 5:
            err(errors, lesson, "listening.dictation must have exactly 5 sentences")
        else:
            heard = set()
            for i, s in enumerate(ds, 1):
                if not isinstance(s, str):
                    err(errors, lesson, f"dictation {i} not a string"); continue
                n = cjk_count(s)
                if not (10 <= n <= 32):
                    err(errors, lesson, f"dictation {i} is {n} CJK chars, expected 10-30")
                if not s.rstrip().endswith(("。", "？", "！")):
                    err(errors, lesson, f"dictation {i} must end with 。？!")
                if re.search(r"[A-Za-z]", s):
                    err(errors, lesson, f"dictation {i} contains Latin letters")
                for w in long_items:
                    if w in s:
                        heard.add(w)
            if len(heard) < 4:
                err(errors, lesson, f"dictation uses only {len(heard)} lesson words (need 4)")

    # ---- writing ----
    w = d.get("writing")
    if not isinstance(w, dict):
        err(errors, lesson, "writing missing")
    else:
        prompt = w.get("prompt", "")
        if not isinstance(prompt, str) or not (20 <= len(prompt) <= 260):
            err(errors, lesson, "writing.prompt should be 20-200 English chars")
        req = w.get("required_words")
        if not isinstance(req, list) or not (3 <= len(req) <= 6):
            err(errors, lesson, "writing.required_words must have 3-6 items")
            req = []
        for word in req:
            if word not in items:
                err(errors, lesson, f"required word {word!r} is not in the lesson vocabulary")
        mc = w.get("min_chars")
        if not isinstance(mc, int) or not (60 <= mc <= 150):
            err(errors, lesson, "writing.min_chars must be 60-150")
        model = w.get("model", "")
        mn = cjk_count(model)
        if not (70 <= mn <= 160):
            err(errors, lesson, f"writing.model is {mn} CJK chars, expected 80-130")
        for word in req:
            if word not in model:
                err(errors, lesson, f"writing.model does not use required word {word!r}")
        if isinstance(mc, int) and mn < mc:
            err(errors, lesson, "writing.model is shorter than min_chars")
        if not isinstance(w.get("tips"), str) or len(w["tips"].strip()) < 15:
            err(errors, lesson, "writing.tips missing or too short")

    # ---- placeholders ----
    blob = json.dumps(d, ensure_ascii=False)
    for bad in ("TODO", "PLACEHOLDER", "lorem ipsum", "XXX"):
        if bad.lower() in blob.lower():
            err(errors, lesson, f"placeholder text found: {bad}")

    stats.append((lesson, cjk_count(text)))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lessons", default="")
    args = ap.parse_args()
    vocab = load_vocab()
    if args.lessons:
        targets = sorted(parse_range(args.lessons))
    else:
        targets = sorted(int(re.search(r"lesson-(\d+)", p).group(1))
                         for p in glob.glob("content/lesson-*.json"))
    errors = []
    stats = []
    points = {}
    for n in targets:
        validate_lesson(n, vocab, errors, stats)
        p = f"content/lesson-{n:02d}.json"
        if os.path.exists(p):
            try:
                g = json.load(open(p, encoding="utf-8")).get("grammar", {})
                pt = g.get("point", "")
                if pt:
                    points.setdefault(pt, []).append(n)
            except Exception:
                pass
    for pt, ls in points.items():
        if len(ls) > 1:
            errors.append(f"duplicate grammar point {pt!r} in lessons {ls}")
    for n, c in stats:
        print(f"L{n:02d}  reading {c} chars")
    if errors:
        print(f"\nFAIL: {len(errors)} problem(s)")
        for e in errors:
            print(" -", e)
        sys.exit(1)
    print(f"\nPASS: {len(targets)} lesson file(s) valid")

if __name__ == "__main__":
    main()

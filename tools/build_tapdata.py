# -*- coding: utf-8 -*-
"""Build the tap-to-define dictionary for reading passages.

The reading screen promises that every word can be tapped for pinyin, meaning and
audio.  The course word list alone covers only the vocabulary a lesson teaches, so
this script generates a small reference layer:

  * one entry per Chinese character used in the passages, and
  * one entry per multi-character word the passages actually use,

each with pinyin, a short English gloss and a frequency used by the runtime
segmentation.  The output, ``assets/js/data/tap.js``, is committed so the app stays
fully offline at runtime.

Sources (downloaded into ``data-src/`` on first run, all reused by the build):

  * CC-CEDICT                 -- glosses and readings (CC BY-SA 4.0)
  * Unihan readings via
    mozillazg/pinyin-data     -- the default reading of a character
  * jieba's word dictionary   -- segmentation frequencies (MIT)

Rebuild after editing a reading passage:

    python tools/build_tapdata.py
    node tools/check_tap.mjs

The generator is deterministic: the same sources and content produce the same file.
"""

import argparse
import collections
import glob
import json
import math
import os
import re
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_SRC = os.path.join(ROOT, "data-src")
OUT = os.path.join(ROOT, "assets", "js", "data", "tap.js")

SOURCES = {
    "cedict": (
        "cc-cedict.json",
        "https://raw.githubusercontent.com/leonsilicon/cc-cedict/main/cedict_1_0_ts_utf-8_mdbg.json",
        "CC-CEDICT (CC BY-SA 4.0)",
    ),
    "pinyin": (
        "pinyin.txt",
        "https://raw.githubusercontent.com/mozillazg/pinyin-data/master/pinyin.txt",
        "Unihan kMandarin via mozillazg/pinyin-data",
    ),
    "jieba": (
        "jieba-dict.txt",
        "https://raw.githubusercontent.com/fxsjy/jieba/master/jieba/dict.txt",
        "jieba dictionary (MIT)",
    ),
}

CJK = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
CJK_RUN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+")
MAX_WORD = 6           # longest dictionary entry the tokenizer will look up
DECK_BOOST = 20000     # keep textbook words whole even when jieba would split them

TONES = {"a": "āáǎà", "e": "ēéěè", "i": "īíǐì", "o": "ōóǒò", "u": "ūúǔù", "ü": "ǖǘǚǜ"}
MARKS = {ch: (base, i + 1) for base, marks in TONES.items() for i, ch in enumerate(marks)}

# Words whose only senses are administrative/metalinguistic make bad tap targets.
SKIP_DEF = re.compile(
    r"^(variant of|old variant|erhua variant of|used in|see |surname |CL:|Taiwan pr\.|also pr\.|"
    r"archaic|dialect|Japanese|Korean)",
    re.I,
)
PROPER_DEF = re.compile(r"(city in|county in|province|capital of|surname|formerly|abbr\. for|prefecture)", re.I)


# --------------------------------------------------------------------------- text

def pinyin_marks(cc):
    """'nu:3 hao3' -> 'nǚ hǎo'; the erhua suffix 'r' joins the previous syllable."""
    out = []
    for syl in cc.split():
        base = re.sub(r"[0-9]", "", syl.replace("u:", "ü").replace("v", "ü").lower())
        m = re.search(r"([1-5])$", syl)
        tone = int(m.group(1)) if m else 5
        if not base:
            continue
        if base == "r" and out:
            out[-1] = out[-1] + "r"
            continue
        if tone == 5:
            out.append(base)
            continue
        target = None
        if "a" in base:
            target = "a"
        elif "e" in base:
            target = "e"
        elif "ou" in base:
            target = "o"
        elif len(base) > 1 and base[-1] in "aeiouü" and base[-2] in "iuü":
            target = base[-1]
        else:
            for ch in base:
                if ch in "aeiouü":
                    target = ch
                    break
        if target is None:
            out.append(base)
            continue
        idx = base.rfind(target)
        out.append(base[:idx] + TONES[target][tone - 1] + base[idx + 1:])
    return " ".join(out)


def attach_erhua(py):
    """Attach a standalone erhua 'r' syllable to the previous one: 'huì r' -> 'huìr'."""
    out = []
    for part in str(py or "").split():
        if part in ("r", "r5") and out:
            out[-1] += "r"
        else:
            out.append(part)
    return " ".join(out)


def base_reading(syl):
    """Tone-marked syllable -> (toneless syllable, tone number)."""
    base, tone = [], 5
    for ch in syl.strip().lower():
        if ch in MARKS:
            b, t = MARKS[ch]
            base.append(b)
            tone = t
        elif ch in "012345":
            tone = int(ch)
        else:
            base.append(ch)
    return "".join(base).replace("u:", "ü").replace("v", "ü"), tone


def cc_base(cc):
    return re.sub(r"[0-9]", "", cc.replace("u:", "ü").replace("v", "ü").lower())


def cc_tone(cc):
    m = re.search(r"([1-5])$", cc)
    return int(m.group(1)) if m else 5


def clean_gloss(text, limit=56):
    text = re.sub(r"\s+", " ", text or "").strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    cut = cut[:cut.rfind(";")] if ";" in cut else cut[:cut.rfind(" ")]
    return cut.rstrip(";,: ") + "…"


def usable_defs(defs):
    good = []
    for d in defs or []:
        d = re.sub(r"\s+", " ", d).strip()
        if d and not SKIP_DEF.search(d):
            good.append(d)
    return good


# --------------------------------------------------------------------------- sources

def source_path(args, key):
    custom = getattr(args, key)
    if custom:
        return custom
    name, url, label = SOURCES[key]
    path = os.path.join(DATA_SRC, name)
    if not os.path.exists(path):
        os.makedirs(DATA_SRC, exist_ok=True)
        print("downloading %s -> %s" % (label, path))
        tmp = path + ".part"
        urllib.request.urlretrieve(url, tmp)
        os.replace(tmp, path)
    return path


def load_cedict(path):
    with open(path, encoding="utf-8") as fh:
        doc = json.load(fh)
    single, multi = collections.defaultdict(list), collections.defaultdict(list)
    for entry in doc.get("entries", []):
        word = entry.get("simplified", "")
        if not word or not all(CJK.match(ch) for ch in word):
            continue
        (single if len(word) == 1 else multi)[word].append(entry)
    return single, multi, doc.get("metadata", {})


def load_pinyin(path):
    """Unicode block -> ordered list of readings, most common first."""
    readings = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.split("#", 1)[0].strip()
            if not line.startswith("U+"):
                continue
            code, rest = line.split(":", 1)
            readings[chr(int(code[2:], 16))] = [x.strip() for x in rest.split(",") if x.strip()]
    return readings


def load_frequencies(path):
    freq = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            parts = line.split()
            if len(parts) >= 2:
                try:
                    freq[parts[0]] = int(parts[1])
                except ValueError:
                    pass
    return freq


# --------------------------------------------------------------------------- corpus

def read_content():
    lessons = []
    for path in sorted(glob.glob(os.path.join(ROOT, "content", "lesson-*.json"))):
        with open(path, encoding="utf-8") as fh:
            lessons.append(json.load(fh))
    passages = []
    for lesson in lessons:
        reading = lesson["reading"]
        passages.append(reading["title"])
        passages.extend(part.strip() for part in reading["text"].split("\n") if part.strip())
    return lessons, passages


def load_deck():
    with open(os.path.join(DATA_SRC, "merged.json"), encoding="utf-8") as fh:
        merged = json.load(fh)
    deck = {}
    for group in ("words", "gap", "hsk4"):
        for word in merged.get(group, []):
            deck[word["w"]] = word
    return deck


def load_official():
    official = {}
    for level in ("hsk3", "hsk4", "hsk5", "hsk6"):
        path = os.path.join(DATA_SRC, level + ".min.json")
        with open(path, encoding="utf-8") as fh:
            for entry in json.load(fh):
                # Polyphonic entries list several forms; the first one is sometimes
                # a "variant of" stub, so prefer the form that carries real senses.
                best = max(entry["f"], key=lambda form: len(usable_defs(form["m"])))
                official.setdefault(entry["s"], {"py": best["i"]["y"], "defs": best["m"]})
    return official


# --------------------------------------------------------------------------- model

class Segmenter:
    """Unigram Viterbi segmentation, mirroring the runtime in core/data.js."""

    def __init__(self, freq):
        self.freq = freq
        self.total = max(1, sum(freq.values()))
        self.log_total = math.log(self.total)

    def split(self, text):
        chars = list(text)
        n = len(chars)
        score = [0.0] * (n + 1)
        back = [0] * (n + 1)
        for i in range(1, n + 1):
            best = score[i - 1] + math.log(max(self.freq.get(chars[i - 1], 0), 1)) - self.log_total
            cut = i - 1
            for length in range(2, min(MAX_WORD, i) + 1):
                cand = "".join(chars[i - length:i])
                f = self.freq.get(cand)
                if not f:
                    continue
                value = score[i - length] + math.log(f) - self.log_total
                if value > best:
                    best, cut = value, i - length
            score[i], back[i] = best, cut
        out = []
        i = n
        while i > 0:
            cut = back[i]
            out.append("".join(chars[cut:i]))
            i = cut
        return out[::-1]


def pick_word_entry(word, deck, official, multi, freq):
    # A few deck entries were generated from a variant-only reading and have no
    # gloss; fall through to the official lists and CC-CEDICT for those.
    word_deck = deck.get(word)
    if word_deck and word_deck.get("py") and word_deck.get("en"):
        return [attach_erhua(word_deck.get("py", "")), clean_gloss(word_deck.get("en", "")), freq.get(word, 0)]
    entry = official.get(word)
    if entry:
        defs = usable_defs(entry["defs"])
        if defs:
            return [attach_erhua(entry["py"]), clean_gloss("; ".join(defs[:2])), freq.get(word, 0)]
    best = None
    for cand in multi.get(word, []):
        defs = usable_defs(cand["definitions"])
        if not defs:
            continue
        proper = any(PROPER_DEF.search(d) for d in cand["definitions"][:2])
        rank = len(defs) * 10 - (30 if proper else 0)
        if best is None or rank > best[0]:
            best = (rank, cand, defs)
    if best is not None:
        return [pinyin_marks(best[1]["pinyin"]), clean_gloss("; ".join(best[2][:2])), freq.get(word, 0)]
    # Erhua words such as 差点儿 only have a "variant of 差点" stub of their own;
    # borrow the base word's gloss but keep the erhua pronunciation.
    if word.endswith("儿") and len(word) > 2:
        base_entry = pick_word_entry(word[:-1], deck, official, multi, freq)
        if base_entry and base_entry[1]:
            py = pinyin_marks(multi[word][0]["pinyin"]) if multi.get(word) else base_entry[0]
            return [py, base_entry[1], freq.get(word, 0)]
    if entry and entry["defs"]:
        return [attach_erhua(entry["py"]), clean_gloss("; ".join(entry["defs"][:2])), freq.get(word, 0)]
    if word_deck:
        return [attach_erhua(word_deck.get("py", "")), clean_gloss(word_deck.get("en", "")), freq.get(word, 0)]
    return None


def pick_char_entry(char, single, readings, votes, freq):
    entries = single.get(char) or []
    if not entries:
        return None
    primary = readings.get(char, [""])[0]
    base, tone = base_reading(primary)
    pool = [e for e in entries if len(e["pinyin"].split()) == 1
            and cc_base(e["pinyin"]) == base and cc_tone(e["pinyin"]) == tone]
    if not pool:
        pool = [e for e in entries if len(e["pinyin"].split()) == 1 and cc_base(e["pinyin"]) == base] or entries
    best = None
    for cand in pool:
        defs = usable_defs(cand["definitions"])
        rank = len(defs) * 10
        if best is None or rank > best[0]:
            best = (rank, cand, defs)
    _, chosen, defs = best
    if not defs:
        defs = chosen["definitions"]
    entry = [pinyin_marks(chosen["pinyin"]), clean_gloss("; ".join(defs[:2]), 60), freq.get(char, 0)]

    alts = []
    vote = votes.get(char)
    if vote:
        total = sum(vote.values()) or 1
        for (alt_base, alt_tone), count in vote.most_common():
            if (alt_base, alt_tone) == (base, tone) or count / total < 0.10:
                continue
            match = next((e for e in entries if len(e["pinyin"].split()) == 1
                          and cc_base(e["pinyin"]) == alt_base and cc_tone(e["pinyin"]) == alt_tone), None)
            if match:
                marked = pinyin_marks(match["pinyin"])
                if marked and marked != entry[0] and marked not in alts:
                    alts.append(marked)
            if len(alts) >= 2:
                break
    if alts:
        entry.append(" · ".join(alts))
    return entry


def build(args):
    _, passages = read_content()
    corpus = "\n".join(passages)
    chars = sorted(set(CJK.findall(corpus)))
    deck = load_deck()
    official = load_official()

    single, multi, cedict_meta = load_cedict(source_path(args, "cedict"))
    readings = load_pinyin(source_path(args, "pinyin"))
    freq = load_frequencies(source_path(args, "jieba"))

    # Segment the passages with the full jieba dictionary: these tokens are the
    # words a reader naturally sees as units.
    jieba = Segmenter(freq)
    saw_words = set()
    for passage in passages:
        for run in CJK_RUN.findall(passage):
            saw_words.update(tok for tok in jieba.split(run) if len(tok) > 1)

    # Reading votes for polyphonic characters, weighted by real word frequency.
    votes = collections.defaultdict(collections.Counter)
    for word, entries in multi.items():
        weight = freq.get(word, 0)
        if not weight:
            continue
        syllables = entries[0]["pinyin"].split()
        if len(syllables) != len(word):
            continue
        for char, syllable in zip(word, syllables):
            votes[char][(cc_base(syllable), cc_tone(syllable))] += weight

    words = {}
    for word in sorted(saw_words):
        if word not in corpus:
            continue
        entry = pick_word_entry(word, deck, official, multi, freq)
        if entry:
            words[word] = entry
    # The course vocabulary always stays tappable as one unit.
    for word in sorted(deck):
        if len(word) > 1 and word in corpus and word not in words:
            entry = pick_word_entry(word, deck, official, multi, freq)
            if entry:
                words[word] = entry

    char_entries = {}
    for char in chars:
        entry = pick_char_entry(char, single, readings, votes, freq)
        if entry:
            char_entries[char] = entry

    missing = [c for c in chars if c not in char_entries]
    if missing:
        raise SystemExit("no dictionary entry for these characters: " + "".join(missing))

    # Frequencies are what the runtime tokenizer balances; keep course words whole.
    for word in words:
        if word in deck:
            words[word][2] = max(words[word][2], DECK_BOOST)
    for char, entry in char_entries.items():
        entry[2] = max(entry[2], 1)

    return {
        "meta": {
            "generated": cedict_meta.get("date", "unknown")[:10],
            "words": len(words),
            "chars": len(char_entries),
            "note": "Reference dictionary for tap-to-define in reading passages.",
        },
        "words": words,
        "chars": char_entries,
    }


def write_output(doc):
    body = json.dumps(doc, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    header = (
        "/* Generated by tools/build_tapdata.py -- do not edit by hand.\n"
        "   Tap-to-define reference for reading passages: pinyin, English gloss and a\n"
        "   segmentation frequency per word and per character.\n"
        "   Sources: CC-CEDICT (CC BY-SA 4.0), Unihan readings via mozillazg/pinyin-data,\n"
        "   jieba dictionary (MIT) for frequencies. See README.md. */\n"
    )
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(header)
        fh.write("window.HY_TAP = ")
        fh.write(body)
        fh.write(";\n")
    return len(body)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cedict", help="path to the parsed CC-CEDICT JSON")
    parser.add_argument("--pinyin", help="path to pinyin-data's pinyin.txt")
    parser.add_argument("--jieba", help="path to jieba's dict.txt")
    args = parser.parse_args()

    doc = build(args)
    size = write_output(doc)
    print("wrote %s (%d words, %d characters, %.0f KB)"
          % (os.path.relpath(OUT, ROOT), doc["meta"]["words"], doc["meta"]["chars"], size / 1024))


if __name__ == "__main__":
    main()

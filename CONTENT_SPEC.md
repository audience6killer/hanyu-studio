# HSK5 Lesson Content Spec

You are writing study content for a personal HSK Standard Course 5 companion app.
The learner finished HSK4 a few years ago and is resuming at HSK5. He studies in short
sessions at work, types his Chinese (no handwriting, no speaking practice), and is
targeting the HSK5 exam in about six months.

Write **original** material. Do not copy or paraphrase the textbook's passages, and do
not reproduce any textbook exercise verbatim. Vocabulary lists are facts; the prose,
questions, explanations and model answers must be yours.

## Files

- Read `content/vocab-by-lesson.json` for the exact lesson vocabulary (word, pinyin,
  part of speech, short English gloss, and whether the word is on the official HSK5 list).
- Write one file per assigned lesson: `content/lesson-01.json`, `content/lesson-02.json`, ...
  (zero-padded two digits, UTF-8, valid JSON, no markdown fences).
- Do not modify any other file. Do not write outside `content/`.

## Exact JSON shape

```json
{
  "lesson": 1,
  "title_zh": "爱的细节",
  "title_en": "Details of Love",
  "theme": "one English sentence describing the angle of this unit",
  "grammar": {
    "id": "g01",
    "point": "不是……而是……",
    "point_en": "not A, but B",
    "structure": "不是 + A + 而是 + B",
    "explain_en": "80-200 words in English. When to use it, what it emphasises, how it differs from a near neighbour, and the word order. Plain, concrete language.",
    "common_mistake": "One or two sentences on the mistake learners actually make.",
    "examples": [
      { "zh": "……", "py": "……", "en": "……" },
      { "zh": "……", "py": "……", "en": "……" },
      { "zh": "……", "py": "……", "en": "……" }
    ],
    "drills": [
      {
        "q": "Chinese sentence with ____ where the target pattern belongs.",
        "options": ["option A", "option B", "option C", "option D"],
        "answer": 0,
        "explain": "English: why this option and not the others."
      },
      { "q": "……", "options": ["……", "……", "……", "……"], "answer": 2, "explain": "……" }
    ]
  },
  "reading": {
    "title": "Short Chinese title",
    "text": "200-280 Chinese characters, one or two paragraphs.",
    "translation": "Natural English translation of the passage.",
    "questions": [
      {
        "q": "Chinese question about the passage",
        "options": ["Chinese option", "Chinese option", "Chinese option", "Chinese option"],
        "answer": 1,
        "explain": "English: where the answer is in the passage."
      },
      { "q": "……", "options": ["……", "……", "……", "……"], "answer": 0, "explain": "……" },
      { "q": "……", "options": ["……", "……", "……", "……"], "answer": 2, "explain": "……" }
    ]
  },
  "listening": {
    "dictation": [
      "10-30 character spoken-style sentence using lesson vocabulary.",
      "……",
      "……",
      "……",
      "……"
    ]
  },
  "writing": {
    "prompt": "English task, e.g. 'Write about a time a small act of care changed your day. Use 4 of the words below.'",
    "required_words": ["word from the lesson", "word from the lesson", "word from the lesson", "word from the lesson"],
    "min_chars": 80,
    "model": "Model answer, 80-130 Chinese characters, using every required word.",
    "tips": "One or two English sentences on structure: opening, concrete detail, closing."
  }
}
```

### Field rules

- `lesson` must equal the lesson number in the filename and in the vocab file.
- `title_zh` and `title_en` must match `content/vocab-by-lesson.json` exactly.
- `grammar.id` is `gNN` for lesson NN, e.g. `g07`.
- `drills`: **exactly two** per lesson. Four options each, exactly one correct,
  `answer` is the 0-based index. The blank is written `____`. Distractors must be
  wrong for a clear structural reason, not merely unnatural.
- `reading.text`: 200-280 CJK characters (punctuation excluded from the count).
  Include the lesson's grammar pattern at least once and at least **8 distinct lesson
  words of two or more characters**. Keep sentences digestible: mostly 10-25 characters.
- `reading.questions`: exactly three. Test one main idea, one detail, one inference or
  attitude. Options must be plausible, similar in length, and mutually exclusive.
- `listening.dictation`: exactly five sentences, 10-30 CJK characters each, ending in
  。/？/！. They are played by text-to-speech and typed by the learner, so keep them
  clear and unambiguous when heard. Across the five, use at least **4 distinct lesson
  words of two or more characters**. No rare characters that are hard to type.
- `writing.prompt`: 20-200 English characters. It may be a personal/opinion/workplace
  task, not a grammar exercise. `required_words`: 3-6 items, all from this lesson.
  `model`: 80-130 CJK characters and must contain every required word.
- `theme`: one English sentence.
- Pinyin: tone marks, syllables separated by spaces (`xì jié`). Neutral tones have no
  mark. Use the pronunciation that matches the lesson word's meaning.
- Everything must be suitable for a workplace browser: no politics, no graphic content,
  no romance beyond mild mention, no violence. Adult, professional, concrete.

### Grammar assignment (do not swap; use exactly this point for each lesson)

| Lesson | Grammar point |
|---|---|
| 1 | 不是……而是…… |
| 2 | 除了……（以外），还/也…… |
| 3 | 无论/不管……都/也…… |
| 4 | 即使……也…… |
| 5 | 与其……不如…… |
| 6 | 宁可……也不…… |
| 7 | 只有……才…… |
| 8 | 只要……就…… |
| 9 | 除非……否则…… |
| 10 | 既然……就…… |
| 11 | 一……就…… |
| 12 | 越……越…… |
| 13 | 由于……而…… |
| 14 | 之所以……是因为…… |
| 15 | 因此 / 因而 / 从而 |
| 16 | 以便 / 以免 / 免得 |
| 17 | 关于 / 对于 / 至于 |
| 18 | 由……组成 |
| 19 | 以……为…… |
| 20 | 为……而…… |
| 21 | 把……当作 / 作为…… |
| 22 | 拿……来说 / 就……而言 |
| 23 | 在……方面 / 从……角度看 |
| 24 | 随着…… |
| 25 | 鉴于 / 基于 / 出于 |
| 26 | 难免 / 不免 / 未免 |
| 27 | 反而 / 却 / 竟然 / 居然 |
| 28 | 简直 / 究竟 / 到底 |
| 29 | 索性 / 干脆 / 不妨 |
| 30 | 何必 / 何尝 / 难道 / 岂 |
| 31 | 难怪 / 怪不得 |
| 32 | 甚至 / 乃至 / 以至于 |
| 33 | 并非 / 并不是 |
| 34 | 再……不过 / 没有比……更…… |
| 35 | 差点儿 / 好不容易 |
| 36 | 值得 / 便于 / 善于 / 勇于 |

For grouped points, explain the difference between the members inside `explain_en`.

### Writing the Chinese well

- Use simplified characters only.
- Prefer vocabulary the learner already has: HSK4-level words plus this lesson's words.
  A handful of new words from later lessons is fine, but do not make the passage dense.
- Use natural connectives, concrete details, and a clear arc. Avoid textbook-style
  moralising and avoid listing vocabulary words just to tick boxes.
- Do not invent statistics, names of real people, or brand names.
- Reading passages should read like a short magazine column or personal essay, not a
  grammar demonstration.

## Validate before reporting

```powershell
python tools/validate_content.py --lessons 1-6
```

Fix every failure and re-run until it prints `PASS` for all assigned lessons. The
validator checks the schema, lengths, option counts, pinyin presence, vocabulary
coverage and duplicate grammar ids. Report the final PASS output and the files written.

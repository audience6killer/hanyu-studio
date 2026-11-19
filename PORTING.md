# Porting HSK5 Studio to Japanese and English

> A handoff manual for AI agents (and humans) who will build sibling language instances.
>
> The current instance is **Chinese (L2) for English speakers (L1)**, following HSK Standard Course 5.
> The planned instances are **Japanese (L2) for Spanish speakers** and **English (L2) for Spanish speakers**.
>
> Read in this order:
>
> 1. `README.md` — what the app does and how to run it.
> 2. `CONTENT_SPEC.md` — the exact Chinese lesson schema and authoring rules.
> 3. `STUDY_PLAN.md` — the learning rationale behind the six-month HSK plan.
> 4. This file — what is reusable, what is Chinese-specific, and the order to build a new instance.

**Do not start authoring 36 lessons from this document alone.** First fill in the instance brief in section 1 and confirm the product choices with the human. The most expensive mistakes are choosing the wrong exam, textbook, lesson count, or learner language (L1).

**TL;DR workflow:** fill the brief → fork and rename → build the vocabulary pipeline → ship one vertical lesson → add the language adapter → scale content in validated batches → adapt plan/diagnostic/checkpoints → localize the interface → isolate sync → deploy and run the QA matrix.

**Contents:** 1 Brief · 2 Invariants · 3 Architecture · 4 Learning design · 5 Content model · 6 Chinese-specific seams · 7 Workflow · 8 Japanese · 9 English · 10 Spanish UI · 11 Sync isolation · 12 Build/QA · 13 Traps · 14 Prompts · 15 Definition of done · 16 File map · 17 Glossary.

---

## 1. One-page instance brief

Fill this in before writing code or content. The Japanese and English columns are **proposals**, not decisions.

| Decision | Chinese instance (current) | Japanese instance | English instance |
|---|---|---|---|
| Target language (L2) | Chinese | Japanese | English |
| Learner language (L1) | English | Spanish | Spanish |
| Interface language | English | Spanish (recommended) | Spanish (recommended) |
| Anchor exam | HSK 2.0 level 5 | JLPT N3 or N2 — confirm | CEFR B1/B2 or Cambridge B2 First — confirm |
| Anchor textbook | HSK Standard Course 5 | Genki / Tobira / Minna no Nihongo — confirm | English File / Speakout — confirm |
| Lesson count | 36 (two HSK5 volumes) | Textbook units — do not force 36 | Textbook units — do not force 36 |
| Script | Simplified hanzi | Kana + kanji | Latin |
| Production input | Pinyin IME, typed hanzi | Japanese IME, typed kana/kanji | Keyboard |
| TTS locale | `zh-CN` | `ja-JP` | `en-US` or `en-GB` |
| Storage key | `hanyu.v1` | `nihongo.v1` | `english.v1` |
| Sync backend | Its own Supabase project | Its own Supabase project | Its own Supabase project |
| Deployment | `hanyu-studio.netlify.app` | New Netlify site | New Netlify site |

Questions that must be answered by the human before content work:

1. **Which exam, if any?** “Learn Japanese” is not a scope. JLPT N3, JLPT N2, or no exam changes vocabulary size, grammar, and checkpoint format.
2. **Which textbook?** The app follows a book’s lesson order. Without a book, define a custom syllabus and vocabulary list.
3. **What is the starting point?** Total beginner, false beginner, or returning after a gap? The current app assumes a returning HSK4 learner and uses calibration to refresh old vocabulary.
4. **How many minutes per weekday, and how many days per week?** The current design assumes 35 minutes and five weekdays.
5. **Is the interface Spanish, English, or bilingual?** Spanish is the learner’s L1; the content explanations should normally be Spanish.
6. **One device or computer + phone sync?** Sync determines whether a Supabase project is needed at all.
7. **Is speaking out of scope?** The current app deliberately has no speaking practice. Keep that constraint unless the human explicitly changes it.

### Spanish is the mother tongue

This has two separate consequences:

- **Content L1 = Spanish.** Glosses, grammar explanations, reading translations, writing prompts, and error messages for the learner should be Spanish.
- **Target text L2 = Japanese or English.** Passages, example sentences, dictation, prompts the learner must read in the target language, and answers stay in L2.
- **The interface** can be Spanish or English. Spanish is recommended for a Spanish speaker; if time is short, keep the English shell for the first MVP and schedule the Spanish pass before daily use.

The current data schema uses fields named `en` (`en` gloss, `title_en`, `explain_en`, etc.). In this document, “`en`” means **the learner’s language field**, not “English”. If L1 is Spanish, those fields must contain Spanish. Rename them to `gloss`, `title_l1`, `explain_l1`, etc. in a fork, or the confusion will cause bugs.

---

## 2. Product invariants

These are the decisions that make the app what it is. Keep them unless the human explicitly asks for a different product.

1. **Static, local-first web app.** No server, no build framework, no runtime dependency except optional Supabase sync. It must open from `index.html` and work offline after the first load.
2. **Plain HTML/CSS/classic JavaScript.** `index.html` loads scripts in order; each module attaches to `window.HY`. Do not introduce React, Vite, TypeScript, or a bundler for a port. The simplicity is the feature.
3. **Data is committed as JavaScript.** `assets/js/data/vocab.js`, `lessons.js`, `tap.js`, and `config.js` are static globals. The app never fetches lesson data from an API.
4. **Three review skills per word.** Recognition, production, listening. Each is scheduled independently.
5. **Typed production, no handwriting, no speaking.** The learner types the target word or composition. There is no pronunciation scoring and no speech recording.
6. **SM-2-style spaced repetition.** Binary correct/incorrect grading; no self-rated Hard/Easy buttons.
7. **A plan, not a content dump.** The app calculates a target-date plan, adapts new-word load to the review backlog, and shows pace honestly.
8. **Optional, local-first sync.** Every answer is saved to `localStorage` first. Supabase is an optional mirror, never the source of truth.
9. **Original content.** Textbook vocabulary lists are facts; passages, questions, explanations, and model answers must be original. Never copy textbook prose or exercises.
10. **PWA/offline.** Service worker, manifest, home-screen install, browser TTS. No audio files.
11. **No secrets in the browser.** Only the Supabase anon/publishable key. Never `service_role` or a secret key.
12. **iPhone-compatible.** Touch targets, responsive layout, iOS Safari, standalone home-screen mode.

If a port violates one of these, write down why in the instance brief. “It was easier” is not a reason.

### 2.1 Fork per instance; do not build a runtime language switcher

Build one repository, one deployment, and one data set per language. A runtime switcher would have to load every language’s vocabulary, lesson content, and tap dictionary, keep separate progress namespaces, and avoid sharing a Supabase row. That is more complexity than the product needs.

- Keep the Chinese instance untouched while building the Japanese/English forks.
- If the family grows, extract a shared engine later; do not block the first port on a grand refactor.
- Separate origins also make `localStorage`, service-worker caches, and PWA installs naturally independent.

---

## 3. How the current app is put together

### 3.1 Layers

```
index.html
  ├─ assets/js/data/config.js      optional build-time Supabase config
  ├─ assets/js/data/vocab.js       generated vocabulary (window.HY_VOCAB)
  ├─ assets/js/data/lessons.js     generated lesson content (window.HY_LESSONS)
  ├─ assets/js/data/tap.js         generated tap-to-define dictionary (window.HY_TAP)
  ├─ assets/js/core/util.js        DOM, dates, text normalization, diff, random
  ├─ assets/js/core/data.js        joins vocab + content, defines examples/tokenization
  ├─ assets/js/core/storage.js     localStorage state, export/import
  ├─ assets/js/core/srs.js         three-skill SM-2-style scheduler
  ├─ assets/js/core/plan.js        target-date plan, daily targets, checkpoints
  ├─ assets/js/core/session.js     queue building, grading, writing, activity log
  ├─ assets/js/core/tts.js         browser speech synthesis, voice picking
  ├─ assets/js/core/sync.js        Supabase auth + snapshot merge
  ├─ assets/js/ui/*.js             screens (dashboard, lessons, session, exam, stats...)
  └─ assets/js/app.js              boot, routes, shell
```

### 3.2 State

Everything the learner does lives in one object saved to `localStorage` under `hanyu.v1`:

```js
{
  version: 1,
  createdAt: "ISO date",
  profile: { name, startDate, targetDate, dailyMinutes, exam: true } | null,
  settings: { voiceURI, rate, translation, theme, newPerDay, reviewCap, reduceMotion },
  diagnostic: { ... } | null,
  plan: { weeks, lessonsPerWeek, checkpoints: [...] } | null,
  cards: {
    "细节|rec": { w, skill, due, interval, ease, reps, lapses, last, suspended, created },
    "细节|prod": { ... },
    "细节|listen": { ... }
  },
  words: {
    "细节": { w, lesson, source, introducedAt, status, seen, correct, lapses, lastSeen }
  },
  lessons: { "1": { stages, scores, stageAt, startedAt, completedAt } },
  sessions: [ ... ],
  days: { "2026-11-18": { minutes, reviews, newWords, correct, total, sessions } },
  exams: [ ... ],
  writing: [ ... ],
  skillStats: { rec: {seen, correct}, prod: {...}, listen: {...} },
  current: { id, date, items, idx, results, done } | null,
  onboarded: false,
  meta: { lastOpen, storage, configAt, sync: {...} }
}
```

`meta.sync` is device-local connection state (project URL, anon key, email, tokens, revision). It is stripped before upload and from exported backups.

### 3.3 Sync

- Supabase Auth email/password through GoTrue REST endpoints.
- One row in `public.progress` per auth user (`user_id` primary key), JSONB snapshot + `rev`.
- Pull, merge field-by-field, push with expected `rev`, retry on conflict.
- Writes go through the `save_progress` security-definer RPC; the table is read-only to the authenticated user.
- RLS limits each user to their own row.
- Build-time env vars `SUPABASE_URL` and `SUPABASE_ANON_KEY` are baked into `deploy/assets/js/data/config.js`.

### 3.4 Build

- `npm run build` → `tools/prepare_deploy.mjs` → `deploy/`.
- Always writes `deploy/assets/js/data/config.js` from the environment (empty if unset).
- Injects `supabase/schema.sql` into `setup.html`.
- Hashes every deployable file (except `sw.js`) and stamps `sw.js` with a new cache name.
- `tools/prepare_deploy.py` does the same and also creates `hsk5-studio-site.zip`.
- Netlify uses `npm run build`, publishes `deploy/`, Node 20.

---

## 4. Learning design decisions

These decisions are the product. Document any change in the new instance brief.

### 4.1 Anchor the syllabus to an exam and a textbook

**Current:** HSK Standard Course 5, two volumes, 18 lessons each; HSK 2.0 level 5 exam in roughly six months; 1,367 book words plus 390 official-list gap words; 598 HSK4 words for calibration.

**Why:** A textbook supplies sequence and vocabulary; the exam supplies a target and a definition of “enough”. Without both, the app becomes an endless deck.

**Porting:** Pick a textbook and an exam (or explicitly “no exam”). Use the textbook’s lesson order for vocabulary. If the official exam list has words the book omits, add a “gap” deck exactly as the Chinese instance does. Do not force 36 lessons; use the book’s unit count, then adjust the plan math.

### 4.2 Three independent skills per word

**Current:** `rec` (read the word → meaning), `prod` (meaning/context → type the word), `listen` (audio → meaning). Each has its own due date, interval, ease, reps, and lapses.

**Why:** Recognition is not production. A learner can read a word in a passage and fail to type it. Listening is a third skill, especially when the script is not phonetic (Chinese, Japanese). Scheduling them separately prevents one strong skill from hiding two weak ones.

**Porting:** Keep all three. For Japanese, decide what `rec` shows (kanji? kana? both?) and what `prod` accepts (kanji, kana, or both if the reading matches). For English, `rec` can be word → Spanish gloss, `prod` Spanish → English, `listen` audio → meaning.

### 4.3 Binary grading, not Anki’s four buttons

**Current:** The session records correct/incorrect. The scheduler supports `q=0..3` internally, but the UI only uses 0 and 2. No self-rating.

**Why:** The app auto-grades typed answers and multiple-choice questions. Asking “how did that feel?” after an objective answer adds noise. It also keeps the session fast.

**Porting:** Keep binary grading unless the exercise type genuinely needs self-rating (e.g., free composition). If you add Hard/Easy, change the scheduler deliberately and document it; do not leave hidden four-grade code paths claiming to be used.

### 4.4 SM-2-style scheduling

**Current:** Ease starts at 2.5. Correct on the first review gives 1 day for recognition/listening and 2 days for production. Later correct answers multiply the interval by ease. A wrong answer drops to 10 minutes and lowers ease by 0.2 (floor 1.3). Interval cap 730 days. Mature at 21 days. A word may appear in more than one skill in a session; there is no sibling burying.

**Why:** Simple, predictable, easy to reason about, and good enough for a six-month exam plan. It is not FSRS, and it does not need to be for this scope.

**Porting:** Keep the model. Tune only the first intervals and daily caps if the language’s script makes production much slower. Document the numbers. Do not silently switch to FSRS and claim the old behavior.

### 4.5 Daily load is adaptive

**Current defaults:**

- 15 new words/day.
- 45 review cards/day cap.
- If due > 45 → at most 8 new words.
- If due > 70 → at most 4.
- If due > 100 → 0 new words.
- If behind plan and due < 70 → +3 new words.
- Session review budget is derived from the target minutes; reviews are estimated at 18 seconds each.

**Why:** Review debt is the main failure mode of self-study. Cutting new words when reviews pile up protects the habit and the retention rate.

**Porting:** Keep the principle, tune the thresholds. Japanese production with an IME and English composition may take longer per item; adjust the time estimate and the review cap. Do not let new words grow while the due queue is exploding.

### 4.6 Calibration before the plan

**Current:** a 14-item first stage (10 HSK4 recognition + up to 4 pinyin checks, filled with HSK4 meaning items if the pinyin pool is short). If stage A accuracy is at least 55%, stage B adds 5 early HSK5 words + 4 grammar-in-context items (23 total); otherwise it adds 5 more HSK4 words + 2 grammar items (21 total). Missed HSK4 words go into a refresh deck mixed into the first three weeks. Calibration is optional.

**Why:** A returning learner should not spend three months on words they already know. A short, adaptive check is enough to set the starting point; it is not a certification exam.

**Porting:** Replace HSK4/HSK5 with the equivalent prior level (JLPT N4/N5; CEFR A2/B1). Keep the adaptive branch: strong prior-level recall unlocks target-level preview. Do not make calibration mandatory or long.

### 4.7 Checkpoints instead of one final exam

**Current:** Five timed checkpoints after lessons 6, 12, 18, 24, 30 plus a final mock after lesson 36. 45 minutes: listening, reading, writing. They are practice instruments, not official papers.

**Why:** A single exam at the end gives no feedback. Checkpoints sample the same skills at a fraction of the length and fit a work break.

**Porting:** Match the target exam’s sections. JLPT has no writing section; do not label a JLPT-style test as having one. Cambridge/IELTS/TOEFL have different section structures. If the exam has no writing, either remove the writing section from checkpoints or label it “extra production practice”.

### 4.8 Typed writing with a transparent heuristic

**Current:** 36 composition tasks, typically 80–130 Chinese characters with 3–6 target words, model answer. The app scores length, target-word coverage, and sentence count. It does not grade style or accuracy semantically.

**Why:** Typing is the only productive writing mode that works offline in a browser. The heuristic gives quick feedback without pretending to be a teacher.

**Porting:** For Japanese, count CJK + kana and use the IME; for English, use word count and CEFR-style task types. Keep the rubric transparent. Tell the learner to have a human check style. Do not present the heuristic as an official score.

### 4.9 No speaking

**Current:** Deliberately absent. Nothing records or scores pronunciation.

**Why:** Browser speech recognition is unreliable, feedback is hard, and the user explicitly excluded speaking. Listening still exercises phonology.

**Porting:** Keep it out unless the human asks. If speaking is added later, make it a separate, clearly optional module; do not silently turn the app into a pronunciation trainer.

### 4.10 Local-first, privacy-preserving

**Current:** All study data is in the browser. Sync is optional and sends one sanitized snapshot per account. No analytics, no third-party scripts, no remote fonts.

**Why:** The app is used at work; progress should survive network outages and not depend on a service. Sync exists for the phone, not as the source of truth.

**Porting:** Keep the local-first architecture and the “sync optional” UX. Do not add telemetry. If you add a new backend, keep it optional and document exactly what leaves the device.

### 4.11 Original content, textbook-shaped

**Current:** HSK vocabulary order comes from the book; all passages, questions, drills, explanations, and model answers are original. The content spec forbids copying textbook prose.

**Why:** Copyright and pedagogy. The book provides scope and sequence; the app provides fresh practice.

**Porting:** Same rule. Vocabulary lists and exam level descriptors are facts; the textbook’s passages and exercises are not. Keep attribution and licensing notes in the README.

### 4.12 Sentence-level translations from the start

**Current lesson from this build:** Reading passages store one passage-level English translation. The example builder split the Chinese into sentences but initially attached the whole translation to each sentence, so a New Word card showed the entire paragraph under one sentence. The fix pairs sentences only when the counts match; otherwise it hides the English rather than mislabel it.

**Porting:** For a new instance, author reading content as sentence pairs from the beginning:

```json
"reading": {
  "text": "……",
  "sentences": [
    { "l2": "第一句。", "l1": "First sentence." },
    { "l2": "第二句。", "l1": "Second sentence." }
  ],
  "questions": [ ... ]
}
```

If you keep the old single `translation` field, never display it as the translation of an individual sentence. Use it only for the whole passage, or align it deliberately and mark uncertain alignments.

---

## 5. Content model

### 5.1 Vocabulary input

`content/vocab-by-lesson.json` is the authored/generated vocabulary index. Current shape:

```json
[
  {
    "lesson": 1,
    "zh": "爱的细节",
    "en": "Details of Love",
    "book": 1,
    "items": [
      {
        "w": "细节",
        "py": "xì jié",
        "pos": "n.",
        "en": "details; particulars",
        "official": true,
        "in_hsk6": false
      }
    ]
  }
]
```

The app data (`assets/js/data/vocab.js`) wraps it:

```js
window.HY_VOCAB = {
  meta: { ... },
  lessons: [ { n, zh, en, book, items: ["细节", ...] } ],
  words: [ { w, py, pos, en, defs, lesson, also, official, in4, in6, trad, rad, freq } ],
  gap: [ ... ],
  hsk4: [ ... ]
};
```

`w` is the lookup key. For Japanese it can be a kanji/kana surface; for English it can be a word or a multiword expression. Do not assume one character or one token.

### 5.2 Lesson content

`content/lesson-NN.json` follows `CONTENT_SPEC.md`. Current sections:

- `lesson`, `title_zh`, `title_en`, `theme`.
- `grammar`: one point, explanation, common mistake, 3 examples with pinyin + translation, 2 drills.
- `reading`: 200–280 CJK characters, translation, 3 questions with explanations.
- `listening`: 5 dictation sentences.
- `writing`: prompt, 3–6 required words, minimum characters, model, tips.

The generated `assets/js/data/lessons.js` is `window.HY_LESSONS = [ ... ]`; `data.js` joins it to vocabulary by lesson number.

### 5.3 Recommended schema for a new instance

Do not refactor and author at the same time. For a new fork, start from the current schema, then normalize names in a mechanical pass:

| Current | Generic | Meaning |
|---|---|---|
| `w` | `term` | Target-language surface form |
| `py` | `reading` | Pinyin / kana reading / IPA |
| `en` (vocabulary) | `gloss_l1` | Learner-language gloss |
| `zh` | `title_l2` | Target-language title |
| `en` (lesson) | `title_l1` | Learner-language title |
| `explain_en` | `explain_l1` | Learner-language grammar explanation |
| `min_chars` | `min_units` + `unit` | Characters for Chinese/Japanese, words for English |
| `lang="zh-Hans"` | `lang` from config | HTML language tag |
| `hanyu.v1` | app-specific key | Local storage namespace |

Target content shape:

```json
{
  "schema": 2,
  "l2": "ja",
  "l1": "es",
  "lesson": 1,
  "title": { "l2": "...", "l1": "..." },
  "grammar": {
    "point_l2": "...",
    "point_l1": "...",
    "explain_l1": "...",
    "common_mistake_l1": "...",
    "examples": [ { "l2": "...", "reading": "...", "l1": "..." } ],
    "drills": [ { "q_l2": "...", "options_l2": ["..."], "answer": 0, "explain_l1": "..." } ]
  },
  "reading": {
    "text_l2": "...",
    "sentences": [ { "l2": "...", "l1": "..." } ],
    "questions": [ { "q_l2": "...", "options_l2": ["..."], "answer": 0, "explain_l1": "..." } ]
  },
  "listening": {
    "dictation": [ { "l2": "...", "l1": "..." } ]
  },
  "writing": {
    "prompt_l1": "...",
    "required": ["..."],
    "min_units": 80,
    "unit": "chars",
    "model_l2": "...",
    "tips_l1": "..."
  }
}
```

This shape is a target, not a requirement for the first fork. The important change is **sentence-level L1 translations** and **unit-aware writing**.

### 5.4 Content volume and plan math

Current scale:

- 36 lessons.
- 1,367 book words + 390 gap words.
- 598 HSK4 calibration words.
- 36 grammar points, 72 drills.
- 36 passages, 108 questions.
- 180 dictation sentences.
- 36 writing tasks.
- 6 checkpoints (5 + final).

For a new instance, estimate before writing:

```
total target words ≈ words per lesson × lessons
weeks ≈ total words / (new words per day × sessions per week)
checkpoint count ≈ lessons / checkpoint interval
```

A 36-week course at 15 new words per session and five sessions per week has a capacity of about 2,700 words (75 new words/week). The current 1,367-word course needs roughly 18 weeks of new-word time; the rest of the six months goes to reviews, lesson stages, and checkpoints. If the target exam needs 4,000 words, either raise the daily new-word load (and review time), extend the date, or reduce scope. Do the arithmetic in the brief; do not discover it after writing 36 lessons.

### 5.5 Authoring rules that still apply

- Original prose only; no textbook copying.
- One grammar point per lesson; two drills; four options; one correct answer.
- Three reading questions: main idea, detail, inference/attitude.
- Five dictation sentences; clear when heard; typeable on the target keyboard.
- Writing: 3–6 required words, model uses all of them, learner output typed.
- Workplace-safe: no politics, graphic content, or romance beyond mild mention.
- Recycle prior vocabulary; keep new-word density manageable.
- Every target-language sentence that appears alone in a context card needs its own L1 translation.
- If an AI drafts content, a fluent speaker reviews the target-language prose and translations before it ships. Do not let volume outrun review capacity.

### 5.6 Validation

Current checks (adapt, do not skip):

```powershell
python tools/validate_content.py --lessons 1-36
python tools/build_content.py
node tools/check_tap.mjs
python tools/prepare_deploy.py
```

`validate_content.py` checks schema, lengths, options, pinyin presence, vocabulary coverage, and duplicate grammar IDs. `check_tap.mjs` verifies every passage character/word has a tap entry. For a new language, rewrite the target-language-specific checks (CJK counts, pinyin regex, character-level tap) and keep the structural checks.

### 5.7 Data sources and licensing

Record every source and its license in `README.md` before committing derived data.

- **Chinese (current):** CC-CEDICT (CC BY-SA 4.0), Unihan readings via `mozillazg/pinyin-data`, jieba dictionary (MIT), HSK lists (verify the upstream list’s terms). Textbook prose is not used.
- **Japanese:** JMdict and KANJIDIC2 are commonly CC BY-SA 4.0 — verify the current license and attribution requirements. JLPT does not publish an official word list; treat third-party “JLPT lists” as unofficial and check their terms.
- **English:** frequency lists, learner dictionaries, and CEFR word lists have different licenses. Prefer a license-compatible frequency source; do not copy a proprietary dictionary’s definitions wholesale.
- **Textbooks:** vocabulary order and exam level descriptors are facts; passages, dialogues, exercises, and model answers are copyrighted. Write original prose.
- **Audio:** the app uses browser TTS, not bundled recordings; no audio license is involved, but voice availability varies by device.

If a derived data file is shared under a share-alike license, keep the attribution and license notice with it. When in doubt, ask the human before committing.

---

## 6. What is Chinese-specific in the code

This table is the fastest way to find the seams. Read the file before changing it; many behaviors are interconnected.

| File / symbol | Chinese-specific behavior | Port action |
|---|---|---|
| `assets/js/core/storage.js` `KEY = "hanyu.v1"` | Local storage namespace | Change to `ja.v1` / `en.v1`; add `app` field to exports |
| `assets/js/core/data.js` `CJK_ONLY`, `TAP_MAX_WORD = 6`, `tapWords`/`tapChars` | Hanzi tokenization and character fallback | Replace with target tokenizer; no character fallback for English; kana/kanji handling for Japanese |
| `assets/js/core/data.js` `splitEnglish`, `buildExamples` | Chinese sentence splitting + English translation pairing | Generalize to L2/L1 sentence arrays; never attach passage translation to one sentence |
| `assets/js/core/tts.js` `zhVoices`, `PREF`, `zh-CN`, test sentence | Mandarin voice selection | Replace locale, voice regex, preferred names, test sentence |
| `assets/js/core/util.js` `U.norm`, `U.sameAnswer`, `U.cjkCount`, `U.splitSentences`, `U.diff` | Chinese punctuation, hanzi counts, `儿` tolerance | Add a language adapter; Japanese kana/kanji normalization; English case/contraction handling |
| `assets/js/core/plan.js` `LESSONS = 36`, `SESSIONS_PER_WEEK = 5` | HSK book length and weekday rhythm | Read lesson count from data; keep the plan formula but parameterize |
| `assets/js/core/srs.js` `SKILLS`, `BASE`, `EASE0` | Three skills and Chinese-tuned first intervals | Keep; tune base intervals for Japanese/English production speed |
| `assets/js/core/session.js` estimates and quotas | 18 sec/review, 15 new/day assumptions | Tune to the language and input method; keep adaptive review protection |
| `assets/js/ui/session.js` `lang="zh-Hans"`, `hanzi` class, Chinese placeholders, `U.cjkCount` | Input and writing UI | Use target `lang`, remove Chinese placeholder, unit-aware counts |
| `assets/js/ui/onboarding.js` | HSK4/HSK5 copy, 36 lessons, six months | Rewrite level/exam/book copy; keep the four-step structure |
| `assets/js/ui/diagnostic.js` | HSK4 pool, pinyin questions, HSK5 preview | Replace prior/target levels and item types |
| `assets/js/ui/exam.js` | HSK section format, 45 minutes, Chinese writing placeholder | Match the new exam; remove/add writing section; rescore |
| `assets/js/ui/components.js` | Radical display, tap examples | Language-specific metadata; make optional |
| `assets/js/ui/lessons.js`, `lesson.js`, `dashboard.js`, `stats.js`, `settings.js` | HSK labels, 36 lessons, 1,300 words, exam copy | Search for “HSK”, “Chinese”, “hanzi”, “pinyin”, “字” and localize |
| `index.html` | Title, `lang`, metadata, script order | Change title/lang; add any new data file to the load order |
| `manifest.webmanifest` | Name, short name, `lang`, icons, colors | New brand and locale |
| `sw.js` | `CORE` list, cache prefix | Add new data files; change cache prefix |
| `supabase/schema.sql` | One `progress` row per user | Separate project per instance, or add an `app` column/composite key |
| `tools/*.py`, `tools/*.mjs` | HSK lists, CC-CEDICT, jieba, Unihan, pinyin regex | New source adapters; keep the build/deploy contract |
| `setup.html`, `README.md` | Supabase/Netlify/HSK instructions | Rewrite for the new instance; do not leave dead HSK links |

Search commands that help:

```powershell
rg -n "HSK|Chinese|hanzi|pinyin|zh-Hans|hanyu|细节|字" assets index.html manifest.webmanifest setup.html README.md
rg -n "TO[A-Z]|LESSONS|SESSIONS_PER_WEEK" assets/js
```

---

## 7. Build workflow for a new instance

Work in this order. Do not author the whole course before testing one lesson end-to-end.

A first release may ship one lesson with all exercise types and local storage; sync, calibration, checkpoints, and the full content set can follow. Do not ship a UI shell with no content, and do not build the sync layer before the first lesson renders correctly.

### Phase 0 — Instance brief and content sample

- Fill section 1.
- Pick one lesson from the chosen textbook.
- Write a 300-word sample of the reading style in L2 and its L1 translation.
- Write one grammar explanation in L1.
- Have the human approve the sample before scaling.
- **Done when:** the human signs off on level, tone, script, and lesson shape.

### Phase 1 — Fork and rename

- Copy the repo to a new directory/repository. Keep the current instance untouched.
- Change:
  - `package.json` name/description.
  - `manifest.webmanifest` name, short name, description, `lang`, theme.
  - `index.html` `<html lang>`, `<title>`, description, apple title.
  - `assets/js/core/storage.js` key (`ja.v1` / `en.v1`).
  - `README.md`, `setup.html`, `netlify.toml` names and instructions.
  - `sw.js` cache prefix.
- Add an app identity constant, e.g. `window.HY_APP = { id: "ja", l1: "es", l2: "ja" }`, and use it in exports/sync.
- Decide UI language; if Spanish, plan the i18n pass (section 10).
- **Done when:** a fresh clone builds and opens with the new name and an empty, separate local state.

### Phase 2 — Data sources and vocabulary

- Choose licensed dictionaries/frequency data. Record licenses in `README.md`.
- Write a `build_vocab` equivalent that produces:
  - lesson-ordered target words,
  - official exam gap words,
  - prior-level refresh words.
- Preserve the `w` lookup key. For Japanese/English, define what a “word” is (lemma, surface, multiword).
- Run the exporter and commit the generated `assets/js/data/vocab.js` and `content/vocab-by-lesson.json`.
- **Done when:** the vocabulary counts and lesson order are reproducible from source data.

### Phase 3 — One vertical lesson

- Author `content/lesson-01.json` for the new language.
- Use sentence-level `reading.sentences` with L1 translations.
- Add grammar examples, two drills, three questions, five dictation sentences, writing task.
- Adapt the validator, then run it.
- Build and test:
  - calibration/onboarding,
  - new word card (context + translation),
  - recognition/production/listening reviews,
  - dictation diff,
  - writing submission.
- **Done when:** one lesson works end-to-end on desktop and iPhone-sized viewport, with no console errors.

### Phase 4 — Language adapter

- Implement target tokenization/segmentation for tap-to-define.
- Implement answer normalization and accepted alternatives.
- Implement sentence splitting for TTS and content.
- Implement unit counting (chars/words) and writing validation.
- Replace TTS voice selection and test sentence.
- Add automated tests or a small browser QA script for these pure functions.
- **Done when:** a target-language passage can be tapped word-by-word, a typed answer with a legitimate variant is accepted, and TTS uses the target voice.

### Phase 5 — Content scale

- Author lessons in batches of 4–6.
- Run the validator after every batch.
- Keep a content ledger: lesson, grammar point, word count, translation status, audio/dictation status.
- Spot-check sentence translations; do not let a single passage translation leak into per-sentence cards.
- **Done when:** the full lesson set passes validation and a random sample of 10 lessons renders correctly.

### Phase 6 — Plan, diagnostic, checkpoints

- Parameterize lesson count and checkpoint interval.
- Rewrite onboarding copy for the new level/book.
- Adapt the diagnostic pools and branch logic.
- Adapt checkpoint sections/timers/scoring to the target exam.
- **Done when:** a new learner can onboard, calibrate, study, and take a checkpoint without seeing HSK copy.

### Phase 7 — UI language and branding

- Translate the interface if the brief says Spanish UI.
- Replace Chinese-specific labels (`hanzi`, `pinyin`, `字`) with target-language equivalents.
- Add target fonts and `lang` attributes.
- Review mobile layout with longer Spanish strings and Japanese text.
- **Done when:** no untranslated English/Chinese text appears in the primary flow.

### Phase 8 — Sync isolation

- Create a separate Supabase project (recommended), run the schema, configure Auth.
- Or add an `app` column/composite key if sharing a project (section 11).
- Bake `SUPABASE_URL` / `SUPABASE_ANON_KEY` at build time.
- Test sign-up, sign-in, upload, download, merge, sign-out, offline.
- **Done when:** the new instance cannot read or overwrite the Chinese instance’s row, even with the same email.

### Phase 9 — Deploy and PWA

- New Netlify site, build `npm run build`, publish `deploy`, Node 20.
- Set env vars, clear-cache deploy, verify `supabase: configured at build time`.
- Set Supabase Site URL to the new site.
- Add to iPhone home screen; test offline launch, TTS voice, input method, writing.
- **Done when:** the app is reachable on the phone and progress syncs with the computer.

### Phase 10 — QA and freeze

- Run the full QA matrix (section 12).
- Export/import backup; verify no tokens in the export.
- Check licenses/credits.
- Freeze content; tag a release.
- **Done when:** the definition of done in section 15 is satisfied.

---

## 8. Japanese instance notes

### 8.1 Scope

- Confirm JLPT level: N3 is a reasonable “resume after a gap” target; N2 is a much larger vocabulary/grammar project.
- Confirm textbook: Genki I/II (23 lessons), Minna no Nihongo I/II (50 lessons), Tobira (15 chapters), or a custom syllabus. Lesson count drives the plan and checkpoint spacing.
- JLPT has **no writing or speaking section**. The app’s writing stage is extra production practice; label it as such. Checkpoints should follow JLPT’s language-knowledge/reading/listening format if the goal is exam preparation.

### 8.2 Script and lookup

- A Japanese “word” may mix kanji, hiragana, and katakana. The lookup key can be the standard written form; store kana reading separately.
- Store at least: surface, kana reading, romaji (optional, for search), gloss in Spanish, part of speech, JLPT level, frequency, lesson.
- For tap-to-define, build a dictionary from JMdict/KANJIDIC2 (verify licenses) and a tokenizer (MeCab, Sudachi, or Juman++) at build time. Do not ship a tokenizer runtime unless necessary; precompute the passage tokens and dictionary entries.
- Character-level fallback is less useful than word-level; kanji have multiple readings. If you show a kanji entry, show its common readings and a caveat.

### 8.3 Answer normalization

Decide explicitly:

- Is kanji required for production, or is kana accepted? Recommended: accept the target written form and its kana reading if they match the dictionary reading; otherwise require the written form for kanji words.
- Normalize full-width/half-width, whitespace, punctuation, and long-vowel marks carefully.
- Do not strip dakuten/handakuten; they change meaning.
- Accept common orthographic variants only from a curated list; do not over-normalize.

### 8.4 TTS

- Use `ja-JP` voices. Preferred names vary by OS/browser (Kyoko, Otoya, Nanami, Haruka, Ayumi, Google 日本語, Microsoft Haruka).
- Test with a sentence that includes kanji, kana, and a number; TTS may read counters differently.
- Fallback `ja-JP` when no matching voice is installed.
- Listening exercises depend on the device voice; document this limitation.

### 8.5 Writing

- Typed Japanese via IME; no handwriting.
- Count CJK + kana for `min_units` (or count morae/words; pick one and document).
- Required words should be exact strings the learner can insert; watch IME composition events.
- JLPT does not test writing; keep the task optional or label it “output practice”.

### 8.6 Content

- Grammar: particles, verb forms, transitivity, keigo; one point per lesson.
- Reading: natural Japanese, not textbook dialogue; include furigana support or a reading toggle if the level needs it.
- Dictation: sentences that are unambiguous when heard; avoid homophone traps unless the lesson is about them.
- Culture: workplace-safe, adult, concrete; avoid anime/manga clichés and stereotyped “cool Japan” content.

---

## 9. English instance notes

### 9.1 Scope

- Confirm CEFR level (B1/B2) and exam (Cambridge B2 First, IELTS, TOEFL, or no exam).
- Pick a coursebook (English File, Speakout, Headway) or a custom syllabus. English has no official single word list; use CEFR descriptors, a coursebook, and a frequency list.
- For a Spanish-speaking learner, grammar explanations and vocabulary glosses are in Spanish; target text is English.

### 9.2 Vocabulary

- Store lemmas and inflected forms deliberately. The lookup key can be the headword; `forms` can list inflections.
- Include phrasal verbs and collocations as multiword entries; they are high-value and often missing from single-word decks.
- Add IPA pronunciation and an example sentence with L1 translation.
- Frequency data: use a license-compatible list; do not copy a proprietary dictionary wholesale.
- Distinguish British/American spelling where it matters; accept variants in answers if the coursebook does.

### 9.3 Tokenization and tap-to-define

- Split on whitespace and punctuation; handle contractions (`don't`, `won't`), hyphenated words, and multiword expressions.
- No character fallback. A tap on a word opens its lemma entry; a tap on a phrase can open a phrase entry.
- Keep a stopword list? No; every word should be tappable, but function words can have short entries.

### 9.4 Answer normalization

- Case-insensitive; trim punctuation; normalize curly quotes/apostrophes.
- Accept contractions and their expansions only if the coursebook treats them as equivalent.
- Accept US/UK spelling variants from a curated list.
- Do not accept grammatical substitutions that change meaning (e.g., “he go” for “he goes”).
- For multiword answers, normalize internal whitespace.

### 9.5 TTS

- Use `en-US` or `en-GB`; pick one default and expose the other as an option.
- Preferred voices: Samantha, Daniel, Google US English, Microsoft Aria/Guy, etc.
- Test with a sentence containing a contraction, a number, and a proper noun.
- For listening, consider accent variety only after the core app works; do not make the first version depend on multiple installed voices.

### 9.6 Writing

- Count words, not characters. Replace `min_chars` with `min_units` + `"unit": "words"`.
- Task types: email, informal message, review, opinion essay, article; align with the target exam.
- Rubric: length, target-word coverage, sentence count; add a checklist (clear opening, concrete detail, closing).
- Spanish L1 interference: false friends, prepositions, verb tense choice, articles; add contrastive tips in L1 where useful.

### 9.7 Exam checkpoints

- Cambridge B2 First: Reading & Use of English, Writing, Listening, Speaking (speaking excluded).
- IELTS: Listening, Reading, Writing, Speaking (speaking excluded); different timing.
- TOEFL: Reading, Listening, Speaking, Writing (speaking excluded).
- If the app excludes speaking, say so in the checkpoint description; do not imply a full exam simulation.

---

## 10. Spanish interface and L1

### 10.1 Decide the UI language early

- **Option A — English UI, Spanish content.** Fastest; acceptable if the learner is comfortable with English. The interface still contains HSK/Chinese labels that must be changed to the new target language.
- **Option B — Spanish UI.** Recommended for daily use. It is a mechanical but broad pass: every button, label, toast, empty state, onboarding step, settings row, exam instruction, and error message.

### 10.2 Minimal i18n approach

The current UI strings are hardcoded in the `ui/*.js` files. A pragmatic approach:

1. Add `assets/js/i18n/es.js` with `window.HY_I18N = { "nav.today": "Hoy", ... }`.
2. Add `U.t(key, vars)` that returns the string or the key if missing.
3. Replace strings screen by screen, starting with onboarding, dashboard, session, settings, and exam.
4. Keep target-language content (`lang="ja"` / `lang="en"`) separate from UI strings.
5. Add a language toggle only if the human wants it; otherwise hardcode the instance’s UI language.

Do not machine-translate the whole UI and ship it unreviewed; a native Spanish speaker should read the primary flow.

### 10.3 Content fields

- Rename `en` → `gloss_l1`, `title_en` → `title_l1`, `explain_en` → `explain_l1`, `translation` → `translation_l1`, `prompt` → `prompt_l1`.
- Store Spanish with correct accents and punctuation.
- Keep target-language examples, passages, and answers in L2.
- Date/number formatting should use the browser locale; `toLocaleString()` already does this in many places, but check hardcoded English month/day labels.

### 10.4 Fonts and layout

- Spanish strings are often 15–30% longer than English; test buttons, tabs, and settings rows at 360 px width.
- Japanese needs a CJK font stack (`"Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif`) and more line-height.
- Keep the existing paper/ink aesthetic; a language instance should look like a sibling, not a different product.

---

## 11. Multi-instance sync isolation

The current schema has one row per user:

```sql
create table public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  rev bigint not null default 1,
  updated_at timestamptz not null default now()
);
```

If two language apps share a Supabase project and the same account, they will overwrite each other’s row. Choose one:

### Option A — separate Supabase project per instance (recommended)

- One project per language; one `progress` table; one set of keys.
- Separate Netlify env vars and Site URL.
- Simplest RLS and migration story.
- Cost: multiple free projects; free projects can pause when idle.

### Option B — one project, app-scoped rows

- Add `app text not null` and make the primary key `(user_id, app)`.
- Add `p_app` to `save_progress`; filter every query by `app`.
- RLS: `auth.uid() = user_id`.
- Client sends `app` from `window.HY_APP.id`.
- Migrate existing row to `app = 'hanyu'`.
- This is more code and more ways to leak across apps; only do it if managing many instances.

Storage keys must also be unique (`hanyu.v1`, `ja.v1`, `en.v1`). Add `app` to exported backups and reject importing a backup from a different app. The sync merge code is generic; it does not care about the language, but it does care about the state shape.

---

## 12. Build, deploy, and QA

### 12.1 Local

```powershell
python serve.py                 # http://127.0.0.1:8765
python tools/validate_content.py --lessons 1-36
python tools/build_content.py
python tools/build_tapdata.py   # only after editing reading passages
node tools/check_tap.mjs
npm run build
```

Open `deploy/index.html` or the served URL. Keep a clean browser profile for first-run tests; `localStorage` is origin-specific.

### 12.2 Netlify

- New site per instance; connect the repo; base directory empty; build `npm run build`; publish `deploy`; Node 20.
- Environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (publishable or legacy anon; never secret).
- Deploys → Trigger deploy → Clear cache and deploy site. Env vars are build-time.
- Build log must show `supabase: configured at build time`.
- Private Netlify projects return `401 Login Redirect` to anonymous visitors; either make the project public (then rely on Supabase auth + RLS) or log into Netlify on the iPhone. The home-screen app may not share the Netlify session; test it.

### 12.3 Supabase

- Create project, run `supabase/schema.sql`, enable Email provider, set Site URL, decide Confirm email.
- Create the account, then disable new sign-ups if the site is public.
- Never put `service_role`/secret keys in the browser or the repo.
- Free projects pause after inactivity; document how to restore.

### 12.4 QA matrix

- [ ] Fresh origin: onboarding, target date, minutes, voice test, calibration.
- [ ] New word card: target word, reading, gloss, **sentence-level context translation**, audio.
- [ ] Recognition, production, listening reviews; wrong answer returns in 10 minutes; correct answer grows the interval.
- [ ] Dictation: play, slow replay, type, diff; IME/accents behave.
- [ ] Reading: tap every target word/token; reading, gloss, audio.
- [ ] Writing: target words insert, unit count, submit, saved attempt.
- [ ] Checkpoint: timer, sections, submit, report.
- [ ] Stats: streak, heatmap, accuracy by skill, forecast.
- [ ] Export/import backup; no tokens in export.
- [ ] Supabase: sign-up, sign-in, upload, download, merge, sign-out, offline resume.
- [ ] iPhone: Add to Home Screen, offline launch, TTS voice, keyboard/IME.
- [ ] No console errors; no untranslated HSK/Chinese strings.
- [ ] Licenses/credits present; no textbook prose copied.

---

## 13. Traps and lessons from this build

1. **Sentence translations must be per sentence.** A passage-level translation attached to every split sentence produces the bug fixed in `4babf16`. Author `reading.sentences` from the start.
2. **Service worker caching can hide a deploy.** The cache name is content-hashed, but an installed PWA may run the old bundle once. Hard reload, unregister the service worker, or clear site data; tell the user to reload twice.
3. **Netlify env vars are build-time.** Saving them does nothing until a new deploy. Use “Clear cache and deploy site” and check the log line.
4. **The Supabase URL/key config is baked, not runtime.** If `config.js` is empty, Settings asks for manual values; if it has values, the card hides them. Do not mix the two modes.
5. **Local storage is per origin.** Progress on `localhost`/`file://` does not appear on the Netlify URL. Export on the old origin, import on the new one.
6. **Private Netlify is not app auth.** It gates the files, not the progress row. The iPhone may need a Netlify login; a home-screen web app may not share that session.
7. **Email login needs the Email provider.** “Email logins are disabled” is a Supabase Auth setting, not a password error. “Invalid login credentials” with no account means create the account first.
8. **Do not disable the Email provider to stop sign-ups.** Turn off “Allow new users to sign up” after creating the account; keep the provider on.
9. **Do not share one `progress` table across instances.** Use separate projects or an app column.
10. **Do not reuse `hanyu.v1`.** State collisions and confusing backups.
11. **Do not assume CJK counts for writing.** English uses words; Japanese uses characters/kana; Chinese uses hanzi. Make the unit explicit.
12. **Do not assume Chinese tokenization.** Japanese needs a morphological tokenizer; English needs whitespace/lemma handling; the Chinese `jieba`/CC-CEDICT pipeline does not transfer.
13. **TTS voices are device-provided.** The app cannot install a voice. Listening tests are not identical across devices.
14. **The writing score is a heuristic.** Do not present it as a teacher or an official exam score.
15. **The readiness number is a composite, not a prediction.** Explain its components; do not promise a pass.
16. **Licensing matters.** CC-CEDICT, JMdict, KANJIDIC2, frequency lists, and textbooks have different licenses. Record attribution; verify before committing derived data.
17. **No secrets.** The anon/publishable key is public by design; the secret/service_role key must never reach the browser, repo, or chat.
18. **The app is not affiliated with the exam boards or publishers.** Say so in the README.

---

## 14. Prompt templates for other AI agents

### 14.1 Content authoring prompt

```text
You are authoring lesson {N} for a {L2} course at {level} for a {L1} speaker.

Inputs:
- content/vocab-by-lesson.json, lesson {N}: the exact target words and glosses.
- CONTENT_SPEC.md: schema and rules (adapt the language-specific parts).
- The approved sample lesson: tone, length, difficulty.

Output:
- One UTF-8 JSON file content/lesson-{NN}.json, no markdown fences.
- Grammar: one point, {L1} explanation, common mistake, 3 examples with reading + {L1} translation, 2 drills.
- Reading: {target length} in {L2}, sentence-level {L1} translations, 3 questions.
- Listening: 5 dictation sentences, clear when heard.
- Writing: {L1} prompt, 3-6 required target words, model answer, unit-aware minimum.

Rules:
- Original prose only. Do not copy or paraphrase the textbook.
- Recycle prior vocabulary; use the lesson words naturally.
- Workplace-safe, adult, concrete.
- Never attach a whole-passage translation to a single sentence.

Validate:
python tools/validate_content.py --lessons {N}
Fix every failure and report the PASS output.
```

### 14.2 Code port prompt

```text
Read PORTING.md, README.md, CONTENT_SPEC.md, and the files named in the task.

Goal: {one vertical slice, e.g. "make tap-to-define work for Japanese lesson 1"}.

Constraints:
- Static HTML/CSS/classic JS; no framework, no bundler.
- Preserve local-first storage, the three-skill SRS, optional sync, and the PWA.
- Do not change learning design without explicit approval.
- Keep generated data committed; do not commit deploy/, zips, keys, or secrets.

Deliver:
- The smallest coherent diff.
- Commands run and their output.
- Browser QA evidence (desktop + iPhone viewport).
- A note on what is still language-specific or unfinished.
```

### 14.3 Review prompt

```text
Review this diff as a language-instance port.

Check:
- Does it preserve the product invariants in PORTING.md section 2?
- Are target-language and learner-language fields separated?
- Are sentence translations aligned per sentence?
- Does answer normalization accept legitimate variants without accepting wrong answers?
- Are storage keys, Supabase rows, and exports isolated from the Chinese instance?
- Do TTS, counts, fonts, and `lang` attributes match the target language?
- Did any HSK/Chinese copy survive in the primary flow?
- Are tests/validators run, and is the service-worker cache updated?

Report concrete file:line findings and a short risk list.
```

---

## 15. Definition of done

A new instance is done when:

- [ ] The instance brief is filled and approved.
- [ ] A fresh clone builds with `npm run build` and opens the new app.
- [ ] The full lesson set validates; every passage has sentence-level L1 translations or an explicit, correct fallback.
- [ ] Tap-to-define works for every target passage word (or the documented subset).
- [ ] TTS uses a target-language voice; the voice test works; listening does not require a specific OS.
- [ ] Recognition, production, listening, dictation, reading, writing, and checkpoints work on desktop and iPhone.
- [ ] Onboarding, calibration, plan, and stats show the new exam/book/level, not HSK.
- [ ] The UI is in the chosen language (or the English-shell limitation is documented and approved).
- [ ] Sync uses its own project or app-scoped rows; two instances cannot overwrite each other.
- [ ] Export/import works; no tokens or secrets are included.
- [ ] PWA installs, launches offline, and updates after a deploy.
- [ ] README, setup guide, licenses, and credits reflect the new instance.
- [ ] QA matrix in section 12 is complete.
- [ ] No `service_role`/secret key anywhere; no `deploy/` or zip committed; no textbook prose copied.

---

## 16. Quick file map

| Path | Role |
|---|---|
| `index.html` | App shell, script order, metadata |
| `assets/js/app.js` | Boot, routes, chrome |
| `assets/js/core/` | util, data, storage, SRS, plan, TTS, session, sync |
| `assets/js/ui/` | screens |
| `assets/js/data/config.js` | Build-injected Supabase config (empty by default) |
| `assets/js/data/vocab.js` | Generated vocabulary |
| `assets/js/data/lessons.js` | Generated lesson content |
| `assets/js/data/tap.js` | Generated tap-to-define dictionary |
| `content/vocab-by-lesson.json` | Authored/generated vocabulary index |
| `content/lesson-NN.json` | Authored lesson content |
| `tools/build_vocab.py` | Build vocabulary from source lists |
| `tools/export_source.py` | Export `vocab.js` + `vocab-by-lesson.json` |
| `tools/build_content.py` | Merge `content/lesson-*.json` into `lessons.js` |
| `tools/build_tapdata.py` | Build tap dictionary from reading passages |
| `tools/check_tap.mjs` | Verify tap coverage |
| `tools/validate_content.py` | Validate lesson content |
| `tools/prepare_deploy.py` / `.mjs` | Build `deploy/` (and zip) |
| `supabase/schema.sql` | Table, RLS, `save_progress` |
| `setup.html` | Supabase/hosting walkthrough with injected SQL |
| `README.md` | User/developer documentation |
| `CONTENT_SPEC.md` | Chinese lesson authoring spec |
| `STUDY_PLAN.md` | HSK plan rationale |
| `netlify.toml`, `.nvmrc`, `package.json` | Deploy/build contract |
| `sw.js`, `manifest.webmanifest` | PWA/offline |

---

## 17. Glossary

- **L1** — learner’s native language (Spanish for the planned instances).
- **L2** — target language (Japanese/English).
- **Instance** — one language course, one deployment, one data set, one sync scope.
- **Skill** — `rec`, `prod`, `listen`; one scheduled card each per word.
- **Mature** — interval ≥ 21 days.
- **Gap deck** — official exam words not covered by the textbook’s core lists.
- **Refresh deck** — prior-level words missed in calibration.
- **Checkpoint** — timed, sampled test after a lesson block.
- **Tap-to-define** — reference dictionary allowing every passage word to be tapped for reading/gloss/audio.
- **Snapshot** — the sanitized JSON state stored in Supabase.

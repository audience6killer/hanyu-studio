# HSK5 Studio

A local-first study desk for resuming **HSK Standard Course 5** after a long gap. It covers vocabulary, grammar, reading, listening and typed writing — everything except speaking — and schedules the next six months for short sessions at work.

It runs entirely in the browser. Local progress needs no account and no network. If you want the same progress on your iPhone, connect your own Supabase project and add the app to the home screen; only a sanitized progress snapshot is sent there.

---

## Start here

### Just this computer

1. Open `index.html` in Chrome, Edge or Firefox (double-clicking is fine).
2. On first run:
   - set a target exam date (default: six months out),
   - pick 30/35/45 minutes per weekday,
   - test the Mandarin voice,
   - take the 15-minute calibration or skip it.
3. Press **Start today's session**.

If your browser refuses to store data from a local file, run the tiny server:

```powershell
python serve.py
```

It opens `http://127.0.0.1:8765`.

### Computer + iPhone with sync

The full walkthrough lives in **`setup.html`**. In short:

1. Create a free Supabase project and run `supabase/schema.sql` in its SQL editor.
2. Turn **Confirm email** off under Authentication → Providers → Email (or confirm the message).
3. Copy the project URL and the **anon public** key.
4. Push this folder to GitHub.
5. Connect the repo to **Netlify** (recommended; `netlify.toml` is included) or **Cloudflare Pages** (build `npm run build`, output `deploy`). Both are free, support private repos and redeploy on every push to `main`. GitHub Pages is optional and currently manual-only because the GitHub account is billing-locked.
6. In Netlify, add the two Supabase values once as **build environment variables** (`SUPABASE_URL`, `SUPABASE_ANON_KEY`), then redeploy with a cleared cache. See [Configure the sync project once](#configure-the-sync-project-once-in-netlify) below. Skip this if you prefer to paste them into Settings on each device.
7. Open the resulting HTTPS URL — `*.netlify.app`, `*.pages.dev`, or `USER.github.io/REPO/`. Note it as the Supabase Site URL.
8. On the work computer, open **Settings → Cloud sync**, create the account (only email and password if the project was baked in), and let the first sync upload this browser's progress.
9. On the iPhone, open the same URL in Safari → **Share → Add to Home Screen** → open the icon → sign in with the same account → **Sync now**.

After that, either device can study offline. The next time both are online, the app merges the two histories.

### Configure the sync project once in Netlify

The app is a static site, so there is no server that could hold a database setting at runtime. The equivalent of "set the database in Netlify" is to put the Supabase **project URL and anon public key** into Netlify's build environment: the build writes them into `deploy/assets/js/data/config.js`, and every device that loads the site inherits them. Settings then only asks for email and password.

**Netlify**

1. **Site configuration → Environment variables → Add a variable**.
2. `SUPABASE_URL` = `https://YOUR-PROJECT.supabase.co` (a trailing slash is stripped automatically).
3. `SUPABASE_ANON_KEY` = the **anon public** / publishable key from Supabase → Project Settings → API. Never the `service_role` key.
4. Leave the scope at its default so builds receive the values.
5. **Deploys → Trigger deploy → Clear cache and deploy site**. Environment variables are read at build time; saving them alone does not change the live site.
6. Reload the site. Settings → Cloud sync now shows only email and password, and the "Change project" control is hidden.

**Cloudflare Pages**: Settings → Environment variables → add both for Production, then **Retry deployment**.

**GitHub Pages**: repository **Settings → Secrets and variables → Actions → Variables**, add `SUPABASE_URL` and `SUPABASE_ANON_KEY`; the workflow passes them to the build. The workflow is manual-only while GitHub billing is locked.

**Local build**

```powershell
$env:SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
$env:SUPABASE_ANON_KEY = "anon-public-key"
npm run build
```

Set both or neither: the build fails if only one is present, to avoid a half-configured site. With neither set, the app falls back to the manual Settings form, exactly as before.

Notes:

- The anon/publishable key is **public by design**; it ships in every browser bundle anyway. Row-level security protects the data. The `service_role` key bypasses RLS and must never be used here.
- A baked-in value wins over anything stored on a device. If `SUPABASE_URL` changes, the app clears the old session and revision on its next load and asks you to sign in again; local progress is untouched.
- Email and password cannot be baked in, and should not be: each device signs in once so Supabase can authorize that user's row. Local storage is origin-specific, so after moving from a local server to the Netlify URL, export a backup on the old origin and import it on the new one.
- The database itself is still created once in Supabase by running `supabase/schema.sql`. Netlify environment variables configure the client, not the Postgres schema.


---

## Automatic deployment from GitHub

> **Current status:** the GitHub account is billing-locked, so GitHub Actions cannot start. The Pages workflow is therefore manual-only, and **Netlify handles automatic deploys from `main`**. The instructions below apply once billing is resolved; Netlify/Cloudflare remain the working path today.

`.github/workflows/deploy.yml` is the optional GitHub Pages pipeline. When run (or after re-enabling its `push` trigger) it:

1. validates all 36 lesson files,
2. rebuilds `assets/js/data/lessons.js`,
3. builds `deploy/` with `tools/prepare_deploy.py`, injecting the current Supabase SQL into `setup.html` and any `SUPABASE_URL` / `SUPABASE_ANON_KEY` repository variables into `config.js`,
4. stamps a fresh service-worker cache name derived from a hash of the bundle, and
5. publishes the artifact to GitHub Pages.

One-time setup, from this folder:

```powershell
git init -b main
git add .
git commit -m "HSK5 Studio"
git remote add origin https://github.com/USER/REPO.git
git push -u origin main
```

Then, in the GitHub repository:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Open **Actions → Deploy HSK5 Studio** and confirm the run is green.
3. The site is at `https://USER.github.io/REPO/` (or a custom domain configured under Pages).

Notes:

- **`deploy/` and `hsk5-studio-site.zip` are ignored** and rebuilt by CI. Keep them for a local drag-and-drop deploy; do not commit them.
- **Private repositories:** Pages on a free plan requires a public repository. The repository contains no Supabase keys or study data; the project URL and anon key are build-time variables or are entered in Settings at runtime. If you need a private repo, use the Netlify/Cloudflare alternatives below.
- **PWA updates:** the cache name changes with the bundle hash, so an installed iPhone app installs the new assets on its next online launch.
- **Supabase Site URL:** if email confirmation is on, set Authentication → URL Configuration → Site URL to the deployed URL (including the `/REPO/` path).
- **Manual re-run:** Actions → Deploy HSK5 Studio → Run workflow. The workflow also runs on `workflow_dispatch`.
- **Custom domain:** add it under Pages, then update the Supabase Site URL and sign in again on the phone (the browser origin and therefore local storage are new; cloud sync restores progress).
- If your default branch is not `main`, change the `branches` entry in the workflow.

### If GitHub Pages billing blocks you

GitHub Pages is free for **public** repositories. Private-repo Pages requires GitHub Pro/Team, which is the usual billing wall. You have two free ways out:

**1. Make the repository public.** Pages becomes free immediately. The repository contains no Supabase keys, no study history and no personal data; the project URL and anon key are build-time variables or are entered in Settings at runtime. Then continue from step 2 above.

**2. Keep it private and use Netlify (recommended alternative).**

1. Push the repository to GitHub.
2. At [app.netlify.com](https://app.netlify.com) choose **Add new site → Import an existing project → GitHub** and pick the repo.
3. Netlify reads the included `netlify.toml`: build command `npm run build`, publish directory `deploy`. No Python is needed.
4. Set the production branch to `main`. The first deploy starts; every later push to `main` redeploys automatically.
5. Use the `*.netlify.app` HTTPS URL as the Supabase Site URL and open it on the iPhone → Share → Add to Home Screen.
6. The Pages workflow is already manual-only while billing is locked, so it will not run on pushes. You can leave it for later or disable it under **Actions → Deploy HSK5 Studio → … → Disable workflow**.

**3. Cloudflare Pages (also free, private repos supported).**

1. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, select the repository.
2. Framework preset: **None**. Build command: `npm run build`. Build output directory: `deploy`. Production branch: `main`.
3. Optionally set `NODE_VERSION=20` as a build environment variable.
4. Every push to `main` deploys to `*.pages.dev`. Use that URL for Supabase and the iPhone home screen.

Both alternatives use the same Node build, the same SQL injection into `setup.html`, the same `.nojekyll`, and the same content-hashed service-worker cache as the Pages workflow. `deploy/` and the zip stay generated artifacts and remain ignored by git.


---

## What is inside

| Area | Coverage |
|---|---|
| Lessons | 36 units, following the two volumes of HSK Standard Course 5 (18 lessons each) |
| Book vocabulary | 1,367 unique words in textbook lesson order, with pinyin, part of speech, English gloss, traditional form, radical and an in-context example where available |
| HSK5 exam gap | 390 official HSK 2.0 level-5 words that the book's core lists do not cover, so the official 1,298-word list is complete |
| HSK4 refresh | 598 HSK4 words for the calibration and reactivation deck |
| Grammar | 36 HSK5 patterns (one per lesson), 72 drills, explanations, common mistakes, example sentences with pinyin |
| Reading | 36 original passages (200–280 characters), 108 comprehension questions, every word and character tap-to-define with pinyin, gloss and audio, translations |
| Listening | 180 dictation sentences, passage audio, per-section slow replay, character-level diff feedback |
| Writing | 36 typed composition tasks with target words, model answers, self-rating and saved attempts |
| Review | Three spaced-repetition skills per word: reading recognition, typed recall, listening |
| Exams | Five timed checkpoints plus a final mock-assembly test, with section scores and item review |
| Progress | Streak, heatmap, accuracy by skill, vocabulary states, review forecast, lesson map, plan pace and readiness estimate |
| Cloud sync | Optional Supabase account, local-first snapshots, revision checks and field-by-field merge |
| Offline install | PWA manifest + service worker; home-screen install on iOS and Android |

The vocabulary data is embedded as JavaScript, lesson content is generated into `assets/js/data/lessons.js`, and local state is saved under the `hanyu.v1` key.

To build a sibling instance for Japanese or English, read `PORTING.md`: it separates the reusable engine from the Chinese-specific seams and gives the build order, content contracts, and QA checklist.

---

## A normal session (about 35 minutes)

1. **Reviews** — cards due now, interleaved across reading, recall and listening.
2. **New words** — normally 15, drawn from the current lesson's next words. When the review queue is heavy, the app lowers this automatically.
3. **Lesson stages** — grammar, reading, listening or writing. Grammar + reading are often paired because together they fit the same block.
4. **Summary** — minutes, first-try accuracy, new words and stages; everything is saved if you close the tab mid-session.

The exact queue is rebuilt each time, so there is no fixed "day 1 / day 2" content to lose track of.

Keyboard: `1`–`4` choose an option, `Enter` continues, `Space` plays audio, `Esc` closes a dialog, `?` shows the shortcut sheet.

---

## The six-month plan

The plan is generated from your target date and daily minutes. With the default settings:

| Phase | Weeks | Work |
|---|---|---|
| Reactivation | 1–2 | Calibration, rusty HSK4 words, Lesson 1 |
| Main run | 2–24 | About 1.5 book lessons per week, steady reviews, one or two stages per session |
| Checkpoints | 5, 9, 13, 17, 21, 25 | Timed tests over lessons 1–6, 1–12, … (assembled from what you have studied) |
| Consolidation | 23–26 | Final mock, weak-spot review, exam technique, no new material |

Five weekday sessions, two rest days. If you fall behind, the app first lowers new-word targets, then shows the gap between completed and expected lessons and notes a later projected finish. Six months at 35 minutes on workdays is ambitious; seven to nine months is more comfortable. The plan is a schedule, not a debt.

`STUDY_PLAN.md` has the fuller rationale and the exam mapping.

---

## How sync behaves

Sync is **local-first**. Every answer is written to `localStorage` immediately, whether or not the network is available. The cloud holds one JSON snapshot per account with a revision number.

- **Pull before push.** Each sync fetches the remote revision, merges it with local state, then saves with an expected revision.
- **Revision conflicts merge, not overwrite.** If another device saved while you were working, the app pulls the newer snapshot, merges again and retries.
- **Field-level merge:**
  - words and cards: union; the later review wins, reps/lapses take the larger count;
  - lesson stages: union, completed lessons stay completed;
  - exams and compositions: union by timestamp;
  - daily totals: per-day maximum, so a session is not double-counted;
  - plan/settings: the most recently changed configuration wins, tracked by an explicit config timestamp;
  - an open session blocks sync so the runner is not replaced mid-card.
- **No secrets in the cloud snapshot.** `meta.sync` — tokens, anon key, email — is stripped before upload. Export backups also omit access and refresh tokens.
- **RLS.** The `progress` table is readable only by its owner. Writes go through a `security definer` function that takes the user id from the JWT.
- **Offline queue.** Saves stay local; sync resumes when the connection returns. The service worker caches the app shell so the desk opens without a network.
- **Rev number** in Settings is the last cloud revision. `Synced 13:01` means the last round trip succeeded.

The sync client is in `assets/js/core/sync.js`. The schema is in `supabase/schema.sql`.

---

## Alignment, originality and limits

- **Vocabulary order** follows the lesson-by-lesson core word lists of HSK Standard Course 5 (cross-checked against HanziStroke's public course index) and is joined to official HSK 2.0 lists and CC-CEDICT definitions.
- **Reading passages, comprehension questions, dictation sentences, grammar explanations, drills, writing prompts and model answers are original study material written for this app.** They are not textbook passages, not official exam papers, and not affiliated with the textbook publisher, Hanban/CTI or any exam board.
- **Grammar is curated, one HSK5 pattern per lesson.** It does not necessarily follow the exact grammar sequence printed in your copy of the book; the vocabulary and lesson themes do.
- **Checkpoint scores are indicative.** They sample the real sections in a 45-minute format. They are not a predicted HSK score.
- **Listening uses your browser's installed Mandarin voice.** On Windows, add one under Settings → Time & Language → Speech → Add voices → Chinese (Simplified), then restart the browser. The app detects voices and offers a test, but cannot install one.
- **Writing is typed.** No handwriting, stroke order or character-production practice. Typed composition matches the HSK5 写短文 task; sentence-level completion is practised through the grammar drills and recall cards.
- **Content is AI-assisted.** Treat explanations as a study aid and verify anything that matters for the exam against your textbook or a teacher.
- **Free-tier caveat.** Supabase free projects can pause after long inactivity. If the app cannot reach your project, local study continues and sync resumes after the project is restored.

---

## Files

```
index.html                  the app
manifest.webmanifest        PWA identity and icons
sw.js                       offline shell cache
.github/workflows/deploy.yml  CI: validate, rebuild and publish on push to main
setup.html                  one-time Supabase + hosting walkthrough
assets/css/app.css          visual design (light/dark, responsive)
assets/js/core/             utilities, data, storage, SRS, plan, TTS, session, sync
assets/js/ui/               screens
assets/js/data/vocab.js     generated vocabulary (1,367 book + 390 gap + 598 HSK4)
assets/js/data/lessons.js   generated lesson content (36 units)
assets/js/data/tap.js       generated tap-to-define reference for the reading passages
assets/js/data/config.js    optional build-injected Supabase URL + anon key (empty by default)
content/lesson-NN.json      editable source for each lesson's reading, grammar, dictation and writing task
content/vocab-by-lesson.json lesson vocabulary used to author and validate content
supabase/schema.sql         table, RLS and atomic save function
netlify.toml                Netlify build config (npm build, publish deploy/)
package.json                npm build entry point and Node engine
.nvmrc                      Node 20 for Netlify/Cloudflare builds
tools/prepare_deploy.py     Python build: deploy/ plus hsk5-studio-site.zip
tools/prepare_deploy.mjs    Node build used by Netlify/Cloudflare and CI
tools/build_content.py      regenerate lessons.js from content/
tools/build_tapdata.py      regenerate tap.js from content/ and the CC-CEDICT / pinyin / jieba caches
tools/check_tap.mjs         verify every passage character opens pinyin, gloss and audio
tools/validate_content.py   schema/content validator
serve.py                    optional local HTTP server
start-server.bat            Windows shortcut for serve.py
STUDY_PLAN.md               plan and exam mapping
PORTING.md                  handoff guide for building Japanese/English instances
deploy/                     generated static site (safe to drag to Netlify)
hsk5-studio-site.zip        generated drag-and-drop bundle
```

To change content, edit `content/lesson-NN.json`, then rebuild:

```powershell
python tools/validate_content.py --lessons 1-36
python tools/build_content.py
python tools/build_tapdata.py
node tools/check_tap.mjs
python tools/prepare_deploy.py
```

`build_tapdata.py` downloads CC-CEDICT, Unihan readings and jieba's word list into
`data-src/` the first time (about 25 MB, build-time only). The generated `tap.js` is
committed and precached by the service worker, so the app itself never goes online.

To rebuild the vocabulary data from source files, put the HSK JSON lists in `data-src/` and run `python tools/build_vocab.py`, then `python tools/export_source.py`.

---

## Backups and privacy

- Every answer, grade, essay and checkpoint is stored locally in `localStorage`.
- When sync is on, a progress snapshot is also stored in your Supabase project, protected by row-level security.
- **Settings → Export backup** downloads a single JSON file without session tokens. **Import backup** replaces the current state and marks it as the newest configuration.
- Clearing site data/browser storage deletes local progress. The cloud copy remains; sign in again to pull it, or restore a backup.
- The app makes network requests only to the Supabase project you configure. No remote fonts, analytics or third-party scripts.
- Never paste a Supabase `service_role` key into the app. Only the public `anon` key belongs in a browser.

---

## Credits

- Vocabulary glosses adapted from **CC-CEDICT** (Creative Commons Attribution-ShareAlike).
- The tap-to-define reference for the reading passages is generated at build time from **CC-CEDICT**, **Unihan** character readings via **mozillazg/pinyin-data**, and **jieba**'s MIT-licensed word list for segmentation frequencies.
- HSK 2.0 level lists via the MIT-licensed **complete-hsk-vocabulary** project; original old-HSK lists from **clem109/hsk-vocabulary**.
- Lesson-by-lesson word order cross-checked against **HanziStroke**'s HSK Standard Course index.
- HSK Standard Course is published by Beijing Language and Culture University Press. This is an independent personal study tool.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| No audio | Check a Mandarin voice is installed; try **Settings → Test voice**; Chrome/Edge usually expose more voices than Firefox |
| Progress disappears | The browser cleared local storage, or you opened a different file/browser profile. Restore the last exported backup, or sign in and sync |
| "Saved in this browser" becomes "Memory only" | Local storage is blocked; export immediately, then use `python serve.py` |
| Sync says the progress table is missing | Run `supabase/schema.sql` in the Supabase SQL editor, then press Sync now |
| "Email not confirmed" | Confirm the email, or turn Confirm email off in Supabase Auth settings |
| "Sync error / Network error" | Confirm the project URL starts with `https://`, the anon key is the public one, and the device is online. The local copy is unaffected |
| iPhone offline | Install via Share → Add to Home Screen and open the icon once while online so the service worker caches the shell |
| Sync from two devices at once | Let both finish; revision conflicts merge automatically. An open session pauses sync until finished |
| Netlify exits 2 with "Missing script: build" | The repo is missing `package.json` or an older commit was deployed. Push the current `package.json`; Netlify's build command should be `npm run build` |
| Netlify did not pick up the latest commit | **Deploys → Trigger deploy → Clear cache and deploy site** |
| Netlify site shows "Login Redirect" or HTTP 401 | Edge Access / visitor access is enabled. Netlify → **Site configuration → Access & security → Visitor access**, switch to public (or log in on the iPhone) |
| Netlify "Cannot find module tools/prepare_deploy.mjs" | Commit `tools/prepare_deploy.mjs`, and make sure Netlify's **Base directory** is empty (repo root) |
| Netlify "service worker references missing files" | A generated asset was not committed. In particular commit `assets/js/data/tap.js`; if editing passages, run `python tools/build_tapdata.py` and `node tools/check_tap.mjs` first |
| Netlify "Deploy directory deploy does not exist" | Set **Publish directory** to `deploy`; `netlify.toml` already does this unless the UI overrides it |
| Settings still asks for the project URL and key | The build did not see the environment variables. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Netlify → Environment variables, then **Trigger deploy → Clear cache and deploy site**; an installed PWA may need one online relaunch to pick up the new bundle |
| Netlify build fails with "Set both SUPABASE_URL and SUPABASE_ANON_KEY" | Only one variable is defined. Add the other, or delete both to fall back to manual Settings |
| Signed out after changing the Supabase project | Expected: tokens from the old project are cleared. Sign in again; local progress is kept and merges |
| GitHub Actions fails at "Configure Pages" | Set **Settings → Pages → Source: GitHub Actions**. Private repositories need GitHub Pro (free Pages requires a public repo) |
| Workflow does not run on push | The trigger is `main`. Change the branch in `.github/workflows/deploy.yml` if your default branch differs |
| Site still looks old on iPhone | Close the home-screen app completely and reopen it while online; each CI build has a new service-worker cache hash |
| Typing Chinese is slow | Use your system IME; the recall cards accept the exact simplified word (punctuation and spaces ignored) |
| A lesson feels too easy | Open any lesson from the library and read its passage, or use the word bank to suspend known words |
| Pace shows behind | Lower new words per session in Settings, or extend the target date; the app will rebuild the schedule |

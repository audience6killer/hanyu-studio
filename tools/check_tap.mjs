/* Verify tap-to-define coverage against the app's own data layer.
 *
 *     node tools/check_tap.mjs
 *
 * Loads the same scripts the browser loads (no DOM needed) and checks that
 * every Chinese character in every reading passage becomes a tap target that
 * resolves to pinyin, a gloss and audio text. Run after editing a passage or
 * rebuilding assets/js/data/tap.js.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = { console, window: null };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
const context = vm.createContext(sandbox);

function load(rel) {
  const file = path.join(ROOT, rel);
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: rel });
}

load("assets/js/data/vocab.js");
load("assets/js/data/lessons.js");
load("assets/js/data/tap.js");
load("assets/js/core/util.js");
load("assets/js/core/data.js");

const HY = sandbox.HY;
const D = HY.data;
const lessons = sandbox.HY_LESSONS;
const CJK = /^[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]+$/;

const problems = [];
let paragraphs = 0;
let characters = 0;
let tokens = 0;

function fail(message) {
  problems.push(message);
}

for (const lesson of lessons) {
  if (!lesson.reading || !lesson.reading.text) {
    fail(`lesson ${lesson.n}: no reading passage`);
    continue;
  }
  for (const paragraph of String(lesson.reading.text).split("\n")) {
    if (!paragraph.trim()) continue;
    paragraphs++;
    const parts = D.tokenize(paragraph);
    let rebuilt = "";
    for (const part of parts) {
      rebuilt += part.t;
      if (!part.w) continue;
      tokens++;
      if (typeof part.w !== "string") {
        fail(`lesson ${lesson.n}: token for “${part.t}” carries ${typeof part.w}, not the hanzi string`);
        continue;
      }
      if (part.w !== part.t) {
        fail(`lesson ${lesson.n}: token text “${part.t}” and key “${part.w}” differ`);
      }
      const entry = D.define(part.w);
      if (!entry) {
        fail(`lesson ${lesson.n}: “${part.t}” has no dictionary entry`);
      } else {
        if (!entry.py || !String(entry.py).trim()) fail(`lesson ${lesson.n}: “${part.t}” has no pinyin`);
        if (!entry.en || !String(entry.en).trim()) fail(`lesson ${lesson.n}: “${part.t}” has no gloss`);
      }
      characters += Array.from(part.t).length;
    }
    if (rebuilt !== paragraph) {
      fail(`lesson ${lesson.n}: tokenizer lost or reordered text in “${paragraph.slice(0, 24)}…”`);
    }
    for (const char of paragraph) {
      if (CJK.test(char) && !D.define(char)) fail(`lesson ${lesson.n}: character “${char}” is not tappable`);
    }
  }
}

// A handful of curriculum words must resolve from the course dictionary, and the
// word modal needs them to keep their lesson metadata.
for (const word of ["细节", "电台", "抱怨", "肩膀", "婚姻", "吵架"]) {
  const entry = D.lookup(word);
  if (!entry) fail(`course word “${word}” is missing from the vocabulary data`);
  else if (!entry.py || !entry.en) fail(`course word “${word}” is missing pinyin or a gloss`);
}

const meta = (sandbox.HY_TAP && sandbox.HY_TAP.meta) || {};
const wordCount = Object.keys((sandbox.HY_TAP && sandbox.HY_TAP.words) || {}).length;
const charCount = Object.keys((sandbox.HY_TAP && sandbox.HY_TAP.chars) || {}).length;
if (meta.words != null && meta.words !== wordCount) fail(`tap.js meta.words=${meta.words} but contains ${wordCount}`);
if (meta.chars != null && meta.chars !== charCount) fail(`tap.js meta.chars=${meta.chars} but contains ${charCount}`);

console.log(
  `tap check: ${lessons.length} lessons, ${paragraphs} paragraphs, ` +
  `${characters} tappable characters, ${tokens} tap targets; ` +
  `dictionary ${wordCount} words + ${charCount} characters`
);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems.slice(0, 40)) console.error("  - " + problem);
  if (problems.length > 40) console.error(`  … and ${problems.length - 40} more`);
  process.exit(1);
}
console.log("PASS — every character in every reading passage opens pinyin, meaning and audio.");

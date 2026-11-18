/**
 * Build the static site for Netlify / Cloudflare Pages using Node only.
 *
 *   node tools/prepare_deploy.mjs
 *
 * Produces deploy/ with the SQL-injected setup page, .nojekyll, and a
 * content-hashed service-worker cache name. The Python prepare_deploy.py still
 * produces the zip for local drag-and-drop use.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "deploy");
const CACHE_RE = /const CACHE = "[^"]+";/;

// Fail with a useful message rather than a bare exit code if a generated or
// source file did not make it into the repository.
const REQUIRED = [
  "index.html",
  "setup.html",
  "manifest.webmanifest",
  "sw.js",
  "supabase/schema.sql",
  "assets/css/app.css",
  "assets/js/data/vocab.js",
  "assets/js/data/lessons.js",
  "assets/js/data/tap.js",
  "assets/js/data/config.js",
  "tools/prepare_deploy.mjs",
];
const missingRequired = REQUIRED.filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
if (missingRequired.length) {
  throw new Error(`missing required files: ${missingRequired.join(", ")}. Commit them or run the content build locally first.`);
}
console.log(`[build] Node ${process.version}, root ${ROOT}`);

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const rel of ["index.html", "setup.html", "manifest.webmanifest", "sw.js"]) {
  fs.copyFileSync(path.join(ROOT, rel), path.join(OUT, rel));
}
for (const rel of ["assets/css", "assets/js", "assets/icons"]) {
  fs.cpSync(path.join(ROOT, rel), path.join(OUT, rel), { recursive: true });
}

// Optional build-time Supabase defaults. The anon/publishable key is public by
// design; never use a secret/service_role key here.
const supabaseUrl = (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || "").trim();
if (!!supabaseUrl !== !!supabaseAnonKey) {
  throw new Error("Set both SUPABASE_URL and SUPABASE_ANON_KEY, or neither.");
}
if (supabaseUrl && !/^https?:\/\//.test(supabaseUrl)) {
  throw new Error("SUPABASE_URL must start with https://");
}
fs.writeFileSync(
  path.join(OUT, "assets/js/data/config.js"),
  `window.HY_CONFIG = ${JSON.stringify({ supabaseUrl, supabaseAnonKey })};\n`
);
console.log(`supabase:      ${supabaseUrl ? "configured at build time" : "not configured (manual Settings)"}`);

// Keep the single SQL source of truth inside the deployed setup page.
const schema = read("supabase/schema.sql");
let setup = read("setup.html");
if (setup.includes("<pre id=\"sql\">")) {
  setup = setup.replace(/<pre id="sql">[\s\S]*?<\/pre>/, `<pre id="sql">${escapeHtml(schema)}</pre>`);
} else if (setup.includes("__SCHEMA_SQL__")) {
  setup = setup.replace("__SCHEMA_SQL__", escapeHtml(schema));
} else {
  throw new Error("setup.html has no SQL block");
}
fs.writeFileSync(path.join(OUT, "setup.html"), setup);

// GitHub Pages does not need Jekyll; harmless elsewhere.
fs.writeFileSync(path.join(OUT, ".nojekyll"), "");

// Hash the deployable files (excluding the worker) so every build gets a
// distinct cache name and installed PWAs pick up the new assets.
const hash = crypto.createHash("sha256");
const all = walk(OUT)
  .map((full) => [path.relative(OUT, full).split(path.sep).join("/"), full])
  .sort((a, b) => a[0].localeCompare(b[0]));
for (const [rel, full] of all) {
  if (rel === "sw.js") continue;
  hash.update(rel);
  hash.update(fs.readFileSync(full));
}
const buildId = hash.digest("hex").slice(0, 10);

let sw = read("sw.js");
const missing = [];
for (const match of sw.matchAll(/"\.\/([^"]+)"/g)) {
  const rel = match[1];
  if (rel === "index.html" || !rel) continue;
  if (!fs.existsSync(path.join(OUT, rel))) missing.push(rel);
}
if (missing.length) throw new Error(`service worker references missing files: ${[...new Set(missing)].join(", ")}`);
if (!CACHE_RE.test(sw)) throw new Error("sw.js is missing the CACHE constant");
sw = sw.replace(CACHE_RE, `const CACHE = "hsk5-studio-${buildId}";`);
fs.writeFileSync(path.join(OUT, "sw.js"), sw);

const total = walk(OUT).reduce((sum, full) => sum + fs.statSync(full).size, 0);
console.log(`deploy/ ready: ${(total / 1024).toFixed(0)} KB`);
console.log(`cache:         hsk5-studio-${buildId}`);
console.log("Netlify/Cloudflare publish directory: deploy");

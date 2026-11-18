"""Build the static site and a drag-and-drop zip.

    python tools/prepare_deploy.py

Creates deploy/ (index.html, setup.html, service worker, manifest, assets)
and hsk5-studio-site.zip. Netlify Drop or Cloudflare Pages can consume either.
"""

from __future__ import annotations

import hashlib
import html
import json
import os
import re
import shutil
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "deploy")
ZIP = os.path.join(ROOT, "hsk5-studio-site.zip")


def copy_file(rel: str) -> None:
    src = os.path.join(ROOT, rel)
    dst = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)


def copy_tree(rel: str) -> None:
    shutil.copytree(os.path.join(ROOT, rel), os.path.join(OUT, rel))


def main() -> None:
    # Windows consoles default to cp1252 and choke on the guide's arrows.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    if os.path.exists(ZIP):
        os.remove(ZIP)
    os.makedirs(OUT)

    for rel in ("index.html", "manifest.webmanifest", "sw.js"):
        copy_file(rel)
    for rel in ("assets/css", "assets/js", "assets/icons"):
        copy_tree(rel)

    # Optional build-time Supabase defaults. The anon/publishable key is public
    # by design; never use a secret/service_role key here.
    site_url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    site_key = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    if bool(site_url) != bool(site_key):
        raise SystemExit("Set both SUPABASE_URL and SUPABASE_ANON_KEY, or neither.")
    if site_url and not re.match(r"^https?://", site_url):
        raise SystemExit("SUPABASE_URL must start with https://")
    config_js = "window.HY_CONFIG = " + json.dumps(
        {"supabaseUrl": site_url, "supabaseAnonKey": site_key}, ensure_ascii=False
    ) + ";\n"
    with open(os.path.join(OUT, "assets", "js", "data", "config.js"), "w", encoding="utf-8") as f:
        f.write(config_js)
    print("supabase:      " + ("configured at build time" if site_url else "not configured (manual Settings)"))

    # Inject the single source-of-truth SQL into the setup page.
    schema = open(os.path.join(ROOT, "supabase", "schema.sql"), encoding="utf-8").read()
    setup = open(os.path.join(ROOT, "setup.html"), encoding="utf-8").read()
    if "__SCHEMA_SQL__" in setup:
        setup = setup.replace("__SCHEMA_SQL__", html.escape(schema))
    else:
        setup, replaced = re.subn(
            r'(<pre id="sql">).*?(</pre>)',
            lambda m: m.group(1) + html.escape(schema) + m.group(2),
            setup, count=1, flags=re.S,
        )
        if replaced != 1:
            raise SystemExit("setup.html does not contain the <pre id=\"sql\"> block")
    with open(os.path.join(OUT, "setup.html"), "w", encoding="utf-8") as f:
        f.write(setup)

    # GitHub Pages: do not run the file through Jekyll.
    open(os.path.join(OUT, ".nojekyll"), "w").close()

    # Hash the deployable files (except the worker itself) so every build gets
    # a distinct cache name. This is what makes a redeploy reach installed PWAs.
    digest = hashlib.sha256()
    for base, dirs, files in os.walk(OUT):
        dirs.sort()
        for name in sorted(files):
            if name == "sw.js":
                continue
            full = os.path.join(base, name)
            rel = os.path.relpath(full, OUT).replace(os.sep, "/")
            digest.update(rel.encode("utf-8"))
            with open(full, "rb") as f:
                digest.update(f.read())
    build_id = digest.hexdigest()[:10]

    # Verify every service-worker precache path exists, then stamp the cache.
    sw = open(os.path.join(ROOT, "sw.js"), encoding="utf-8").read()
    missing = []
    for rel in re.findall(r'"\./([^"]+)"', sw):
        if rel == "index.html" or not rel:
            continue
        target = os.path.join(OUT, rel)
        if not os.path.exists(target):
            missing.append(rel)
    if missing:
        raise SystemExit("service worker references missing files: " + ", ".join(sorted(set(missing))))
    sw, stamped = re.subn(r'const CACHE = "[^"]+";', f'const CACHE = "hsk5-studio-{build_id}";', sw, count=1)
    if stamped != 1:
        raise SystemExit("sw.js is missing the CACHE constant")
    with open(os.path.join(OUT, "sw.js"), "w", encoding="utf-8") as f:
        f.write(sw)

    # Zip the contents of deploy/ so unzipping yields index.html at the root.
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for base, _dirs, files in os.walk(OUT):
            for name in files:
                full = os.path.join(base, name)
                z.write(full, os.path.relpath(full, OUT))

    total = sum(os.path.getsize(os.path.join(b, n)) for b, _d, fs in os.walk(OUT) for n in fs)
    print(f"deploy/ ready: {total / 1024:.0f} KB")
    print(f"cache:         hsk5-studio-{build_id}")
    print(f"zip ready:     {os.path.getsize(ZIP) / 1024:.0f} KB  -> {ZIP}")
    print("Next: drag deploy/ or the zip to https://app.netlify.com/drop")
    print("      or Cloudflare Pages Direct Upload. GitHub Actions does this automatically.")
    print("Setup page: /setup.html")


if __name__ == "__main__":
    main()

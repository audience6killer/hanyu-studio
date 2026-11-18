"""Optional local server for HSK5 Studio.

Opening index.html directly works in most browsers, but some block localStorage
for file:// pages. Run this instead:

    python serve.py

Then use http://127.0.0.1:8765 . The server only serves files from this folder.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import os
import socketserver
import threading
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8765


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:  # keep the console quiet
        if args and str(args[0]).startswith(("4", "5")):
            super().log_message(fmt, *args)


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve HSK5 Studio locally")
    parser.add_argument("--port", type=int, default=PORT)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    handler = functools.partial(Handler, directory=ROOT)
    with socketserver.ThreadingTCPServer(("127.0.0.1", args.port), handler) as httpd:
        httpd.daemon_threads = True
        url = f"http://127.0.0.1:{args.port}/index.html"
        print(f"HSK5 Studio: {url}")
        print("Press Ctrl+C to stop.")
        if not args.no_browser:
            threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    main()

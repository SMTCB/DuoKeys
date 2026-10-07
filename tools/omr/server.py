"""ADR-010 — a small local HTTP wrapper around Audiveris.

POST /convert?name=score.pdf   body = the PDF or image bytes   ->  the recognised score as .mxl
GET  /health                                                    ->  "ok"

Nothing is stored: each request works in a temporary folder that is deleted afterwards.
Only pages from localhost are allowed to call it (CORS), and Docker should publish the port
on 127.0.0.1 only (see the Dockerfile header).
"""

import glob
import os
import re
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 8765
MAX_BYTES = 20 * 1024 * 1024
TIMEOUT_SECONDS = 240
EXTENSIONS = {"pdf", "png", "jpg", "jpeg"}
LOCAL_ORIGIN = re.compile(r"^http://(localhost|127\.0\.0\.1)(:\d+)?$")
AUDIVERIS = "/opt/audiveris/bin/Audiveris"


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        origin = self.headers.get("Origin", "")
        if LOCAL_ORIGIN.match(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _reply(self, status, body=b"", content_type="text/plain; charset=utf-8"):
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._reply(204)

    def do_GET(self):
        if self.path == "/health":
            return self._reply(200, b"ok")
        self._reply(404, b"not found")

    def do_POST(self):
        if not self.path.startswith("/convert"):
            return self._reply(404, b"not found")
        origin = self.headers.get("Origin", "")
        if origin and not LOCAL_ORIGIN.match(origin):
            return self._reply(403, b"only localhost pages may use this service")
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_BYTES:
            return self._reply(413, b"file is empty or larger than 20 MB")
        name = re.search(r"name=([^&]+)", self.path)
        extension = (name.group(1).rsplit(".", 1)[-1].lower() if name and "." in name.group(1) else "pdf")
        if extension not in EXTENSIONS:
            return self._reply(415, b"send a pdf, png or jpg")
        data = self.rfile.read(length)
        with tempfile.TemporaryDirectory() as work:
            source = os.path.join(work, f"score.{extension}")
            with open(source, "wb") as f:
                f.write(data)
            try:
                run = subprocess.run(
                    [AUDIVERIS, "-batch", "-transcribe", "-export", "-output", work, source],
                    capture_output=True,
                    timeout=TIMEOUT_SECONDS,
                )
            except subprocess.TimeoutExpired:
                return self._reply(504, b"reading the score took too long")
            found = sorted(glob.glob(os.path.join(work, "**", "*.mxl"), recursive=True))
            if run.returncode != 0 or not found:
                tail = run.stdout.decode("utf-8", "replace")[-400:]
                return self._reply(422, f"no music could be read from that file. {tail}".encode())
            with open(found[0], "rb") as f:
                self._reply(200, f.read(), "application/vnd.recordare.musicxml")

    def log_message(self, fmt, *args):
        print(fmt % args, flush=True)


if __name__ == "__main__":
    print(f"DuoKeys score reader listening on :{PORT}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()

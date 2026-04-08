#!/usr/bin/env python3
"""Dev server — ปิด cache ทุกกรณี (ป้องกัน 304 / ES module cache)"""
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        # Strip conditional request headers so server never returns 304
        for h in ('If-Modified-Since', 'If-None-Match'):
            if h in self.headers:
                del self.headers[h]
        return super().send_head()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        print(f"  {args[1]}  {args[0]}")

print(f"🚀  http://localhost:{PORT}  [no-cache]")
http.server.test(HandlerClass=NoCacheHandler, port=PORT, bind='0.0.0.0')

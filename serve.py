#!/usr/bin/env python3
"""Dev server with no-cache headers — ป้องกัน browser cache JS modules"""
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        print(f"  {args[0]} {args[1]}")

print(f"🚀  Dev server: http://localhost:{PORT}  (no-cache)")
http.server.test(HandlerClass=NoCacheHandler, port=PORT)

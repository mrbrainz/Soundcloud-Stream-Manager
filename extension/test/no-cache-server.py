#!/usr/bin/env python3
"""Local static file server for the mock test harness, serving extension/
with Cache-Control: no-store on every response.

Plain `python3 -m http.server` sends weak/no cache-control headers, which
the Browser tool's disk cache treats as "keep serving the old copy" across
edits during a test session - repeatedly caused stale-script confusion
while iterating (a fixture would silently keep running yesterday's code).
Run this instead of http.server for local development/testing.
"""
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    directory = sys.argv[2] if len(sys.argv) > 2 else os.getcwd()
    os.chdir(directory)
    http.server.test(HandlerClass=NoCacheHandler, port=port)

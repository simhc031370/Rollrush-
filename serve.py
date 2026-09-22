#!/usr/bin/env python3
"""Dual-stack static server so Chrome's localhost (IPv6 ::1) works."""
import os
import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)


class DualStackServer(ThreadingHTTPServer):
    address_family = socket.AF_INET6
    daemon_threads = True

    def server_bind(self):
        self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".wasm": "application/wasm",
    }


if __name__ == "__main__":
    httpd = DualStackServer(("::", 4173), Handler)
    print(f"Serving {ROOT} at http://127.0.0.1:4173/ and http://localhost:4173/", flush=True)
    httpd.serve_forever()

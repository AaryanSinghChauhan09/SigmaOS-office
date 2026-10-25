"""SigmaOS-office Web Exporter & Offline Runtime Server.

Bundles and serves the self-contained offline Progressive Web App (PWA)
for Chromium-based browsers (Chrome, Chromium, Brave, Edge, Opera).

Principles: Zero Network Dependencies, Deterministic Testing, Clear Abstraction.
"""

from typing import Dict, Any, List
import os
import http.server
import socketserver
import shutil
import re


WEB_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web")

REQUIRED_WEB_ASSETS = [
    "index.html",
    "manifest.json",
    "sw.js",
    "css/office.css",
    "icons/icon-192.svg",
    "icons/icon-512.svg",
    "js/storage_engine.js",
    "js/writer_web.js",
    "js/calc_web.js",
    "js/impress_web.js",
    "js/draw_web.js",
    "js/math_web.js",
    "js/app.js",
]


class WebExporter:
    """Validates, bundles, and serves the offline office web application."""

    @staticmethod
    def get_web_dir() -> str:
        return WEB_ROOT

    @staticmethod
    def verify_offline_assets() -> Dict[str, Any]:
        """Verifies that all assets exist and have zero external network dependencies."""
        missing = []
        for rel_path in REQUIRED_WEB_ASSETS:
            full_path = os.path.join(WEB_ROOT, rel_path)
            if not os.path.isfile(full_path):
                missing.append(rel_path)

        if missing:
            return {"ok": False, "missing": missing, "external_urls": []}

        # Scan index.html and css for forbidden external dependencies
        external_urls = []
        index_path = os.path.join(WEB_ROOT, "index.html")
        with open(index_path, "r", encoding="utf-8") as fh:
            content = fh.read()
            urls = re.findall(r'(src|href)=["\'](https?://[^"\']+)["\']', content)
            for _, u in urls:
                external_urls.append(u)

        css_path = os.path.join(WEB_ROOT, "css", "office.css")
        with open(css_path, "r", encoding="utf-8") as fh:
            content = fh.read()
            urls = re.findall(r'url\(["\']?(https?://[^"\'\)]+)["\']?\)', content)
            for u in urls:
                external_urls.append(u)

        return {
            "ok": len(missing) == 0 and len(external_urls) == 0,
            "missing": missing,
            "external_urls": external_urls,
            "total_assets": len(REQUIRED_WEB_ASSETS),
        }

    @staticmethod
    def export_bundle(target_dir: str) -> str:
        """Copies the web suite into target_dir for standalone offline deployment."""
        os.makedirs(target_dir, exist_ok=True)
        for item in os.listdir(WEB_ROOT):
            s = os.path.join(WEB_ROOT, item)
            d = os.path.join(target_dir, item)
            if os.path.isdir(s):
                if os.path.exists(d):
                    shutil.rmtree(d)
                shutil.copytree(s, d)
            else:
                shutil.copy2(s, d)
        return target_dir

    @staticmethod
    def start_server(port: int = 8080, bind_address: str = "127.0.0.1") -> None:
        """Starts a local HTTP server serving the offline web app."""
        os.chdir(WEB_ROOT)
        handler = http.server.SimpleHTTPRequestHandler
        with socketserver.TCPServer((bind_address, port), handler) as httpd:
            print(f"SigmaOS Offline Office running at http://{bind_address}:{port}")
            print("Press Ctrl+C to stop.")
            httpd.serve_forever()

"""Unit tests for SigmaOS-office Web Exporter and Offline Chromium Suite (AAA Pattern, Deterministic, FIRST)."""

import os
import sys
import json
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src"))
from web_exporter import WebExporter, REQUIRED_WEB_ASSETS, WEB_ROOT


class TestWebExporter(unittest.TestCase):

    def test_verify_offline_assets(self):
        # Arrange & Act
        result = WebExporter.verify_offline_assets()

        # Assert
        self.assertTrue(result["ok"], f"Asset verification failed: {result}")
        self.assertEqual(result["missing"], [])
        self.assertEqual(result["external_urls"], [])
        self.assertEqual(result["total_assets"], len(REQUIRED_WEB_ASSETS))

    def test_manifest_pwa_compliance(self):
        # Arrange
        manifest_path = os.path.join(WEB_ROOT, "manifest.json")

        # Act
        with open(manifest_path, "r", encoding="utf-8") as fh:
            manifest = json.load(fh)

        # Assert
        self.assertEqual(manifest["name"], "SigmaOS Office Suite")
        self.assertEqual(manifest["display"], "standalone")
        self.assertEqual(manifest["start_url"], "./index.html")
        self.assertIn("file_handlers", manifest)
        self.assertGreaterEqual(len(manifest["file_handlers"]), 3)

    def test_service_worker_offline_cache(self):
        # Arrange
        sw_path = os.path.join(WEB_ROOT, "sw.js")

        # Act
        with open(sw_path, "r", encoding="utf-8") as fh:
            sw_code = fh.read()

        # Assert
        self.assertIn("caches.open", sw_code)
        self.assertIn("addEventListener('fetch'", sw_code)
        self.assertIn("index.html", sw_code)
        self.assertIn("ASSETS_TO_CACHE", sw_code)

    def test_export_bundle(self):
        # Arrange
        with tempfile.TemporaryDirectory() as tmpdir:
            out_dir = os.path.join(tmpdir, "exported_web")

            # Act
            WebExporter.export_bundle(out_dir)

            # Assert
            self.assertTrue(os.path.isdir(out_dir))
            self.assertTrue(os.path.isfile(os.path.join(out_dir, "index.html")))
            self.assertTrue(os.path.isfile(os.path.join(out_dir, "manifest.json")))
            self.assertTrue(os.path.isfile(os.path.join(out_dir, "sw.js")))
            self.assertTrue(os.path.isfile(os.path.join(out_dir, "css", "office.css")))
            self.assertTrue(os.path.isfile(os.path.join(out_dir, "js", "writer_web.js")))
            self.assertTrue(os.path.isfile(os.path.join(out_dir, "js", "calc_web.js")))


if __name__ == "__main__":
    unittest.main()

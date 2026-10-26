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

    def test_offline_subengines_integrity_and_features(self):
        # Arrange & Act
        js_dir = os.path.join(WEB_ROOT, "js")
        with open(os.path.join(js_dir, "writer_web.js"), "r", encoding="utf-8") as f:
            writer_code = f.read()
        with open(os.path.join(js_dir, "calc_web.js"), "r", encoding="utf-8") as f:
            calc_code = f.read()
        with open(os.path.join(js_dir, "base_web.js"), "r", encoding="utf-8") as f:
            base_code = f.read()
        with open(os.path.join(js_dir, "draw_web.js"), "r", encoding="utf-8") as f:
            draw_code = f.read()
        with open(os.path.join(js_dir, "impress_web.js"), "r", encoding="utf-8") as f:
            impress_code = f.read()
        with open(os.path.join(js_dir, "math_web.js"), "r", encoding="utf-8") as f:
            math_code = f.read()
        with open(os.path.join(js_dir, "storage_engine.js"), "r", encoding="utf-8") as f:
            storage_code = f.read()

        # Assert Writer Features
        self.assertIn("toggleSplitView", writer_code)
        self.assertIn("generateTOC", writer_code)
        self.assertIn("insertFootnote", writer_code)
        self.assertIn("setPageMargins", writer_code)
        self.assertIn("insertMathFormula", writer_code)

        # Assert Calc Features
        self.assertIn("generatePivotTable", calc_code)
        self.assertIn("applyConditionalFormat", calc_code)
        self.assertIn("sortRange", calc_code)
        self.assertIn("MEDIAN", calc_code)
        self.assertIn("STDEV", calc_code)
        self.assertIn("NPV", calc_code)

        # Assert Base Features
        self.assertIn("setViewMode", base_code)
        self.assertIn("querySQL", base_code)
        self.assertIn("importCSV", base_code)
        self.assertIn("firstRecord", base_code)
        self.assertIn("nextRecord", base_code)

        # Assert Draw Features
        self.assertIn("sticky", draw_code)
        self.assertIn("highlighter", draw_code)
        self.assertIn("connector", draw_code)
        self.assertIn("zoomIn", draw_code)
        self.assertIn("zoomOut", draw_code)

        # Assert Impress Features
        self.assertIn("startPresenterMode", impress_code)
        self.assertIn("comparison", impress_code)

        # Assert Math Features
        self.assertIn("copyMathML", math_code)
        self.assertIn("insertIntoWriter", math_code)

        # Assert Storage Features
        self.assertIn("createSnapshot", storage_code)
        self.assertIn("exportWorkspaceBundle", storage_code)
        self.assertIn("importWorkspaceBundle", storage_code)


if __name__ == "__main__":
    unittest.main()

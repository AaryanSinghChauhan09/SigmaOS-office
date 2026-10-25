"""Deterministic unit tests for SigmaOS-office core and CLI (FIRST principles: no external I/O)."""

import os
import sys
import unittest
from io import StringIO
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src"))
import core


class TestCore(unittest.TestCase):

    def test_self_test_passes(self):
        core.self_test()

    def test_cli_mapping(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["mapping"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn(".odt -> libreoffice-writer.svg", output)
            self.assertIn(".wcf -> craftoffice-writer.svg", output)

    def test_cli_icons(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["icons", "mint"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("libreoffice-writer.svg", output)

    def test_cli_apply_plan(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["apply-plan", "mint"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("libreoffice-mint: .docx -> libreoffice-writer.svg", output)

    def test_cli_writer(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["writer", "--title", "CLI Spec", "--text", "CLI generated document"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("CLI generated document", output)

    def test_cli_calc(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["calc", "--set", "A1=50", "--set", "A2=50", "--set", "A3==SUM(A1:A2)"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("A3 = 100", output)

    def test_cli_impress(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["impress", "--title", "CLI Pitch", "--slides", "2"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("# CLI Pitch", output)

    def test_cli_draw(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["draw", "--demo"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("<svg", output)

    def test_cli_math(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["math", r"\alpha + \beta"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("α + β", output)

    def test_cli_base(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["base", "--demo"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("developer", output)

    def test_cli_gen(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["gen", "--topic", "Cloud Microkernels"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("# Cloud Microkernels", output)

    def test_cli_collab(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["collab", "--demo"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("OT Transformation Result", output)

    def test_cli_odf(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["odf", "--title", "CLI ODF Doc"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("Built ODF Package: ODF:", output)

    def test_cli_ooxml(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["ooxml", "--title", "CLI Word Doc"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("Built OOXML Package: OOXML:", output)

    def test_cli_macro(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["macro", "--code", "res = 20 * 2"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("'res': 40", output)

    def test_cli_toc(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["toc", "--sample"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("# Table of Contents", output)

    def test_cli_bib(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["bib"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("Donald Knuth", output)

    def test_cli_diff(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["diff", "hello world", "hello sigmaos"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("[DEL: world] [INS: sigmaos]", output)

    def test_cli_token(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["token", "--generate"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("Generated Token:", output)

    def test_cli_web(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["web", "--verify"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("offline web assets verified", output)

    def test_cli_self_test(self):
        with patch("sys.stdout", new=StringIO()) as fake_out:
            code = core.main(["self-test"])
            self.assertEqual(code, 0)
            output = fake_out.getvalue()
            self.assertIn("All SigmaOS-office deterministic self-tests passed successfully.", output)


if __name__ == "__main__":
    unittest.main()

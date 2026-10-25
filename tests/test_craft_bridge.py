"""Unit tests for SigmaOS-office Craft Bridge (AAA Pattern, Deterministic, FIRST)."""

import unittest
from craft_bridge import CraftBridge
from document_engine import Document
from spreadsheet_engine import Spreadsheet
from presentation_engine import SlideDeck
from vector_draw_engine import DrawingCanvas, Rectangle
from math_engine import MathFormula


class TestCraftBridge(unittest.TestCase):

    def test_wordcraft_conversion(self):
        # Arrange
        doc = Document(title="Craft Document", author="Writer")
        doc.add_heading("Craft Architecture", level=1)
        doc.add_paragraph("WordCraft interoperability layer.")

        # Act
        wcf = CraftBridge.doc_to_wcf(doc)
        restored = CraftBridge.wcf_to_doc(wcf)

        # Assert
        self.assertEqual(restored.title, "Craft Document")
        self.assertEqual(len(restored.elements), 2)
        self.assertEqual(CraftBridge.detect_format(wcf), "SigmaOS.WordCraft")

    def test_gridcraft_conversion(self):
        # Arrange
        sheet = Spreadsheet(title="GridCraft Book")
        sheet.set_cell("A1", 42)
        sheet.set_cell("B1", 58)
        sheet.set_cell("C1", "=SUM(A1:B1)")
        sheet.evaluate_all()

        # Act
        gcf = CraftBridge.sheet_to_gcf(sheet)
        restored = CraftBridge.gcf_to_sheet(gcf)

        # Assert
        self.assertEqual(restored.get_value("A1"), 42)
        self.assertEqual(restored.get_value("C1"), 100)
        self.assertEqual(CraftBridge.detect_format(gcf), "SigmaOS.GridCraft")

    def test_deckcraft_conversion(self):
        # Arrange
        deck = SlideDeck(title="DeckCraft Presentation")
        s = deck.add_slide("Introduction")
        s.add_bullet_point("DeckCraft vector slides.")

        # Act
        dcf = CraftBridge.deck_to_dcf(deck)
        restored = CraftBridge.dcf_to_deck(dcf)

        # Assert
        self.assertEqual(restored.title, "DeckCraft Presentation")
        self.assertEqual(len(restored.slides), 1)
        self.assertEqual(CraftBridge.detect_format(dcf), "SigmaOS.DeckCraft")

    def test_vectorcraft_conversion(self):
        # Arrange
        canvas = DrawingCanvas(width=640, height=480, title="VectorCanvas")
        canvas.add_shape(Rectangle("rect1", 10, 10, 100, 100))

        # Act
        vcf = CraftBridge.canvas_to_vcf(canvas)
        restored = CraftBridge.vcf_to_canvas(vcf)

        # Assert
        self.assertEqual(restored.width, 640)
        self.assertEqual(len(restored.shapes), 1)
        self.assertEqual(CraftBridge.detect_format(vcf), "SigmaOS.VectorCraft")

    def test_mathcraft_conversion(self):
        # Arrange
        mf = MathFormula(r"\int x dx")

        # Act
        mcf = CraftBridge.math_to_mcf(mf)
        restored = CraftBridge.mcf_to_math(mcf)

        # Assert
        self.assertIn("∫", restored.to_unicode_text())
        self.assertEqual(CraftBridge.detect_format(mcf), "SigmaOS.MathCraft")


if __name__ == "__main__":
    unittest.main()

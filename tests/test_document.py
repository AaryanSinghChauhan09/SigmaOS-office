"""Unit tests for SigmaOS-office Document Engine (AAA Pattern, Deterministic, FIRST)."""

import unittest
from document_engine import Document, Paragraph, TextRun, Table, TableCell, CharacterStyle, TrackedChange


class TestDocumentEngine(unittest.TestCase):

    def test_character_style_and_text_run(self):
        # Arrange
        style = CharacterStyle(bold=True, italic=True, font_family="Liberation Serif", font_size=12.0, color="#FF0000")
        
        # Act
        run = TextRun("Formatted text", style)
        run_dict = run.to_dict()

        # Assert
        self.assertEqual(run.text, "Formatted text")
        self.assertTrue(run_dict["style"]["bold"])
        self.assertTrue(run_dict["style"]["italic"])
        self.assertEqual(run_dict["style"]["color"], "#FF0000")

    def test_paragraph_and_formatting(self):
        # Arrange
        p = Paragraph(alignment="center", heading_level=2)
        
        # Act
        p.add_run("Heading 2 Text", bold=True)
        plain = p.plain_text

        # Assert
        self.assertEqual(p.alignment, "center")
        self.assertEqual(p.heading_level, 2)
        self.assertEqual(plain, "Heading 2 Text")

    def test_table_operations(self):
        # Arrange
        tbl = Table()
        
        # Act
        tbl.add_row(["Header 1", "Header 2"])
        tbl.add_row(["Val A", "Val B"])
        t_dict = tbl.to_dict()

        # Assert
        self.assertEqual(len(tbl.rows), 2)
        self.assertEqual(tbl.rows[0][0].text, "Header 1")
        self.assertEqual(t_dict["type"], "table")
        self.assertEqual(len(t_dict["rows"]), 2)

    def test_document_roundtrip_json_and_markdown(self):
        # Arrange
        doc = Document(title="Specification", author="Engineer")
        doc.add_heading("Section 1: Architecture", level=1)
        doc.add_paragraph("This is the core specification text.")
        doc.add_bullet("Modular design")
        doc.add_bullet("Zero dependencies")
        
        # Act
        md = doc.to_markdown()
        json_str = doc.to_json()
        restored = Document.from_json(json_str)

        # Assert
        self.assertIn("# Section 1: Architecture", md)
        self.assertIn("Modular design", md)
        self.assertEqual(restored.title, "Specification")
        self.assertEqual(restored.author, "Engineer")
        self.assertEqual(len(restored.elements), 4)
        self.assertGreater(doc.word_count(), 5)
        self.assertGreater(doc.character_count(), 20)

    def test_tracked_changes(self):
        # Arrange
        doc = Document(title="Collaborative Draft")
        
        # Act
        doc.record_change(author="alice", action="insert", content="Added section on safety")
        doc.record_change(author="bob", action="delete", content="Removed legacy notes")

        # Assert
        self.assertEqual(len(doc.tracked_changes), 2)
        self.assertEqual(doc.tracked_changes[0].author, "alice")
        self.assertEqual(doc.tracked_changes[1].action, "delete")


if __name__ == "__main__":
    unittest.main()

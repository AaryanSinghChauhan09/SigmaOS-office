"""Unit tests for Table of Contents and Bibliography Engine (AAA Pattern, Deterministic, FIRST)."""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src"))
from document_engine import Document, Paragraph, TextRun
from bibliography_toc_engine import TableOfContents, BibliographyManager, FootnoteManager, BibEntry


class TestBibliographyTOC(unittest.TestCase):

    def test_table_of_contents_generation(self):
        # Arrange
        doc = Document(title="Monograph")
        doc.add_heading("Introduction", level=1)
        doc.add_paragraph("Introductory text.")
        doc.add_heading("Background", level=2)
        doc.add_heading("Methodology", level=2)
        doc.add_heading("Results", level=1)

        # Act
        toc_entries = TableOfContents.generate_toc(doc)
        rendered_md = TableOfContents.render_markdown(toc_entries)

        # Assert
        self.assertEqual(len(toc_entries), 4)
        self.assertEqual(toc_entries[0].section_number, "1")
        self.assertEqual(toc_entries[0].title, "Introduction")
        self.assertEqual(toc_entries[1].section_number, "1.1")
        self.assertEqual(toc_entries[1].title, "Background")
        self.assertEqual(toc_entries[2].section_number, "1.2")
        self.assertEqual(toc_entries[3].section_number, "2")
        self.assertIn("[1 Introduction]", rendered_md)
        self.assertIn("[1.1 Background]", rendered_md)

    def test_bibtex_parsing_and_apa_formatting(self):
        # Arrange
        raw_bibtex = """
        @article{turing1936,
            author = {Alan M. Turing},
            title = {On Computable Numbers},
            year = {1936},
            journal = {Proceedings of the London Mathematical Society}
        }
        @book{knuth1968,
            author = {Donald E. Knuth},
            title = {The Art of Computer Programming},
            year = {1968}
        }
        """
        bm = BibliographyManager()

        # Act
        entries = bm.parse_bibtex(raw_bibtex)
        ref_list = bm.generate_reference_list(style="APA")

        # Assert
        self.assertEqual(len(entries), 2)
        self.assertIn("turing1936", bm.entries)
        self.assertIn("knuth1968", bm.entries)
        self.assertIn("Alan M. Turing (1936). On Computable Numbers.", ref_list)
        self.assertIn("Donald E. Knuth (1968). The Art of Computer Programming.", ref_list)

    def test_footnote_management(self):
        # Arrange
        fm = FootnoteManager()

        # Act
        fn1 = fm.add_footnote("First historical reference.", anchor_id="p1")
        fn2 = fm.add_footnote("Second technical clarification.", anchor_id="p2")
        md_notes = fm.render_footnotes_markdown()

        # Assert
        self.assertEqual(fn1, 1)
        self.assertEqual(fn2, 2)
        self.assertIn("[^1]: First historical reference.", md_notes)
        self.assertIn("[^2]: Second technical clarification.", md_notes)


if __name__ == "__main__":
    unittest.main()

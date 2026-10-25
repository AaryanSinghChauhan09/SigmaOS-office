"""Unit tests for ODF and OOXML Packaging Engines (AAA Pattern, Deterministic, FIRST)."""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src"))
from document_engine import Document, Paragraph, TextRun
from spreadsheet_engine import Spreadsheet
from odf_ooxml_engine import ODFPackageBuilder, OOXMLPackageBuilder, PackageInspector


class TestODFOOXML(unittest.TestCase):

    def test_odf_text_package_creation_and_inspection(self):
        # Arrange
        doc = Document(title="ODF Test", author="Architect")
        doc.add_heading("ODF Chapter 1", level=1)
        doc.add_paragraph("Testing OpenDocument XML generation.")

        # Act
        odt_bytes = ODFPackageBuilder.build_odt(doc)
        inspection = PackageInspector.inspect_archive(odt_bytes)

        # Assert
        self.assertGreater(len(odt_bytes), 200)
        self.assertIn("ODF: application/vnd.oasis.opendocument.text", inspection["format"])
        self.assertIn("content.xml", inspection["entries"])
        self.assertIn("mimetype", inspection["entries"])
        self.assertIn("META-INF/manifest.xml", inspection["entries"])

    def test_odf_spreadsheet_package(self):
        # Arrange
        sheet = Spreadsheet(title="DataSheet")
        sheet.set_cell("A1", 123)
        sheet.set_cell("B1", "=A1*2")

        # Act
        ods_bytes = ODFPackageBuilder.build_ods(sheet)
        inspection = PackageInspector.inspect_archive(ods_bytes)

        # Assert
        self.assertGreater(len(ods_bytes), 200)
        self.assertIn("ODF: application/vnd.oasis.opendocument.spreadsheet", inspection["format"])
        self.assertIn("content.xml", inspection["entries"])

    def test_ooxml_docx_package(self):
        # Arrange
        doc = Document(title="Word Test", author="Analyst")
        doc.add_paragraph("Testing WordprocessingML output.")

        # Act
        docx_bytes = OOXMLPackageBuilder.build_docx(doc)
        inspection = PackageInspector.inspect_archive(docx_bytes)

        # Assert
        self.assertGreater(len(docx_bytes), 200)
        self.assertIn("OOXML: Word (.docx)", inspection["format"])
        self.assertIn("word/document.xml", inspection["entries"])
        self.assertIn("[Content_Types].xml", inspection["entries"])

    def test_ooxml_xlsx_package(self):
        # Arrange
        sheet = Spreadsheet(title="Financials")
        sheet.set_cell("A1", 1000)
        sheet.set_cell("A2", 2000)

        # Act
        xlsx_bytes = OOXMLPackageBuilder.build_xlsx(sheet)
        inspection = PackageInspector.inspect_archive(xlsx_bytes)

        # Assert
        self.assertGreater(len(xlsx_bytes), 200)
        self.assertIn("OOXML: Excel (.xlsx)", inspection["format"])
        self.assertIn("xl/workbook.xml", inspection["entries"])
        self.assertIn("xl/worksheets/sheet1.xml", inspection["entries"])


if __name__ == "__main__":
    unittest.main()

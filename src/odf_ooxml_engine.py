"""SigmaOS-office ODF & OOXML Package Engine (OpenOffice, LibreOffice, Microsoft Office Interop).

Generates and inspects valid in-memory zip packages for:
- OpenDocument Format (ODF 1.3): .odt (Text), .ods (Spreadsheet), .odp (Presentation)
- Open XML (OOXML ISO/IEC 29500): .docx (Word), .xlsx (Workbook), .pptx (Presentation)

Principles: Open Standards & Interoperability, Separation of Concerns, Deterministic Testing.
"""

from typing import Dict, Any, Optional
import io
import zipfile
import xml.etree.ElementTree as ET

from document_engine import Document, Paragraph, TextRun, Table
from spreadsheet_engine import Spreadsheet, format_cell_coord
from presentation_engine import SlideDeck, Slide, TextElement


class ODFPackageBuilder:
    """Constructs standards-compliant OpenDocument Format (.odt, .ods, .odp) zip packages."""

    @staticmethod
    def build_odt(doc: Document) -> bytes:
        """Packages Document AST into OpenDocument Text (.odt) zip bytes."""
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            # 1. mimetype (MUST be stored uncompressed as the first entry per ODF spec)
            z.writestr("mimetype", "application/vnd.oasis.opendocument.text", compress_type=zipfile.ZIP_STORED)

            # 2. META-INF/manifest.xml
            manifest_xml = (
                '<?xml version="1.0" encoding="UTF-8"?>\n'
                '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">\n'
                '  <manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.text"/>\n'
                '  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>\n'
                '  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>\n'
                '  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>\n'
                '</manifest:manifest>'
            )
            z.writestr("META-INF/manifest.xml", manifest_xml)

            # 3. meta.xml
            meta_xml = (
                '<?xml version="1.0" encoding="UTF-8"?>\n'
                '<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" '
                'xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.3">\n'
                '  <office:meta>\n'
                f'    <dc:title>{doc.title}</dc:title>\n'
                f'    <dc:creator>{doc.author}</dc:creator>\n'
                '  </office:meta>\n'
                '</office:document-meta>'
            )
            z.writestr("meta.xml", meta_xml)

            # 4. styles.xml
            styles_xml = (
                '<?xml version="1.0" encoding="UTF-8"?>\n'
                '<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" '
                'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" office:version="1.3">\n'
                '  <office:styles>\n'
                '    <style:default-style style:family="paragraph">\n'
                '      <style:text-properties style:font-name="DejaVu Sans" style:font-size="11pt"/>\n'
                '    </style:default-style>\n'
                '  </office:styles>\n'
                '</office:document-styles>'
            )
            z.writestr("styles.xml", styles_xml)

            # 5. content.xml
            body_elems = []
            for elem in doc.elements:
                if isinstance(elem, Paragraph):
                    style_tag = f'text:outline-level="{elem.heading_level}"' if elem.heading_level > 0 else ""
                    tag_name = "text:h" if elem.heading_level > 0 else "text:p"
                    runs_xml = "".join(f'<text:span>{r.text}</text:span>' for r in elem.runs)
                    body_elems.append(f'<{tag_name} {style_tag}>{runs_xml}</{tag_name}>')
                elif isinstance(elem, Table):
                    rows_xml = []
                    for row in elem.rows:
                        cells_xml = "".join(f'<table:table-cell><text:p>{c.text}</text:p></table:table-cell>' for c in row)
                        rows_xml.append(f'<table:table-row>{cells_xml}</table:table-row>')
                    body_elems.append(f'<table:table>{"".join(rows_xml)}</table:table>')

            content_xml = (
                '<?xml version="1.0" encoding="UTF-8"?>\n'
                '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" '
                'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" '
                'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" office:version="1.3">\n'
                '  <office:body>\n'
                '    <office:text>\n'
                f'      {"".join(body_elems)}\n'
                '    </office:text>\n'
                '  </office:body>\n'
                '</office:document-content>'
            )
            z.writestr("content.xml", content_xml)

        return buf.getvalue()

    @staticmethod
    def build_ods(sheet: Spreadsheet) -> bytes:
        """Packages Spreadsheet AST into OpenDocument Spreadsheet (.ods) zip bytes."""
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("mimetype", "application/vnd.oasis.opendocument.spreadsheet", compress_type=zipfile.ZIP_STORED)

            manifest_xml = (
                '<?xml version="1.0" encoding="UTF-8"?>\n'
                '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3">\n'
                '  <manifest:file-entry manifest:full-path="/" manifest:version="1.3" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>\n'
                '  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>\n'
                '</manifest:manifest>'
            )
            z.writestr("META-INF/manifest.xml", manifest_xml)

            # Generate table cells
            max_r = max((r for r, c in sheet.cells.keys()), default=0)
            max_c = max((c for r, c in sheet.cells.keys()), default=0)
            table_rows = []
            for r in range(max_r + 1):
                row_cells = []
                for c in range(max_c + 1):
                    val = sheet.get_value(format_cell_coord(r, c))
                    if val is not None:
                        formula_attr = ""
                        cell = sheet.get_cell(format_cell_coord(r, c))
                        if cell and cell.formula:
                            formula_attr = f' table:formula="of:={cell.formula}"'
                        row_cells.append(f'<table:table-cell office:value-type="string"{formula_attr}><text:p>{val}</text:p></table:table-cell>')
                    else:
                        row_cells.append('<table:table-cell/>')
                table_rows.append(f'<table:table-row>{"".join(row_cells)}</table:table-row>')

            content_xml = (
                '<?xml version="1.0" encoding="UTF-8"?>\n'
                '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" '
                'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" '
                'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" office:version="1.3">\n'
                '  <office:body>\n'
                '    <office:spreadsheet>\n'
                f'      <table:table table:name="{sheet.title}">\n'
                f'        {"".join(table_rows)}\n'
                '      </table:table>\n'
                '    </office:spreadsheet>\n'
                '  </office:body>\n'
                '</office:document-content>'
            )
            z.writestr("content.xml", content_xml)

        return buf.getvalue()


class OOXMLPackageBuilder:
    """Constructs standards-compliant Office Open XML (.docx, .xlsx, .pptx) zip packages."""

    @staticmethod
    def build_docx(doc: Document) -> bytes:
        """Packages Document AST into WordprocessingML (.docx) zip bytes."""
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            # 1. [Content_Types].xml
            ct_xml = (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n'
                '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n'
                '  <Default Extension="xml" ContentType="application/xml"/>\n'
                '  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\n'
                '</Types>'
            )
            z.writestr("[Content_Types].xml", ct_xml)

            # 2. _rels/.rels
            rels_xml = (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
                '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>\n'
                '</Relationships>'
            )
            z.writestr("_rels/.rels", rels_xml)

            # 3. word/document.xml
            paragraphs_xml = []
            for elem in doc.elements:
                if isinstance(elem, Paragraph):
                    runs_xml = []
                    for r in elem.runs:
                        bold_tag = "<w:b/>" if r.style.bold else ""
                        italic_tag = "<w:i/>" if r.style.italic else ""
                        rpr = f"<w:rPr>{bold_tag}{italic_tag}</w:rPr>" if (bold_tag or italic_tag) else ""
                        runs_xml.append(f'<w:r>{rpr}<w:t>{r.text}</w:t></w:r>')
                    paragraphs_xml.append(f'<w:p>{"".join(runs_xml)}</w:p>')

            doc_xml = (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n'
                '  <w:body>\n'
                f'    {"".join(paragraphs_xml)}\n'
                '  </w:body>\n'
                '</w:document>'
            )
            z.writestr("word/document.xml", doc_xml)

        return buf.getvalue()

    @staticmethod
    def build_xlsx(sheet: Spreadsheet) -> bytes:
        """Packages Spreadsheet AST into SpreadsheetML (.xlsx) zip bytes."""
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            ct_xml = (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n'
                '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n'
                '  <Default Extension="xml" ContentType="application/xml"/>\n'
                '  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>\n'
                '  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>\n'
                '</Types>'
            )
            z.writestr("[Content_Types].xml", ct_xml)

            rels_xml = (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
                '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>\n'
                '</Relationships>'
            )
            z.writestr("_rels/.rels", rels_xml)

            wb_rels_xml = (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
                '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>\n'
                '</Relationships>'
            )
            z.writestr("xl/_rels/workbook.xml.rels", wb_rels_xml)

            wb_xml = (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n'
                '  <sheets>\n'
                f'    <sheet name="{sheet.title}" sheetId="1" r:id="rId1"/>\n'
                '  </sheets>\n'
                '</workbook>'
            )
            z.writestr("xl/workbook.xml", wb_xml)

            # Generate sheet1.xml
            rows_dict: Dict[int, list] = {}
            for (r, c), cell in sheet.cells.items():
                if r not in rows_dict:
                    rows_dict[r] = []
                coord = format_cell_coord(r, c)
                val = cell.computed if cell.computed is not None else cell.raw
                val_tag = f"<v>{val}</v>" if val is not None else ""
                formula_tag = f"<f>{cell.formula}</f>" if cell.formula else ""
                t_attr = ' t="str"' if isinstance(val, str) else ""
                rows_dict[r].append(f'<c r="{coord}"{t_attr}>{formula_tag}{val_tag}</c>')

            sheet_data_xml = []
            for r_idx in sorted(rows_dict.keys()):
                cells_str = "".join(rows_dict[r_idx])
                sheet_data_xml.append(f'<row r="{r_idx + 1}">{cells_str}</row>')

            ws_xml = (
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n'
                '  <sheetData>\n'
                f'    {"".join(sheet_data_xml)}\n'
                '  </sheetData>\n'
                '</worksheet>'
            )
            z.writestr("xl/worksheets/sheet1.xml", ws_xml)

        return buf.getvalue()


class PackageInspector:
    """Inspects in-memory zip archive contents and media-types."""

    @staticmethod
    def inspect_archive(zip_bytes: bytes) -> Dict[str, Any]:
        """Lists files and detects format (ODT, ODS, DOCX, XLSX) from archive structure."""
        buf = io.BytesIO(zip_bytes)
        with zipfile.ZipFile(buf, "r") as z:
            namelist = z.namelist()
            detected = "Unknown Archive"
            if "mimetype" in namelist:
                mime = z.read("mimetype").decode("utf-8").strip()
                detected = f"ODF: {mime}"
            elif "[Content_Types].xml" in namelist:
                if any("word/document.xml" in n for n in namelist):
                    detected = "OOXML: Word (.docx)"
                elif any("xl/workbook.xml" in n for n in namelist):
                    detected = "OOXML: Excel (.xlsx)"
                elif any("ppt/presentation.xml" in n for n in namelist):
                    detected = "OOXML: PowerPoint (.pptx)"
            return {
                "format": detected,
                "file_count": len(namelist),
                "entries": namelist,
            }

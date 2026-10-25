"""SigmaOS-office Craft Bridge (CraftOffice / OpenOffice / LibreOffice / OnlyOffice Interop).

Provides bidirectional conversion and verification between SigmaOS Craft formats:
- WordCraft (.wcf) <-> Document AST <-> Markdown / Text / ODF XML Stub
- GridCraft (.gcf) <-> Spreadsheet AST <-> CSV / Grid Data
- DeckCraft (.dcf) <-> Presentation AST <-> Markdown Slides / Presentation XML Stub
- VectorCraft (.vcf) <-> DrawingCanvas AST <-> SVG
- DataCraft (.dbcf) <-> Relational Database AST <-> SQL DDL / CSV
- MathCraft (.mcf) <-> MathFormula AST <-> MathML / LaTeX

Principles: Open Standards & Interoperability, Single Responsibility, Separation of Concerns.
"""

from typing import Dict, Any, Optional
import json

from document_engine import Document, Paragraph, TextRun
from spreadsheet_engine import Spreadsheet, format_cell_coord
from presentation_engine import SlideDeck
from vector_draw_engine import DrawingCanvas
from database_engine import Database, Column
from math_engine import MathFormula


class CraftBridge:
    """Interoperability bridge between Craft formats and standard office representations."""

    # -------------------------------------------------------------------------
    # WordCraft (.wcf)
    # -------------------------------------------------------------------------
    @staticmethod
    def doc_to_wcf(doc: Document) -> str:
        """Serializes Document AST into WordCraft (.wcf) JSON package."""
        payload = {
            "format": "SigmaOS.WordCraft",
            "version": "1.0",
            "title": doc.title,
            "author": doc.author,
            "document_data": json.loads(doc.to_json()),
        }
        return json.dumps(payload, indent=2)

    @staticmethod
    def wcf_to_doc(wcf_str: str) -> Document:
        """Deserializes WordCraft (.wcf) string into Document AST."""
        data = json.loads(wcf_str)
        if data.get("format") != "SigmaOS.WordCraft":
            raise ValueError(f"Invalid format identifier: {data.get('format')}")
        doc_data = data.get("document_data", {})
        return Document.from_json(json.dumps(doc_data))

    # -------------------------------------------------------------------------
    # GridCraft (.gcf)
    # -------------------------------------------------------------------------
    @staticmethod
    def sheet_to_gcf(sheet: Spreadsheet) -> str:
        """Serializes Spreadsheet AST into GridCraft (.gcf) JSON package."""
        payload = {
            "format": "SigmaOS.GridCraft",
            "version": "1.0",
            "title": sheet.title,
            "cells": {
                format_cell_coord(r, c): {
                    "raw": cell.raw,
                    "formula": cell.formula,
                    "value": cell.computed if cell.computed is not None else cell.raw,
                }
                for (r, c), cell in sheet.cells.items()
            },
        }
        return json.dumps(payload, indent=2)

    @staticmethod
    def gcf_to_sheet(gcf_str: str) -> Spreadsheet:
        """Deserializes GridCraft (.gcf) string into Spreadsheet AST."""
        data = json.loads(gcf_str)
        if data.get("format") != "SigmaOS.GridCraft":
            raise ValueError(f"Invalid format identifier: {data.get('format')}")
        sheet = Spreadsheet(title=data.get("title", "Sheet"))
        for coord, c_info in data.get("cells", {}).items():
            sheet.set_cell(coord, c_info.get("raw"))
        sheet.evaluate_all()
        return sheet

    # -------------------------------------------------------------------------
    # DeckCraft (.dcf)
    # -------------------------------------------------------------------------
    @staticmethod
    def deck_to_dcf(deck: SlideDeck) -> str:
        """Serializes SlideDeck AST into DeckCraft (.dcf) JSON package."""
        payload = {
            "format": "SigmaOS.DeckCraft",
            "version": "1.0",
            "deck_data": json.loads(deck.to_json()),
        }
        return json.dumps(payload, indent=2)

    @staticmethod
    def dcf_to_deck(dcf_str: str) -> SlideDeck:
        """Deserializes DeckCraft (.dcf) string into SlideDeck AST."""
        data = json.loads(dcf_str)
        if data.get("format") != "SigmaOS.DeckCraft":
            raise ValueError(f"Invalid format identifier: {data.get('format')}")
        deck_data = data.get("deck_data", {})
        return SlideDeck.from_json(json.dumps(deck_data))

    # -------------------------------------------------------------------------
    # VectorCraft (.vcf)
    # -------------------------------------------------------------------------
    @staticmethod
    def canvas_to_vcf(canvas: DrawingCanvas) -> str:
        """Serializes DrawingCanvas AST into VectorCraft (.vcf) JSON package."""
        payload = {
            "format": "SigmaOS.VectorCraft",
            "version": "1.0",
            "canvas_data": canvas.to_dict(),
        }
        return json.dumps(payload, indent=2)

    @staticmethod
    def vcf_to_canvas(vcf_str: str) -> DrawingCanvas:
        """Deserializes VectorCraft (.vcf) string into DrawingCanvas AST."""
        data = json.loads(vcf_str)
        if data.get("format") != "SigmaOS.VectorCraft":
            raise ValueError(f"Invalid format identifier: {data.get('format')}")
        return DrawingCanvas.from_dict(data.get("canvas_data", {}))

    # -------------------------------------------------------------------------
    # MathCraft (.mcf)
    # -------------------------------------------------------------------------
    @staticmethod
    def math_to_mcf(formula: MathFormula) -> str:
        """Serializes MathFormula AST into MathCraft (.mcf) JSON package."""
        payload = {
            "format": "SigmaOS.MathCraft",
            "version": "1.0",
            "formula": formula.to_dict(),
        }
        return json.dumps(payload, indent=2)

    @staticmethod
    def mcf_to_math(mcf_str: str) -> MathFormula:
        """Deserializes MathCraft (.mcf) string into MathFormula AST."""
        data = json.loads(mcf_str)
        if data.get("format") != "SigmaOS.MathCraft":
            raise ValueError(f"Invalid format identifier: {data.get('format')}")
        latex = data.get("formula", {}).get("latex", "")
        return MathFormula(latex)

    # -------------------------------------------------------------------------
    # Unified Detection & Conversion Helper
    # -------------------------------------------------------------------------
    @staticmethod
    def detect_format(content: str) -> str:
        """Detects whether content is WordCraft, GridCraft, DeckCraft, VectorCraft, or MathCraft."""
        try:
            data = json.loads(content)
            fmt = data.get("format", "")
            if fmt.startswith("SigmaOS."):
                return fmt
        except Exception:
            pass
        if "<svg" in content:
            return "SVG"
        if "<math" in content:
            return "MathML"
        return "Unknown"

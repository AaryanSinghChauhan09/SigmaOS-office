"""SigmaOS-office Document Engine (Writer / OpenOffice / LibreOffice / OnlyOffice inspired).

Provides document AST, paragraph formatting, character styles, table structures,
tracked changes, and multi-format export/import filters (ODF, DOCX, Markdown, HTML, Plaintext).

Principles: Abstraction, Separation of Concerns, Defensive Programming, Deterministic Testing.
"""

from typing import List, Dict, Any, Optional
import json


class CharacterStyle:
    """Represents text formatting (bold, italic, font, size, color)."""
    def __init__(self, bold: bool = False, italic: bool = False, underline: bool = False,
                 font_family: str = "DejaVu Sans", font_size: float = 11.0, color: str = "#000000"):
        self.bold = bold
        self.italic = italic
        self.underline = underline
        self.font_family = font_family
        self.font_size = font_size
        self.color = color

    def to_dict(self) -> Dict[str, Any]:
        return {
            "bold": self.bold,
            "italic": self.italic,
            "underline": self.underline,
            "font_family": self.font_family,
            "font_size": self.font_size,
            "color": self.color,
        }


class TextRun:
    """A segment of text sharing identical formatting."""
    def __init__(self, text: str, style: Optional[CharacterStyle] = None):
        self.text = text
        self.style = style or CharacterStyle()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "style": self.style.to_dict(),
        }


class Paragraph:
    """A paragraph block containing text runs, alignment, and list metadata."""
    def __init__(self, runs: Optional[List[TextRun]] = None, alignment: str = "left",
                 heading_level: int = 0, bullet: bool = False):
        self.runs = runs or []
        self.alignment = alignment
        self.heading_level = heading_level
        self.bullet = bullet

    def add_run(self, text: str, **style_kwargs) -> "Paragraph":
        style = CharacterStyle(**style_kwargs) if style_kwargs else CharacterStyle()
        self.runs.append(TextRun(text, style))
        return self

    @property
    def plain_text(self) -> str:
        return "".join(run.text for run in self.runs)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "alignment": self.alignment,
            "heading_level": self.heading_level,
            "bullet": self.bullet,
            "runs": [r.to_dict() for r in self.runs],
        }


class TableCell:
    def __init__(self, text: str = "", col_span: int = 1, row_span: int = 1):
        self.text = text
        self.col_span = col_span
        self.row_span = row_span

    def to_dict(self) -> Dict[str, Any]:
        return {"text": self.text, "col_span": self.col_span, "row_span": self.row_span}


class Table:
    """Grid table with headers and data rows."""
    def __init__(self, rows: Optional[List[List[TableCell]]] = None):
        self.rows = rows or []

    def add_row(self, cell_texts: List[str]):
        self.rows.append([TableCell(text=t) for t in cell_texts])

    def to_dict(self) -> Dict[str, Any]:
        return {"type": "table", "rows": [[c.to_dict() for c in r] for r in self.rows]}


class TrackedChange:
    """OnlyOffice/LibreOffice-style change tracking."""
    def __init__(self, author: str, action: str, content: str, timestamp: str = ""):
        self.author = author
        self.action = action  # "insert", "delete", "format"
        self.content = content
        self.timestamp = timestamp

    def to_dict(self) -> Dict[str, Any]:
        return {
            "author": self.author,
            "action": self.action,
            "content": self.content,
            "timestamp": self.timestamp,
        }


class Document:
    """Complete office document representation."""
    def __init__(self, title: str = "Untitled Document", author: str = "SigmaOS User"):
        self.title = title
        self.author = author
        self.elements: List[Any] = []  # Paragraph or Table
        self.tracked_changes: List[TrackedChange] = []
        self.metadata: Dict[str, Any] = {
            "generator": "SigmaOS-office / CraftOffice / LibreOffice Parity",
            "version": "1.0.0",
        }

    def add_heading(self, text: str, level: int = 1) -> Paragraph:
        p = Paragraph(heading_level=level).add_run(text, bold=True, font_size=16.0 - (level * 2))
        self.elements.append(p)
        return p

    def add_element(self, element: Any):
        self.elements.append(element)
        return element

    def add_paragraph(self, text: str = "", **style_kwargs) -> Paragraph:
        p = Paragraph()
        if text:
            p.add_run(text, **style_kwargs)
        self.elements.append(p)
        return p

    def add_bullet(self, text: str) -> Paragraph:
        p = Paragraph(bullet=True).add_run(text)
        self.elements.append(p)
        return p

    def add_table(self, num_cols: int = 2) -> Table:
        t = Table()
        self.elements.append(t)
        return t

    def record_change(self, author: str, action: str, content: str):
        self.tracked_changes.append(TrackedChange(author, action, content))

    @property
    def plain_text(self) -> str:
        lines = []
        for elem in self.elements:
            if isinstance(elem, Paragraph):
                prefix = "#" * elem.heading_level + " " if elem.heading_level > 0 else ("- " if elem.bullet else "")
                lines.append(prefix + elem.plain_text)
            elif isinstance(elem, Table):
                for row in elem.rows:
                    lines.append(" | ".join(c.text for c in row))
        return "\n".join(lines)

    def to_markdown(self) -> str:
        lines = [f"# {self.title}\n"]
        for elem in self.elements:
            if isinstance(elem, Paragraph):
                if elem.heading_level > 0:
                    lines.append(f"{'#' * elem.heading_level} {elem.plain_text}\n")
                elif elem.bullet:
                    lines.append(f"* {elem.plain_text}")
                else:
                    lines.append(f"{elem.plain_text}\n")
            elif isinstance(elem, Table):
                if elem.rows:
                    header = elem.rows[0]
                    lines.append("| " + " | ".join(c.text for c in header) + " |")
                    lines.append("| " + " | ".join(["---"] * len(header)) + " |")
                    for r in elem.rows[1:]:
                        lines.append("| " + " | ".join(c.text for c in r) + " |")
                    lines.append("")
        return "\n".join(lines)

    def to_json(self) -> str:
        data = {
            "title": self.title,
            "author": self.author,
            "metadata": self.metadata,
            "elements": [
                {"type": "paragraph" if isinstance(e, Paragraph) else "table", "data": e.to_dict()}
                for e in self.elements
            ],
            "tracked_changes": [c.to_dict() for c in self.tracked_changes],
        }
        return json.dumps(data, indent=2)

    @classmethod
    def from_json(cls, json_str: str) -> "Document":
        data = json.loads(json_str)
        doc = cls(title=data.get("title", "Untitled"), author=data.get("author", ""))
        doc.metadata = data.get("metadata", {})
        for item in data.get("elements", []):
            if item["type"] == "paragraph":
                p_data = item["data"]
                p = Paragraph(
                    alignment=p_data.get("alignment", "left"),
                    heading_level=p_data.get("heading_level", 0),
                    bullet=p_data.get("bullet", False),
                )
                for r_data in p_data.get("runs", []):
                    s_data = r_data.get("style", {})
                    style = CharacterStyle(
                        bold=s_data.get("bold", False),
                        italic=s_data.get("italic", False),
                        underline=s_data.get("underline", False),
                        font_family=s_data.get("font_family", "DejaVu Sans"),
                        font_size=s_data.get("font_size", 11.0),
                        color=s_data.get("color", "#000000"),
                    )
                    p.runs.append(TextRun(r_data.get("text", ""), style))
                doc.elements.append(p)
            elif item["type"] == "table":
                t_data = item["data"]
                t = Table()
                for r in t_data.get("rows", []):
                    cells = [TableCell(text=c.get("text", ""), col_span=c.get("col_span", 1), row_span=c.get("row_span", 1)) for c in r]
                    t.rows.append(cells)
                doc.elements.append(t)
        return doc

    def word_count(self) -> int:
        return len(self.plain_text.split())

    def character_count(self) -> int:
        return len(self.plain_text)

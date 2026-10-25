"""SigmaOS-office Bibliography & Table of Contents Engine (Academic & Technical Publishing).

Provides automatic Table of Contents (TOC) hierarchy generation, BibTeX parsing,
citation formatting (APA, IEEE), and footnotes/endnotes management.

Principles: Separation of Concerns, Clear Abstraction, Deterministic Testing.
"""

from typing import List, Dict, Any, Optional
import re

from document_engine import Document, Paragraph, TextRun


class TOCEntry:
    def __init__(self, level: int, title: str, section_number: str, anchor_id: str):
        self.level = level
        self.title = title
        self.section_number = section_number
        self.anchor_id = anchor_id

    def to_dict(self) -> Dict[str, Any]:
        return {
            "level": self.level,
            "title": self.title,
            "section_number": self.section_number,
            "anchor_id": self.anchor_id,
        }


class TableOfContents:
    """Extracts and builds hierarchical Table of Contents from document headings."""

    @staticmethod
    def generate_toc(doc: Document) -> List[TOCEntry]:
        entries: List[TOCEntry] = []
        counters = [0] * 6  # supports up to 6 heading levels

        for idx, elem in enumerate(doc.elements):
            if isinstance(elem, Paragraph) and elem.heading_level > 0:
                lvl = min(elem.heading_level, 6)
                counters[lvl - 1] += 1
                for j in range(lvl, 6):
                    counters[j] = 0

                sec_num = ".".join(str(counters[k]) for k in range(lvl))
                title = elem.plain_text.strip()
                anchor = f"heading-{idx}-{re.sub(r'[^a-zA-Z0-9]+', '-', title).lower()}"
                entries.append(TOCEntry(lvl, title, sec_num, anchor))

        return entries

    @staticmethod
    def render_markdown(entries: List[TOCEntry]) -> str:
        lines = ["# Table of Contents\n"]
        for e in entries:
            indent = "  " * (e.level - 1)
            lines.append(f"{indent}- [{e.section_number} {e.title}](#{e.anchor_id})")
        return "\n".join(lines)


class BibEntry:
    """Represents an academic or technical citation entry."""
    def __init__(self, key: str, entry_type: str, fields: Dict[str, str]):
        self.key = key
        self.entry_type = entry_type.lower()
        self.fields = fields

    def get(self, field: str, default: str = "") -> str:
        return self.fields.get(field.lower(), default)

    def to_apa(self) -> str:
        author = self.get("author", "Unknown Author")
        year = self.get("year", "n.d.")
        title = self.get("title", "Untitled")
        journal = self.get("journal", self.get("booktitle", ""))
        source = f" {journal}." if journal else ""
        return f"{author} ({year}). {title}.{source}".strip()

    def to_ieee(self, index: int = 1) -> str:
        author = self.get("author", "Unknown Author")
        title = self.get("title", "Untitled")
        journal = self.get("journal", self.get("booktitle", ""))
        year = self.get("year", "n.d.")
        source = f', "{journal}"' if journal else ""
        return f'[{index}] {author}, "{title}"{source}, {year}.'


class BibliographyManager:
    """BibTeX parser and reference list builder."""
    def __init__(self):
        self.entries: Dict[str, BibEntry] = {}

    def add_entry(self, entry: BibEntry) -> None:
        self.entries[entry.key] = entry

    def parse_bibtex(self, bibtex_str: str) -> List[BibEntry]:
        """Parses BibTeX syntax: @type{key, field = {val}, ...}"""
        parsed = []
        entry_pattern = re.compile(r"@([a-zA-Z]+)\s*\{\s*([^,]+),([^@]*)\}", re.DOTALL)
        field_pattern = re.compile(r'([a-zA-Z0-9_-]+)\s*=\s*[\{"\']([^"\'\}]+)[\}"\']')

        for match in entry_pattern.finditer(bibtex_str):
            etype = match.group(1).strip()
            key = match.group(2).strip()
            body = match.group(3)
            fields = {}
            for fm in field_pattern.finditer(body):
                fields[fm.group(1).strip().lower()] = fm.group(2).strip()
            entry = BibEntry(key, etype, fields)
            self.add_entry(entry)
            parsed.append(entry)

        return parsed

    def generate_reference_list(self, style: str = "APA") -> str:
        lines = ["# References\n"]
        for idx, (k, entry) in enumerate(sorted(self.entries.items()), 1):
            if style.upper() == "IEEE":
                lines.append(entry.to_ieee(idx))
            else:
                lines.append(f"- {entry.to_apa()}")
        return "\n".join(lines)


class FootnoteManager:
    """Manages footnotes and endnotes."""
    def __init__(self):
        self.footnotes: List[Dict[str, Any]] = []

    def add_footnote(self, text: str, anchor_id: str) -> int:
        num = len(self.footnotes) + 1
        self.footnotes.append({"number": num, "text": text, "anchor_id": anchor_id})
        return num

    def render_footnotes_markdown(self) -> str:
        lines = ["---\n**Footnotes:**\n"]
        for fn in self.footnotes:
            lines.append(f"[^{fn['number']}]: {fn['text']}")
        return "\n".join(lines)

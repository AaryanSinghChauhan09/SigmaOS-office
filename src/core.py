"""SigmaOS-office Unified Office Suite CLI and Integration Platform.

Integrates sub-engines inspired by OpenOffice, LibreOffice, GenOffice, OnlyOffice, and CraftOffice:
- Writer (Document Engine: AST, text formatting, page styles, tables, tracked changes)
- Calc (Spreadsheet Engine: DAG formula evaluation, OpenFormula VLOOKUP/INDEX, cell ranges, CSV)
- Impress (Presentation Engine: Slide decks, layouts, transitions)
- Draw (Vector Draw Engine: Shapes, Bezier curves, polygons, connectors, transforms, SVG)
- Math (Formula Engine: LaTeX, MathML, Unicode math symbols)
- Base (Database Engine: Relational tables, SQL-like query builder, reports)
- GenOffice AI (Prompt-to-doc/deck, summarization, grammar/readability analysis)
- OnlyOffice Collab & Security (OT, Merkle hash chains, HMAC session tokens, visual diffs)
- Craft Bridge (WordCraft .wcf, GridCraft .gcf, DeckCraft .dcf, VectorCraft .vcf, MathCraft .mcf)
- ODF & OOXML Packaging (OpenDocument .odt/.ods and Office Open XML .docx/.xlsx)
- UNO Scripting & Macros (Universal Network Objects, component contexts, event hooks)
- Bibliography & TOC (Automatic Table of Contents, BibTeX parsing, APA/IEEE reference formatters)
- Style & Icon Planner (Mint/Breeze/Elementary icon mapping and verification)

Principles: Separation of Concerns, Defensive Programming, Fail-Fast, KISS, Deterministic Testing.
"""

import argparse
import io
import json
import os
import re
import sys
from typing import List, Dict, Any, Optional

from document_engine import Document, Paragraph, TextRun, Table as DocTable, CharacterStyle, PageStyle
from spreadsheet_engine import Spreadsheet, format_cell_coord
from presentation_engine import SlideDeck, Slide, TextElement
from vector_draw_engine import DrawingCanvas, Rectangle, Ellipse, Line, Connector, TextShape, BezierCurve, Polygon
from database_engine import Database, Column, Table as DbTable
from math_engine import MathFormula
from genoffice_ai import GenOfficeAI
from onlyoffice_collab import Operation, ChangeSet, OperationalTransform, CommentThread, DocumentLockManager, UserPresence
from craft_bridge import CraftBridge
from odf_ooxml_engine import ODFPackageBuilder, OOXMLPackageBuilder, PackageInspector
from uno_macro_engine import XComponentContext, XMultiComponentFactory, MacroRunner
from bibliography_toc_engine import TableOfContents, BibliographyManager, FootnoteManager, BibEntry
from collab_security import MerkleAuditLog, DocumentTokenManager, VisualDiffEngine, WatermarkSpec

ENGINE = {
    "name": "sigma-office",
    "summary": "Unified Office Suite and Document Platform for SigmaOS",
    "version": "2.1.0",
    "language": "python",
    "verbs": [
        "apply-plan", "icons", "mapping", "verify",
        "writer", "calc", "impress", "draw", "math",
        "base", "gen", "collab", "craft", "odf", "ooxml",
        "macro", "toc", "bib", "diff", "token", "self-test",
    ],
    "principles": [
        "Separation of Concerns", "Defensive Programming",
        "Fail-Fast", "KISS", "Deterministic Testing",
        "Open Standard and Interoperability", "Locality of Reference",
    ],
}


class StyleError(Exception):
    pass


STYLES = ("mint", "breeze", "elementary", "classic")
_ICON_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")

DEFAULT_MAPPING = {
    ".odt": "libreoffice-writer",
    ".doc": "libreoffice-writer",
    ".docx": "libreoffice-writer",
    ".odp": "libreoffice-impress",
    ".ppt": "libreoffice-impress",
    ".pptx": "libreoffice-impress",
    ".ods": "libreoffice-calc",
    ".xls": "libreoffice-calc",
    ".xlsx": "libreoffice-calc",
    ".odg": "libreoffice-draw",
    ".svg": "libreoffice-draw",
    ".odb": "libreoffice-base",
    ".oxt": "libreoffice-extension",
    ".ots": "libreoffice-calc",
    ".ott": "libreoffice-writer",
    ".wcf": "craftoffice-writer",
    ".gcf": "craftoffice-calc",
    ".dcf": "craftoffice-impress",
    ".vcf": "craftoffice-draw",
    ".mcf": "craftoffice-math",
    ".dbcf": "craftoffice-base",
}


# --------------------------------------------------------------------------- #
#  PURE plan / verify layer (LibreOffice / Mint style parity)
# --------------------------------------------------------------------------- #
def load_mapping(path: Optional[str] = None) -> Dict[str, str]:
    """Load an 'ext=icon' mapping file; defaults to the built-in mapping."""
    if path is None:
        return dict(DEFAULT_MAPPING)
    mapping = {}
    with open(path, "r", encoding="utf-8") as fh:
        for lineno, raw in enumerate(fh, 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            ext, sep, icon = line.partition("=")
            ext, icon = ext.strip().lower(), icon.strip()
            if not sep or not ext.startswith(".") or len(ext) < 2:
                raise StyleError(f"line {lineno}: expected '.ext=icon', got {line!r}")
            if not _ICON_RE.match(icon):
                raise StyleError(f"line {lineno}: bad icon name {icon!r}")
            if ext in mapping:
                raise StyleError(f"line {lineno}: duplicate extension {ext!r}")
            mapping[ext] = icon
    if not mapping:
        raise StyleError("mapping file is empty")
    return mapping


def theme_dir(style: str) -> str:
    """Return the icon theme directory for a style."""
    if style not in STYLES:
        raise StyleError(f"unknown style {style!r} (choose from {', '.join(STYLES)})")
    return f"libreoffice-{style}"


def apply_plan(style: str, mapping: Optional[Dict[str, str]] = None) -> List[Dict[str, str]]:
    """Plan theme assignments: deterministic, sorted, nothing written."""
    theme = theme_dir(style)
    mapping = DEFAULT_MAPPING if mapping is None else mapping
    if not isinstance(mapping, dict) or not mapping:
        raise StyleError("mapping must be a non-empty dict")
    plan = []
    for ext in sorted(mapping):
        icon = mapping[ext]
        if not _ICON_RE.match(icon):
            raise StyleError(f"bad icon name for {ext}: {icon!r}")
        plan.append({"ext": ext, "icon": icon, "file": f"{icon}.svg", "theme": theme})
    return plan


def icons(style: str, mapping: Optional[Dict[str, str]] = None) -> List[str]:
    """List the unique icon files a style needs (sorted)."""
    return sorted({e["file"] for e in apply_plan(style, mapping)})


def verify(plan: List[Dict[str, str]], available: Any) -> Dict[str, Any]:
    """Check a plan against a collection of available icon file names."""
    if not isinstance(plan, list) or not plan:
        raise StyleError("plan must be a non-empty list")
    avail = set(available or [])
    missing = sorted({e["file"] for e in plan if e["file"] not in avail})
    return {
        "ok": not missing,
        "missing": missing,
        "total": len(plan),
        "present": len(plan) - len(missing),
    }


def _read_lines(path: str) -> List[str]:
    with open(path, "r", encoding="utf-8") as fh:
        return [l.strip() for l in fh if l.strip() and not l.startswith("#")]


# --------------------------------------------------------------------------- #
#  CLI Parser
# --------------------------------------------------------------------------- #
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog=ENGINE["name"], description=ENGINE["summary"])
    sub = p.add_subparsers(dest="cmd", required=True)

    # Legacy Style Verbs
    ap = sub.add_parser("apply-plan", help="plan theme assignments for a style")
    ap.add_argument("style", choices=list(STYLES))
    ap.add_argument("--mapping", default=None, help="mapping file (default: built-in)")

    ic = sub.add_parser("icons", help="list icons a style needs")
    ic.add_argument("style", choices=list(STYLES))
    ic.add_argument("--mapping", default=None)

    mp = sub.add_parser("mapping", help="print the extension->icon mapping")
    mp.add_argument("file", nargs="?", default=None)

    vf = sub.add_parser("verify", help="verify a style provides every icon")
    vf.add_argument("style", choices=list(STYLES))
    vf.add_argument("--available", required=True, help="file listing available icon file names")
    vf.add_argument("--mapping", default=None)

    # Writer CLI
    wr = sub.add_parser("writer", help="create and inspect documents")
    wr.add_argument("--title", default="Untitled Document")
    wr.add_argument("--text", default="SigmaOS Office Writer document text.")
    wr.add_argument("--format", choices=["markdown", "json", "stats"], default="markdown")

    # Calc CLI
    cl = sub.add_parser("calc", help="create and evaluate spreadsheets")
    cl.add_argument("--set", action="append", help="assign cell e.g. A1=10, B1=20, C1==SUM(A1:B1)")
    cl.add_argument("--csv", action="store_true", help="output as CSV")

    # Impress CLI
    im = sub.add_parser("impress", help="create slide decks")
    im.add_argument("--title", default="SigmaOS Presentation")
    im.add_argument("--slides", type=int, default=3)

    # Draw CLI
    dr = sub.add_parser("draw", help="render vector diagram to SVG")
    dr.add_argument("--demo", action="store_true", help="generate demo vector diagram")

    # Math CLI
    mt = sub.add_parser("math", help="convert LaTeX formula to MathML and Unicode")
    mt.add_argument("latex", help="LaTeX formula string e.g. '\\sum x^2'")

    # Base CLI
    bs = sub.add_parser("base", help="relational table and reporting engine")
    bs.add_argument("--demo", action="store_true", help="run database demo and report")

    # GenOffice AI CLI
    gn = sub.add_parser("gen", help="GenOffice AI assistant (doc synthesis, summary, review)")
    gn.add_argument("--topic", help="topic to synthesize document or presentation")
    gn.add_argument("--type", choices=["doc", "deck"], default="doc")
    gn.add_argument("--summarize", help="text to summarize")
    gn.add_argument("--review", help="text to review for style/grammar")

    # OnlyOffice Collab CLI
    cb = sub.add_parser("collab", help="collaboration, OT, and lock verification")
    cb.add_argument("--demo", action="store_true", help="run OT and comment thread demo")

    # Craft Bridge CLI
    cr = sub.add_parser("craft", help="convert and inspect CraftOffice formats (.wcf, .gcf, .dcf, etc.)")
    cr.add_argument("--inspect", help="JSON string or path to CraftOffice file")

    # ODF CLI
    od = sub.add_parser("odf", help="build or inspect OpenDocument packages (.odt, .ods)")
    od.add_argument("--type", choices=["odt", "ods"], default="odt")
    od.add_argument("--title", default="ODF Document")

    # OOXML CLI
    ox = sub.add_parser("ooxml", help="build or inspect Office Open XML packages (.docx, .xlsx)")
    ox.add_argument("--type", choices=["docx", "xlsx"], default="docx")
    ox.add_argument("--title", default="OOXML Document")

    # Macro CLI
    mc = sub.add_parser("macro", help="execute sandboxed Python macro in UNO context")
    mc.add_argument("--code", required=True, help="Python macro code snippet")

    # TOC CLI
    tc = sub.add_parser("toc", help="generate Table of Contents from document headings")
    tc.add_argument("--sample", action="store_true", help="generate sample TOC")

    # Bibliography CLI
    bb = sub.add_parser("bib", help="parse BibTeX and format reference list")
    bb.add_argument("--bibtex", help="BibTeX snippet")
    bb.add_argument("--style", choices=["APA", "IEEE"], default="APA")

    # Visual Diff CLI
    df = sub.add_parser("diff", help="compute visual word diff between two texts")
    df.add_argument("text_a", help="original text")
    df.add_argument("text_b", help="modified text")

    # Token CLI
    tk = sub.add_parser("token", help="generate or verify OnlyOffice-style session token")
    tk.add_argument("--generate", action="store_true", help="generate token")
    tk.add_argument("--secret", default="sigma_office_secret_key")
    tk.add_argument("--doc-id", default="doc_123")
    tk.add_argument("--user-id", default="user_alice")

    # Self-test CLI
    st = sub.add_parser("self-test", help="run deterministic test suites across all engines")

    return p


# --------------------------------------------------------------------------- #
#  CLI Handlers
# --------------------------------------------------------------------------- #
def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        # Style commands
        if args.cmd == "apply-plan":
            for e in apply_plan(args.style, load_mapping(args.mapping)):
                print(f'{e["theme"]}: {e["ext"]} -> {e["file"]}')
            return 0
        elif args.cmd == "icons":
            print(" ".join(icons(args.style, load_mapping(args.mapping))))
            return 0
        elif args.cmd == "mapping":
            for ext, icon in sorted(load_mapping(args.file).items()):
                print(f"{ext} -> {icon}.svg")
            return 0
        elif args.cmd == "verify":
            result = verify(apply_plan(args.style, load_mapping(args.mapping)), _read_lines(args.available))
            if result["ok"]:
                print(f'ok: {result["present"]}/{result["total"]} icons present')
                return 0
            print(f'missing {len(result["missing"])} icon(s): ' + " ".join(result["missing"]), file=sys.stderr)
            return 1

        # Writer
        elif args.cmd == "writer":
            doc = Document(title=args.title)
            p = Paragraph()
            p.runs.append(TextRun(args.text))
            doc.add_element(p)
            if args.format == "markdown":
                print(doc.to_markdown())
            elif args.format == "json":
                print(doc.to_json())
            elif args.format == "stats":
                print(f"Words: {doc.word_count()}, Characters: {doc.character_count()}")
            return 0

        # Calc
        elif args.cmd == "calc":
            sheet = Spreadsheet(title="Calc Sheet")
            if args.set:
                for entry in args.set:
                    coord, _, val = entry.partition("=")
                    sheet.set_cell(coord.strip(), val.strip())
            sheet.evaluate_all()
            if args.csv:
                print(sheet.to_csv())
            else:
                for (r, c), cell in sorted(sheet.cells.items()):
                    val = cell.computed if cell.computed is not None else cell.raw
                    print(f"{format_cell_coord(r, c)} = {val} (raw: {cell.raw})")
            return 0

        # Impress
        elif args.cmd == "impress":
            deck = SlideDeck(title=args.title)
            for i in range(1, args.slides + 1):
                s = Slide(title=f"Slide {i}")
                s.add_element(TextElement(f"Content for Slide {i}"))
                deck.add_slide(s)
            print(deck.to_markdown())
            return 0

        # Draw
        elif args.cmd == "draw":
            canvas = DrawingCanvas(width=800, height=600, title="Vector Drawing")
            canvas.add_shape(Rectangle("rect1", 50, 50, 200, 100))
            canvas.add_shape(Ellipse("circle1", 400, 100, 50, 50))
            canvas.add_shape(Connector("conn1", (250, 100), (350, 100)))
            canvas.add_shape(BezierCurve("curve1", 50, 300, 150, 200, 250, 400, 350, 300))
            print(canvas.to_svg())
            return 0

        # Math
        elif args.cmd == "math":
            formula = MathFormula(args.latex)
            print("Unicode:", formula.to_unicode_text())
            print("MathML:\n", formula.to_mathml())
            return 0

        # Base
        elif args.cmd == "base":
            db = Database("SigmaOfficeDB")
            tbl = db.create_table("users", [
                Column("id", "INTEGER", primary_key=True),
                Column("username", "TEXT"),
                Column("role", "TEXT"),
            ])
            tbl.insert({"id": 1, "username": "admin", "role": "root"})
            tbl.insert({"id": 2, "username": "developer", "role": "staff"})
            res = db.query("users").where("role", "!=", "root").execute()
            print(json.dumps(res, indent=2))
            return 0

        # GenOffice AI
        elif args.cmd == "gen":
            if args.topic:
                if args.type == "deck":
                    deck = GenOfficeAI.generate_presentation_from_prompt(args.topic)
                    print(deck.to_markdown())
                else:
                    doc = GenOfficeAI.generate_document_from_prompt(args.topic)
                    print(doc.to_markdown())
            elif args.summarize:
                print(json.dumps(GenOfficeAI.summarize_text(args.summarize), indent=2))
            elif args.review:
                print(json.dumps(GenOfficeAI.review_style_and_grammar(args.review), indent=2))
            return 0

        # OnlyOffice Collab
        elif args.cmd == "collab":
            op1 = Operation(Operation.INSERT, 0, "Hello ")
            op2 = Operation(Operation.INSERT, 0, "SigmaOS ")
            t1, t2 = OperationalTransform.transform_op(op2, op1)
            result = OperationalTransform.apply_to_text("", [op1, t1])
            print(f"OT Transformation Result: {result!r}")
            return 0

        # Craft Bridge
        elif args.cmd == "craft":
            if args.inspect:
                fmt = CraftBridge.detect_format(args.inspect)
                print(f"Detected Format: {fmt}")
            return 0

        # ODF
        elif args.cmd == "odf":
            doc = Document(title=args.title)
            doc.add_paragraph("OpenDocument generated package.")
            pkg = ODFPackageBuilder.build_odt(doc)
            info = PackageInspector.inspect_archive(pkg)
            print(f"Built ODF Package: {info['format']}, Files: {info['file_count']}")
            return 0

        # OOXML
        elif args.cmd == "ooxml":
            doc = Document(title=args.title)
            doc.add_paragraph("Office Open XML generated package.")
            pkg = OOXMLPackageBuilder.build_docx(doc)
            info = PackageInspector.inspect_archive(pkg)
            print(f"Built OOXML Package: {info['format']}, Files: {info['file_count']}")
            return 0

        # Macro
        elif args.cmd == "macro":
            runner = MacroRunner()
            doc = Document(title="Macro Target")
            res = runner.execute_snippet(args.code, doc)
            print("Macro Scope:", res)
            return 0

        # TOC
        elif args.cmd == "toc":
            doc = Document(title="Guide")
            doc.add_heading("Architecture", level=1)
            doc.add_heading("Subsystems", level=2)
            entries = TableOfContents.generate_toc(doc)
            print(TableOfContents.render_markdown(entries))
            return 0

        # Bibliography
        elif args.cmd == "bib":
            sample = args.bibtex or '@article{knuth1984, author={Donald Knuth}, title={Literate Programming}, year={1984}, journal={Computer Journal}}'
            bm = BibliographyManager()
            bm.parse_bibtex(sample)
            print(bm.generate_reference_list(style=args.style))
            return 0

        # Diff
        elif args.cmd == "diff":
            diff = VisualDiffEngine.compute_word_diff(args.text_a, args.text_b)
            print("Visual Diff:", diff)
            return 0

        # Token
        elif args.cmd == "token":
            if args.generate:
                tok = DocumentTokenManager.generate_token(args.secret, args.doc_id, args.user_id)
                print("Generated Token:", tok)
            return 0

        # Self-Test
        elif args.cmd == "self-test":
            self_test()
            print("All SigmaOS-office deterministic self-tests passed successfully.")
            return 0

        return 0

    except (StyleError, OSError, ValueError, KeyError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


# --------------------------------------------------------------------------- #
#  Deterministic Self-Tests
# --------------------------------------------------------------------------- #
def self_test() -> None:
    # 1. Test Style Engine & Icon Mappings
    mapping = load_mapping()
    assert mapping[".odt"] == "libreoffice-writer"
    assert mapping[".xlsx"] == "libreoffice-calc"
    assert mapping[".wcf"] == "craftoffice-writer"

    plan = apply_plan("mint")
    assert plan == sorted(plan, key=lambda e: e["ext"])
    assert all(e["theme"] == "libreoffice-mint" for e in plan)
    assert apply_plan("breeze")[0]["theme"] == "libreoffice-breeze"

    need = icons("mint")
    assert "libreoffice-writer.svg" in need and "craftoffice-writer.svg" in need
    full = verify(plan, need)
    assert full["ok"] is True and full["missing"] == []

    # 2. Test Document Engine & PageStyle
    doc = Document(title="Test Architecture", author="Architect")
    assert doc.page_style.orientation == "portrait"
    p = Paragraph(heading_level=1)
    p.runs.append(TextRun("SigmaOS Office Suite", CharacterStyle(bold=True)))
    doc.add_element(p)
    tbl = DocTable()
    tbl.add_row(["Key", "Value"])
    tbl.add_row(["Status", "Active"])
    doc.add_element(tbl)
    doc_json = doc.to_json()
    doc_reconstructed = Document.from_json(doc_json)
    assert doc_reconstructed.title == "Test Architecture"
    assert doc_reconstructed.word_count() > 0

    # 3. Test Spreadsheet Engine & OpenFormula
    sheet = Spreadsheet(title="Financials")
    sheet.set_cell("A1", 100)
    sheet.set_cell("A2", 250)
    sheet.set_cell("A3", "=SUM(A1:A2)")
    sheet.set_cell("E1", "Widget")
    sheet.set_cell("F1", 99)
    sheet.set_cell("G1", '=VLOOKUP("Widget", E1:F1, 2)')
    sheet.evaluate_all()
    assert sheet.get_cell_value("A3") == 350
    assert sheet.get_cell_value("G1") == 99

    # 4. Test Presentation Engine
    deck = SlideDeck(title="Quarterly Review")
    s1 = Slide(title="Intro")
    s1.add_element(TextElement("Welcome", x=10, y=20))
    deck.add_slide(s1)
    md = deck.to_markdown()
    assert "# Quarterly Review" in md and "## Intro" in md

    # 5. Test Math Engine
    mf = MathFormula(r"\sum x^2 + \alpha = \beta")
    assert "∑" in mf.to_unicode_text()
    assert "α" in mf.to_unicode_text()
    assert "<math" in mf.to_mathml()

    # 6. Test Vector Draw Engine with Bezier and Polygon
    canvas = DrawingCanvas(width=400, height=300)
    canvas.add_shape(Rectangle("r1", 10, 10, 50, 50))
    canvas.add_shape(Connector("c1", (10, 10), (100, 100)))
    canvas.add_shape(BezierCurve("bz1", 0, 0, 20, 50, 80, 50, 100, 0))
    canvas.add_shape(Polygon("poly1", [(0, 0), (10, 0), (5, 10)]))
    svg = canvas.to_svg()
    assert "<svg" in svg and "<rect" in svg and "<polygon" in svg

    # 7. Test Database Engine
    db = Database("OfficeStore")
    t = db.create_table("inventory", [
        Column("sku", "TEXT", primary_key=True),
        Column("qty", "INTEGER"),
    ])
    t.insert({"sku": "A100", "qty": 42})
    t.insert({"sku": "B200", "qty": 10})
    rows = db.query("inventory").where("qty", ">", 20).execute()
    assert len(rows) == 1 and rows[0]["sku"] == "A100"
    total_qty = db.query("inventory").aggregate("SUM", "qty")
    assert total_qty == 52

    # 8. Test GenOffice AI
    ai_doc = GenOfficeAI.generate_document_from_prompt("Microkernel OS", ["Design", "Drivers"])
    assert ai_doc.title == "Microkernel OS"
    assert len(ai_doc.elements) >= 4
    rev = GenOfficeAI.review_style_and_grammar("The driver was executed by the thread. This is a very clear process.")
    assert rev["passive_voice_count"] >= 1
    tmpl = GenOfficeAI.expand_template("Hello {{name}}! {{#if valid}}OK{{/if}}", {"name": "World", "valid": True})
    assert tmpl == "Hello World! OK"

    # 9. Test OnlyOffice Collab & OT
    op_ins1 = Operation(Operation.INSERT, 0, "Hello")
    op_ins2 = Operation(Operation.INSERT, 0, "World ")
    t_ins2, _ = OperationalTransform.transform_op(op_ins2, op_ins1)
    merged = OperationalTransform.apply_to_text("", [op_ins1, t_ins2])
    assert "Hello" in merged and "World" in merged
    lock_mgr = DocumentLockManager()
    assert lock_mgr.acquire_lock("p1", "alice") is True
    assert lock_mgr.acquire_lock("p1", "bob") is False
    assert lock_mgr.release_lock("p1", "alice") is True
    assert lock_mgr.acquire_lock("p1", "bob") is True

    # 10. Test Craft Bridge
    wcf = CraftBridge.doc_to_wcf(doc)
    doc_from_wcf = CraftBridge.wcf_to_doc(wcf)
    assert doc_from_wcf.title == doc.title
    gcf = CraftBridge.sheet_to_gcf(sheet)
    sheet_from_gcf = CraftBridge.gcf_to_sheet(gcf)
    assert sheet_from_gcf.get_cell_value("A3") == 350
    assert CraftBridge.detect_format(wcf) == "SigmaOS.WordCraft"
    assert CraftBridge.detect_format(gcf) == "SigmaOS.GridCraft"

    # 11. Test ODF & OOXML Packaging
    odt_bytes = ODFPackageBuilder.build_odt(doc)
    assert len(odt_bytes) > 100
    odt_info = PackageInspector.inspect_archive(odt_bytes)
    assert "ODF" in odt_info["format"]
    docx_bytes = OOXMLPackageBuilder.build_docx(doc)
    assert len(docx_bytes) > 100
    docx_info = PackageInspector.inspect_archive(docx_bytes)
    assert "OOXML" in docx_info["format"]

    # 12. Test UNO Scripting & Macros
    runner = MacroRunner()
    res = runner.execute_snippet("output = 40 + 2", doc)
    assert res["output"] == 42

    # 13. Test Bibliography & TOC
    toc_entries = TableOfContents.generate_toc(doc)
    assert len(toc_entries) >= 1
    bm = BibliographyManager()
    bm.parse_bibtex('@article{lamport78, author={Leslie Lamport}, title={Time and Clocks}, year={1978}}')
    ref_md = bm.generate_reference_list(style="APA")
    assert "Leslie Lamport" in ref_md

    # 14. Test Collab Security & Hash Chain
    audit = MerkleAuditLog()
    cs = ChangeSet(revision=1, user_id="alice", operations=[op_ins1])
    audit.append_changeset(cs, "Initial insertion")
    assert audit.verify_integrity() is True

    # Test Session Token
    token = DocumentTokenManager.generate_token("test_secret", "doc1", "user1")
    verified = DocumentTokenManager.verify_token(token, "test_secret")
    assert verified["doc_id"] == "doc1" and verified["user_id"] == "user1"

    # Test Visual Diff
    diff_text = VisualDiffEngine.compute_word_diff("Hello old world", "Hello new world")
    assert "[DEL: old]" in diff_text and "[INS: new]" in diff_text


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

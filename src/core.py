"""LibreOffice icon/style integration planner for SigmaOS-office
(libreoffice-style-mint-inspired).

The engine maps office document extensions to icon names, plans theme
assignments (never touching the filesystem itself) and verifies that a style
provides every icon a mapping needs. All logic is pure plan/verify data
handling -- applying the theme is the thin side-effecting layer that
self_test() never runs.
Principles: Separation of Concerns, Defensive Programming, Fail-Fast, KISS.
"""
import argparse, os, re, sys

ENGINE = {
    "name": "sigma-office-style",
    "summary": "Map office document types to theme icons and verify coverage",
    "language": "python",
    "verbs": ["apply-plan", "icons", "mapping", "verify"],
    "principles": ["Separation of Concerns", "Defensive Programming",
                   "Fail-Fast", "KISS", "Deterministic Testing"],
}

cli_doc = """\
$ sigma-office-style mapping
.docx -> libreoffice-writer.svg
.xlsx -> libreoffice-calc.svg
$ sigma-office-style apply-plan mint
mint: .docx -> libreoffice-writer.svg
$ sigma-office-style icons mint
libreoffice-base.svg libreoffice-calc.svg ...
$ sigma-office-style verify mint --available available.txt
ok: 12/12 icons present
"""


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
}


# --------------------------------------------------------------------------- #
#  PURE plan / verify layer
# --------------------------------------------------------------------------- #
def load_mapping(path=None):
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


def theme_dir(style):
    """Return the icon theme directory for a style."""
    if style not in STYLES:
        raise StyleError(f"unknown style {style!r} "
                         f"(choose from {', '.join(STYLES)})")
    return f"libreoffice-{style}"


def apply_plan(style, mapping=None):
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
        plan.append({"ext": ext, "icon": icon,
                     "file": f"{icon}.svg", "theme": theme})
    return plan


def icons(style, mapping=None):
    """List the unique icon files a style needs (sorted)."""
    return sorted({e["file"] for e in apply_plan(style, mapping)})


def verify(plan, available):
    """Check a plan against a collection of available icon file names."""
    if not isinstance(plan, list) or not plan:
        raise StyleError("plan must be a non-empty list")
    avail = set(available or [])
    missing = sorted({e["file"] for e in plan if e["file"] not in avail})
    return {"ok": not missing, "missing": missing,
            "total": len(plan), "present": len(plan) - len(missing)}


# --------------------------------------------------------------------------- #
#  CLI
# --------------------------------------------------------------------------- #
def _read_lines(path):
    with open(path, "r", encoding="utf-8") as fh:
        return [l.strip() for l in fh if l.strip() and not l.startswith("#")]


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog=ENGINE["name"], description=ENGINE["summary"])
    sub = p.add_subparsers(dest="cmd", required=True)
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
    vf.add_argument("--available", required=True,
                    help="file listing available icon file names")
    vf.add_argument("--mapping", default=None)
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.cmd == "apply-plan":
            for e in apply_plan(args.style, load_mapping(args.mapping)):
                print(f'{e["theme"]}: {e["ext"]} -> {e["file"]}')
        elif args.cmd == "icons":
            print(" ".join(icons(args.style, load_mapping(args.mapping))))
        elif args.cmd == "mapping":
            for ext, icon in sorted(load_mapping(args.file).items()):
                print(f"{ext} -> {icon}.svg")
        elif args.cmd == "verify":
            result = verify(apply_plan(args.style, load_mapping(args.mapping)),
                            _read_lines(args.available))
            if result["ok"]:
                print(f'ok: {result["present"]}/{result["total"]} icons present')
                return 0
            print(f'missing {len(result["missing"])} icon(s): '
                  + " ".join(result["missing"]), file=sys.stderr)
            return 1
        return 0
    except (StyleError, OSError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


# --------------------------------------------------------------------------- #
#  Tests (pure plan/verify layer; filesystem use limited to tempfile)
# --------------------------------------------------------------------------- #
def self_test() -> None:
    mapping = load_mapping()
    assert mapping[".odt"] == "libreoffice-writer"
    assert mapping[".xlsx"] == "libreoffice-calc"
    assert mapping[".odp"] == "libreoffice-impress"
    assert mapping[".odb"] == "libreoffice-base"

    plan = apply_plan("mint")
    assert plan == sorted(plan, key=lambda e: e["ext"])      # deterministic
    assert all(e["theme"] == "libreoffice-mint" for e in plan)
    assert plan[0]["file"].endswith(".svg")
    # identical plans for identical inputs (pure function)
    assert apply_plan("mint") == apply_plan("mint")
    assert apply_plan("breeze")[0]["theme"] == "libreoffice-breeze"
    try:
        apply_plan("skeuomorphic")
    except StyleError:
        pass
    else:
        raise AssertionError("unknown style not rejected")
    try:
        apply_plan("mint", {})
    except StyleError:
        pass
    else:
        raise AssertionError("empty mapping not rejected")
    try:
        apply_plan("mint", {".odt": "Bad Icon!"})
    except StyleError:
        pass
    else:
        raise AssertionError("bad icon name not rejected")

    need = icons("mint")
    assert need == sorted(need) and "libreoffice-writer.svg" in need
    assert "libreoffice-calc.svg" in need and "libreoffice-impress.svg" in need

    full = verify(plan, need)
    assert full["ok"] is True and full["missing"] == [] and full["total"] == len(plan)
    partial = verify(plan, need[:-2] + ["unrelated.svg"])
    assert partial["ok"] is False and len(partial["missing"]) >= 1
    assert partial["missing"] == sorted(partial["missing"])
    try:
        verify([], set())
    except StyleError:
        pass
    else:
        raise AssertionError("empty plan not rejected")

    import tempfile
    with tempfile.TemporaryDirectory() as d:
        mf = os.path.join(d, "map.txt")
        with open(mf, "w", encoding="utf-8") as fh:
            fh.write("# comment\n.odt=custom-writer\n.XLSX=custom-calc\n")
        custom = load_mapping(mf)
        assert custom == {".odt": "custom-writer", ".xlsx": "custom-calc"}, custom
        bad_map = os.path.join(d, "bad.txt")
        for body in ("odt=no-dot\n", ".odt=x\n.odt=y\n", "=\n", "\n"):
            with open(bad_map, "w", encoding="utf-8") as fh:
                fh.write(body)
            try:
                load_mapping(bad_map)
            except StyleError:
                pass
            else:
                raise AssertionError(f"bad mapping file not rejected: {body!r}")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

# SigmaOS-office

This repository contains Python modules for document, spreadsheet,
presentation, ODF/OOXML, and office-application bridge workflows. The presence
of modules named for OpenOffice, LibreOffice, OnlyOffice, or CraftOffice does
not establish compatibility with those applications. Verify each bridge,
format round trip, and licensing boundary independently before describing a
complete office suite.

## Development

Use the repository Makefile for supported checks:

```bash
make build
make test
```

Keep application integration optional, reproducible, and isolated from the
boot-critical system. Track compatibility and licensing decisions explicitly.

# Complete Spanish Grammar — Interactive Learning PWA

An Android-friendly, browser-only learning app built from *Complete Spanish
Grammar* (Practice Makes Perfect, Gilda Nissenberg). Read theory → answer
exercises → check answers → understand why → try again → progress is saved.

Runtime stack: **HTML + CSS + JavaScript + Dexie.js + IndexedDB**, hosted on
**GitHub Pages**. Python is used only locally, one time, to extract content.

## Docs

- `AGENTS.md` — operating rules for all coding agents.
- `stepbystep.md` — the implementation roadmap.
- `PLAYBOOK.md` — how to replicate this project for another book.
- `docs/deployment.md` — GitHub Pages deployment runbook.

## Structure

- `source/` — the original EPUB files (immutable; git-ignored, local only).
- `tools/` — local Python extraction scripts (development-time only).
- `data/` — prepared content (imported into IndexedDB).
- App files at repo root (`index.html`, `css/`, `js/`).

## Status

See `stepbystep.md`.

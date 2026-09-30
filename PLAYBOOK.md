# PLAYBOOK — Replicate this project for another book

A step-by-step recipe to turn **any EPUB-based learning book** into the same
kind of app: an Android-friendly, browser-only PWA with theory, interactive
exercises, answer checking, "try again", and persistent progress — hosted on
GitHub Pages with Dexie.js/IndexedDB.

This playbook produces the three planning deliverables **in one pass**:

1. `AGENTS.md` — permanent operating rules.
2. `stepbystep.md` — the phased roadmap.
3. An **approval-ready implementation plan**.

> Rule of thumb: plan first, get human approval, then build. Never start coding
> before the human approves the step.

---

## 1. What you need

- One or more EPUB copies of the book (a text EPUB and/or the publisher's EPUB).
- Local Python 3 (development-time extraction only — not part of the runtime).
- A Git repo (create one if absent) and a GitHub account for Pages hosting.
- (Target runtime stays: HTML + CSS + JS + Dexie.js + IndexedDB.)

---

## 2. Phase A — Inspect the source (never assume)

1. List the working directory; find every `.epub`/`.pdf`/`.zip`.
2. Open each EPUB as a ZIP (`zipfile` in Python, or unzip); list entries + sizes.
3. Classify each EPUB:
   - **Text EPUB** — selectable text, often Calibre/PDF-reflow with generic
     `calibre*` classes and reflow artifacts.
   - **Official/publisher EPUB** — semantic HTML (real `h2/h3/...`, named
     classes) + page images; may include question↔answer anchor links.
   - **Image-only EPUB** — page scans with no text layer (OCR territory).
4. Read the TOC/nav (`.ncx`, `nav`, or `contents.html`) to map the hierarchy:
   Part → Chapter → Section → Subsection.
5. Read 2–3 sample chapter files **and** the answer-key file.
6. Identify **semantic markers** (heading classes; exercise/question/answer
   classes and IDs). These become the parser targets.
7. Measure scale with regex counts, e.g. chapters (`ch\d+\.html`), exercises
   (`id="ch\d+exe\d+"`), questions (`id="ch\d+qa\d+"`), answers
   (`id="ch\d+qar\d+"`).
8. Note what is text vs what is image (tables, conjugation charts, vocab lists).

---

## 3. Phase B — Decide (answer before planning)

1. **Primary source** — which EPUB has the best machine-readable structure and
   complete answers?
2. **Secondary source** — which EPUB fills the gaps (e.g. tables rendered as
   images in the primary)?
3. **Table/image handling** — recover as text / OCR / show images / manual
   transcription / flag-for-review?
4. **Dependency delivery** — vendor locally (offline-first) vs CDN?
5. **Open-ended content** — include as self-checked / skip?
6. **Repo layout & hosting** — app at repo root vs `/docs`; source files
   git-ignored?

Record every decision; they drive the templates below.

---

## 4. Phase C — Design (the four models)

1. **Data model** — content tables (immutable, imported) vs learner tables
   (mutable, user-generated). Store canonical answers separately from user
   attempts.
2. **App architecture** — SPA, hash-based routing (GitHub Pages safe), mobile
   layout with a theory panel (desktop sidebar / mobile bottom sheet).
3. **Progression** — one atomic "question progress" row; derive exercise /
   section / chapter / overall stats by query. "Continue where you left off"
   stored in a key-value `meta` table.
4. **Theory ↔ exercise links** — `Exercise → Section → TheoryBlocks`, with a
   "follow exercise" toggle; store the relationship in data, never guess at
   runtime.

---

## 5. Phase D — Write `AGENTS.md`

Use this template (replace `{{...}}` placeholders):

```markdown
# AGENTS.md — Operating Rules

Permanent rules for every coding agent working in this repository.

## 1. Project summary
Build a {{DESCRIPTION}}. Runtime stack is HTML + CSS + JavaScript + Dexie.js +
IndexedDB only, hosted on GitHub Pages. Python is only a one-time local
extraction tool and is never part of the runtime.

## 2. Mandatory workflow
### Before work
1. Read AGENTS.md. 2. Read stepbystep.md. 3. Inspect Git. 4. Identify the
current step.
### Before implementation (hard gate)
1. Present the step (STEP X — Name, Goal, Why, Files, Work, Risks, Tests,
Acceptance criteria). 2. Ask "Approve this step?" and STOP. 3. Implement only
after approval. 4. Create a Git checkpoint first.
### After implementation
1. Run tests. 2. Report changes/results/problems. 3. Provide a manual
self-check (see §9). 4. Ask "Do you approve marking this step complete?" and
STOP. 5. Only after approval: update stepbystep.md, mark complete, update
AGENTS.md if rules changed, commit.

## 3. Source data rules
- EPUBs are immutable. Primary source: {{PRIMARY_EPUB}}. Secondary:
  {{SECONDARY_EPUB}}.
- Python is local-only. Generated data lives in a separate folder and is
  distinguishable from source. Never invent answers (mark freeform/noAnswer).
  Flag uncertain relationships for review.

## 4. Scope rules
Do not build (unless requested): search, book mode, dashboard, import/export,
generic answer engine, Python runtime, backend, spaced repetition, AI, audio,
flashcards. No unapproved features; no destructive operations.

## 5. Data-model rules
Dexie.js + IndexedDB. Canonical answers separate from attempts. Versioned
migrations. Import content only if version is absent/stale. Don't load the whole
book into the DOM.

## 6. Deployment rules
GitHub Pages: relative paths, correct service-worker scope + manifest paths,
hash-based nav. No Python at runtime. Progress persists across reloads.
Mobile-first + accessible.

## 7. Answer-checking rules
Only the interactions the book actually uses. Normalize whitespace/case (where
safe); never strip accents. Support multiple accepted answers. Preserve attempt
history.

## 8. Approval & communication
Human approval required before every step and before marking complete.

## 9. Verification for the human
Every step-complete report must include a self-check: what to run/open, what to
do, what to see, how to roll back.
```

---

## 6. Phase E — Write `stepbystep.md`

Use this template (adjust phase/step names to your book and decisions):

```markdown
# stepbystep.md — Implementation Roadmap

Status legend: [ ] not started · [~] in progress · [x] complete

## Key inspection findings
(Record the EPUB comparison + scale counts here.)

## Phase 1 — Project & EPUB analysis
- **Step 1.1 — Scaffold repo**: git init, .gitignore, move EPUBs to source/,
  initial commit. Rollback: delete repo, restore EPUBs.
- **Step 1.2 — Extraction analysis doc**: freeze conclusions in docs/.

## Phase 2 — Local Python extraction
- **Step 2.1 — Structure + theory parser**: parse TOC + chapters → structure.
- **Step 2.2 — Exercises + questions + answers parser**: join via anchor IDs.
- **Step 2.3 — Table recovery**: recover image-table text or flag for review.
- **Step 2.4 — Prepare final data**: data/book.json + content-version + report.

## Phase 3 — Data model & Dexie foundation
- **Step 3.1 — Dexie schema + DB module**.
- **Step 3.2 — One-time import** (idempotent).

## Phase 4 — Basic mobile UI
- **Step 4.1 — App shell + mobile CSS**. - **Step 4.2 — Render theory**.
- **Step 4.3 — Render exercises/questions**.

## Phase 5 — Breadcrumb & navigation
- **Step 5.1 — Breadcrumbs + prev/next**.

## Phase 6 — Answer checking
- **Step 6.1 — Normalization + checking**.

## Phase 7 — Try Again / hints / "Why?"
- **Step 7.1 — Feedback + Try Again**.

## Phase 8 — Theory ↔ exercise sync
- **Step 8.1 — Auto theory following + highlight + follow toggle**.

## Phase 9 — Progress tracking
- **Step 9.1 — Progress recording + aggregates + continue-where-left-off**.

## Phase 10 — Review mistakes
- **Step 10.1 — Review list**.

## Phase 11 — PWA / offline / Android
- **Step 11.1 — Manifest + service worker + vendored deps**.

## Phase 12 — GitHub Pages deployment
- **Step 12.1 — Deploy & verify**.

## Phase 13 — Final testing & polish
- **Step 13.1 — Content QA, accessibility, performance**.
```

---

## 7. Phase F — Present the plan & get approval

Present to the human, in this order:

1. Inspection findings (EPUB comparison).
2. Source choice + the 6 decisions.
3. Extraction approach.
4. Data model / Dexie schema.
5. App architecture / progression / theory↔exercise.
6. Roadmap summary.
7. Ask: **"Approve the first implementation step?"** and STOP.

Build nothing until the human approves the first step.


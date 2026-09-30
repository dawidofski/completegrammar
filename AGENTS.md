# AGENTS.md — Operating Rules

Permanent rules for every coding agent (human or AI) working in this repository.
Read this file **before doing anything else** in the project.

---

## 1. Project summary

Build an **Android-friendly, browser-only PWA** ("Complete Spanish Grammar" —
Practice Makes Perfect, Gilda Nissenberg) that turns the book into an
interactive learning environment: read theory → answer exercises → check
answers → understand why → try again → progress is saved. Runtime stack is
**HTML + CSS + JavaScript + Dexie.js + IndexedDB** only. It is hosted on
**GitHub Pages** and used mainly from an Android phone.

Python is **only** a one-time, local, development-time content-extraction tool.
It is **never** part of the runtime.

---

## 2. Mandatory workflow (every step)

### Before work
1. Read `AGENTS.md` (this file).
2. Read `stepbystep.md`.
3. Inspect Git (`git status`, current branch, recent log). The repo may not
   exist yet — if so, the first implementation step must create it.
4. Identify the current step in `stepbystep.md` (the first `[ ]` item).

### Before implementation (hard gate)
1. Present the step in the format: **STEP X — Name**, Goal, Why, Files affected,
   What I will do, Risks, Tests, Acceptance criteria.
2. Ask **"Approve this step?"** and **STOP**.
3. Do **not** implement until the human explicitly approves.
4. Before writing code, create a Git checkpoint (commit) of current known-good
   state.

### After implementation
1. Run the tests.
2. Report: what changed, test results, remaining problems.
3. Provide a **manual self-check** (see §9) so the human can independently
   confirm the result — concrete "open X, click Y, expect Z".
4. Ask **"Do you approve marking this step complete?"** and **STOP**.
5. Only after approval: update `stepbystep.md`, mark the step complete, update
   `AGENTS.md` if the rules changed, and create the completion Git commit.

**A step is NOT complete merely because code was written.**

---

## 3. Source data rules (hard)

- The two EPUB files are **immutable source**. Never edit them in place.
- Primary source: the **Premium Fourth Edition (2020)** EPUB
  (`Complete Spanish Grammar (Practice Makes Perfect), 4th …` — the official
  McGraw-Hill EPUB: semantic HTML + an answer key with exercise links).
- Secondary source: the **Premium Third Edition (2016)** EPUB
  (`Practice Makes Perfect_ Complete Spanish Grammar, Premium …` — Adobe-style
  `part####` split; used to recover table content that the primary renders as
  images).
- Python is **local-only**. The deployed app must not reference Python.
- Generated/prepared data must live in a clearly separated location (e.g.
  `data/`) and be **distinguishable** from source (e.g. `data/*.json`).
- **Never invent answers.** If a question has no canonical answer (e.g.
  "Answers will vary", reading comprehension, oral practice), mark it
  explicitly as `freeform`/`noAnswer` — never fabricate one.
- Where a relationship (e.g. exercise→theory, item→answer) is uncertain, **flag
  for review** rather than guessing.

---

## 4. Scope rules (hard)

Do **not** build, unless explicitly requested later:
Book Mode, Chapter Dashboard, Search, user import/export, a generic answer
engine, a Python runtime, an image-verification system, cloud backend, server
database, spaced repetition, AI, audio, or flashcards.

No unapproved features. No silent architecture changes. No destructive
operations (no `git reset`, no deleting uncommitted work, no destructive DB
migration without backup + approval).

---

## 5. Data-model / database rules

- Dexie.js with IndexedDB. Store canonical answers **separately** from user
  attempts; never overwrite the canonical answer.
- Use Dexie versioning. A schema change = new version + migration + test +
  approval. Never casually destroy the local DB during development.
- On app start, import prepared content only if the stored content-version is
  absent or stale (never re-import/duplicate on every load).
- Do not load the whole book into the DOM at once; use indexed queries.

---

## 6. Deployment / runtime rules

- Final app must work from GitHub Pages: use relative paths, correct service
  worker scope and manifest paths, and no server routing (hash-based nav).
- Runtime must **not** require Python.
- Dexie.js/IndexedDB must persist learner data across reloads.
- Mobile-first: large touch targets, readable type, responsive, no horizontal
  scroll, clear feedback, accessible semantics.

---

## 7. Answer-checking rules

- Only support the interactions this book actually uses: fill-in-the-blank
  (conjugation / single word), short text answers, translation, true/false
  (V/F), and choose-from-list (vocabulary). No generic answer engine.
- Normalize surrounding whitespace and (where safe) case. **Never** strip
  Spanish accents automatically — doing so could mark a wrong answer correct.
- Support multiple accepted answers (the source uses " OR " / "or" / " / ").
- Preserve attempt history; "Try Again" must not destroy the canonical answer.
- The answer key joins answers to questions by **exercise ID + positional
  order** (not per-question IDs); the parser must validate counts per exercise.

---

## 8. Approval & communication

- Human approval is required before every implementation step and before any
  step is marked complete. Always ask; never assume.
- If a decision is ambiguous, ask rather than guessing. Offer concrete options.

---

## 9. Verification for the human (required after every step)

Every "step complete" report must include a **self-check** the human can run
without trusting the agent's word. For each step, provide:

- **What to run / open** (exact command, file, or URL).
- **What to do** (concrete clicks/inputs).
- **What you should see** (the observable expected result).
- **How to roll back** if it's wrong.

Examples:

- "Open `index.html` in Chrome, tap the exercise, type `vive`, tap Check — you
  should see a green ✓."
- "Run `python tools/extract_structure.py`, then open
  `data/raw/structure.json` — it must list 26 chapters and 175 sections."


# stepbystep.md — Implementation Roadmap

Status legend: `[ ]` not started · `[~]` in progress · `[x]` complete

---

## Key inspection findings (drives everything below)

- **Two EPUBs** (both *Complete Spanish Grammar*, Practice Makes Perfect, Gilda
  Nissenberg):
  - `Complete Spanish Grammar (Practice Makes Perfect), 4th … 2020 … isbn13
    9781260463156 … .epub` (29.4 MB) = the **official McGraw-Hill EPUB**
    (Premium Fourth Edition):
    - Flat **26 chapters** (`ch1..ch26.xhtml`) — **no parts**.
    - Chapter (`h2.h2c` number + `h2.h2c1` title) → Section (`h3.h3`,
      `id=sec{N}_{M}`, 175) → Subsection (`h4.h4`, 46).
    - Theory: `p.noindent` (body), `p.squ` (bullets), `p.squn` (note),
      `p.images` + `<img>` (charts/tables as images — 726 refs / 1292 jpg).
    - Exercises: `div.box` (`id=exe{N}-{M}`, 373) with instruction
      (`p.noindente`) and numbered items (`p.number` / `p.numberh` /
      `p.number1`) carrying `___` blanks / hint words.
    - Answer key `ans.xhtml`: `p.ansch` (26 chapter headers), `p.ans`
      (`id=exe{N}_{M}`, 373 exercise blocks), `p.ak` (2042 answer lines),
      `p.ak1` (135), `p.underline` (34).
  - `Practice Makes Perfect_ Complete Spanish Grammar, Premium … 2016 … isbn13
    9781259584190 … .epub` (62.2 MB) = **Premium Third Edition** (Adobe-style
    `Text/part0000..0037.xhtml` split, 1295 jpeg).
- **Conclusion:** primary source = 4th-edition EPUB (structure + theory +
  exercises + answer key). Secondary source = Premium 3rd edition (recover
  table-like content that the primary stores as images).
- **Critical difference vs the Step-by-Step book:** answers are joined by
  **exercise ID + positional order** (the Nth numbered item in an exercise maps
  to the Nth answer line), not by per-question anchor IDs. The parser must
  validate item↔answer counts per exercise and flag mismatches.

---

## Phase 1 — Project & EPUB analysis  `[x]`

- [x] **Step 1.1 — Scaffold the repo**
  - Objective: create the project skeleton and version control in `Spanish2/`.
  - Prereqs: none.
  - Files: `.gitignore`, `README.md`, `AGENTS.md`, `stepbystep.md`,
    `PLAYBOOK.md`, directory layout (`source/`, `tools/`, `data/`, `docs/`,
    `css/`, `js/`).
  - Work: `git init`, `.gitignore`, move EPUBs into `source/`, initial commit.
  - Tests: `git status` clean; EPUBs intact in `source/`.
  - Acceptance: repo exists with a clean initial commit; EPUBs immutable in
    `source/` (not committed).
  - Rollback: delete `.git`, restore EPUBs to root, delete added files.

- [x] **Step 1.2 — Document extraction analysis**
  - Objective: freeze inspection conclusions as the source-of-truth for
    extraction.
  - Files: `docs/extraction-analysis.md`.
  - Work: record EPUB comparison, semantic class map, exercise/answer join
    scheme, scale numbers (26 chapters / 175 sections / 373 exercises / ~2196
    numbered items / 2042 answer lines), and image-table inventory.
  - Acceptance: a reviewer can implement extraction from this doc.

---

## Phase 2 — Local Python extraction  `[x]`

- [x] **Step 2.1 — Parser: structure + theory**
  - Objective: parse the official EPUB → chapters, sections, subsections,
    theory blocks.
  - Files: `tools/extract_structure.py`, `tools/epub_reader.py`.
  - Work: parse `nav.xhtml`/`contents.xhtml` + `ch*.xhtml`; emit
    `data/raw/structure.json` (no parts).
  - Tests: assert 26 chapters, 175 sections; sample spot-check.
  - Acceptance: structure JSON matches the TOC hierarchy.

- [x] **Step 2.2 — Parser: exercises, questions, answers (positional join)**
  - Objective: extract exercises (`div.box`), numbered items (questions), and
    answer-key answers, joining by exercise ID + position.
  - Files: `tools/extract_exercises.py`.
  - Work: parse `ch*.xhtml` + `ans.xhtml`; join `exe{N}-{M}` ↔ `exe{N}_{M}`;
    map Nth `p.number` item ↔ Nth answer line; classify question type from the
    instruction; emit `data/raw/exercises.json`, `data/raw/answers.json`.
  - Tests: assert 373 exercises; every exercise resolves to an answer block;
    per-exercise item↔answer count matches; count "Answers will vary"/V-F/
    translation/vocab.
  - Acceptance: canonical answers stored separately; freeform questions flagged.

- [x] **Step 2.3 — Table recovery (cross-EPUB)**
  - Objective: for image tables (conjugation charts/vocab), recover text from
    the Premium EPUB or mark for manual review.
  - Files: `tools/recover_tables.py`.
  - Work: detect `p.images`/`img` blocks; extract images to `data/tables/`;
    emit `data/review/tables.md` + `data/raw/tables.json`.
  - Acceptance: every image-table has either recovered text or a review flag.

- [x] **Step 2.4 — Prepare final data + validation report**
  - Objective: produce clean `data/book.json` with a content-version id and a
    validation report.
  - Files: `tools/prepare_data.py`, `data/*.json`.
  - Tests: validate counts, integrity (no dangling refs), encoding (UTF-8,
    Spanish accents intact), and a sample spot-check against the book.
  - Acceptance: `data/book.json` is import-ready; report lists needs-review
    items.

---

## Phase 3 — Data model & Dexie foundation  `[x]`

- [x] **Step 3.1 — Dexie schema + DB module**
  - Objective: implement schema v1 (no `parts` table — the book is flat) and
    the DB access layer.
  - Files: `js/db.js`.
  - Work: Dexie stores (chapters, sections, theoryBlocks, exercises, questions,
    answers, questionProgress, reviewItems, meta); helper queries.
  - Acceptance: schema matches the data model; versioned.

- [x] **Step 3.2 — One-time content import**
  - Objective: load `data/book.json` into IndexedDB idempotently.
  - Files: `js/import.js`.
  - Acceptance: no duplication across reloads.

---

## Phase 4 — Basic mobile UI  `[x]`

- [x] **Step 4.1 — App shell + mobile-first CSS**
  - Files: `index.html`, `css/app.css`, `js/app.js`.
- [x] **Step 4.2 — Render theory**
  - Files: `js/theory.js`.
- [x] **Step 4.3 — Render exercises & questions**
  - Files: `js/exercises.js`.

---

## Phase 5 — Breadcrumb & navigation  `[x]`

- [x] **Step 5.1 — Breadcrumb navigation + prev/next**
  - Files: `js/nav.js`.

---

## Phase 6 — Answer checking  `[x]`

- [x] **Step 6.1 — Answer normalization & checking**
  - Files: `js/answer.js`.

---

## Phase 7 — Try Again / hints / "Why?"  `[x]`

- [x] **Step 7.1 — Feedback + Try Again**
  - Files: `js/feedback.js`.

---

## Phase 8 — Theory ↔ exercise sync  `[x]`

- [x] **Step 8.1 — Automatic theory following + highlight**
  - Files: `js/theorySync.js` (or folded into `js/theory.js`).

---

## Phase 9 — Progress tracking  `[x]`

- [x] **Step 9.1 — Progress recording & aggregates**
  - Files: `js/progress.js`.

---

## Phase 10 — Review mistakes  `[x]`

- [x] **Step 10.1 — Review list**
  - Files: `js/review.js`.

---

## Phase 11 — PWA / offline / Android  `[ ]` *(skip — online-only)*

- [ ] **Step 11.1 — Manifest + service worker + offline** *(skipped — online-only)*

---

## Phase 12 — GitHub Pages deployment  `[ ]`

- [ ] **Step 12.1 — Deploy & verify**

---

## Phase 13 — Final testing & polish  `[ ]`

- [ ] **Step 13.1 — Content QA, accessibility, performance**


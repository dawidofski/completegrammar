# Extraction Analysis — Complete Spanish Grammar

Authoritative spec for the Python extraction (Phase 2) and the data model
(Phase 3). Anyone can build the parser from this document alone.

## 1. Purpose

Document the two source EPUBs, the chosen strategy, the semantic markup to
parse, the exercise↔answer join scheme, the scale of content, and every special
case the parser must handle.

## 2. Source EPUBs

| File | Size | Nature | Role |
|---|---|---|---|
| `Complete Spanish Grammar (Practice Makes Perfect), 4th … 9781260463156 … .epub` | 29.4 MB | **Official McGraw-Hill EPUB** (Premium Fourth Edition). Semantic HTML + answer key with exercise links. | **Primary** |
| `Practice Makes Perfect_ Complete Spanish Grammar, Premium … 9781259584190 … .epub` | 62.2 MB | Premium Third Edition, Adobe-style `Text/part0000..0037.xhtml` split. | **Secondary** |

Why the 4th-edition EPUB is primary: real heading hierarchy (`h2/h3/h4`), named
CSS classes for every element, and an answer key (`ans.xhtml`) that links every
answer block back to its exercise (`href="ch1.xhtml#exe1-1"`).

The Premium 3rd-edition EPUB is secondary: the same content in different
packaging (`part####` split) — used to recover table text that the primary
renders as images.

## 3. Strategy

1. Parse the **4th-edition EPUB** for structure, theory, exercises, questions,
   and answers.
2. Use the **Premium EPUB** to recover text for table-like content rendered as
   images; flag anything unrecoverable for review.
3. Emit one import-ready `data/book.json` with a content-version id.

## 4. Book hierarchy

```
Book
  └── Chapter (26)          ch1..26.xhtml   h2.h2c (number) + h2.h2c1 (title)
       └── Section (175)    h3.h3   id=sec{N}_{M}
            └── Subsection (46)   h4.h4   (no id)
```

There are **no parts** — a flat 26-chapter book (unlike the Step-by-Step book,
which had 6 parts).

Other files: `contents.xhtml` (TOC), `nav.xhtml` (EPUB3 nav), `intro.xhtml`,
`verb.xhtml` (verb tables), `gloss1.xhtml`/`gloss2.xhtml` (glossaries),
`ans.xhtml` (answer key), `cover.xhtml`, `title.xhtml`, `copy.xhtml`.

## 5. Semantic class map (parser targets)

### Structure
| Class | Meaning | ID |
|---|---|---|
| `h2.h2c` | Chapter number | `ch{N}` |
| `h2.h2c1` | Chapter title | — |
| `h3.h3` | Section heading | `sec{N}_{M}` |
| `h4.h4` | Subsection heading | (none) |

### Theory
| Class | Meaning |
|---|---|
| `p.noindent`, `p.indent`, `p.noindent1`, `p.noindentt`, `p.indentt` | body paragraph |
| `p.squ` | theory bullet (prefixed by an `img.inline` marker) |
| `p.squn`, `p.squnn`, `p.squ1` | note box ("Keep in mind…") |
| `p.images` + `img` | content image (table/chart) → `Image_*.jpg` |

### Exercises & questions
| Class | Meaning | Count |
|---|---|---|
| `div.box` | exercise container | 424 |
| `hr.hr1` | exercise separator | 424 |
| `p.image-e` | exercise image (`N-M.jpg`) | 424 |
| `p.noindente` | exercise instruction | 425 |
| `p.exorder` | exercise-order marker | 332 |
| `p.exvoca` | vocabulary exercise (word bank) | 39 |
| `p.number` | numbered question item | 2,196 |
| `p.numberh` | numbered translation item | 478 |
| `p.number1` | numbered item variant | 129 |
| `p.numbera` | numbered item variant | 10 |
| `underline` | underlined blank marker | 108 |

### Answer key (`ans.xhtml`)
| Class | Meaning | Count |
|---|---|---|
| `h2.h2a` | "Answer key" heading | 1 |
| `p.ansch` | chapter header | 26 |
| `p.ans` | exercise answer block | 373 |
| `p.ak` | answer line | 2,042 |
| `p.ak1` | answer-line variant | 135 |
| `p.underline` | underlined answer | 34 |
| `p.akb` | answer-line variant | 2 |

## 6. Exercise↔answer join scheme

- Chapter exercises carry `id="exe{N}-{M}"` (hyphen), e.g. `exe1-1`.
- The answer key links back with `<a href="ch1.xhtml#exe1-1" id="exe1_1">1·1</a>`
  (underscore in the id, hyphen in the href target).
- **There are no per-question anchor IDs.** Within an answer block the answers
  are positional:
  - `p.ans` text = `"1·1  1. <first answer>"` (exercise label + answer #1).
  - following `p.ak` lines = `"2. <answer>"`, `"3. <answer>"`, …
- So the Nth `p.number`/`p.numberh`/`p.number1`/`p.numbera` item in an exercise
  maps to the Nth answer line. The parser **must** validate item↔answer counts
  per exercise and flag mismatches.

## 7. Scale (4th-edition EPUB)

| Item | Count |
|---|---|
| Chapters | 26 |
| Sections (`sec{N}_{M}`) | 175 |
| Subsections (`h4.h4`) | 46 |
| Exercises (`exe{N}-{M}`) | 373 |
| Answer blocks (`p.ans`, `exe{N}_{M}`) | 373 |
| Numbered items (`p.number` / `numberh` / `number1` / `numbera`) | 2,196 / 478 / 129 / 10 |
| Answer lines (`p.ak`) | 2,042 |
| Answer-line variants (`p.ak1`) | 135 |
| Theory bullets (`p.squ`) | 485 |
| Note boxes (`p.squn` / `squnn` / `squ1`) | 142 / 12 / 2 |
| Table images (`p.images`) | 726 |
| jpg files | 1,292 |

## 8. Answer-key special cases

1. **Multiple accepted answers** — `p.ak` lines like `"… al reportero / a la
   reportera."` (slash = alternatives) → store as an array.
2. **True/false** — answers are `V` / `F`.
3. **Translation** — answer is the full translated sentence (e.g.
   `"1. Yo preparo la cena."`).
4. **Fill-in-the-blank** — answer is just the word (e.g. `"1. vive"`).
5. **"Answers will vary" / self-check** — mark `freeform`, never fabricate.
6. **Non-contiguous exercise numbering** — `exe1-3`, `exe1-5`, `exe1-8` are
   absent; the parser must not assume contiguity.
7. **Vocabulary (`exvoca`)** — word-bank / choose-from-list exercises.

## 9. Image-table inventory & recovery

- 726 `p.images` blocks reference table/chart images (`Image_*.jpg` in `OEBPS/`,
  1,292 jpg total — also `ch{N}.jpg` chapter images, `N-M.jpg` exercise images,
  and decorative `square.jpg` bullets).
- Recovery strategy (Step 2.3): extract referenced jpgs into `data/tables/` as
  a display fallback; build `data/raw/tables.json`; emit `data/review/tables.md`
  flagging tables for manual/OCR transcription, with the Premium EPUB text in
  `data/raw/reflow_text.json` as reference.
- Decorative icons (`square.jpg`, `img.inline`) must be ignored.

## 10. Extraction rules (non-negotiable)

- Preserve ordering and hierarchy exactly (Chapter → Section → Exercise →
  Question → Answer).
- Preserve Spanish accents and UTF-8 encoding intact.
- Store canonical answers separately from anything user-facing/mutable.
- **Never invent answers**; mark `freeform`/`noAnswer` explicitly.
- Where a relationship (item↔answer, exercise→section, image→table text) is
  uncertain, **flag for review** rather than guessing.

## 11. Flagged-for-review / risks

- **Positional answer join** is the main risk: ~2,813 numbered items vs ~2,586
  answer entries (373 first-answers + 2,042 `ak` + 135 `ak1` + 34 `underline` +
  2 `akb`) — some items are ungraded/self-checked and must be reconciled
  per-exercise.
- **Non-contiguous exercise IDs** (gaps like `exe1-3`).
- **Image→text mapping** may be incomplete; unresolved items go to
  `data/review/`.
- Some `h4` subsection headings have no `id`.
- EPUB metadata declares `dc:language = en` (correct); verify — this is the
  expected case (unlike the Step-by-Step book's bogus `zh` quirk).


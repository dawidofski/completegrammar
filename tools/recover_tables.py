"""Step 2.3 — Recover image-based theory tables + question images.

1. Extract the table images (Image_*.jpg) referenced by theory blocks and the
   question images (N-M.jpg) for image-based exercises into data/tables/.
2. Build data/raw/tables.json inventory.
3. Emit data/review/tables.md flagging tables for manual text transcription.
4. Dump the Premium EPUB's chapter text as a transcription reference.

Usage:  python tools/recover_tables.py
"""
from __future__ import annotations

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from epub_reader import EpubReader, find_epubs, primary_epub  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.path.join(REPO_ROOT, "source")
RAW_DIR = os.path.join(REPO_ROOT, "data", "raw")
TABLES_DIR = os.path.join(REPO_ROOT, "data", "tables")
REVIEW_DIR = os.path.join(REPO_ROOT, "data", "review")


def text_of(el) -> str:
    return re.sub(r"\s+", " ", "".join(el.itertext())).strip()


def main() -> None:
    primary = primary_epub(SOURCE_DIR)
    secondary = next((p for p in find_epubs(SOURCE_DIR) if p != primary), None)

    with open(os.path.join(RAW_DIR, "structure.json"), encoding="utf-8") as f:
        structure = json.load(f)
    with open(os.path.join(RAW_DIR, "exercises.json"), encoding="utf-8") as f:
        exercises = json.load(f)

    sections = {s["id"]: s for s in structure["sections"]}
    chapters = {c["id"]: c for c in structure["chapters"]}

    table_blocks = [b for b in structure["theoryBlocks"] if b["type"] == "table" and b.get("src")]
    table_srcs = sorted({b["src"] for b in table_blocks})
    # Image-based questions (placeholder questions have empty prompt + imageSrc)
    q_srcs = sorted({q["imageSrc"] for q in exercises["questions"]
                     if q.get("imageSrc") and not q.get("prompt")})
    all_srcs = sorted(set(table_srcs) | set(q_srcs))

    # 1) extract images from OEBPS/
    os.makedirs(TABLES_DIR, exist_ok=True)
    missing = []
    with EpubReader(primary) as epub:
        names = set(epub.names())
        for src in all_srcs:
            entry = "OEBPS/" + src
            if entry in names:
                data = epub.read_bytes(entry)
                with open(os.path.join(TABLES_DIR, src), "wb") as f:
                    f.write(data)
            else:
                missing.append(src)

    # 2) inventory
    tables = []
    for b in table_blocks:
        sec = sections.get(b.get("sectionId")) or {}
        tables.append({
            "id": b["id"],
            "chapterId": b["chapterId"],
            "sectionId": b.get("sectionId"),
            "sectionTitle": sec.get("title"),
            "order": b["order"],
            "src": b["src"],
            "recoveredText": None,
            "confidence": None,
        })

    os.makedirs(RAW_DIR, exist_ok=True)
    with open(os.path.join(RAW_DIR, "tables.json"), "w", encoding="utf-8") as f:
        json.dump({
            "meta": {"contentVersion": structure["meta"]["contentVersion"]},
            "tables": tables,
            "questionImages": q_srcs,
            "summary": {
                "tables": len(tables),
                "questionImages": len(q_srcs),
                "extracted": len(all_srcs) - len(missing),
            },
        }, f, ensure_ascii=False, indent=2)

    # 3) review list
    os.makedirs(REVIEW_DIR, exist_ok=True)
    by_chapter = {}
    for t in tables:
        by_chapter.setdefault(t["chapterId"], []).append(t)
    lines = [
        "# Tables needing text transcription (review)",
        "",
        f"Total: {len(tables)} theory tables rendered as images. Displayed as",
        "images until transcribed. Each entry lists the image + section.",
        "Reference text is in data/raw/reflow_text.json.",
        "",
    ]
    for ch_id in sorted(by_chapter, key=lambda x: int(re.search(r"\d+", x).group())):
        ch = chapters.get(ch_id) or {}
        lines.append(f"## {ch.get('number', '?')} — {ch.get('title', ch_id)}")
        for t in by_chapter[ch_id]:
            sec = t.get("sectionTitle") or "(no section)"
            lines.append(f"- `{t['src']}` — {sec}")
        lines.append("")
    with open(os.path.join(REVIEW_DIR, "tables.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    # 4) Premium EPUB text dump (transcription reference)
    reflow = {}
    if secondary:
        with EpubReader(secondary) as epub:
            part_names = [n for n in epub.names()
                          if re.search(r"part\d+\.xhtml$", n, re.I)]
            part_names.sort(key=lambda n: int(re.search(r"(\d+)", n).group(1))
                            if re.search(r"(\d+)", n) else 0)
            for n in part_names:
                raw = epub.read(n)
                if len(raw) < 2000:
                    continue
                root = epub.parse_xhtml(n)
                body = root.find("body")
                reflow[n] = text_of(body) if body is not None else ""
        with open(os.path.join(RAW_DIR, "reflow_text.json"), "w", encoding="utf-8") as f:
            json.dump(reflow, f, ensure_ascii=False, indent=2)

    print(f"tableBlocks={len(table_blocks)} tableSrcs={len(table_srcs)} "
          f"questionSrcs={len(q_srcs)}")
    print(f"extracted={len(all_srcs) - len(missing)} missing={len(missing)} "
          f"reflowFiles={len(reflow)}")
    for m in missing[:20]:
        print("   MISSING:", m)

    assert len(missing) == 0, f"{len(missing)} referenced images not found in EPUB"
    print("OK: all referenced images extracted")


if __name__ == "__main__":
    main()

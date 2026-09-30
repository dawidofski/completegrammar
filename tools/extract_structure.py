"""Step 2.1 — Extract the book skeleton + theory from the publisher EPUB.

Parses the Premium Fourth Edition EPUB (ch*.xhtml) into:
  data/raw/structure.json  ->  { parts:[], chapters, sections, theoryBlocks }

The book is a flat 26-chapter book (no parts). Sections are h3.h3 (level 1,
id sec{N}_{M}) and h4.h4 (level 2, no id -> synthetic id).

Usage:  python tools/extract_structure.py
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from epub_reader import EpubReader, primary_epub  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.path.join(REPO_ROOT, "source")
OUT_DIR = os.path.join(REPO_ROOT, "data", "raw")

PARA_CLASSES = {"noindent", "indent", "noindent1", "noindentt", "indentt"}
BULLET_CLASS = "squ"
NOTE_CLASSES = {"squn", "squnn", "squ1"}
TABLE_IMAGE_CLASS = "images"


def text_of(el) -> str:
    return re.sub(r"\s+", " ", "".join(el.itertext())).strip()


def inner_html(el) -> str:
    s = ET.tostring(el, encoding="unicode")
    m = re.match(r"^<[^>]+>(.*)</[^>]+>$", s, re.DOTALL)
    inner = m.group(1) if m else "".join(el.itertext())
    # Strip decorative inline bullet images (square.jpg) so they don't render
    # as broken images in the app.
    inner = re.sub(r'<img[^>]*class="[^"]*inline[^"]*"[^>]*/?>', "", inner)
    return inner


def cls(el) -> str:
    return el.get("class") or ""


def main() -> None:
    path = primary_epub(SOURCE_DIR)
    print(f"Primary EPUB: {os.path.basename(path)}")

    with EpubReader(path) as epub:
        cv = hashlib.md5(open(path, "rb").read()).hexdigest()[:12]
        chapter_files = [n for n in epub.names() if re.search(r"ch(\d+)\.xhtml", n)]
        chapter_files.sort(key=lambda n: int(re.search(r"ch(\d+)", n).group(1)))

        chapters = []
        sections = []
        theory_blocks = []

        tb_id = 0
        for ch_order, name in enumerate(chapter_files, 1):
            ch_num = int(re.search(r"ch(\d+)", name).group(1))
            ch_id = f"ch{ch_num}"
            root = epub.parse_xhtml(name)
            body = root.find("body")

            title = ""
            h2c1 = root.find(".//h2[@class='h2c1']")
            if h2c1 is not None:
                title = text_of(h2c1)
            chapters.append({
                "id": ch_id,
                "partId": None,
                "number": ch_num,
                "title": title,
                "order": ch_order,
            })

            stack = []  # [{level, id}]
            sec_order = 0

            def add_section(level, heading_text, real_id):
                nonlocal sec_order
                while stack and stack[-1]["level"] >= level:
                    stack.pop()
                parent = stack[-1] if stack else None
                sec_order += 1
                sid = real_id or f"{ch_id}_sec_{sec_order}"
                sections.append({
                    "id": sid,
                    "chapterId": ch_id,
                    "parentId": parent["id"] if parent else None,
                    "level": level,
                    "title": heading_text,
                    "order": sec_order,
                })
                stack.append({"level": level, "id": sid})

            def box_has_exe(div):
                for ch in div:
                    if ch.tag == "p" and "image-e" in set((ch.get("class") or "").split()):
                        return any(re.fullmatch(r"exe\d+-\d+", a.get("id") or "") for a in ch.iter("a"))
                return False

            def walk(container, in_graded):
                nonlocal tb_id
                for el in container:
                    tag = el.tag
                    c = cls(el)
                    if tag == "section":
                        walk(el, in_graded)
                        continue
                    if tag == "div":
                        toks = set(c.split())
                        if "box" in toks:
                            walk(el, in_graded or box_has_exe(el))
                            continue
                        if "sidebar" in toks:
                            tb_id += 1
                            theory_blocks.append({
                                "id": f"{ch_id}_tb_{tb_id}",
                                "chapterId": ch_id,
                                "sectionId": stack[-1]["id"] if stack else None,
                                "type": "note",
                                "order": tb_id,
                                "text": text_of(el),
                                "html": None,
                                "src": None,
                            })
                            continue
                        walk(el, in_graded)
                        continue
                    if tag == "h2":
                        continue
                    if tag == "h3" and "h3" in set(c.split()):
                        add_section(1, text_of(el), el.get("id"))
                        continue
                    if tag == "h4" and "h4" in set(c.split()):
                        add_section(2, text_of(el), None)
                        continue
                    if tag != "p":
                        continue
                    if c in PARA_CLASSES:
                        ttype = "paragraph"
                    elif c == BULLET_CLASS:
                        ttype = "paragraph"
                    elif c in NOTE_CLASSES:
                        ttype = "note"
                    elif c == TABLE_IMAGE_CLASS:
                        ttype = "table"
                    else:
                        continue  # exercise internals / other
                    if c == "noindent" and in_graded:
                        continue  # exercise translation passage
                    tb_id += 1
                    src = None
                    if ttype == "table":
                        img = el.find("img")
                        src = img.get("src") if img is not None else None
                    theory_blocks.append({
                        "id": f"{ch_id}_tb_{tb_id}",
                        "chapterId": ch_id,
                        "sectionId": stack[-1]["id"] if stack else None,
                        "type": ttype,
                        "order": tb_id,
                        "text": text_of(el),
                        "html": inner_html(el),
                        "src": src,
                    })

            walk(body, False)

        n_l1 = sum(1 for s in sections if s["level"] == 1)
        n_l2 = sum(1 for s in sections if s["level"] == 2)

        summary = {
            "chapters": len(chapters),
            "sections": len(sections),
            "level1": n_l1,
            "level2": n_l2,
            "theoryBlocks": len(theory_blocks),
        }
        data = {
            "meta": {
                "title": "Complete Spanish Grammar",
                "contentVersion": cv,
                "source": os.path.basename(path),
            },
            "parts": [],
            "chapters": chapters,
            "sections": sections,
            "theoryBlocks": theory_blocks,
            "summary": summary,
        }
        os.makedirs(OUT_DIR, exist_ok=True)
        out_path = os.path.join(OUT_DIR, "structure.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print("Summary:", json.dumps(summary, ensure_ascii=False))
        print(f"Wrote {out_path}")

        assert len(chapters) == 26, f"expected 26 chapters, got {len(chapters)}"
        assert n_l1 == 175, f"expected 175 level-1 sections, got {n_l1}"
        assert n_l2 == 46, f"expected 46 level-2 subsections, got {n_l2}"
        print("OK: 26 chapters, 175 level-1 sections, 46 level-2 subsections")

        from collections import Counter
        dist = Counter(tb["type"] for tb in theory_blocks)
        print("Theory block types:", dict(dist))

        print(f"\nSample — Chapter 1: {chapters[0]['title']}")
        for s in [x for x in sections if x["chapterId"] == "ch1"][:14]:
            print(f"  {'  ' * (s['level'] - 1)}[L{s['level']}] {s['id']}  {s['title']}")


if __name__ == "__main__":
    main()


"""Step 2.2 — Extract exercises, questions, and canonical answers.

Walks ch*.xhtml for exercises (div.box whose p.image-e holds an exe{N}-{M}
anchor) and their ordered question items; parses ans.xhtml for canonical
answers; joins them by exercise ID + positional order (Nth question item maps
to Nth answer line).

Emits data/raw/exercises.json and data/raw/answers.json.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from epub_reader import EpubReader, primary_epub  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.path.join(REPO_ROOT, "source")
OUT_DIR = os.path.join(REPO_ROOT, "data", "raw")

PAT_EXE = re.compile(r"exe(\d+)-(\d+)")
PAT_ANS = re.compile(r"exe(\d+)_(\d+)")

QUESTION_CLASSES = {"number", "number1", "numbera", "exorder"}


def text_of(el) -> str:
    return re.sub(r"\s+", " ", "".join(el.itertext())).strip()


def cls(el) -> str:
    return el.get("class") or ""


def classify_kind(instruction: str) -> str:
    ins = (instruction or "").lower()
    if "verdadero o falso" in ins or "v o f" in ins:
        return "true-false"
    if "traduce" in ins or "escribe en español" in ins or " en español" in ins:
        return "translation"
    if "conecta la letra" in ins or "pareados" in ins or "escribe la letra" in ins:
        return "matching"
    return "fill"


def box_exe_id(div) -> str:
    for ch in div:
        if ch.tag == "p" and "image-e" in set((ch.get("class") or "").split()):
            for a in ch.iter("a"):
                i = a.get("id") or ""
                if PAT_EXE.search(i):
                    return i
    return ""


def first_answer(text: str) -> str:
    # "1·1 1. vive" -> "vive"
    t = re.sub(r"^\s*\d+\s*·\s*\d+\s*", "", text)
    t = re.sub(r"^\s*1[.)]\s*", "", t)
    return t.strip()


def line_answer(text: str) -> str:
    # "2. trabaja" -> "trabaja"
    return re.sub(r"^\s*\d+[.)]\s*", "", text).strip()


def split_alternatives(text: str) -> list:
    return [a.strip() for a in re.split(r"\s*/\s*", text) if a.strip()]


def extract_box(div):
    """Extract (instruction, numbered_items, passages, image) from one div.box,
    stopping at nested containers (the book has malformed div nesting)."""
    instruction = ""
    items = []
    passages = []
    image = ""
    for ch in div:
        tag = ch.tag
        chc = cls(ch)
        if tag in ("div", "h3", "h4", "hr"):
            break  # nested container / section -> belongs to a later block
        if tag != "p":
            continue
        if chc == "noindente":
            instruction = text_of(ch)
        elif chc in QUESTION_CLASSES:
            items.append(text_of(ch))
        elif chc == "noindent":
            t = text_of(ch)
            if t:
                passages.append(t)
        elif chc == "image-e":
            img = ch.find(".//img")
            image = img.get("src") if img is not None else ""
    return instruction, items, passages, image


def extract_exercises(epub):
    """Return (exercises, questions) from the chapter files."""
    exercises = []
    questions = []
    chapter_files = [n for n in epub.names() if re.search(r"ch(\d+)\.xhtml", n)]
    chapter_files.sort(key=lambda n: int(re.search(r"ch(\d+)", n).group(1)))

    q_order = 0
    ex_order = 0
    for name in chapter_files:
        ch_num = int(re.search(r"ch(\d+)", name).group(1))
        ch_id = f"ch{ch_num}"
        root = epub.parse_xhtml(name)
        body = root.find("body")

        state = {"section": None}

        def walk(container):
            nonlocal q_order, ex_order
            for el in container:
                tag = el.tag
                c = cls(el)
                if tag == "section":
                    walk(el)
                    continue
                if tag == "h3" and "h3" in set(c.split()):
                    state["section"] = el.get("id") or state["section"]
                    continue
                if tag == "div":
                    toks = set(c.split())
                    if "box" in toks:
                        ex_id = box_exe_id(el)
                        instruction, items, passages, image = extract_box(el)
                        ex_order += 1
                        num = ""
                        if ex_id:
                            m = PAT_EXE.search(ex_id)
                            num = f"{m.group(1)}.{m.group(2)}"
                        prompts = items if items else passages
                        ex = {
                            "id": ex_id or f"free_{ch_id}_{ex_order}",
                            "chapterId": ch_id,
                            "sectionId": state["section"],
                            "number": num,
                            "order": ex_order,
                            "instruction": instruction,
                            "kind": classify_kind(instruction) if ex_id else "freeform",
                            "freeform": not bool(ex_id),
                            "wordBank": [],
                            "imageSrc": image,
                        }
                        for i, itxt in enumerate(prompts, 1):
                            q_order += 1
                            q_id = f"{ex['id']}_q{i}"
                            questions.append({
                                "id": q_id,
                                "exerciseId": ex["id"],
                                "chapterId": ch_id,
                                "number": i,
                                "order": q_order,
                                "prompt": itxt,
                                "gloss": "",
                                "blankCount": len(re.findall(r"_+", itxt)),
                                "graded": bool(ex_id),
                                "blankIndex": None,
                                "imageSrc": None,
                                "freeResponse": not bool(ex_id),
                            })
                        exercises.append(ex)
                        walk(el)  # recurse: find nested sections (malformed nesting)
                        continue
                    if "sidebar" in toks:
                        continue
                    walk(el)
                    continue
        walk(body)
    return exercises, questions


def extract_answers(epub):
    """Return a list of answer blocks {exerciseId, accepted: [..]}."""
    root = epub.parse_xhtml("OEBPS/ans.xhtml")
    blocks = []
    current = None
    for el in root.iter():
        tag = el.tag
        c = cls(el)
        if tag == "p" and c == "ans":
            ex_id = ""
            for a in el.iter("a"):
                i = a.get("id") or ""
                if PAT_ANS.search(i):
                    ex_id = PAT_ANS.search(i).group(0).replace("_", "-")
                    break
            current = {
                "exerciseId": ex_id,
                "accepted": [first_answer(text_of(el))],
            }
            blocks.append(current)
            continue
        if tag == "p" and c in ("ak", "ak1", "akb") and current is not None:
            txt = line_answer(text_of(el)) if c in ("ak", "ak1") else text_of(el)
            current["accepted"].append(txt)
    return blocks


def _cv(path: str) -> str:
    return hashlib.md5(open(path, "rb").read()).hexdigest()[:12]


def is_header(text: str) -> bool:
    t = (text or "").strip().lower().rstrip(":").rstrip()
    return t in ("possible answers", "answers will vary", "respuestas posibles", "model answer")


def main() -> None:
    path = primary_epub(SOURCE_DIR)
    print(f"Primary EPUB: {os.path.basename(path)}")
    with EpubReader(path) as epub:
        exercises, questions = extract_exercises(epub)
        answer_blocks = extract_answers(epub)

    ans_by_ex = {b["exerciseId"]: b for b in answer_blocks if b["exerciseId"]}

    answers = []
    a_order = 0
    mismatches = []
    graded_with_answer = 0
    graded_no_answer = 0
    q_counter = len(questions)
    for ex in exercises:
        qs = [q for q in questions if q["exerciseId"] == ex["id"]]
        if ex["freeform"]:
            continue
        block = ans_by_ex.get(ex["id"])
        if not block:
            graded_no_answer += 1
            continue
        graded_with_answer += 1
        accepted = [a for a in block["accepted"] if not is_header(a)]

        # Image-based exercise (e.g. Pareados / Conecta la letra): 0 text
        # questions -> create one placeholder question per answer line.
        if not qs:
            for i, ans_text in enumerate(accepted, 1):
                q_counter += 1
                q_id = f"{ex['id']}_q{i}"
                questions.append({
                    "id": q_id,
                    "exerciseId": ex["id"],
                    "chapterId": ex["chapterId"],
                    "number": i,
                    "order": q_counter,
                    "prompt": "",
                    "gloss": "",
                    "blankCount": 0,
                    "graded": True,
                    "blankIndex": None,
                    "imageSrc": ex["imageSrc"],
                    "freeResponse": False,
                })
                answers.append({
                    "id": f"{q_id}_a",
                    "questionId": q_id,
                    "exerciseId": ex["id"],
                    "number": i,
                    "accepted": split_alternatives(ans_text),
                    "explanation": "",
                })
            continue

        # Multi-blank passage: one question whose blank count matches answers.
        if len(qs) == 1 and len(accepted) > 1 and qs[0]["blankCount"] == len(accepted):
            answers.append({
                "id": f"{qs[0]['id']}_a",
                "questionId": qs[0]["id"],
                "exerciseId": ex["id"],
                "number": 1,
                "accepted": [", ".join(accepted)],
                "explanation": "",
            })
            continue

        # Composition / model answer: one prompt, no blanks, several answers.
        if len(qs) == 1 and qs[0]["blankCount"] == 0 and len(accepted) > 1:
            mismatches.append(f"{ex['id']}: composition -> freeform")
            ex["freeform"] = True
            ex["kind"] = "freeform"
            qs[0]["graded"] = False
            qs[0]["freeResponse"] = True
            continue

        if len(accepted) != len(qs):
            mismatches.append(f"{ex['id']}: {len(qs)} q vs {len(accepted)} a")
        for i, q in enumerate(qs):
            answers.append({
                "id": f"{q['id']}_a",
                "questionId": q["id"],
                "exerciseId": ex["id"],
                "number": q["number"],
                "accepted": split_alternatives(accepted[i]) if i < len(accepted) else [],
                "explanation": "",
            })

    n_freeform = sum(1 for e in exercises if e["freeform"])
    n_graded = sum(1 for e in exercises if not e["freeform"])

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, "exercises.json"), "w", encoding="utf-8") as f:
        json.dump({
            "meta": {"contentVersion": _cv(path)},
            "exercises": exercises,
            "questions": questions,
            "summary": {
                "exercises": len(exercises),
                "graded": n_graded,
                "freeform": n_freeform,
                "questions": len(questions),
                "answers": len(answers),
            },
        }, f, ensure_ascii=False, indent=2)
    with open(os.path.join(OUT_DIR, "answers.json"), "w", encoding="utf-8") as f:
        json.dump({
            "meta": {"contentVersion": _cv(path)},
            "answers": answers,
            "summary": {"answers": len(answers)},
        }, f, ensure_ascii=False, indent=2)

    print(f"exercises={len(exercises)} (graded={n_graded} freeform={n_freeform})")
    print(f"questions={len(questions)} answers={len(answers)}")
    print(f"gradedWithAnswer={graded_with_answer} gradedNoAnswer={graded_no_answer}")
    print(f"countMismatches={len(mismatches)}")
    for m in mismatches[:40]:
        print("   ", m)

    assert len(exercises) == 424, f"expected 424 boxes, got {len(exercises)}"
    assert graded_no_answer == 0, f"{graded_no_answer} graded exercises lack an answer block"
    print("OK: 424 exercises; every graded exercise has an answer block")


if __name__ == "__main__":
    main()



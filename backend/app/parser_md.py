from __future__ import annotations
from dataclasses import dataclass
from typing import List

@dataclass
class ParsedCard:
    card_type: str
    front: str
    back: str
    raw: str | None = None

# -------------------------
# Tag normalization helpers
# -------------------------

def _norm_tag(line: str) -> str | None:
    """
    Accept common typos / variants for Question and MCQ.
    Add more accepted spellings here.
    """
    s = line.strip().lower()

    # Q&A tag variants
    if s.startswith((
        "question:", "quesition:", "quesiton:", "quesion:", "qestion:", "queston:", "qustion:", "q:",
    )):
        return "question"

    # MCQ tag variants
    if s.startswith((
        "mcq:", "mcu:", "mcv:", "mvq:", "mqc:", "mc:",  # include mvq per your request
    )):
        return "mcq"

    return None

def _is_answer_tag(line: str) -> bool:
    """
    Accept common typos / variants for Answer tag.
    Add more accepted spellings here.
    """
    s = line.strip().lower()
    return s.startswith((
        "answer:", "ans:", "anser:", "anwser:", "aswer:", "anwer:", "answer :", "ans :"
    ))

def _is_indented_or_bulleted(line: str) -> bool:
    # treat tabs OR >=4 spaces OR "- " OR "* " as content lines
    return (
        line.startswith("\t")
        or line.startswith("    ")
        or line.startswith("- ")
        or line.startswith("* ")
    )

def _strip_one_level_prefix(line: str) -> str:
    # Remove exactly ONE level of indentation/bullet marker, preserve inner structure
    if line.startswith("\t"):
        return line[1:].rstrip()
    if line.startswith("    "):
        return line[4:].rstrip()
    if line.startswith("- "):
        return line[2:].rstrip()
    if line.startswith("* "):
        return line[2:].rstrip()
    # fallback: strip common symbols at start
    return line.lstrip(" \t-*•").rstrip()

def parse_markdown(md_text: str) -> List[ParsedCard]:
    lines = md_text.splitlines()
    cards: List[ParsedCard] = []
    i = 0

    while i < len(lines):
        line = lines[i]
        tag = _norm_tag(line)
        if not tag:
            i += 1
            continue

        # -------------------------
        # Q&A
        # -------------------------
        if tag == "question":
            # supports "q:" shorthand too
            q = line.split(":", 1)[1].strip()
            i += 1
            ans_lines: List[str] = []

            while i < len(lines):
                nxt = lines[i]
                if _norm_tag(nxt):
                    break

                if nxt.strip() == "":
                    # keep blank lines only after answer starts
                    if ans_lines:
                        ans_lines.append("")
                    i += 1
                    continue

                if _is_indented_or_bulleted(nxt):
                    ans_lines.append(_strip_one_level_prefix(nxt))
                    i += 1
                    continue

                # stop once answer has started and we hit a non-answer line
                if ans_lines:
                    break

                i += 1

            back = "\n".join(ans_lines).strip()
            cards.append(ParsedCard(card_type="qa", front=q, back=back))
            continue

        # -------------------------
        # MCQ
        # -------------------------
        if tag == "mcq":
            stem = line.split(":", 1)[1].strip()
            i += 1

            options: List[str] = []
            answer_lines: List[str] = []
            in_answer = False

            while i < len(lines):
                nxt = lines[i]
                if _norm_tag(nxt):
                    break

                # allow blank lines anywhere
                if nxt.strip() == "":
                    # keep blank lines inside answer block (optional)
                    if in_answer and answer_lines:
                        answer_lines.append("")
                    i += 1
                    continue

                # Answer: can be on its own line OR "Answer: B) ..."
                if _is_answer_tag(nxt):
                    in_answer = True
                    after = nxt.split(":", 1)[1].strip()
                    if after:
                        # Answer on same line
                        answer_lines.append(after)
                    i += 1
                    continue

                if in_answer:
                    # ✅ multiple answer lines only if indented/bulleted
                    if _is_indented_or_bulleted(nxt):
                        answer_lines.append(_strip_one_level_prefix(nxt))
                        i += 1
                        continue
                    # stop answer block when no longer indented/bulleted
                    break

                # options (before Answer:)
                if _is_indented_or_bulleted(nxt):
                    options.append(_strip_one_level_prefix(nxt))
                    i += 1
                    continue

                break

            front = stem + ("\n" + "\n".join(options) if options else "")
            back = "\n".join(answer_lines).strip()
            cards.append(ParsedCard(card_type="mcq", front=front, back=back))
            continue

    return cards

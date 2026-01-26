from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class ParsedCard:
    card_type: str
    front: str
    back: str
    raw: str | None = None


BULLET_PREFIXES = ("- ", "* ", "• ")


def _strip_leading_bullets_and_space(line: str) -> str:
    """
    For Notion toggle exports you often get:
      "- Question: ...", "- MCQ: ...", "- Answer:"
    This removes ONE leading bullet marker after optional whitespace.
    """
    s = line.lstrip()
    for bp in BULLET_PREFIXES:
        if s.startswith(bp):
            return s[len(bp) :].lstrip()
    return s


def _norm_tag(line: str) -> Optional[str]:
    """
    Detect Question / MCQ even if the line starts with "- " (toggle export),
    or has minor typos.
    """
    s = _strip_leading_bullets_and_space(line).strip().lower()
    if s.startswith(("question:", "quesition:", "quesiton:")):
        return "question"
    if s.startswith(("mcq:", "mcu:")):
        return "mcq"
    return None


def _is_blank(line: str) -> bool:
    return line.strip() == ""


def _is_indented_or_bulleted(line: str) -> bool:
    """
    Accept any indentation (1+ spaces OR a tab), OR a bullet item.
    This is the key fix for Notion “tab” becoming 2 spaces.
    """
    if not line:
        return False
    if line[0] in (" ", "\t"):
        return True
    s = line.lstrip()
    return s.startswith(BULLET_PREFIXES)


def _normalize_answer_line(line: str) -> str:
    """
    Keep bullets visible (convert '* ' / '• ' to '- '),
    but remove the indentation that Notion adds.
    """
    raw = line.lstrip("\t ")
    for bp in BULLET_PREFIXES:
        if raw.startswith(bp):
            # normalize bullet marker to "- "
            return "- " + raw[len(bp) :].rstrip()
    return raw.rstrip()


def _is_answer_marker(line: str) -> bool:
    s = _strip_leading_bullets_and_space(line).strip().lower()
    return s.startswith("answer:")


def _answer_inline_value(line: str) -> str:
    """
    Support: 'Answer: C) CT'
    """
    s = _strip_leading_bullets_and_space(line)
    if ":" not in s:
        return ""
    return s.split(":", 1)[1].strip()


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
            cleaned = _strip_leading_bullets_and_space(line)
            q = cleaned.split(":", 1)[1].strip()

            i += 1
            ans_lines: List[str] = []

            while i < len(lines):
                nxt = lines[i]

                # stop if next card begins
                if _norm_tag(nxt):
                    break

                if _is_blank(nxt):
                    # keep paragraph spacing only if we've started capturing
                    if ans_lines and ans_lines[-1] != "":
                        ans_lines.append("")
                    i += 1
                    continue

                # capture indented OR bulleted lines as answer
                if _is_indented_or_bulleted(nxt):
                    ans_lines.append(_normalize_answer_line(nxt))
                    i += 1
                    continue

                # unindented non-blank: if we've started capturing, stop
                if ans_lines:
                    break

                # otherwise ignore stray text before answer block
                i += 1

            back = "\n".join(ans_lines).strip()
            cards.append(ParsedCard(card_type="qa", front=q, back=back))
            continue

        # -------------------------
        # MCQ
        # -------------------------
        if tag == "mcq":
            cleaned = _strip_leading_bullets_and_space(line)
            stem = cleaned.split(":", 1)[1].strip()

            i += 1
            options: List[str] = []
            answer = ""
            in_answer = False

            while i < len(lines):
                nxt = lines[i]

                # stop if next card begins
                if _norm_tag(nxt):
                    break

                if _is_blank(nxt):
                    i += 1
                    continue

                if _is_answer_marker(nxt):
                    # support Answer: <value> on the same line
                    inline = _answer_inline_value(nxt)
                    if inline:
                        answer = inline
                        i += 1
                        break
                    in_answer = True
                    i += 1
                    continue

                if in_answer:
                    # accept any indentation OR bullet for the answer line
                    if _is_indented_or_bulleted(nxt):
                        answer = _normalize_answer_line(nxt).strip()
                        i += 1
                        continue
                    # first non-indented non-blank ends the answer block
                    break

                # options: accept indented lines OR bulleted lines
                if _is_indented_or_bulleted(nxt):
                    options.append(_normalize_answer_line(nxt))
                    i += 1
                    continue

                # unindented non-blank ends the options block
                break

            front = stem + ("\n" + "\n".join(options) if options else "")
            cards.append(ParsedCard(card_type="mcq", front=front, back=answer.strip()))
            continue

    return cards

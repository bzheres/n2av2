from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional
import re


@dataclass
class ParsedCard:
    card_type: str  # "qa" | "mcq"
    front: str
    back: str
    raw: str | None = None


# -----------------------------
# Tag detection (forgiving)
# -----------------------------

# Require ":" for card tags to reduce false positives.
_Q_TAGS = ("question:", "quesition:", "quesiton:", "q:")
_MCQ_TAGS = ("mcq:", "mcu:", "mcq :")
_ANS_TAGS = ("answer:", "ans:", "anwser:", "anwer:")


def _strip_bullet_prefix(s: str) -> str:
    """
    Remove leading markdown bullet/list markers so toggles/lists still parse:
      "  - Question: ..." -> "Question: ..."
      "  1) MCQ: ..."     -> "MCQ: ..."
    """
    t = s.lstrip(" \t")

    if t.startswith(("- ", "* ", "• ")):
        return t[2:]

    m = re.match(r"^\d+\s*[\)\.]\s+(.*)$", t)
    if m:
        return m.group(1)

    return t


def _tag_type(line: str) -> Optional[str]:
    """Returns: 'question' | 'mcq' | 'answer' | None"""
    s = _strip_bullet_prefix(line).strip().lower()

    for t in _Q_TAGS:
        if s.startswith(t):
            return "question"
    for t in _MCQ_TAGS:
        if s.startswith(t):
            return "mcq"
    for t in _ANS_TAGS:
        if s.startswith(t):
            return "answer"
    return None


def _extract_after_colon(line: str) -> str:
    cleaned = _strip_bullet_prefix(line).strip()
    parts = cleaned.split(":", 1)
    return parts[1].strip() if len(parts) == 2 else ""


def _is_blank(line: str) -> bool:
    return line.strip() == ""


def _looks_like_option(line: str) -> bool:
    """
    Option A: Options are list-like lines after an MCQ stem until Answer:
    Accept:
      - "- A) ...", "* B) ..."
      - "1) ...", "2. ..."
      - "A) ...", "B. ..."
      - "a) ...", "c. ..."
      - bullet text with no label
    """
    s2 = _strip_bullet_prefix(line).strip()
    if not s2:
        return False

    if re.match(r"^[A-Da-d]\s*[\)\.]\s+.+", s2):
        return True
    if re.match(r"^\d+\s*[\)\.]\s+.+", s2):
        return True
    if line.lstrip(" \t").startswith(("- ", "* ", "• ")):
        return True

    return False


def parse_markdown(md_text: str) -> List[ParsedCard]:
    """
    Option A rules:
      - Q/A: answer = every non-blank line after Question: until a BLANK LINE or next card tag
      - MCQ: options = list-like lines until Answer:
             answer = everything after Answer: until BLANK LINE or next card tag
      - Tags may appear inside toggles/lists (leading "- ", "* ", "1) ").
      - Indentation is NOT required; tabs/spaces are accepted.
    """
    lines = md_text.splitlines()
    cards: List[ParsedCard] = []

    i = 0
    while i < len(lines):
        line = lines[i]
        t = _tag_type(line)

        if t not in ("question", "mcq"):
            i += 1
            continue

        # -----------------
        # Q&A card
        # -----------------
        if t == "question":
            q = _extract_after_colon(line)
            raw_start = i
            i += 1

            ans_lines: List[str] = []
            while i < len(lines):
                nxt = lines[i]

                if _tag_type(nxt) in ("question", "mcq"):
                    break
                if _is_blank(nxt):
                    break

                # normalize tabs for display
                ans_lines.append(nxt.replace("\t", "    ").rstrip())
                i += 1

            back = "\n".join(ans_lines).strip()
            raw_block = "\n".join(lines[raw_start:i]).strip() or None
            cards.append(ParsedCard(card_type="qa", front=q, back=back, raw=raw_block))

            while i < len(lines) and _is_blank(lines[i]):
                i += 1
            continue

        # -----------------
        # MCQ card
        # -----------------
        if t == "mcq":
            stem = _extract_after_colon(line)
            raw_start = i
            i += 1

            option_lines: List[str] = []
            answer_lines: List[str] = []
            saw_answer_tag = False

            while i < len(lines):
                nxt = lines[i]

                if _tag_type(nxt) in ("question", "mcq"):
                    break
                if _is_blank(nxt):
                    break

                tt = _tag_type(nxt)

                if tt == "answer":
                    saw_answer_tag = True
                    inline = _extract_after_colon(nxt)
                    if inline:
                        answer_lines.append(inline)
                    i += 1
                    continue

                if saw_answer_tag:
                    answer_lines.append(nxt.replace("\t", "    ").rstrip())
                    i += 1
                    continue

                if _looks_like_option(nxt):
                    option_lines.append(nxt.replace("\t", "    ").rstrip().strip())
                i += 1

            front = stem.strip()
            if option_lines:
                front = front + "\n" + "\n".join(option_lines)

            back = "\n".join(answer_lines).strip()
            raw_block = "\n".join(lines[raw_start:i]).strip() or None
            cards.append(ParsedCard(card_type="mcq", front=front, back=back, raw=raw_block))

            while i < len(lines) and _is_blank(lines[i]):
                i += 1
            continue

    return cards

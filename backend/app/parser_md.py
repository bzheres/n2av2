from __future__ import annotations
from dataclasses import dataclass
from typing import List
import re

@dataclass
class ParsedCard:
    card_type: str   # "qa" or "mcq"
    front: str
    back: str
    raw: str | None = None


# -------------------------
# Helpers
# -------------------------

TAG_RE = re.compile(r"""
    ^\s*[-*+]*\s*
    (?P<tag>
        question|q|
        quesition|quesiton|
        mcq|mcu
    )
    \s*:
""", re.IGNORECASE | re.VERBOSE)

ANSWER_RE = re.compile(r"^\s*[-*+]*\s*answer\s*:", re.IGNORECASE)

def is_tag_line(line: str) -> str | None:
    m = TAG_RE.match(line)
    if not m:
        return None
    tag = m.group("tag").lower()
    if tag in ("question", "q", "quesition", "quesiton"):
        return "question"
    return "mcq"

def strip_tag(line: str) -> str:
    return TAG_RE.sub("", line, count=1).strip()

def is_indented(line: str) -> bool:
    return bool(re.match(r"^\s+", line))

def clean_line(line: str) -> str:
    # Remove bullets, indentation, keep content
    return re.sub(r"^\s*[-*+]\s*", "", line).rstrip()


# -------------------------
# Parser
# -------------------------

def parse_markdown(md_text: str) -> List[ParsedCard]:
    lines = md_text.splitlines()
    cards: List[ParsedCard] = []
    i = 0

    while i < len(lines):
        line = lines[i]
        tag = is_tag_line(line)

        if not tag:
            i += 1
            continue

        # -------------------------
        # Q&A
        # -------------------------
        if tag == "question":
            front = strip_tag(line)
            i += 1
            back_lines = []

            while i < len(lines):
                nxt = lines[i]

                if is_tag_line(nxt):
                    break

                if is_indented(nxt):
                    back_lines.append(clean_line(nxt))
                    i += 1
                    continue

                break  # unindented line ends answer

            cards.append(
                ParsedCard(
                    card_type="qa",
                    front=front,
                    back="\n".join(back_lines).strip()
                )
            )
            continue

        # -------------------------
        # MCQ
        # -------------------------
        if tag == "mcq":
            stem = strip_tag(line)
            i += 1

            options = []
            answer_lines = []
            in_answer = False

            while i < len(lines):
                nxt = lines[i]

                if is_tag_line(nxt):
                    break

                if ANSWER_RE.match(nxt):
                    in_answer = True
                    # inline answer?
                    inline = ANSWER_RE.sub("", nxt).strip()
                    if inline:
                        answer_lines.append(inline)
                    i += 1
                    continue

                if in_answer:
                    if is_indented(nxt):
                        answer_lines.append(clean_line(nxt))
                        i += 1
                        continue
                    break

                # options must be bulleted + indented
                if is_indented(nxt) and re.match(r"^\s*[-*+]\s*", nxt):
                    options.append(clean_line(nxt))
                    i += 1
                    continue

                # anything else ends MCQ block
                break

            front = stem
            if options:
                front += "\n" + "\n".join(options)

            cards.append(
                ParsedCard(
                    card_type="mcq",
                    front=front,
                    back="\n".join(answer_lines).strip()
                )
            )
            continue

    return cards

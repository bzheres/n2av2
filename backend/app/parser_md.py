from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional, Tuple
import re


@dataclass
class ParsedCard:
    card_type: str  # "qa" | "mcq"
    front: str
    back: str
    raw: str | None = None


# ---- helpers ---------------------------------------------------------------

_BULLET_PREFIX_RE = re.compile(r"^\s*(?:[-*•]\s+)?(.*)$")
_TAG_RE_QUESTION = re.compile(r"^\s*(?:[-*•]\s+)?\s*(question|quesition|quesiton)\s*:\s*(.*)$", re.I)
_TAG_RE_MCQ = re.compile(r"^\s*(?:[-*•]\s+)?\s*(mcq|mcu)\s*:\s*(.*)$", re.I)
_TAG_RE_ANSWER = re.compile(r"^\s*(?:[-*•]\s+)?\s*answer\s*:\s*(.*)$", re.I)


def _strip_list_prefix(line: str) -> str:
    """Remove one leading bullet marker ( - / * / • ) and whitespace."""
    m = _BULLET_PREFIX_RE.match(line)
    return (m.group(1) if m else line).rstrip("\n")


def _norm_tag(line: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Returns (tag, payload) where tag in {"question","mcq","answer"} or (None, None).
    Payload is the text after ":" (may be empty).
    """
    s = line.rstrip("\n")

    m = _TAG_RE_QUESTION.match(s)
    if m:
        return "question", (m.group(2) or "").strip()

    m = _TAG_RE_MCQ.match(s)
    if m:
        return "mcq", (m.group(2) or "").strip()

    m = _TAG_RE_ANSWER.match(s)
    if m:
        # could be inline answer: "Answer: B) something"
        return "answer", (m.group(1) or "").strip()

    return None, None


def _is_card_start(line: str) -> bool:
    tag, _ = _norm_tag(line)
    return tag in ("question", "mcq")


def _is_indented_or_bulleted(line: str) -> bool:
    """
    For Notion exports, answer/options lines may appear as:
      - indented with 1+ spaces (not necessarily 4)
      - tab
      - nested list items: "  - A) ...", "- A) ..."
    """
    if not line:
        return False
    if line.startswith("\t"):
        return True
    if line.startswith(" "):  # any leading spaces
        return True
    s = line.lstrip()
    return s.startswith(("-", "*", "•"))


def _clean_content_line(line: str) -> str:
    """
    Remove indentation + one list marker, but keep the meaningful text.
    """
    s = line.rstrip("\n")
    # strip leading whitespace first
    s = s.lstrip(" \t")
    # strip ONE bullet if present
    if s.startswith(("-", "*", "•")):
        s = s[1:].lstrip(" \t")
    return s.rstrip()


# ---- main parser -----------------------------------------------------------

def parse_markdown(md_text: str) -> List[ParsedCard]:
    lines = md_text.splitlines()
    cards: List[ParsedCard] = []
    i = 0

    while i < len(lines):
        line = lines[i]
        tag, payload = _norm_tag(line)

        if tag is None:
            i += 1
            continue

        # ---------------- Q&A ----------------
        if tag == "question":
            q = payload or ""
            raw_lines = [line]
            i += 1

            ans_lines: List[str] = []
            started = False

            while i < len(lines):
                nxt = lines[i]
                if _is_card_start(nxt):
                    break

                raw_lines.append(nxt)

                # allow blank lines inside an answer once started
                if nxt.strip() == "":
                    if started:
                        ans_lines.append("")
                    i += 1
                    continue

                # capture any indented / bulleted line as answer content
                if _is_indented_or_bulleted(nxt):
                    ans_lines.append(_clean_content_line(nxt))
                    started = True
                    i += 1
                    continue

                # if we already started collecting an answer, stop at first non-answer line
                if started:
                    break

                # otherwise ignore stray text until we hit answer-like structure
                i += 1

            back = "\n".join(ans_lines).strip()
            cards.append(
                ParsedCard(card_type="qa", front=q.strip(), back=back, raw="\n".join(raw_lines))
            )
            continue

        # ---------------- MCQ ----------------
        if tag == "mcq":
            stem = payload or ""
            raw_lines = [line]
            i += 1

            options: List[str] = []
            answer: str = ""
            in_answer = False

            while i < len(lines):
                nxt = lines[i]
                if _is_card_start(nxt):
                    break

                raw_lines.append(nxt)

                if nxt.strip() == "":
                    i += 1
                    continue

                t, p = _norm_tag(nxt)

                # detect "Answer:" even if bulleted/toggled
                if t == "answer":
                    in_answer = True
                    # if "Answer:" has inline content, take it immediately
                    if p:
                        answer = p.strip()
                        i += 1
                        # keep scanning until we hit next card start, but don’t overwrite answer
                        continue
                    i += 1
                    continue

                if in_answer:
                    # accept answer line if it's indented OR bulleted (nested list)
                    if _is_indented_or_bulleted(nxt):
                        cleaned = _clean_content_line(nxt)
                        if cleaned:
                            answer = cleaned
                        i += 1
                        # stop consuming answer after first meaningful line
                        break
                    # sometimes Notion exports answer without indentation (rare) — accept first plain line too
                    cleaned = _strip_list_prefix(nxt).strip()
                    if cleaned and not _is_card_start(nxt):
                        answer = cleaned
                    i += 1
                    break

                # options: accept indented/bulleted lines as options
                if _is_indented_or_bulleted(nxt):
                    opt = _clean_content_line(nxt)
                    if opt:
                        options.append(opt)
                    i += 1
                    continue

                # if we hit a plain line, stop MCQ block (prevents swallowing notes)
                break

            front = stem.strip()
            if options:
                front = front + "\n" + "\n".join(options)

            cards.append(
                ParsedCard(card_type="mcq", front=front, back=answer.strip(), raw="\n".join(raw_lines))
            )
            continue

        i += 1

    return cards

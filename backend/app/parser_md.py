from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple
import re


@dataclass
class ParsedCard:
    card_type: str
    front: str
    back: str
    raw: str | None = None


# ---------- helpers ----------

_BULLET_PREFIX_RE = re.compile(r"""^\s*([-*•])\s+""")
_TAG_RE = re.compile(
    r"""^\s*(?:[-*•]\s+)?\s*(question|q|mcq|mcu)\s*:\s*(.*)\s*$""",
    re.IGNORECASE,
)
_ANSWER_RE = re.compile(r"""^\s*(?:[-*•]\s+)?\s*answer\s*:\s*(.*)\s*$""", re.IGNORECASE)

_HEADING_OR_RULE_RE = re.compile(r"""^\s*(#{1,6}\s+|---\s*$)""")


def _strip_one_bullet_prefix(s: str) -> str:
    """Remove ONE leading bullet marker (after indentation), if present."""
    return _BULLET_PREFIX_RE.sub("", s, count=1)


def _clean_content_line(line: str) -> str:
    """
    Normalize a content line for back/options:
    - preserves nested indentation roughly by keeping leading whitespace
    - removes one bullet marker if present
    - trims trailing whitespace
    """
    # Keep leading whitespace but normalize tabs -> 4 spaces (helps “Notion tab” exports)
    line = line.replace("\t", "    ")
    # Remove one bullet marker after indentation
    stripped = _strip_one_bullet_prefix(line)
    return stripped.rstrip()


def _norm_tag(line: str) -> Optional[Tuple[str, str]]:
    """
    Return (tag, payload) where tag in {"question","mcq"} and payload is text after ':'.
    Accepts toggle-style '- Question:' / '- MCQ:' and 'Q:'.
    """
    m = _TAG_RE.match(line)
    if not m:
        # tolerate common typos for question:
        s = _strip_one_bullet_prefix(line).strip().lower()
        if s.startswith(("quesition:", "quesiton:")):
            payload = line.split(":", 1)[1].strip() if ":" in line else ""
            return ("question", payload)
        return None

    raw_tag = m.group(1).strip().lower()
    payload = m.group(2).strip()

    if raw_tag in ("question", "q"):
        return ("question", payload)
    if raw_tag in ("mcq", "mcu"):
        return ("mcq", payload)
    return None


def _is_answer_marker(line: str) -> Optional[str]:
    """
    If line is 'Answer:' (including '- Answer:'), return inline text after ':'
    (may be empty). Otherwise None.
    """
    m = _ANSWER_RE.match(line)
    if not m:
        return None
    return (m.group(1) or "").strip()


def _is_stop_line(line: str) -> bool:
    """Headings or rules should generally stop capture once content has started."""
    return bool(_HEADING_OR_RULE_RE.match(line.strip()))


# ---------- main parser ----------

def parse_markdown(md_text: str) -> List[ParsedCard]:
    lines = md_text.splitlines()
    cards: List[ParsedCard] = []
    i = 0

    while i < len(lines):
        line = lines[i]
        tagged = _norm_tag(line)
        if not tagged:
            i += 1
            continue

        tag, payload = tagged

        # -------- Q&A --------
        if tag == "question":
            q = payload
            i += 1

            ans_lines: List[str] = []
            while i < len(lines):
                nxt = lines[i]

                # next card starts
                if _norm_tag(nxt):
                    break

                # stop if we hit a new section divider AFTER answer started
                if ans_lines and _is_stop_line(nxt):
                    break

                # skip leading blank lines before answer starts
                if nxt.strip() == "":
                    if ans_lines:
                        ans_lines.append("")  # keep paragraph spacing
                    i += 1
                    continue

                # capture ANY non-empty line once we're in an answer block
                ans_lines.append(_clean_content_line(nxt))
                i += 1

            back = "\n".join(ans_lines).strip()
            cards.append(ParsedCard(card_type="qa", front=q, back=back))
            continue

        # -------- MCQ --------
        if tag == "mcq":
            stem = payload
            i += 1

            options: List[str] = []
            answer = ""
            in_answer = False

            while i < len(lines):
                nxt = lines[i]

                # next card starts
                if _norm_tag(nxt):
                    break

                # stop at new section divider AFTER we started reading this MCQ
                if (options or answer or in_answer) and _is_stop_line(nxt):
                    break

                if nxt.strip() == "":
                    i += 1
                    continue

                # Answer marker (supports '- Answer:' and inline 'Answer: D) ...')
                inline = _is_answer_marker(nxt)
                if inline is not None:
                    if inline:
                        answer = inline
                        i += 1
                        # once we have an inline answer, we can stop reading this MCQ block
                        break
                    in_answer = True
                    i += 1
                    continue

                if in_answer:
                    # Accept answer even if it's:
                    # - indented
                    # - tabbed
                    # - bulleted (e.g. '- D) ...')
                    # - plain text (e.g. 'D) ...')
                    answer = _clean_content_line(nxt).strip()
                    i += 1
                    # stop after first meaningful answer line
                    break

                # Options: accept indented or bulleted lines as options
                # (this keeps your current behaviour, plus handles toggle indentation)
                if nxt.lstrip().startswith(("-", "*", "•")) or nxt.startswith(("    ", "\t")):
                    opt = _clean_content_line(nxt).strip()
                    options.append(opt)
                    i += 1
                    continue

                # If a non-option, non-answer line appears, stop options capture
                break

            front = stem + ("\n" + "\n".join(options) if options else "")
            cards.append(ParsedCard(card_type="mcq", front=front, back=answer.strip()))
            continue

    return cards

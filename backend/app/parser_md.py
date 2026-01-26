from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional
import re

@dataclass
class ParsedCard:
    card_type: str
    front: str
    back: str
    raw: str | None = None

# ---------- helpers ----------

_BULLET_RE = re.compile(r"^\s*([-*•])\s+")
_NUMBERED_RE = re.compile(r"^\s*\d+[.)]\s+")
_TAG_RE = re.compile(r"^\s*(?:[-*•]\s+)?(question|mcq|answer)\s*:\s*(.*)$", re.IGNORECASE)

def _strip_list_prefix(line: str) -> str:
    """Remove a single leading markdown bullet prefix like '- ' / '* ' / '• ' (after whitespace)."""
    return _BULLET_RE.sub("", line, count=1)

def _is_numbered(line: str) -> bool:
    return bool(_NUMBERED_RE.match(line))

def _is_bulleted(line: str) -> bool:
    return bool(_BULLET_RE.match(line))

def _is_indented(line: str) -> bool:
    # Any leading whitespace counts (1+ spaces OR tabs)
    return len(line) > 0 and line[0].isspace()

def _norm_tag(line: str) -> Optional[str]:
    """
    Detect 'Question:' / 'MCQ:' / 'Answer:' with optional leading bullet.
    Also tolerates common misspellings.
    """
    m = _TAG_RE.match(line)
    if not m:
        # tolerate your previous misspellings for Question/MCQ
        s = _strip_list_prefix(line).strip().lower()
        if s.startswith(("question:", "quesition:", "quesiton:")):
            return "question"
        if s.startswith(("mcq:", "mcu:")):
            return "mcq"
        if s.startswith("answer:"):
            return "answer"
        return None

    tag = m.group(1).strip().lower()
    if tag in ("question", "mcq", "answer"):
        return tag
    return None

def _tag_payload(line: str) -> str:
    """Return text after the first ':' (after stripping optional list prefix)."""
    core = _strip_list_prefix(line)
    return core.split(":", 1)[1].strip() if ":" in core else core.strip()

def _clean_content_line(line: str) -> str:
    """
    Clean an answer/option line:
    - remove one bullet prefix if present
    - strip leading whitespace
    - keep internal numbering/lettering (e.g., 'A) ...', '1) ...')
    """
    core = _strip_list_prefix(line)
    return core.strip()

# ---------- parser ----------

def parse_markdown(md_text: str) -> List[ParsedCard]:
    lines = md_text.splitlines()
    cards: List[ParsedCard] = []
    i = 0

    while i < len(lines):
        line = lines[i]
        tag = _norm_tag(line)

        if tag != "question" and tag != "mcq":
            i += 1
            continue

        # ---------------- QA ----------------
        if tag == "question":
            q = _tag_payload(line)
            is_toggle = bool(_BULLET_RE.match(line))  # "- Question:" style

            i += 1
            ans_lines: List[str] = []
            started = False

            while i < len(lines):
                nxt = lines[i]
                nxt_tag = _norm_tag(nxt)
                if nxt_tag in ("question", "mcq"):
                    break

                if nxt.strip() == "":
                    if started:
                        ans_lines.append("")
                    i += 1
                    continue

                # Decide whether this line counts as answer content
                if _is_indented(nxt) or _is_bulleted(nxt) or _is_numbered(nxt):
                    started = True
                    ans_lines.append(_clean_content_line(nxt))
                    i += 1
                    continue

                # Toggle-style: allow unindented plain text answers directly under "- Question:"
                if is_toggle and not started:
                    started = True
                    ans_lines.append(_clean_content_line(nxt))
                    i += 1
                    continue

                # otherwise, stop QA answer capture once we hit normal prose
                if started:
                    break

                i += 1

            back = "\n".join(ans_lines).strip()
            cards.append(ParsedCard(card_type="qa", front=q, back=back))
            continue

        # ---------------- MCQ ----------------
        if tag == "mcq":
            stem = _tag_payload(line)
            is_toggle = bool(_BULLET_RE.match(line))  # "- MCQ:" style

            i += 1
            options: List[str] = []
            answer = ""
            in_answer = False

            while i < len(lines):
                nxt = lines[i]
                nxt_tag = _norm_tag(nxt)

                # New card begins
                if nxt_tag in ("question", "mcq"):
                    break

                # Enter answer mode (supports "Answer:" and "- Answer:")
                if nxt_tag == "answer":
                    in_answer = True
                    i += 1
                    continue

                if nxt.strip() == "":
                    i += 1
                    continue

                if in_answer:
                    # Take first non-empty line after Answer:, regardless of indent
                    answer = _clean_content_line(nxt)
                    i += 1
                    # optionally allow multi-line answers if they are indented/bulleted
                    while i < len(lines):
                        more = lines[i]
                        if _norm_tag(more) in ("question", "mcq", "answer"):
                            break
                        if more.strip() == "":
                            break
                        if _is_indented(more) or _is_bulleted(more) or _is_numbered(more):
                            answer += "\n" + _clean_content_line(more)
                            i += 1
                            continue
                        break
                    break

                # Collect options:
                # - indented lines
                # - bulleted lines
                # - numbered lines like "1) ..."
                # - lettered lines like "A) ..." even if not indented (common)
                core = _strip_list_prefix(nxt)
                core_stripped = core.strip()

                looks_like_option = (
                    _is_indented(nxt)
                    or _is_bulleted(nxt)
                    or _is_numbered(nxt)
                    or re.match(r"^[A-Da-d][\).]\s+", core_stripped) is not None
                )

                if looks_like_option:
                    options.append(_clean_content_line(nxt))
                    i += 1
                    continue

                # Toggle-style MCQ: allow unindented options directly under "- MCQ:" until Answer:
                if is_toggle and not in_answer:
                    options.append(_clean_content_line(nxt))
                    i += 1
                    continue

                # Stop options at first unrelated line
                break

            front = stem + ("\n" + "\n".join(options) if options else "")
            cards.append(ParsedCard(card_type="mcq", front=front, back=answer.strip()))
            continue

    return cards

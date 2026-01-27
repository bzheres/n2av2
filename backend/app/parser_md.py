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


# Common tag typos you mentioned
QUESTION_TAG_RE = re.compile(r"^(question|q|quesition|quesiton)\s*:\s*(.*)$", re.IGNORECASE)
MCQ_TAG_RE = re.compile(r"^(mcq|mcu)\s*:\s*(.*)$", re.IGNORECASE)
ANSWER_TAG_RE = re.compile(r"^answer\s*:\s*(.*)$", re.IGNORECASE)


def _expand_tabs(s: str) -> str:
    # Notion export can contain tabs; normalize to spaces for consistent indent calc
    return s.replace("\t", "    ")


def _strip_bullet(s: str) -> Tuple[bool, str]:
    """
    Strips a single leading bullet marker (-, *, •) after indentation.
    Returns (was_bullet, content_without_bullet).
    """
    t = s.lstrip(" ")
    # If we removed indentation, re-check bullet at the start of trimmed portion
    for mark in ("- ", "* ", "• "):
        if t.startswith(mark):
            return True, t[len(mark) :]
    return False, t


def _analyze_line(line: str) -> Tuple[int, bool, str, str]:
    """
    Returns:
      indent: number of leading spaces (tabs already expanded)
      is_bullet: whether line is a bullet item
      content: content with indentation removed and bullet removed (single level)
      raw_stripped: line stripped of trailing whitespace only
    """
    raw = line.rstrip("\r\n")
    expanded = _expand_tabs(raw)
    indent = len(expanded) - len(expanded.lstrip(" "))
    is_bullet, content_no_bullet = _strip_bullet(expanded)
    content = content_no_bullet.strip()
    return indent, is_bullet, content, raw.rstrip()


def _norm_tag(line: str) -> Optional[Tuple[str, str]]:
    """
    Detects card tag on a line (supports toggle style "- Question:" by stripping bullet).
    Returns ("question"|"mcq", payload_text) or None.
    """
    _, _, content, _ = _analyze_line(line)
    m = QUESTION_TAG_RE.match(content)
    if m:
        return "question", (m.group(2) or "").strip()
    m = MCQ_TAG_RE.match(content)
    if m:
        return "mcq", (m.group(2) or "").strip()
    return None


def _is_heading_or_rule(line: str) -> bool:
    s = line.strip()
    if not s:
        return False
    if s.startswith("#"):
        return True
    if s == "---" or s.startswith("---"):
        return True
    return False


def parse_markdown(md_text: str) -> List[ParsedCard]:
    lines = md_text.splitlines()
    cards: List[ParsedCard] = []
    i = 0

    def at_new_card(idx: int) -> bool:
        if idx < 0 or idx >= len(lines):
            return False
        return _norm_tag(lines[idx]) is not None

    while i < len(lines):
        tag_info = _norm_tag(lines[i])
        if not tag_info:
            i += 1
            continue

        tag, payload = tag_info

        # ------------------------
        # Q&A
        # ------------------------
        if tag == "question":
            front = payload
            raw_block = [lines[i]]
            i += 1

            # Collect everything until next card OR heading/rule.
            back_lines: List[str] = []
            while i < len(lines) and not at_new_card(i) and not _is_heading_or_rule(lines[i]):
                raw_block.append(lines[i])

                indent, is_bullet, content, raw = _analyze_line(lines[i])

                # Skip leading blank lines
                if not back_lines and not content:
                    i += 1
                    continue

                # Keep meaningful lines. Preserve list item text without the bullet marker.
                if content:
                    back_lines.append(content)
                else:
                    # preserve paragraph breaks once we've started
                    if back_lines and (back_lines[-1] != ""):
                        back_lines.append("")
                i += 1

            back = "\n".join(back_lines).strip()
            cards.append(
                ParsedCard(
                    card_type="qa",
                    front=front,
                    back=back,
                    raw="\n".join(raw_block),
                )
            )
            continue

        # ------------------------
        # MCQ
        # ------------------------
        if tag == "mcq":
            stem = payload
            raw_block = [lines[i]]
            i += 1

            options: List[str] = []
            answer_lines: List[str] = []
            seen_answer = False

            while i < len(lines) and not at_new_card(i) and not _is_heading_or_rule(lines[i]):
                raw_block.append(lines[i])
                indent, is_bullet, content, raw = _analyze_line(lines[i])

                # ignore blank lines
                if not content:
                    i += 1
                    continue

                # Detect Answer: (also works if it's a bullet like "- Answer:")
                m_ans = ANSWER_TAG_RE.match(content)
                if m_ans:
                    seen_answer = True
                    inline = (m_ans.group(1) or "").strip()
                    if inline:
                        answer_lines.append(inline)
                    i += 1
                    # If no inline answer, the next non-empty line becomes the start of the answer
                    continue

                if not seen_answer:
                    # Options are bullet lines after the stem (Notion export uses "-" for these)
                    if is_bullet:
                        options.append(content)
                        i += 1
                        continue
                    # Non-bullet content before Answer: => stop MCQ block
                    break

                # We are in answer capture mode:
                # Accept bullet OR flat paragraph line as answer (your Notion “tabbed” often exports flat).
                answer_lines.append(content)
                i += 1

                # Also capture any immediately-following sub-lines that are indented/bulleted
                # until we hit a blank line + non-bullet paragraph *or* next card/heading/rule.
                while i < len(lines) and not at_new_card(i) and not _is_heading_or_rule(lines[i]):
                    raw_block.append(lines[i])
                    ind2, bullet2, content2, raw2 = _analyze_line(lines[i])

                    if not content2:
                        # allow blank line inside answer to keep formatting
                        if answer_lines and answer_lines[-1] != "":
                            answer_lines.append("")
                        i += 1
                        continue

                    # If we hit a new Answer: accidentally, treat it as restart (rare)
                    if ANSWER_TAG_RE.match(content2):
                        seen_answer = True
                        i += 1
                        continue

                    # Keep nested bullets / indented lines as part of answer
                    if bullet2 or ind2 > 0:
                        answer_lines.append(content2)
                        i += 1
                        continue

                    # Flat, non-bullet paragraph after we've started answer:
                    # treat as continuation ONLY if it immediately follows (no blank gap).
                    # If the previous captured line is blank, stop (likely new note section).
                    if answer_lines and answer_lines[-1] == "":
                        break

                    answer_lines.append(content2)
                    i += 1

                break  # done with this MCQ after capturing answer block

            front = stem + ("\n" + "\n".join(options) if options else "")
            back = "\n".join(answer_lines).strip()
            cards.append(
                ParsedCard(
                    card_type="mcq",
                    front=front.strip(),
                    back=back,
                    raw="\n".join(raw_block),
                )
            )
            continue

    return cards

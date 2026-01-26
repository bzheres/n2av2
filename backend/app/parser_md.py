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


# Match tags anywhere a Notion export might put them:
#   Question: ...
#   Q: ...
#   - Question: ...
#   * MCQ: ...
_TAG_RE = re.compile(
    r"""^\s*(?:[-*•]\s*)?(?P<tag>question|q|quesition|quesiton|mcq|mcu)\s*:\s*(?P<body>.*)$""",
    re.IGNORECASE,
)

# Answer tag (toggle-style too):
#   Answer:
#   - Answer:
#   Answer: B) ...
_ANSWER_RE = re.compile(r"""^\s*(?:[-*•]\s*)?answer\s*:\s*(?P<body>.*)$""", re.IGNORECASE)

# Option-ish lines (very permissive). Examples:
#   A) foo
#   B. foo
#   1) foo
#   1. foo
#   - A) foo
#   * 2) foo
_OPT_RE = re.compile(r"""^\s*(?:[-*•]\s*)?(?:\(?[A-Da-d]\)?[.)]|[0-9]{1,2}[.)])\s+.+$""")


def _is_tag(line: str) -> Optional[Tuple[str, str]]:
    m = _TAG_RE.match(line)
    if not m:
        return None
    tag = m.group("tag").lower()
    body = (m.group("body") or "").strip()

    if tag in ("question", "q", "quesition", "quesiton"):
        return ("question", body)
    if tag in ("mcq", "mcu"):
        return ("mcq", body)
    return None


def _strip_list_prefix(s: str) -> str:
    # Remove leading indentation + common list markers
    return s.lstrip(" \t").lstrip("-*•").lstrip(" \t").rstrip()


def parse_markdown(md_text: str) -> List[ParsedCard]:
    lines = md_text.splitlines()
    cards: List[ParsedCard] = []

    i = 0
    while i < len(lines):
        tagged = _is_tag(lines[i])
        if not tagged:
            i += 1
            continue

        tag, header = tagged
        start_i = i
        i += 1

        # Collect block lines until next tag
        block: List[str] = []
        while i < len(lines):
            if _is_tag(lines[i]):
                break
            block.append(lines[i])
            i += 1

        raw_block = "\n".join([lines[start_i]] + block).strip()

        if tag == "question":
            q = header.strip()
            if not q:
                # If empty after "Question:", try to use the next non-empty line as the question
                for ln in block:
                    if ln.strip():
                        q = _strip_list_prefix(ln)
                        break

            # Q&A answer strategy (permissive):
            # - If an Answer: label exists, use everything after it (including unindented)
            # - Else use all meaningful lines in the block (excluding headings/hr when possible)
            ans_lines: List[str] = []
            in_answer = False
            saw_answer_label = False

            for ln in block:
                am = _ANSWER_RE.match(ln)
                if am:
                    saw_answer_label = True
                    in_answer = True
                    inline = (am.group("body") or "").strip()
                    if inline:
                        ans_lines.append(inline)
                    continue

                if saw_answer_label and not in_answer:
                    continue

                if saw_answer_label and in_answer:
                    # take almost everything (except pure separators)
                    if ln.strip() in ("---", "***"):
                        continue
                    ans_lines.append(_strip_list_prefix(ln))
                else:
                    # no Answer: label: still take content (Notion often exports flat)
                    if not ln.strip():
                        # keep blank lines only if we already started capturing
                        if ans_lines:
                            ans_lines.append("")
                        continue
                    if ln.strip().startswith("#") and not ans_lines:
                        # ignore headings before answer starts
                        continue
                    if ln.strip() in ("---", "***") and not ans_lines:
                        continue
                    ans_lines.append(_strip_list_prefix(ln))

            back = "\n".join([x.rstrip() for x in ans_lines]).strip()
            cards.append(ParsedCard(card_type="qa", front=q.strip(), back=back, raw=raw_block))
            continue

        if tag == "mcq":
            stem = header.strip()
            if not stem:
                # If empty after "MCQ:", fall back to first non-empty line in block
                for ln in block:
                    if ln.strip() and not _ANSWER_RE.match(ln):
                        stem = _strip_list_prefix(ln)
                        break

            options_lines: List[str] = []
            answer_lines: List[str] = []
            in_answer = False

            for ln in block:
                am = _ANSWER_RE.match(ln)
                if am:
                    in_answer = True
                    inline = (am.group("body") or "").strip()
                    if inline:
                        answer_lines.append(_strip_list_prefix(inline))
                    continue

                if not ln.strip():
                    continue

                if in_answer:
                    # capture answer even if it is NOT indented (Notion can do this)
                    if ln.strip() in ("---", "***"):
                        continue
                    answer_lines.append(_strip_list_prefix(ln))
                else:
                    # capture options very permissively:
                    # - lines that look like options (A) / 1) etc
                    # - OR bulleted lines (common Notion export)
                    stripped = _strip_list_prefix(ln)
                    if _OPT_RE.match(ln) or ln.lstrip().startswith(("-", "*", "•")):
                        options_lines.append(stripped)
                    else:
                        # allow flat options too if they look like them after stripping
                        if _OPT_RE.match(stripped):
                            options_lines.append(stripped)
                        else:
                            # ignore other commentary lines in MCQ block
                            continue

            # If no explicit Answer: section, try a last-ditch heuristic: last option-like line might be the answer (rare)
            answer = "\n".join([x for x in answer_lines if x.strip()]).strip()

            front = stem
            if options_lines:
                front = stem + "\n" + "\n".join(options_lines)

            cards.append(ParsedCard(card_type="mcq", front=front.strip(), back=answer.strip(), raw=raw_block))
            continue

    return cards

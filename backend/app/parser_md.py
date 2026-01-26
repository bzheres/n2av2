from __future__ import annotations

from dataclasses import dataclass
from typing import List
import re


@dataclass
class ParsedCard:
    card_type: str
    front: str
    back: str
    raw: str | None = None


# Accept common typos + shorthand
_TAG_Q = ("question:", "q:", "quesition:", "quesiton:")
_TAG_M = ("mcq:", "mcu:")
_TAG_A = ("answer:", "ans:", "a:")

_BULLETS = ("- ", "* ", "• ")

# Option lines like "A) ..." / "A. ..." / "1) ..." / "1. ..."
_OPT_RE = re.compile(r"^([A-Ha-h]|[1-9]|1[0-9]|20)[\)\.\:]\s+")


def _strip_list_prefixes(line: str) -> str:
    """
    Remove leading whitespace + one bullet marker (-/*/•) repeatedly.
    This lets us treat toggle-style lines like "- Question:" as normal tags.
    """
    s = line.lstrip(" \t")
    changed = True
    while changed:
        changed = False
        for b in _BULLETS:
            if s.startswith(b):
                s = s[len(b) :].lstrip(" \t")
                changed = True
                break
    return s


def _norm_tag(line: str) -> str | None:
    s = _strip_list_prefixes(line).strip().lower()
    if any(s.startswith(t) for t in _TAG_Q):
        return "question"
    if any(s.startswith(t) for t in _TAG_M):
        return "mcq"
    return None


def _is_answer_tag(line: str) -> bool:
    s = _strip_list_prefixes(line).strip().lower()
    return any(s.startswith(t) for t in _TAG_A)


def _after_colon(line: str) -> str:
    parts = line.split(":", 1)
    return parts[1].strip() if len(parts) == 2 else ""


def _is_indented_or_bulleted(line: str) -> bool:
    # Notion exports nested content with 2 spaces a lot, so accept ANY leading whitespace.
    if line.startswith((" ", "\t")):
        return True
    s = line.lstrip(" \t")
    return s.startswith(_BULLETS)


def _clean_payload(line: str) -> str:
    """
    Remove indentation + a single leading bullet marker, keep the remaining text.
    """
    s = line.lstrip(" \t")
    for b in _BULLETS:
        if s.startswith(b):
            s = s[len(b) :]
            break
    return s.rstrip()


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
            q = _after_colon(_strip_list_prefixes(line))
            i += 1

            ans_lines: List[str] = []
            started = False

            while i < len(lines):
                nxt = lines[i]

                # stop when next card starts
                if _norm_tag(nxt):
                    break

                # blank lines: keep only after answer started
                if nxt.strip() == "":
                    if started:
                        ans_lines.append("")
                    i += 1
                    continue

                # capture any indented or bulleted line (2 spaces, 4 spaces, tabs, bullets)
                if _is_indented_or_bulleted(nxt):
                    ans_lines.append(_clean_payload(nxt))
                    started = True
                    i += 1
                    continue

                # non-indented line:
                if started:
                    break  # end answer block once we hit normal text
                i += 1  # ignore stray body text before answer starts

            back = "\n".join(ans_lines).strip()
            cards.append(ParsedCard(card_type="qa", front=q, back=back))
            continue

        # -------------------------
        # MCQ
        # -------------------------
        if tag == "mcq":
            stem = _after_colon(_strip_list_prefixes(line))
            i += 1

            options: List[str] = []
            answer = ""
            in_answer = False

            while i < len(lines):
                nxt = lines[i]

                # stop when next card starts
                if _norm_tag(nxt):
                    break

                if nxt.strip() == "":
                    i += 1
                    continue

                # Answer tag may also be toggle-style "- Answer:"
                if _is_answer_tag(nxt):
                    in_answer = True
                    i += 1
                    continue

                if in_answer:
                    # Take the first “real” line after Answer:
                    # accept indented, bulleted, or an option-looking line
                    payload = _clean_payload(nxt).strip()
                    if payload and (_is_indented_or_bulleted(nxt) or _OPT_RE.match(payload)):
                        answer = payload
                        i += 1

                        # allow extra indented lines as explanation (optional)
                        extra: List[str] = []
                        while i < len(lines):
                            nxt2 = lines[i]
                            if nxt2.strip() == "":
                                extra.append("")
                                i += 1
                                continue
                            if _norm_tag(nxt2) or _is_answer_tag(nxt2):
                                break
                            if _is_indented_or_bulleted(nxt2):
                                extra.append(_clean_payload(nxt2))
                                i += 1
                                continue
                            break

                        if extra:
                            answer = (answer + "\n" + "\n".join(extra)).strip()
                        continue

                    break  # end MCQ block if answer content isn't in a recognizable format

                # Options: accept indented/bulleted lines
                if _is_indented_or_bulleted(nxt):
                    payload = _clean_payload(nxt)
                    if payload:
                        options.append(payload)
                    i += 1
                    continue

                # Rare: allow non-indented option lines like "A) ..."
                payload = _clean_payload(nxt)
                if _OPT_RE.match(payload):
                    options.append(payload)
                    i += 1
                    continue

                break

            front = stem + ("\n" + "\n".join(options) if options else "")
            cards.append(ParsedCard(card_type="mcq", front=front, back=answer.strip()))
            continue

    return cards

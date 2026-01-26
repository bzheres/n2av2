from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class ParsedCard:
    card_type: str
    front: str
    back: str
    raw: str | None = None


BULLETS = ("- ", "* ", "• ")


def _strip_toggle_prefix(line: str) -> str:
    """
    Removes a single leading toggle/list prefix like:
      "- Question: ..."
      "  - Answer: ..."
      "* MCQ: ..."
    Keeps the rest intact.
    """
    s = line.lstrip(" \t")
    for b in BULLETS:
        if s.startswith(b):
            return s[len(b) :]
    return s


def _norm_tag(line: str) -> Optional[str]:
    """
    Recognizes Question/MCQ tags even when exported as toggles:
      "- Question: ..."
      "- MCQ: ..."
    Also tolerates common typos.
    """
    s = _strip_toggle_prefix(line).strip().lower()

    if s.startswith(("question:", "quesition:", "quesiton:")):
        return "question"
    if s.startswith(("mcq:", "mcu:")):
        return "mcq"
    return None


def _is_answer_label(line: str) -> bool:
    """
    Recognize Answer: lines even when exported as toggles:
      "Answer:"
      "- Answer:"
      "  - Answer:"
    """
    s = _strip_toggle_prefix(line).strip().lower()
    return s.startswith("answer:")


def _is_indented_or_list(line: str) -> bool:
    """
    Treat as content line if it's indented (ANY leading whitespace, including 1-2 spaces),
    or if it begins with a list/toggle bullet.
    This is what fixes Notion 'tab' exports that don't become literal \\t.
    """
    if not line:
        return False
    if line.startswith((" ", "\t")):
        return True
    s = line.lstrip(" \t")
    return s.startswith(BULLETS)


def _clean_content(line: str) -> str:
    """
    Remove leading indentation and a single bullet prefix, but preserve the actual text.
    """
    s = line.lstrip(" \t")
    for b in BULLETS:
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
            s = _strip_toggle_prefix(line)
            q = s.split(":", 1)[1].strip()
            i += 1

            ans_lines: List[str] = []

            while i < len(lines):
                nxt = lines[i]

                # next card starts
                if _norm_tag(nxt):
                    break

                # blank lines: keep only if we've started capturing
                if nxt.strip() == "":
                    if ans_lines:
                        ans_lines.append("")
                    i += 1
                    continue

                # answer content lines
                if _is_indented_or_list(nxt):
                    ans_lines.append(_clean_content(nxt))
                    i += 1
                    continue

                # If we already started capturing and we hit non-indented text, end the answer block.
                if ans_lines:
                    break

                # Otherwise ignore stray non-indented lines between Question and Answer
                i += 1

            back = "\n".join(ans_lines).strip()
            cards.append(ParsedCard(card_type="qa", front=q, back=back))
            continue

        # -------------------------
        # MCQ
        # -------------------------
        if tag == "mcq":
            s = _strip_toggle_prefix(line)
            stem = s.split(":", 1)[1].strip()
            i += 1

            options: List[str] = []
            answer = ""
            in_answer = False

            while i < len(lines):
                nxt = lines[i]

                # next card starts
                if _norm_tag(nxt):
                    break

                # skip blank lines
                if nxt.strip() == "":
                    i += 1
                    continue

                # answer label
                if _is_answer_label(nxt):
                    in_answer = True
                    i += 1
                    continue

                if in_answer:
                    # Accept answer line if it is indented OR bullet/toggle-style
                    if _is_indented_or_list(nxt):
                        answer = _clean_content(nxt).strip()
                        i += 1
                        # optionally: consume additional indented lines as part of answer (rare)
                        while i < len(lines) and lines[i].strip() != "" and _is_indented_or_list(lines[i]):
                            # If user puts multiple answer lines, join them
                            extra = _clean_content(lines[i]).strip()
                            if extra:
                                answer = (answer + "\n" + extra).strip()
                            i += 1
                        continue
                    break

                # options lines
                if _is_indented_or_list(nxt):
                    options.append(_clean_content(nxt))
                    i += 1
                    continue

                # stop if unindented unexpected content
                break

            front = stem + ("\n" + "\n".join(options) if options else "")
            cards.append(ParsedCard(card_type="mcq", front=front, back=answer.strip()))
            continue

    return cards

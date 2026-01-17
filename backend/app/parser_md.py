from __future__ import annotations
from dataclasses import dataclass
from typing import List

@dataclass
class ParsedCard:
    card_type: str
    front: str
    back: str
    raw: str | None = None


def _norm_tag(line: str) -> str | None:
    s = line.strip().lower()
    if s.startswith("question:") or s.startswith("quesition:") or s.startswith("quesiton:"):
        return "question"
    if s.startswith("mcq:") or s.startswith("mcu:"):
        return "mcq"
    return None


def _is_answer_or_option_line(line: str) -> bool:
    """Treat these as 'belonging to the current block'."""
    return line.startswith(("    ", "\t", "- ", "* ", "• "))


def _strip_prefix(line: str) -> str:
    """Remove indentation/bullet prefix while preserving the content."""
    # For indents, remove leading whitespace; for bullets, remove bullet markers too.
    return line.lstrip(" \t-*•").rstrip()


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
            q = line.split(":", 1)[1].strip()
            i += 1
            ans_lines: List[str] = []

            while i < len(lines):
                nxt = lines[i]
                if _norm_tag(nxt):
                    break

                if _is_answer_or_option_line(nxt):
                    ans_lines.append(_strip_prefix(nxt))
                elif nxt.strip() == "":
                    if ans_lines:
                        ans_lines.append("")
                else:
                    if ans_lines:
                        break
                i += 1

            back = "\n".join(ans_lines).strip()
            cards.append(ParsedCard(card_type="qa", front=q, back=back))
            continue

        # -------------------------
        # MCQ
        # -------------------------
        if tag == "mcq":
            stem = line.split(":", 1)[1].strip()
            i += 1

            options: List[str] = []
            answer_lines: List[str] = []
            in_answer = False

            while i < len(lines):
                nxt = lines[i]
                if _norm_tag(nxt):
                    break

                # Ignore leading blank lines between blocks
                if nxt.strip() == "":
                    i += 1
                    continue

                # Detect Answer: (supports "Answer:" alone OR "Answer: B) ..." inline)
                if nxt.strip().lower().startswith("answer:"):
                    in_answer = True
                    inline = nxt.split(":", 1)[1].strip()
                    if inline:
                        answer_lines.append(inline)
                    i += 1
                    continue

                # Collect multi-line answer (indented OR bulleted)
                if in_answer:
                    if nxt.startswith(("    ", "\t", "- ", "* ", "• ")):
                        answer_lines.append(_strip_prefix(nxt))
                        i += 1
                        continue
                    # any non-indented line ends the answer block
                    break

                # Collect options (indented OR bulleted)
                if nxt.startswith(("    ", "\t", "- ", "* ", "• ")):
                    options.append(_strip_prefix(nxt))
                    i += 1
                    continue

                # Any other non-empty, non-indented line ends the MCQ block
                break

            front = stem + ("\n" + "\n".join(options) if options else "")
            back = "\n".join(answer_lines).strip()
            cards.append(ParsedCard(card_type="mcq", front=front, back=back))
            continue

    return cards

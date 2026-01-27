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

        if tag == "question":
            q = line.split(":", 1)[1].strip()
            i += 1
            ans_lines = []
            while i < len(lines):
                nxt = lines[i]
                if _norm_tag(nxt):
                    break
                if nxt.startswith(("    ", "\t", "- ", "* ")):
                    ans_lines.append(nxt.lstrip(" \t-*•").rstrip())
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

        if tag == "mcq":
            stem = line.split(":", 1)[1].strip()
            i += 1
            options = []
            answer = ""
            in_answer = False
            while i < len(lines):
                nxt = lines[i]
                if _norm_tag(nxt):
                    break
                if nxt.strip() == "":
                    i += 1
                    continue
                if nxt.strip().lower().startswith("answer:"):
                    in_answer = True
                    i += 1
                    continue
                if in_answer:
                    if nxt.startswith(("    ", "\t")):
                        answer = nxt.strip()
                        i += 1
                        continue
                    break
                if nxt.startswith(("    ", "\t", "- ", "* ")):
                    options.append(nxt.lstrip(" \t-*•").rstrip())
                    i += 1
                    continue
                break
            front = stem + ("\n" + "\n".join(options) if options else "")
            cards.append(ParsedCard(card_type="mcq", front=front, back=answer.strip()))
            continue

    return cards

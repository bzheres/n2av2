from __future__ import annotations

import json
import httpx
from typing import Literal, TypedDict
from ..config import settings


AIMode = Literal["content", "format", "both"]


class AIResult(TypedDict):
    changed: bool
    flag: str
    feedback: str
    front: str
    back: str


SYSTEM_PROMPT_CONTENT = """You are reviewing flashcards for spaced-repetition learning.

CRITICAL RULES (must follow):
- DO NOT add new information
- DO NOT expand answers
- DO NOT invent examples
- DO NOT change meaning
- DO NOT "improve" cards that are already clear and correct

You MAY:
- Fix spelling and grammar (English US vs English UK/AUS)
- Rephrase wording ONLY if confusing or ambiguous
- Flag ambiguity if multiple interpretations exist

If the card is already clear and correct:
- Set changed = false
- Return the original text unchanged
- flag = "ok"

Return ONLY valid JSON with keys:
changed, flag, feedback, front, back
"""

SYSTEM_PROMPT_FORMAT = """You are formatting flashcards for spaced-repetition learning (Anki-style readability).

CRITICAL RULES (must follow):
- DO NOT add new information
- DO NOT remove information
- DO NOT expand answers
- DO NOT invent examples
- DO NOT change meaning
- Only improve readability/structure/formatting.

Formatting goals:
- Make the BACK easy to skim: use short lines, bullets, numbering, and clear labels.
- Preserve equations/symbols. Keep units intact.
- Prefer simple Markdown that will look good in Anki:
  - Use blank lines between sections
  - Use bullets (-) or numbering (1., 2., 3.)
  - Use **bold** for key labels/terms (sparingly)
- If the FRONT has multiple lines, keep it clean and consistent.
- If already nicely formatted, set changed=false and return original.

IMPORTANT:
- “Changed” should be true if you changed formatting/structure, even if meaning is identical.
- flag should be "format_ok" if unchanged or "format_changed" if you changed formatting.

Return ONLY valid JSON with keys:
changed, flag, feedback, front, back
"""

SYSTEM_PROMPT_BOTH = """You are reviewing AND formatting flashcards for spaced-repetition learning.

CRITICAL RULES (must follow):
- DO NOT add new information
- DO NOT remove information
- DO NOT expand answers
- DO NOT invent examples
- DO NOT change meaning
- You may fix spelling/grammar, and improve clarity ONLY if needed
- You should also improve formatting/readability as per Anki-style

Formatting goals:
- Make the BACK easy to skim: use short lines, bullets/numbering, and clear labels
- Preserve equations/symbols and units
- Use simple Markdown: blank lines, bullets, and **bold** labels sparingly

If the card is already clear and nicely formatted:
- Set changed=false and return original
- flag="ok"

Return ONLY valid JSON with keys:
changed, flag, feedback, front, back
"""


def _system_prompt_for(mode: AIMode) -> str:
    if mode == "format":
        return SYSTEM_PROMPT_FORMAT
    if mode == "both":
        return SYSTEM_PROMPT_BOTH
    return SYSTEM_PROMPT_CONTENT


async def review_card(front: str, back: str, variant: str = "en-AU", mode: AIMode = "content") -> AIResult:
    if not settings.OPENAI_API_KEY:
        return AIResult(changed=False, flag="ai_disabled", feedback="AI key not configured", front=front, back=back)

    url = "https://api.openai.com/v1/responses"
    headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"}

    system_prompt = _system_prompt_for(mode)

    payload = {
        "model": settings.OPENAI_MODEL,
        "input": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Language variant: {variant}\n"
                    f"Mode: {mode}\n\n"
                    f"Front:\n{front}\n\n"
                    f"Back:\n{back}\n"
                ),
            },
        ],
        "text": {"format": {"type": "json_object"}},
        "temperature": 0.2,
    }

    async with httpx.AsyncClient(timeout=35) as client:
        r = await client.post(url, headers=headers, json=payload)
        r.raise_for_status()
        data = r.json()

    text = None
    for item in data.get("output", []):
        if item.get("type") == "message":
            for c in item.get("content", []):
                if c.get("type") == "output_text":
                    text = c.get("text")
                    break
        if text:
            break

    if not text:
        text = json.dumps({"changed": False, "flag": "ok", "feedback": "", "front": front, "back": back})

    try:
        obj = json.loads(text)
        return AIResult(
            changed=bool(obj.get("changed", False)),
            flag=str(obj.get("flag", "ok")),
            feedback=str(obj.get("feedback", "")),
            front=str(obj.get("front", front)),
            back=str(obj.get("back", back)),
        )
    except Exception:
        return AIResult(changed=False, flag="parse_error", feedback="AI returned invalid JSON", front=front, back=back)

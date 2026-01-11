from __future__ import annotations
import json
import httpx
from typing import TypedDict
from ..config import settings

class AIResult(TypedDict):
    changed: bool
    flag: str
    feedback: str
    front: str
    back: str

SYSTEM_PROMPT = """You are reviewing flashcards for spaced-repetition learning.

CRITICAL RULES (must follow):
- DO NOT add new information
- DO NOT expand answers
- DO NOT invent examples
- DO NOT change meaning
- DO NOT improve cards that are already clear and correct

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

async def review_card(front: str, back: str, variant: str = "en-AU") -> AIResult:
    if not settings.OPENAI_API_KEY:
        return AIResult(changed=False, flag="ai_disabled", feedback="AI key not configured", front=front, back=back)

    url = "https://api.openai.com/v1/responses"
    headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": settings.OPENAI_MODEL,
        "input": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Language variant: {variant}\n\nFront:\n{front}\n\nBack:\n{back}"},
        ],
        "text": {"format": {"type": "json_object"}},
        "temperature": 0.2,
    }

    async with httpx.AsyncClient(timeout=25) as client:
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

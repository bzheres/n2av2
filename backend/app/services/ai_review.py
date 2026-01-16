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


# ---------------------------------------------------------------------
# Variant normalization
# ---------------------------------------------------------------------
def _norm_variant(v: str) -> str:
    raw = (v or "").strip().lower()

    if raw in ("uk_au", "uk", "au", "aus", "en_au", "en-au", "en-gb", "en_uk", "en-uk"):
        return "en-AU"
    if raw in ("us", "usa", "en_us", "en-us"):
        return "en-US"

    if raw.startswith("en-"):
        parts = raw.split("-", 1)
        if len(parts) == 2:
            return f"{parts[0]}-{parts[1].upper()}"

    return "en-AU"


# ---------------------------------------------------------------------
# Language variant policy
# ---------------------------------------------------------------------
LANGUAGE_VARIANT_POLICY = """LANGUAGE VARIANT RULE (MANDATORY):
- You MUST normalise spelling and medical terminology to the requested language variant.
- Apply this to BOTH Front and Back.
- If ANY word(s) are in the "other" variant, you MUST correct them AND set changed=true.

Examples (not exhaustive):
- en-US: color, center, pediatric, anesthesia, optimize, hemorrhage, aluminum, esophagus, meter, liter, artifact
- en-AU (UK/AUS): colour, centre, paediatric, anaesthesia, optimise, haemorrhage, aluminium, oesophagus, metre, litre, artefact

IMPORTANT:
- If you ONLY perform variant normalisation:
  - flag = "variant_normalised"
  - feedback = short note like "Normalised spelling to en-AU"
- If NO variant changes AND no other improvements:
  - changed=false
  - return original text unchanged
"""


# ---------------------------------------------------------------------
# CRITICAL INCORRECT CONTENT RULE
# ---------------------------------------------------------------------
INCORRECT_CONTENT_POLICY = """FACTUAL CORRECTNESS RULE (CRITICAL):
- If the answer is factually incorrect, misleading, or wrong:
  - Set flag = "incorrect"
  - Set changed = false
  - DO NOT provide a corrected or alternative answer
  - DO NOT modify Front or Back
  - Feedback MUST explain briefly why the content is incorrect

This rule OVERRIDES all other rules.
"""


SYSTEM_PROMPT_CONTENT = f"""You are reviewing flashcards for spaced-repetition learning.

CRITICAL RULES (must follow):
- DO NOT add new information
- DO NOT expand answers
- DO NOT invent examples
- DO NOT change meaning

{INCORRECT_CONTENT_POLICY}
{LANGUAGE_VARIANT_POLICY}

You MAY (only if needed, without changing meaning):
- Fix typos/grammar consistent with the requested variant
- Rephrase wording ONLY if confusing or ambiguous

If the card is already clear and correct:
- changed=false
- flag="ok"
- return original text unchanged

Return ONLY valid JSON with keys:
changed, flag, feedback, front, back
"""


SYSTEM_PROMPT_FORMAT = """You are formatting flashcards for spaced-repetition learning (Anki-style readability).

CRITICAL RULES:
- DO NOT add new information
- DO NOT remove information
- DO NOT expand answers
- DO NOT invent examples
- DO NOT change meaning
- DO NOT assess factual correctness

Formatting goals:
- Improve structure, spacing, bullets, readability
- Preserve equations, symbols, units
- Use simple Markdown suitable for Anki

IMPORTANT:
- DO NOT perform language variant normalisation
- DO NOT flag incorrect answers
- flag = "format_changed" or "format_ok"

Return ONLY valid JSON with keys:
changed, flag, feedback, front, back
"""


SYSTEM_PROMPT_BOTH = f"""You are reviewing AND formatting flashcards for spaced-repetition learning.

CRITICAL RULES:
- DO NOT add new information
- DO NOT remove information
- DO NOT expand answers
- DO NOT invent examples
- DO NOT change meaning

{INCORRECT_CONTENT_POLICY}
{LANGUAGE_VARIANT_POLICY}

You MAY:
- Fix spelling/grammar (variant-consistent)
- Improve clarity ONLY if needed
- Improve formatting/readability

If the card is already clear and correct:
- changed=false
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
        return AIResult(
            changed=False,
            flag="ai_disabled",
            feedback="AI key not configured",
            front=front,
            back=back,
        )

    norm_variant = _norm_variant(variant)
    system_prompt = _system_prompt_for(mode)

    url = "https://api.openai.com/v1/responses"
    headers = {
        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": settings.OPENAI_MODEL,
        "input": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Language variant: {norm_variant}\n"
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
        return AIResult(
            changed=False,
            flag="ok",
            feedback="",
            front=front,
            back=back,
        )

    try:
        obj = json.loads(text)

        flag = str(obj.get("flag", "ok")).strip().lower()

        # HARD SAFETY: incorrect → never modify content
        if flag == "incorrect":
            return AIResult(
                changed=False,
                flag="incorrect",
                feedback=str(obj.get("feedback", "")).strip(),
                front=front,
                back=back,
            )

        return AIResult(
            changed=bool(obj.get("changed", False)),
            flag=str(obj.get("flag", "ok")),
            feedback=str(obj.get("feedback", "")),
            front=str(obj.get("front", front)),
            back=str(obj.get("back", back)),
        )

    except Exception:
        return AIResult(
            changed=False,
            flag="parse_error",
            feedback="AI returned invalid JSON",
            front=front,
            back=back,
        )

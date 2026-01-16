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
# Your UI might send "uk_au" or "us". We hard-normalize here so the AI
# sees consistent values and follows the rule reliably.
# ---------------------------------------------------------------------
def _norm_variant(v: str) -> str:
    raw = (v or "").strip().lower()

    # common aliases from UI / older code
    if raw in ("uk_au", "uk", "au", "aus", "en_au", "en-au", "en-gb", "en_uk", "en-uk"):
        return "en-AU"
    if raw in ("us", "usa", "en_us", "en-us"):
        return "en-US"

    # already valid-ish
    if raw.startswith("en-"):
        # Preserve en-XX casing
        parts = raw.split("-", 1)
        if len(parts) == 2:
            return f"{parts[0]}-{parts[1].upper()}"
        return "en-AU"

    # default
    return "en-AU"


# ---------------------------------------------------------------------
# Language variant policy: force US vs UK/AUS normalisation when mode
# includes "content" or "both". This ensures the toggle visibly works.
# ---------------------------------------------------------------------
LANGUAGE_VARIANT_POLICY = """LANGUAGE VARIANT RULE (MANDATORY):
- You MUST normalise spelling and medical terminology to the requested language variant.
- Apply this to BOTH Front and Back.
- If ANY word(s) are in the "other" variant, you MUST correct them AND set changed=true.

Examples (not exhaustive):
- en-US: color, center, pediatric, anesthesia, optimize, hemorrhage, aluminum, esophagus, meter, liter, artifact
- en-AU (UK/AUS): colour, centre, paediatric, anaesthesia, optimise, haemorrhage, aluminium, oesophagus, metre, litre, artefact

IMPORTANT:
- If you only perform variant normalisation (and no other edits), set:
  - flag = "variant_normalised"
  - feedback = a short note like "Normalised spelling to en-AU" (or en-US).
- If NO variant changes are needed AND no other improvements are needed:
  - changed=false and return the original text unchanged.
"""


SYSTEM_PROMPT_CONTENT = f"""You are reviewing flashcards for spaced-repetition learning.

CRITICAL RULES (must follow):
- DO NOT add new information
- DO NOT expand answers
- DO NOT invent examples
- DO NOT change meaning

{LANGUAGE_VARIANT_POLICY}

You MAY (only if needed, and without changing meaning):
- Fix typos/grammar consistent with the requested variant
- Rephrase wording ONLY if confusing or ambiguous
- Flag ambiguity if multiple interpretations exist

If the card is already clear/correct AND no language-variant changes are needed:
- Set changed=false
- Return the original text unchanged
- flag="ok"

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

IMPORTANT:
- In FORMAT mode, do NOT do spelling/variant conversions unless fixing an actual typo.
  (Variant enforcement is handled in "content" or "both" modes.)
- “Changed” should be true if you changed formatting/structure, even if meaning is identical.
- flag should be "format_ok" if unchanged or "format_changed" if you changed formatting.

Return ONLY valid JSON with keys:
changed, flag, feedback, front, back
"""


SYSTEM_PROMPT_BOTH = f"""You are reviewing AND formatting flashcards for spaced-repetition learning.

CRITICAL RULES (must follow):
- DO NOT add new information
- DO NOT remove information
- DO NOT expand answers
- DO NOT invent examples
- DO NOT change meaning

{LANGUAGE_VARIANT_POLICY}

You may:
- Fix spelling/grammar consistent with the requested variant
- Improve clarity ONLY if needed (no new information)
- Improve formatting/readability as per Anki-style

Formatting goals:
- Make the BACK easy to skim: use short lines, bullets/numbering, and clear labels
- Preserve equations/symbols and units
- Use simple Markdown: blank lines, bullets, and **bold** labels sparingly

If the card is already clear and nicely formatted AND no language-variant changes are needed:
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

    norm_variant = _norm_variant(variant)
    system_prompt = _system_prompt_for(mode)

    url = "https://api.openai.com/v1/responses"
    headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"}

    payload = {
        "model": settings.OPENAI_MODEL,
        "input": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Language variant (MANDATORY): {norm_variant}\n"
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

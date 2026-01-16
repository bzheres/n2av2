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
- Prefer skimmable backs: short lines, bullets, simple labels

IMPORTANT:
- DO NOT perform language variant normalisation
- DO NOT flag incorrect answers
- Set changed=true if you changed anything about formatting/structure
- flag = "format_changed" or "format_ok"

Return ONLY valid JSON with keys:
changed, flag, feedback, front, back
"""


def _extract_output_text(resp_json: dict, fallback: str) -> str:
    text = None
    for item in resp_json.get("output", []):
        if item.get("type") == "message":
            for c in item.get("content", []):
                if c.get("type") == "output_text":
                    text = c.get("text")
                    break
        if text:
            break
    return text or fallback


async def _call_ai(front: str, back: str, variant: str, mode: AIMode) -> AIResult:
    """
    Low-level AI call. mode is only 'content' or 'format' here.
    """
    norm_variant = _norm_variant(variant)

    system_prompt = SYSTEM_PROMPT_CONTENT if mode == "content" else SYSTEM_PROMPT_FORMAT

    url = "https://api.openai.com/v1/responses"
    headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"}

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

    fallback = json.dumps({"changed": False, "flag": "ok", "feedback": "", "front": front, "back": back})
    text = _extract_output_text(data, fallback)

    try:
        obj = json.loads(text)
        return AIResult(
            changed=bool(obj.get("changed", False)),
            flag=str(obj.get("flag", "ok")).strip() or "ok",
            feedback=str(obj.get("feedback", "")),
            front=str(obj.get("front", front)),
            back=str(obj.get("back", back)),
        )
    except Exception:
        return AIResult(changed=False, flag="parse_error", feedback="AI returned invalid JSON", front=front, back=back)


def _actually_changed(a_front: str, a_back: str, b_front: str, b_back: str) -> bool:
    return (a_front != (b_front or "")) or (a_back != (b_back or ""))


async def review_card(front: str, back: str, variant: str = "en-AU", mode: AIMode = "content") -> AIResult:
    if not settings.OPENAI_API_KEY:
        return AIResult(changed=False, flag="ai_disabled", feedback="AI key not configured", front=front, back=back)

    # -------------------------
    # CONTENT ONLY
    # -------------------------
    if mode == "content":
        res = await _call_ai(front, back, variant, "content")

        # If incorrect: never change text
        if res["flag"].lower() == "incorrect":
            return AIResult(changed=False, flag="incorrect", feedback=res["feedback"].strip(), front=front, back=back)

        # truth-check "changed"
        if _actually_changed(res["front"], res["back"], front, back):
            if not res["changed"]:
                # force changed true if text differs
                res["changed"] = True
                if not res["feedback"].strip():
                    res["feedback"] = "Content/spelling adjusted for clarity."
        else:
            res["changed"] = False
            if res["flag"].lower() not in ("incorrect",):
                res["flag"] = "ok"

        return res

    # -------------------------
    # FORMAT ONLY
    # -------------------------
    if mode == "format":
        res = await _call_ai(front, back, variant, "format")

        # truth-check "changed"
        if _actually_changed(res["front"], res["back"], front, back):
            if not res["changed"]:
                res["changed"] = True
            if res["flag"].lower() not in ("format_changed",):
                res["flag"] = "format_changed"
            if not res["feedback"].strip():
                res["feedback"] = "Formatting changed for clarity."
        else:
            res["changed"] = False
            res["flag"] = "format_ok"
            if not res["feedback"].strip():
                res["feedback"] = ""

        return res

    # -------------------------
    # BOTH = 2-pass pipeline:
    #   1) content (incl incorrect + variant)
    #   2) format (on output of content)
    # -------------------------
    # Pass 1: content
    content_res = await _call_ai(front, back, variant, "content")

    # If incorrect: STOP, do not format, do not change
    if content_res["flag"].lower() == "incorrect":
        return AIResult(changed=False, flag="incorrect", feedback=content_res["feedback"].strip(), front=front, back=back)

    # Determine what content stage did
    content_changed = _actually_changed(content_res["front"], content_res["back"], front, back)

    # Use content output as input to formatting stage
    base_front = content_res["front"]
    base_back = content_res["back"]

    # Pass 2: format
    format_res = await _call_ai(base_front, base_back, variant, "format")
    format_changed = _actually_changed(format_res["front"], format_res["back"], base_front, base_back)

    final_front = format_res["front"]
    final_back = format_res["back"]

    any_changed = content_changed or format_changed

    # Decide flag + feedback
    # (We also preserve variant_normalised if that's all that happened.)
    cflag = (content_res["flag"] or "ok").strip()
    cflag_lower = cflag.lower()

    if not any_changed:
        return AIResult(changed=False, flag="ok", feedback="", front=front, back=back)

    # If only content changed
    if content_changed and not format_changed:
        # preserve variant_normalised if content stage only did variant
        out_flag = "variant_normalised" if cflag_lower == "variant_normalised" else "content_changed"
        out_feedback = (content_res["feedback"] or "").strip() or "Content/spelling adjusted for clarity."
        return AIResult(changed=True, flag=out_flag, feedback=out_feedback, front=base_front, back=base_back)

    # If only format changed
    if format_changed and not content_changed:
        out_feedback = (format_res["feedback"] or "").strip() or "Formatting changed for clarity."
        return AIResult(changed=True, flag="format_changed", feedback=out_feedback, front=final_front, back=final_back)

    # Both changed
    out_feedback_parts = []
    cf = (content_res["feedback"] or "").strip()
    ff = (format_res["feedback"] or "").strip()
    if cf:
        out_feedback_parts.append(cf)
    if ff and ff not in out_feedback_parts:
        out_feedback_parts.append(ff)
    out_feedback = " • ".join(out_feedback_parts) if out_feedback_parts else "Content and formatting changed for clarity."

    return AIResult(changed=True, flag="both_changed", feedback=out_feedback, front=final_front, back=final_back)

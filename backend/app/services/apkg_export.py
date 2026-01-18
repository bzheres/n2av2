from __future__ import annotations

import hashlib
import html
import os
import re
import tempfile
from typing import Iterable, Tuple

import genanki

from ..models import Card


# ---------------------------------------------------------------------
# Stable IDs (important for Anki / genanki)
# ---------------------------------------------------------------------
def _stable_id(*parts: str) -> int:
    """
    genanki expects a (signed) 64-bit-ish integer ID.
    We derive a stable one so re-exports don't duplicate models.
    """
    s = "|".join(parts).encode("utf-8")
    h = hashlib.sha1(s).digest()[:8]
    val = int.from_bytes(h, "big", signed=False)
    return val & ((1 << 63) - 1)


# ---------------------------------------------------------------------
# Markdown-ish → HTML helpers
# (small, safe subset for AI-formatted content)
# ---------------------------------------------------------------------
_md_bold_re = re.compile(r"\*\*(.+?)\*\*")
_md_italic_re = re.compile(r"(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)")
_md_code_re = re.compile(r"`([^`]+)`")


def _markdownish_to_plaintext(s: str) -> str:
    """
    Normalize a small subset of Notion/Markdown-like formatting
    BEFORE HTML escaping.
    """
    if not s:
        return ""

    s = s.replace("\r\n", "\n").replace("\r", "\n")

    lines = s.split("\n")
    out_lines = []

    for line in lines:
        stripped = line.lstrip()

        # Convert bullets: "- item" or "* item" → "• item"
        if stripped.startswith("- ") or stripped.startswith("* "):
            indent = len(line) - len(stripped)
            out_lines.append((" " * indent) + "• " + stripped[2:])
        else:
            out_lines.append(line)

    return "\n".join(out_lines)


def _field_to_html(field: str) -> str:
    """
    Convert AI-reviewed text into HTML suitable for Anki.

    Supports:
    - **bold** → <b>
    - *italic* → <i>
    - `code` → <code>
    - bullets → •
    - newlines → <br>

    We intentionally avoid full Markdown parsing.
    """
    s = "" if field is None else str(field)

    # Tabs → spaces (Anki-safe)
    s = s.replace("\t", "    ")

    # Normalize bullets / spacing BEFORE escaping
    s = _markdownish_to_plaintext(s)

    # Escape everything (prevents HTML injection)
    s = html.escape(s, quote=True)

    # Apply lightweight formatting on escaped text
    s = _md_code_re.sub(r"<code>\1</code>", s)
    s = _md_bold_re.sub(r"<b>\1</b>", s)
    s = _md_italic_re.sub(r"<i>\1</i>", s)

    # Newlines → <br>
    s = s.replace("\n", "<br>")

    return s


# ---------------------------------------------------------------------
# APKG builder
# ---------------------------------------------------------------------
def build_apkg(
    *,
    deck_name: str,
    cards: Iterable[Card],
    identity_key: str,
) -> Tuple[str, str]:
    """
    Returns: (apkg_path, suggested_filename)

    identity_key should be stable per user+project
    e.g. "uid:1|pid:42"
    """
    deck_id = _stable_id("deck", identity_key)
    model_id = _stable_id("model", "n2a-basic-v1")

    model = genanki.Model(
        model_id,
        "N2A Basic (Front/Back)",
        fields=[
            {"name": "Front"},
            {"name": "Back"},
        ],
        templates=[
            {
                "name": "Card 1",
                "qfmt": """
<div class="n2a-card">
  <div class="n2a-front">{{Front}}</div>
</div>
""".strip(),
                "afmt": """
<div class="n2a-card">
  <div class="n2a-front">{{Front}}</div>
  <hr class="n2a-hr">
  <div class="n2a-back">{{Back}}</div>
</div>
""".strip(),
            }
        ],
        css="""
/* N2A deck styling */
.card {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
               Roboto, Arial, sans-serif;
  font-size: 18px;
  line-height: 1.35;
  text-align: left;
  color: #F7F7F8;
  background-color: #0E1420;
}

.n2a-card {
  padding: 14px 10px;
}

.n2a-front {
  font-weight: 600;
}

.n2a-back {
  margin-top: 8px;
  font-weight: 400;
}

.n2a-hr {
  border: none;
  border-top: 1px solid rgba(247,247,248,0.18);
  margin: 12px 0;
}

/* emphasis */
b, strong { color: #F7F7F8; }
i, em { opacity: 0.95; }

/* code */
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.95em;
  background: rgba(255,255,255,0.06);
  padding: 2px 4px;
  border-radius: 4px;
}

/* bullets rendered as text */
""".strip(),
    )

    deck = genanki.Deck(deck_id, deck_name)

    for c in cards:
        front_html = _field_to_html(c.front)
        back_html = _field_to_html(c.back)
        note = genanki.Note(model=model, fields=[front_html, back_html])
        deck.add_note(note)

    fd, path = tempfile.mkstemp(prefix="n2a_", suffix=".apkg")
    os.close(fd)

    pkg = genanki.Package(deck)
    pkg.write_to_file(path)

    safe_name = "".join(ch for ch in deck_name if ch.isalnum() or ch in (" ", "-", "_")).strip()
    safe_name = safe_name.replace(" ", "_") or "n2a_deck"

    return path, f"{safe_name}.apkg"

from __future__ import annotations

import hashlib
import html
import os
import tempfile
from typing import Iterable, Tuple

import genanki

from ..models import Card


def _stable_id(*parts: str) -> int:
    """
    genanki expects a (signed) 64-bit-ish integer ID. We'll derive a stable one.
    """
    s = "|".join(parts).encode("utf-8")
    h = hashlib.sha1(s).digest()[:8]
    val = int.from_bytes(h, "big", signed=False)
    # keep it under 2^63-1 to be safe across tooling
    return val & ((1 << 63) - 1)


def _field_to_html(field: str) -> str:
    """
    For APKG we want HTML fields (Anki renders HTML).
    Convert plaintext -> safe HTML with <br> for newlines.
    """
    s = "" if field is None else str(field)
    s = s.replace("\t", "    ")
    s = html.escape(s, quote=True)
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = s.replace("\n", "<br>")
    return s


def build_apkg(
    *,
    deck_name: str,
    cards: Iterable[Card],
    identity_key: str,
) -> Tuple[str, str]:
    """
    Returns: (apkg_path, suggested_filename)
    identity_key should be stable per user+project (e.g. "uid:1|pid:42")
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
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
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

/* subtle emphasis support */
b, strong { color: #F7F7F8; }
i, em { opacity: 0.95; }

/* nicer lists if you end up exporting bullet-like lines */
ul { margin: 8px 0 8px 22px; }
li { margin: 4px 0; }
""".strip(),
    )

    deck = genanki.Deck(deck_id, deck_name)

    n = 0
    for c in cards:
        front_html = _field_to_html(c.front)
        back_html = _field_to_html(c.back)
        note = genanki.Note(model=model, fields=[front_html, back_html])
        deck.add_note(note)
        n += 1

    fd, path = tempfile.mkstemp(prefix="n2a_", suffix=".apkg")
    os.close(fd)

    pkg = genanki.Package(deck)
    pkg.write_to_file(path)

    safe_name = "".join(ch for ch in deck_name if ch.isalnum() or ch in (" ", "-", "_")).strip()
    safe_name = safe_name.replace(" ", "_") or "n2a_deck"
    filename = f"{safe_name}.apkg"

    return path, filename

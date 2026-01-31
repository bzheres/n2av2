// src/pages/Workflow.tsx
import React from "react";
import UploadBox from "../components/UploadBox";
import { meCached } from "../auth";
import { apiFetch } from "../api";

const NOTION_TEMPLATE_URL =
  "https://n2a-template.notion.site/N2A-Notion-Template-Read-Only-2eb54986383480a2b7b9c652a6893078";

type CardType = "qa" | "mcq";
type EnglishVariant = "us" | "uk_au";
type McqStyle = "1)" | "1." | "A)" | "a)" | "A." | "a.";
type FilterMode = "all" | "qa" | "mcq";
type AIMode = "content" | "format" | "both";

/**
 * ✅ MCQ answer output mode (4 options)
 * - default: do NOT transform the answer (keep exactly what was imported)
 * - label_only: show just the label (e.g. "B)" or "2)")
 * - option_only: show just the option text (e.g. "Compton scatter")
 * - label_plus_option: show label + option text (e.g. "B) Compton scatter")
 */
type McqAnswerMode = "default" | "label_only" | "option_only" | "label_plus_option";

type Card = {
  id: string; // UI keeps string IDs; persisted IDs are numeric-as-string
  card_type: CardType;
  front: string;
  back: string;

  // AI fields (optional, may be null from DB)
  ai_changed?: boolean | null;
  ai_flag?: string | null;
  ai_feedback?: string | null;
  ai_suggest_front?: string | null;
  ai_suggest_back?: string | null;
};

/* ------------------------------------------------------------------ */
/* Parse Report (post-parse validation)                                */
/* ------------------------------------------------------------------ */
type ParseIssueSeverity = "error" | "warn" | "info";
type ParseIssue = {
  id: string;
  severity: ParseIssueSeverity;
  title: string;
  detail?: string;
  cardId?: string; // if known, enables "Jump to card"
};

type ParseReport = {
  rawCounts: { questionTags: number; mcqTags: number };
  parsedCounts: { total: number; qa: number; mcq: number };
  issues: ParseIssue[];
};

function severityBadgeClass(s: ParseIssueSeverity) {
  if (s === "error") return "badge-error";
  if (s === "warn") return "badge-warning";
  return "badge-info";
}

/* ------------------------------------------------------------------ */
/* Diff helper: line-based "good enough" visual diff for flashcards.   */
/* - Added lines: primary-tinted highlight                             */
/* - Removed lines: error-tinted + strikethrough                       */
/* ------------------------------------------------------------------ */
type DiffLine = { kind: "same" | "add" | "remove"; text: string };

function buildLineDiff(original: string, suggested: string): DiffLine[] {
  const o = (original ?? "").split("\n");
  const s = (suggested ?? "").split("\n");

  const out: DiffLine[] = [];
  const max = Math.max(o.length, s.length);

  for (let i = 0; i < max; i++) {
    const a = o[i];
    const b = s[i];

    if (a === b) {
      if (a !== undefined) out.push({ kind: "same", text: a });
      continue;
    }

    if (a !== undefined) out.push({ kind: "remove", text: a });
    if (b !== undefined) out.push({ kind: "add", text: b });
  }

  return out;
}

function DiffBlock({ original, suggested }: { original: string; suggested: string }) {
  const diff = React.useMemo(() => buildLineDiff(original, suggested), [original, suggested]);

  return (
    <div className="rounded-xl border border-base-300 bg-base-100/40 p-3">
      <pre className="whitespace-pre-wrap text-sm leading-relaxed">
        {diff.map((d, idx) => {
          if (d.kind === "same") {
            return (
              <div key={idx} className="opacity-90">
                {d.text}
              </div>
            );
          }
          if (d.kind === "add") {
            return (
              <div key={idx} className="rounded px-1 py-[1px] bg-primary/15 border border-primary/20">
                <span className="font-mono opacity-70">+ </span>
                {d.text}
              </div>
            );
          }
          return (
            <div
              key={idx}
              className="rounded px-1 py-[1px] bg-error/10 border border-error/20 line-through text-error/80"
            >
              <span className="font-mono opacity-70">− </span>
              {d.text}
            </div>
          );
        })}
      </pre>

      <div className="pt-2 text-[11px] opacity-60">
        <span className="font-semibold">Legend:</span>{" "}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-primary/15 border border-primary/20" />
          added
        </span>{" "}
        ·{" "}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-error/10 border border-error/20" />
          removed/changed
        </span>
      </div>
    </div>
  );
}

function parseMarkdown(md: string): Omit<Card, "id">[] {
  const lines = md.split(/\r?\n/);
  const norm = (l: string) => {
    const s = l.trim().toLowerCase();
    if (s.startsWith("question:") || s.startsWith("quesition:") || s.startsWith("quesiton:")) return "question";
    if (s.startsWith("mcq:") || s.startsWith("mcu:")) return "mcq";
    return null;
  };

  const out: Omit<Card, "id">[] = [];
  let i = 0;

  while (i < lines.length) {
    const tag = norm(lines[i]);
    if (!tag) {
      i++;
      continue;
    }

    if (tag === "question") {
      const q = lines[i].split(":", 2)[1].trim();
      i++;
      const ans: string[] = [];
      while (i < lines.length) {
        if (norm(lines[i])) break;
        const nxt = lines[i];

        if (/^(\s{4}|\t|-\s|\*\s)/.test(nxt)) {
          ans.push(nxt.replace(/^(\s{4}|\t|-\s|\*\s)/, "").trimEnd());
          i++;
          continue;
        }
        if (nxt.trim() === "") {
          if (ans.length) ans.push("");
          i++;
          continue;
        }
        if (ans.length) break;
        i++;
      }
      out.push({ card_type: "qa", front: q, back: ans.join("\n").trim() });
      continue;
    }

    if (tag === "mcq") {
      const stem = lines[i].split(":", 2)[1].trim();
      i++;
      const opts: string[] = [];
      let ans = "";
      let inAns = false;

      while (i < lines.length) {
        if (norm(lines[i])) break;
        const nxt = lines[i];
        if (nxt.trim() === "") {
          i++;
          continue;
        }
        if (nxt.trim().toLowerCase().startsWith("answer:")) {
          inAns = true;
          i++;
          continue;
        }
        if (inAns) {
          if (/^(\s{4}|\t)/.test(nxt)) {
            ans = nxt.trim();
            i++;
            continue;
          }
          break;
        }
        if (/^(\s{4}|\t|-\s|\*\s)/.test(nxt)) {
          opts.push(nxt.replace(/^(\s{4}|\t|-\s|\*\s)/, "").trimEnd());
          i++;
          continue;
        }
        break;
      }

      out.push({
        card_type: "mcq",
        front: opts.length ? `${stem}\n${opts.join("\n")}` : stem,
        back: ans.trim(),
      });
      continue;
    }
  }

  return out;
}

function uid() {
  return Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
}

/** ✅ Safe across TS targets (no replaceAll), keeps only filename-safe chars */
function sanitizeForFilename(name: string) {
  const base = String(name ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\.+$/g, "")
    .trim();
  return base || "n2a";
}

function formatMcqOptions(front: string, style: McqStyle): string {
  const lines = front.split("\n");
  if (lines.length <= 1) return front;

  const stem = lines[0];
  const opts = lines.slice(1).filter((l) => l.trim().length > 0);

  const labelFor = (idx: number) => {
    const n = idx + 1;
    const A = String.fromCharCode("A".charCodeAt(0) + idx);
    const a = String.fromCharCode("a".charCodeAt(0) + idx);

    switch (style) {
      case "1)":
        return `${n})`;
      case "1.":
        return `${n}.`;
      case "A)":
        return `${A})`;
      case "a)":
        return `${a})`;
      case "A.":
        return `${A}.`;
      case "a.":
        return `${a}.`;
      default:
        return `${n})`;
    }
  };

  const rebuilt = opts.map((o, i) => {
    const cleaned = o.replace(/^\s*([A-Za-z]|\d+)[\)\.]\s+/, "").trim();
    return `${labelFor(i)} ${cleaned}`;
  });

  return [stem, ...rebuilt].join("\n");
}

/**
 * ✅ FIXED: Only rewrite MCQ answer if it really looks like a label (A/B/C or 1/2/3)
 * Prevents "Photoelectric effect" -> "16) hotoelectric effect"
 */
function formatMcqAnswer(back: string, style: McqStyle): string {
  const raw0 = (back || "").trim();
  if (!raw0) return raw0;

  // strip optional "Answer:" prefix
  const raw = raw0.replace(/^answer:\s*/i, "").trim();
  if (!raw) return raw0;

  // Match: token + optional delimiter + optional rest
  const m = raw.match(/^([A-Za-z]|\d+)\s*([)\.:])?\s*(.*)$/);
  if (!m) return raw0;

  const token = m[1];
  const delim = m[2] || "";
  const rest = (m[3] || "").trim();

  const isNum = /^\d+$/.test(token);
  const isLetter = /^[A-Za-z]$/.test(token);

  // If it's a letter with no delimiter and the rest looks like a word continuation, do nothing.
  if (isLetter) {
    const restStartsLower = rest.length > 0 && /^[a-z]/.test(rest);
    const looksLikeWordContinuation = !delim && restStartsLower;
    if (looksLikeWordContinuation) return raw0;
  }

  // Similar safety for numerals: avoid "2 diabetes" becoming "2) diabetes"
  if (isNum && !delim && rest) {
    const restStartsLower = /^[a-z]/.test(rest);
    if (restStartsLower) return raw0;
  }

  const idx = isNum
    ? Math.max(parseInt(token, 10) - 1, 0)
    : token.toUpperCase().charCodeAt(0) - "A".charCodeAt(0);

  const n = idx + 1;
  const A = String.fromCharCode("A".charCodeAt(0) + idx);
  const a = String.fromCharCode("a".charCodeAt(0) + idx);

  let label = "";
  switch (style) {
    case "1)":
      label = `${n})`;
      break;
    case "1.":
      label = `${n}.`;
      break;
    case "A)":
      label = `${A})`;
      break;
    case "a)":
      label = `${a})`;
      break;
    case "A.":
      label = `${A}.`;
      break;
    case "a.":
      label = `${a}.`;
      break;
    default:
      label = `${n})`;
  }

  return rest ? `${label} ${rest}` : label;
}

/**
 * ✅ MCQ answer formatting (default/label/option/label+option).
 * Key fix:
 * - For label_plus_option, we ALSO reverse-map option-only answers to their labeled option line.
 * - For option_only, we can also map label-only or label+option to just text.
 */
function expandMcqAnswerIfLabelOnly(args: {
  cardFront: string;
  cardBack: string;
  style: McqStyle;
  mode: McqAnswerMode;
}): string {
  const { cardFront, cardBack, style, mode } = args;

  const original = (cardBack ?? "").trim();
  if (mode === "default") return original;

  // Normalize label styling only if it looks label-ish (safe)
  const base = formatMcqAnswer(original, style).trim();
  if (!base) return base;

  // Build normalized options with the currently selected style
  const frontFormatted = formatMcqOptions(cardFront, style);
  const lines = frontFormatted.split("\n");
  const optLines = lines
    .slice(1)
    .map((l) => l.trim())
    .filter(Boolean);

  const labelFor = (idx: number) => {
    const n = idx + 1;
    const A = String.fromCharCode("A".charCodeAt(0) + idx);
    const a = String.fromCharCode("a".charCodeAt(0) + idx);

    switch (style) {
      case "1)":
        return `${n})`;
      case "1.":
        return `${n}.`;
      case "A)":
        return `${A})`;
      case "a)":
        return `${a})`;
      case "A.":
        return `${A}.`;
      case "a.":
        return `${a}.`;
      default:
        return `${n})`;
    }
  };

  const stripLeadingLabel = (s: string) => s.replace(/^\s*([A-Za-z]|\d+)[)\.]\s+/, "").trim();

  // More tolerant normalize for matching option text
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, " ")
      .replace(/[^\w\s\-+./%()]/g, "") // mild punctuation tolerance
      .trim();

  const labelTokenToIndex = (token: string) => {
    if (/^\d+$/.test(token)) return Math.max(parseInt(token, 10) - 1, 0);
    if (/^[A-Za-z]$/.test(token)) return token.toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
    return null;
  };

  // Find index from:
  // 1) pure label: "B" / "2" / "B)" / "2."
  // 2) label+text: "B) Compton scatter"
  // 3) option-only: "Compton scatter"
  const findIndex = (): number | null => {
    if (!optLines.length) return null;

    // 1) Pure label token
    const pureLabel = base.match(/^([A-Za-z]|\d+)\s*([)\.])?$/);
    if (pureLabel) {
      const idx = labelTokenToIndex(pureLabel[1]);
      if (idx == null) return null;
      return idx >= 0 && idx < optLines.length ? idx : null;
    }

    // 2) Starts with label+delim (e.g. "B) xxx" or "2. yyy")
    const withLabel = base.match(/^\s*([A-Za-z]|\d+)\s*[)\.]\s+(.+)$/);
    if (withLabel) {
      const idx = labelTokenToIndex(withLabel[1]);
      if (idx != null && idx >= 0 && idx < optLines.length) return idx;

      // If label is weird, still try matching the text portion
      const targetText = normalize(withLabel[2]);
      for (let i = 0; i < optLines.length; i++) {
        const optText = normalize(stripLeadingLabel(optLines[i]));
        if (optText && optText === targetText) return i;
      }
      return null;
    }

    // 3) Option-only: match against option text
    const target = normalize(stripLeadingLabel(base));
    if (!target) return null;

    for (let i = 0; i < optLines.length; i++) {
      const optText = normalize(stripLeadingLabel(optLines[i]));
      if (optText && optText === target) return i;
    }

    return null;
  };

  const idx = findIndex();

  // If we can’t map safely, do nothing (safe fallback)
  if (idx == null) return base;

  const optionLine = optLines[idx]; // e.g. "2) 1.02 MeV"
  const optionText = stripLeadingLabel(optionLine); // e.g. "1.02 MeV"

  if (mode === "label_only") {
    return labelFor(idx);
  }

  if (mode === "option_only") {
    return optionText || base;
  }

  // mode === "label_plus_option"
  // ✅ Key fix: ALWAYS output label+option once mapped, even if stored answer was option-only
  return optionLine || `${labelFor(idx)} ${optionText}`.trim();
}

function normFlag(flag: string | null | undefined) {
  return (flag ?? "").trim().toLowerCase();
}

function isIncorrectFlag(flag: string | null | undefined) {
  const f = normFlag(flag);
  return f === "incorrect" || f === "wrong" || f.includes("incorrect");
}

function isFormatFlag(flag: string | null | undefined) {
  const f = normFlag(flag);
  return f.startsWith("format_") || f === "format_changed" || f === "format_ok";
}

// --- TSV + HTML helpers (for Anki import) ---
function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fieldToHtml(field: string) {
  // Make content tab-safe, HTML-safe, and preserve newlines in Anki via <br>.
  const noTabs = String(field ?? "").replace(/\t/g, "    ");
  return escapeHtml(noTabs).replace(/(?:\r\n|\r|\n)/g, "<br>");
}

// --- APKG download helper (now supports overriding the downloaded filename) ---
async function downloadApkg(projectId: number, overrideFilename?: string) {
  // Always prefer explicit API base. If env isn't set, fall back to production API domain.
  const rawBase = (import.meta as any).env?.VITE_API_BASE;
  const API_BASE = (rawBase && String(rawBase).trim()) || "https://api.n2a.com.au";

  const url = `${API_BASE.replace(/\/+$/, "")}/export/apkg/${projectId}`;

  const resp = await fetch(url, {
    method: "GET",
    credentials: "include", // keep if your backend uses cookies
    headers: {
      Accept: "application/octet-stream",
    },
  });

  if (!resp.ok) {
    // Try to show a helpful error if backend returned JSON detail
    try {
      const j = await resp.json();
      throw new Error(j?.detail || `APKG export failed (${resp.status})`);
    } catch {
      throw new Error(`APKG export failed (${resp.status})`);
    }
  }

  // Guard: if we accidentally hit the frontend, it will return HTML
  const ct = (resp.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("text/html")) {
    const text = await resp.text();
    const firstLine = (text.split("\n")[0] || "").slice(0, 120);
    throw new Error(`APKG export returned HTML (wrong API base / routing). URL was: ${url}. First line: ${firstLine}`);
  }

  const blob = await resp.blob();

  // extra safety: APKG is a zip; first 2 bytes should be PK
  const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  const looksZip = head.length === 2 && head[0] === 0x50 && head[1] === 0x4b; // "PK"
  if (!looksZip) {
    try {
      const text = await blob.text();
      throw new Error(`APKG export did not look like a zip. First 120 chars: ${text.slice(0, 120)}`);
    } catch {
      throw new Error("APKG export did not look like a zip file (unexpected response).");
    }
  }

  // Try extract filename from Content-Disposition
  const cd = resp.headers.get("content-disposition") || "";
  const m = cd.match(/filename="?([^"]+)"?/i);
  const serverFilename = m?.[1] || "n2a_deck.apkg";

  const finalName =
    (overrideFilename ? sanitizeForFilename(overrideFilename) : "") || serverFilename.replace(/\.apkg$/i, "");
  const finalFilename = finalName.toLowerCase().endsWith(".apkg") ? finalName : `${finalName}.apkg`;

  const dlUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = dlUrl;
  a.download = finalFilename;
  a.click();
  URL.revokeObjectURL(dlUrl);
}

/* ------------------------------------------------------------------ */
/* Post-parse checker (does NOT touch parseMarkdown)                   */
/* ------------------------------------------------------------------ */
function buildParseReport(raw: string, cards: Card[]): ParseReport {
  const lines = String(raw || "").split(/\r?\n/);

  const normTag = (l: string) => {
    const s = l.trim().toLowerCase();
    if (s.startsWith("question:") || s.startsWith("quesition:") || s.startsWith("quesiton:")) return "question";
    if (s.startsWith("mcq:") || s.startsWith("mcu:")) return "mcq";
    return null;
  };

  const rawCounts = {
    questionTags: lines.filter((l) => normTag(l) === "question").length,
    mcqTags: lines.filter((l) => normTag(l) === "mcq").length,
  };

  const parsedCounts = {
    total: cards.length,
    qa: cards.filter((c) => c.card_type === "qa").length,
    mcq: cards.filter((c) => c.card_type === "mcq").length,
  };

  const issues: ParseIssue[] = [];
  const add = (x: Omit<ParseIssue, "id">) => {
    issues.push({ id: uid(), ...x });
  };

  // --------------------
  // Card-level checks
  // --------------------
  for (const c of cards) {
    const front = (c.front || "").trim();
    const back = (c.back || "").trim();

    if (!front) {
      add({
        severity: "error",
        title: `${c.card_type.toUpperCase()} card has an empty question/front`,
        detail: "This card will export badly. Check your markdown for a missing stem.",
        cardId: c.id,
      });
    }

    if (c.card_type === "qa") {
      if (!back) {
        add({
          severity: "warn",
          title: `Q&A appears to be missing an answer`,
          detail: "Answer lines must be indented (4 spaces) or start with '- ' or '* '.",
          cardId: c.id,
        });
      }
    } else {
      // mcq
      const fLines = (c.front || "").split("\n").map((s) => s.trim()).filter(Boolean);
      const optCount = Math.max(0, fLines.length - 1); // stem + options
      if (optCount === 0) {
        add({
          severity: "error",
          title: "MCQ has no options detected",
          detail: "Option lines must be indented (4 spaces) or start with '- ' or '* '.",
          cardId: c.id,
        });
      } else if (optCount === 1) {
        add({
          severity: "warn",
          title: "MCQ has only 1 option detected",
          detail: "Most MCQs should have 3–5 options. Check indentation/bullets in the markdown.",
          cardId: c.id,
        });
      }

      if (!back) {
        add({
          severity: "error",
          title: "MCQ is missing an answer",
          detail: "After 'Answer:' the answer line must be indented (4 spaces).",
          cardId: c.id,
        });
      }
    }
  }

  // --------------------
  // Raw-level "likely skipped/malformed" checks
  // (simple, helpful, and does NOT alter parsing)
  // --------------------
  const isIndentedOrBulleted = (l: string) => /^(\s{4}|\t|-\s|\*\s)/.test(l);
  const isIndented = (l: string) => /^(\s{4}|\t)/.test(l);

  let i = 0;
  while (i < lines.length) {
    const tag = normTag(lines[i]);
    if (!tag) {
      i++;
      continue;
    }

    const startLine = i;
    const header = lines[i];
    i++;

    // gather block lines until next tag
    const block: string[] = [];
    while (i < lines.length && !normTag(lines[i])) {
      block.push(lines[i]);
      i++;
    }

    // heuristics
    if (tag === "question") {
      const hasAnyNonEmpty = block.some((l) => l.trim().length > 0);
      const hasAnswerLines = block.some((l) => isIndentedOrBulleted(l));
      const hasNonEmptyNonIndented = block.some((l) => l.trim().length > 0 && !isIndentedOrBulleted(l));

      // if it looks like user wrote an answer but it wouldn't be captured
      if (hasAnyNonEmpty && !hasAnswerLines && hasNonEmptyNonIndented) {
        const example = block.find((l) => l.trim().length > 0) || "";
        add({
          severity: "warn",
          title: "A Question block likely has answer lines in the wrong format (skipped)",
          detail:
            `Found text after "${header.trim()}" but it wasn't indented/bulleted.\n` +
            `Example line: "${example.trim().slice(0, 140)}"\n` +
            `Fix: indent answer lines with 4 spaces, or use '- ' bullets.`,
        });
      }

      // empty question text
      const qText = header.split(":", 2)[1]?.trim() || "";
      if (!qText) {
        add({
          severity: "warn",
          title: "A Question tag has an empty question text",
          detail: `Line ${startLine + 1}: "${header.trim()}". Add text after "Question:".`,
        });
      }
    }

    if (tag === "mcq") {
      const hasAnswerMarker = block.some((l) => l.trim().toLowerCase().startsWith("answer:"));

      const opts = block.filter((l) => isIndentedOrBulleted(l) && l.trim().length > 0);
      const nonEmptyNonOption = block.filter((l) => l.trim().length > 0 && !isIndentedOrBulleted(l));

      if (!opts.length && nonEmptyNonOption.length) {
        // this often indicates options were not indented/bulleted
        const example =
          nonEmptyNonOption.find((l) => !l.trim().toLowerCase().startsWith("answer:")) ||
          nonEmptyNonOption[0] ||
          "";
        add({
          severity: "warn",
          title: "An MCQ block likely has options in the wrong format (skipped)",
          detail:
            `Found text after "${header.trim()}" but no indented/bulleted option lines.\n` +
            `Example line: "${example.trim().slice(0, 140)}"\n` +
            `Fix: indent options with 4 spaces, or use '- ' bullets.`,
        });
      }

      if (!hasAnswerMarker) {
        add({
          severity: "info",
          title: "An MCQ block has no 'Answer:' line",
          detail:
            `After the options, add "Answer:" on its own line, then an indented answer line.\n` +
            `Example:\nAnswer:\n    B)`,
        });
      } else {
        // ensure there is an indented answer line after Answer:
        const ansIdx = block.findIndex((l) => l.trim().toLowerCase().startsWith("answer:"));
        if (ansIdx >= 0) {
          const after = block.slice(ansIdx + 1);
          const firstNonEmpty = after.find((l) => l.trim().length > 0);
          const hasIndentedAnswer = after.some((l) => isIndented(l) && l.trim().length > 0);

          if (firstNonEmpty && !hasIndentedAnswer) {
            add({
              severity: "warn",
              title: "An MCQ block likely has an answer line that isn't indented (skipped)",
              detail:
                `After "Answer:" the next non-empty line must be indented (4 spaces).\n` +
                `Example line: "${firstNonEmpty.trim().slice(0, 140)}"`,
            });
          }
        }
      }

      // empty stem
      const stem = header.split(":", 2)[1]?.trim() || "";
      if (!stem) {
        add({
          severity: "warn",
          title: "An MCQ tag has an empty stem/question text",
          detail: `Line ${startLine + 1}: "${header.trim()}". Add text after "MCQ:".`,
        });
      }
    }
  }

  // Summary mismatch hint (very useful for users)
  const rawTotal = rawCounts.questionTags + rawCounts.mcqTags;
  if (rawTotal && parsedCounts.total && Math.abs(rawTotal - parsedCounts.total) >= 1) {
    add({
      severity: "info",
      title: "Tag count vs parsed card count differs",
      detail: `Detected ${rawTotal} tagged blocks (Question/MCQ) in the markdown, but produced ${parsedCounts.total} cards. Review warnings above for likely formatting issues.`,
    });
  }

  // Sort: errors first, then warnings, then info
  const rank = (s: ParseIssueSeverity) => (s === "error" ? 0 : s === "warn" ? 1 : 2);
  issues.sort((a, b) => rank(a.severity) - rank(b.severity));

  return { rawCounts, parsedCounts, issues };
}

export default function Workflow() {
  const [user, setUser] = React.useState<any>(null);
  const [authLoading, setAuthLoading] = React.useState(true);

  const [raw, setRaw] = React.useState("");
  const [filename, setFilename] = React.useState("");
  const [cards, setCards] = React.useState<Card[]>([]);

  const [status, setStatus] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Controls
  const [mcqStyle, setMcqStyle] = React.useState<McqStyle>("1)");
  // ✅ DEFAULT: keep imported answer format (mixed per-card)
  const [mcqAnswerMode, setMcqAnswerMode] = React.useState<McqAnswerMode>("default");
  const [englishVariant, setEnglishVariant] = React.useState<EnglishVariant>("uk_au");
  const [filterMode, setFilterMode] = React.useState<FilterMode>("all");

  // Edit toggle per-card
  const [editingIds, setEditingIds] = React.useState<Set<string>>(() => new Set());

  // Persistence
  const [projectId, setProjectId] = React.useState<number | null>(null);

  // Local UI memory
  const [aiReviewedIds, setAiReviewedIds] = React.useState<Set<string>>(() => new Set());

  // Per-card spinner
  const [aiLoadingIds, setAiLoadingIds] = React.useState<Set<string>>(() => new Set());

  // Track which mode was last run per card (so we can decide whether to show diff)
  const [aiLastModeById, setAiLastModeById] = React.useState<Record<string, AIMode>>({});

  // Batch progress
  const [batch, setBatch] = React.useState<{
    running: boolean;
    total: number;
    done: number;
    errors: number;
    mode: AIMode | null;
    apply: boolean;
  }>({ running: false, total: 0, done: 0, errors: 0, mode: null, apply: false });

  // ✅ Export naming modal (no new permanent UI field)
  const [exportModalOpen, setExportModalOpen] = React.useState(false);
  const [exportName, setExportName] = React.useState("");
  const exportInputRef = React.useRef<HTMLInputElement | null>(null);

  // ✅ Parse Report state
  const [parseReport, setParseReport] = React.useState<ParseReport | null>(null);
  const [showParseReport, setShowParseReport] = React.useState(true);

  // ✅ Card refs for "Jump to card"
  const cardRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  function jumpToCard(cardId: string) {
    const el = cardRefs.current[cardId];
    if (!el) {
      setStatus("Could not locate that card in the current view (try Filter: All).");
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // small highlight pulse
    el.classList.add("ring", "ring-primary/40", "ring-offset-2", "ring-offset-base-100");
    window.setTimeout(() => {
      el.classList.remove("ring", "ring-primary/40", "ring-offset-2", "ring-offset-base-100");
    }, 900);
  }

  // ---- Auth load ----
  React.useEffect(() => {
    let alive = true;
    meCached(false)
      .then((r) => {
        if (!alive) return;
        setUser(r.user);
      })
      .catch(() => setUser(null))
      .finally(() => {
        if (!alive) return;
        setAuthLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  // ---- Resume latest project on refresh (logged in only) ----
  React.useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    let alive = true;

    (async () => {
      try {
        const latest = await apiFetch<{ project: { id: number; name?: string } | null }>("/projects/latest");
        if (!alive) return;
        if (!latest.project) return;

        const pid = latest.project.id;
        setProjectId(pid);

        const res = await apiFetch<{ cards: any[] }>(`/projects/${pid}/cards`);
        if (!alive) return;

        const loaded = (res.cards || []).map((c) => ({
          id: String(c.id),
          card_type: c.card_type as CardType,
          front: c.front,
          back: c.back,
          ai_changed: c.ai_changed ?? null,
          ai_flag: c.ai_flag ?? null,
          ai_feedback: c.ai_feedback ?? null,
          ai_suggest_front: c.ai_suggest_front ?? null,
          ai_suggest_back: c.ai_suggest_back ?? null,
        })) as Card[];

        if (loaded.length) {
          setCards(loaded);
          // NOTE: raw markdown isn't available on resume, so we can only do card-level checks (best effort)
          setParseReport(buildParseReport("", loaded));
          setStatus(`Resumed Project #${pid} (${loaded.length} cards).`);
        }
      } catch {
        // silent
      }
    })();

    return () => {
      alive = false;
    };
  }, [authLoading, user]);

  const parsedCount = cards.length;
  const canAI = !!user && user.plan && user.plan !== "free" && user.plan !== "guest";
  const canApkg = !!user && user.plan && user.plan !== "free" && user.plan !== "guest";

  // ✅ Dynamic subtitle based on plan
  const heroSubtitle = canAI
    ? "Parse locally, edit freely, review with AI, export clean apkg for Anki"
    : "Parse locally, edit freely, export clean TSV for Anki. AI review and apkg export is available on paid plans";

  // ✅ One export button: guests/free => TSV, paid => APKG
  const exportLabel = canApkg ? "Export APKG" : "Export TSV";
  const exportTitle = canApkg ? "Export Anki .apkg (paid)" : "Export TSV (HTML) for Anki import";
  const exportBtnClass = ["btn w-full", canApkg ? "btn-accent" : "btn-secondary"].join(" ");

  const filteredCards = React.useMemo(() => {
    if (filterMode === "all") return cards;
    return cards.filter((c) => c.card_type === filterMode);
  }, [cards, filterMode]);

  const filteredCount = filteredCards.length;

  function clearAll() {
    setRaw("");
    setFilename("");
    setCards([]);
    setStatus(null);
    setEditingIds(new Set());
    setProjectId(null);
    setAiReviewedIds(new Set());
    setAiLoadingIds(new Set());
    setAiLastModeById({});
    setBatch({ running: false, total: 0, done: 0, errors: 0, mode: null, apply: false });
    setParseReport(null);
    setShowParseReport(true);
    cardRefs.current = {};
  }

  function updateCardLocal(id: string, patch: Partial<Pick<Card, "front" | "back">>) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function persistCardEditIfPossible(id: string, front: string, back: string) {
    if (!projectId) return;
    if (!/^\d+$/.test(id)) return;
    try {
      await apiFetch(`/cards/${Number(id)}`, { method: "PATCH", body: JSON.stringify({ front, back }) });
    } catch {
      // silent
    }
  }

  async function deleteCard(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setAiReviewedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setAiLoadingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setAiLastModeById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    if (projectId && /^\d+$/.test(id)) {
      try {
        await apiFetch(`/cards/${Number(id)}`, { method: "DELETE" });
      } catch {
        // ignore
      }
    }
  }

  function toggleEdit(id: string) {
    setEditingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function doParse() {
    setStatus(null);
    setBusy(true);

    try {
      const parsedLocal = parseMarkdown(raw);

      // Guest mode: local-only
      if (!user) {
        const localCards = parsedLocal.map((c) => ({ ...c, id: uid() }));
        setCards(localCards);
        setEditingIds(new Set());
        setProjectId(null);
        setAiReviewedIds(new Set());
        setAiLoadingIds(new Set());
        setAiLastModeById({});
        setParseReport(buildParseReport(raw, localCards));
        setShowParseReport(true);
        setStatus(`Parsed ${localCards.length} card${localCards.length === 1 ? "" : "s"} (guest mode).`);
        return;
      }

      // Logged-in: create project + persist cards
      const baseName = (filename || "N2A Project").replace(/\.md$/i, "").trim() || "N2A Project";
      const pr = await apiFetch<{ project: { id: number } }>("/projects", {
        method: "POST",
        body: JSON.stringify({ name: baseName }),
      });

      const pid = pr.project.id;
      setProjectId(pid);

      const cr = await apiFetch<{ cards: Array<{ id: number; card_type: CardType; front: string; back: string }> }>(
        "/cards",
        {
          method: "POST",
          body: JSON.stringify({
            project_id: pid,
            cards: parsedLocal.map((c) => ({
              card_type: c.card_type,
              front: c.front,
              back: c.back,
              raw: undefined,
            })),
          }),
        }
      );

      const persisted = cr.cards.map((c) => ({
        id: String(c.id),
        card_type: c.card_type,
        front: c.front,
        back: c.back,
      }));

      setCards(persisted);
      setEditingIds(new Set());
      setAiReviewedIds(new Set());
      setAiLoadingIds(new Set());
      setAiLastModeById({});
      setParseReport(buildParseReport(raw, persisted));
      setShowParseReport(true);
      setStatus(`Parsed & saved ${persisted.length} card${persisted.length === 1 ? "" : "s"} to Project #${pid}.`);
    } catch (e: any) {
      setStatus(e?.message ? `Parse failed: ${e.message}` : "Parse failed.");
    } finally {
      setBusy(false);
    }
  }

  // ✅ Export as TSV with HTML formatting for Anki (newline -> <br>)
  function exportTSV(namedBase?: string) {
    const exportedCards = cards.map((c) => {
      if (c.card_type !== "mcq") return c;

      const front = formatMcqOptions(c.front, mcqStyle);
      const back = expandMcqAnswerIfLabelOnly({
        cardFront: c.front,
        cardBack: c.back,
        style: mcqStyle,
        mode: mcqAnswerMode,
      });

      return { ...c, front, back };
    });

    // No header row (prevents importing an extra card).
    const tsv = exportedCards.map((c) => `${fieldToHtml(c.front)}\t${fieldToHtml(c.back)}`).join("\n");

    const blob = new Blob([tsv], { type: "text/tab-separated-values;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    const base = sanitizeForFilename(namedBase || (filename ? filename.replace(/\.md$/i, "") : "n2a"));
    a.download = base.toLowerCase().endsWith(".tsv") ? base : base + ".tsv";

    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportAPKG(namedBase?: string) {
    if (!projectId) {
      setStatus("No project saved yet. Press Parse while logged in to save cards first.");
      return;
    }
    if (!canApkg) {
      setStatus("APKG export is available on paid plans.");
      return;
    }

    setBusy(true);
    setStatus("Building APKG deck…");
    try {
      await downloadApkg(projectId, namedBase);
      setStatus("APKG exported.");
    } catch (e: any) {
      setStatus(e?.message ? `APKG export failed: ${e.message}` : "APKG export failed.");
    } finally {
      setBusy(false);
    }
  }

  // ✅ Instead of exporting immediately, open a centered modal to name the export
  function openExportModal() {
    const defaultBase = filename ? filename.replace(/\.(md|html)$/i, "") : canApkg ? "n2a_deck" : "n2a";
    setExportName(sanitizeForFilename(defaultBase || "n2a"));
    setExportModalOpen(true);

    // focus the input next tick
    window.setTimeout(() => {
      exportInputRef.current?.focus();
      exportInputRef.current?.select();
    }, 0);
  }

  function closeExportModal() {
    setExportModalOpen(false);
  }

  async function confirmExport() {
    const chosen = sanitizeForFilename(exportName || "");
    setExportModalOpen(false);

    if (canApkg) {
      await exportAPKG(chosen);
    } else {
      exportTSV(chosen);
    }
  }

  function toAiVariant(v: EnglishVariant): "en-AU" | "en-US" {
    return v === "us" ? "en-US" : "en-AU";
  }

  async function aiReviewCard(id: string, apply: boolean, mode: AIMode) {
    if (!canAI) {
      setStatus("AI Review is available on paid plans. Please subscribe in Account.");
      return;
    }
    if (!projectId) {
      setStatus("No project saved yet. Press Parse while logged in to save cards first.");
      return;
    }
    if (!/^\d+$/.test(id)) {
      setStatus("This card is not saved (guest/local). Parse while logged in to enable AI.");
      return;
    }

    // mark reviewed for UI
    setAiReviewedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    // remember which mode ran (for diff vs summary behavior)
    setAiLastModeById((prev) => ({ ...prev, [id]: mode }));

    // per-card spinner
    setAiLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    try {
      const res = await apiFetch<{
        ok: boolean;
        result: { changed: boolean; flag?: string | null; feedback?: string | null; front: string; back: string };
        usage?: { used: number; limit: number };
      }>("/ai/review", {
        method: "POST",
        body: JSON.stringify({
          project_id: projectId,
          card_id: Number(id),
          variant: toAiVariant(englishVariant),
          apply,
          mode,
        }),
      });

      const changed = !!res.result.changed;
      const flag = res.result.flag ?? "ok";
      const feedback = (res.result.feedback ?? "").trim();

      setCards((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;

          const next: Card = {
            ...c,
            ai_changed: changed,
            ai_flag: flag,
            ai_feedback:
              feedback ||
              (changed
                ? mode === "format"
                  ? "Formatting updated for clarity."
                  : "AI suggested improvements (see suggested front/back)."
                : "Looks good — no changes suggested."),
            ai_suggest_front: res.result.front ?? null,
            ai_suggest_back: res.result.back ?? null,
          };

          // apply is still respected client-side, but backend will also guard it for incorrect
          if (apply && changed) {
            next.front = res.result.front;
            next.back = res.result.back;
          }
          return next;
        })
      );

      if (apply && changed) {
        await persistCardEditIfPossible(id, res.result.front, res.result.back);
      }

      return res;
    } finally {
      setAiLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
    const queue = [...items];
    const runners: Promise<void>[] = [];
    const runOne = async () => {
      while (queue.length) {
        const item = queue.shift()!;
        await worker(item);
      }
    };
    const n = Math.max(1, Math.min(limit, items.length || 1));
    for (let i = 0; i < n; i++) runners.push(runOne());
    await Promise.all(runners);
  }

  async function aiReviewAll(apply: boolean, mode: AIMode) {
    if (!canAI) {
      setStatus("AI Review is available on paid plans. Please subscribe in Account.");
      return;
    }
    if (!projectId) {
      setStatus("No project saved yet. Press Parse while logged in to save cards first.");
      return;
    }
    const saved = cards.filter((c) => /^\d+$/.test(c.id));
    if (!saved.length) return;

    setBusy(true);
    setBatch({ running: true, total: saved.length, done: 0, errors: 0, mode, apply });

    const concurrency = 5;

    try {
      await runWithConcurrency(saved, concurrency, async (c) => {
        try {
          await aiReviewCard(c.id, apply, mode);
          setBatch((b) => ({ ...b, done: b.done + 1 }));
        } catch {
          setBatch((b) => ({ ...b, done: b.done + 1, errors: b.errors + 1 }));
        }
      });

      setStatus(
        apply
          ? `AI complete: applied ${mode} for ${saved.length} card(s).`
          : `AI complete: reviewed ${mode} for ${saved.length} card(s).`
      );
    } finally {
      setBatch((b) => ({ ...b, running: false }));
      setBusy(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  const progressPct = batch.total ? Math.round((batch.done / batch.total) * 100) : 0;

  // Full-page overlay ONLY for AI Review ALL
  if (batch.running) {
    return (
      <div className="fixed inset-0 z-[1000] bg-base-100/90 backdrop-blur flex items-center justify-center px-6">
        <div className="max-w-lg w-full space-y-6 text-center">
          <div className="flex justify-center">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>

          <div className="space-y-1">
            <div className="text-lg font-semibold">{batch.apply ? "Applying AI to all cards…" : "Reviewing all cards…"}</div>
            <div className="text-sm opacity-70">
              Mode: <span className="font-semibold">{batch.mode}</span> • {batch.done}/{batch.total} ({progressPct}%)
              {batch.errors ? ` • errors: ${batch.errors}` : ""}
            </div>
          </div>

          <progress className="progress progress-primary w-full" value={batch.done} max={batch.total} />
          <div className="text-xs opacity-60">Please keep this tab open until the process completes.</div>
        </div>
      </div>
    );
  }

  // ---------- UI ----------
  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8">
      {/* ✅ Centered modal overlay for naming export */}
      {exportModalOpen && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            // click outside to close
            if (e.target === e.currentTarget) closeExportModal();
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Modal */}
          <div className="relative w-[92vw] max-w-md">
            <div className="card bg-base-100 border border-base-300 shadow-2xl rounded-2xl">
              <div className="card-body space-y-4">
                <div className="space-y-1">
                  <div className="text-lg font-extrabold">Name your export</div>
                  <div className="text-sm opacity-70">
                    {canApkg ? "This will download an Anki .apkg file." : "This will download a .tsv file for Anki import."}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold opacity-70">Filename</label>
                  <div className="join w-full">
                    <input
                      ref={exportInputRef}
                      className="input input-bordered join-item w-full"
                      value={exportName}
                      onChange={(e) => setExportName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") closeExportModal();
                        if (e.key === "Enter") void confirmExport();
                      }}
                      placeholder="e.g. Radiology Physics Week 1"
                    />
                    <span className="join-item px-3 inline-flex items-center border border-base-300 bg-base-200/60 text-sm opacity-80 select-none">
                      {canApkg ? ".apkg" : ".tsv"}
                    </span>
                  </div>
                  <div className="text-xs opacity-60">
                    Invalid characters will be replaced automatically (e.g. / \ : * ? &quot; &lt; &gt; |).
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button className="btn btn-ghost" onClick={closeExportModal}>
                    Cancel
                  </button>
                  <button className={["btn", canApkg ? "btn-accent" : "btn-secondary"].join(" ")} onClick={() => void confirmExport()}>
                    Download
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER BAND */}
      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-100">
        <div className="max-w-6xl mx-auto text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Workflow: <span className="text-primary">Upload</span> → Parse → Review → Export
          </h1>

          {/* ✅ Dynamic by plan */}
          <p className="opacity-75 max-w-2xl mx-auto">{heroSubtitle}</p>

          <div className="flex justify-center pt-2">
            <div className={["badge badge-lg", user ? "badge-primary badge-outline" : "badge-ghost"].join(" ")}>
              {user ? `Logged in (${user.plan})` : "Guest mode"}
            </div>
          </div>

          {user && projectId ? (
            <div className="flex justify-center">
              <div className="badge badge-outline">Project #{projectId}</div>
            </div>
          ) : null}
        </div>
      </section>

      {/* UPLOAD + PARSE BAND */}
      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-200">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-6 items-stretch">
            {/* LEFT: Upload */}
            <div className="lg:w-[420px] w-full flex">
              <div className="card bg-base-100 border border-base-300 rounded-2xl w-full h-full">
                <div className="card-body space-y-4 h-full">
                  <div>
                    <h2 className="text-xl font-bold">1) Upload</h2>
                    <p className="text-sm opacity-70">Drop your Notion markdown file</p>
                  </div>

                  <UploadBox
                    onFile={(t, n) => {
                      setRaw(t);
                      setFilename(n);

                      setCards([]);
                      setEditingIds(new Set());
                      setStatus(null);
                      setProjectId(null);
                      setAiReviewedIds(new Set());
                      setAiLoadingIds(new Set());
                      setAiLastModeById({});
                      setBatch({ running: false, total: 0, done: 0, errors: 0, mode: null, apply: false });
                      setParseReport(null);
                      setShowParseReport(true);
                      cardRefs.current = {};
                    }}
                  />

                  <div className="text-xs opacity-70">
                    File: <span className="font-semibold">{filename || "None"}</span>
                  </div>

                  <div className="rounded-xl border border-base-300 bg-base-200/40 p-3">
                    <div className="text-sm font-semibold">Need a template?</div>
                    <div className="text-xs opacity-70 mt-1">
                      Duplicate the FREE notion template to copy the exact formatting N2A expects
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <a className="btn btn-sm btn-outline" href={NOTION_TEMPLATE_URL} target="_blank" rel="noopener noreferrer">
                        N2A Notion Template
                      </a>
                    </div>
                  </div>

                  {status && (
                    <div className="alert">
                      <span>{status}</span>
                    </div>
                  )}

                  {!user && (
                    <div className="alert alert-info">
                      <span>Guest mode works for parse/edit/export. Login to subscribe + AI.</span>
                    </div>
                  )}

                  <div className="flex-1" />
                </div>
              </div>
            </div>

            {/* RIGHT: Parse & Review */}
            <div className="flex-1 flex">
              <div className="card bg-base-100 border border-base-300 rounded-2xl w-full h-full">
                <div className="card-body space-y-5 h-full">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="text-xl font-bold">2) Parse & Review</h2>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <div className="rounded-xl border border-base-300 bg-base-200/40 px-3 py-2 text-center">
                        <div className="text-xs opacity-70">Total</div>
                        <div className="text-xl font-extrabold text-primary leading-none">{parsedCount}</div>
                      </div>
                      <div className="rounded-xl border border-base-300 bg-base-200/40 px-3 py-2 text-center">
                        <div className="text-xs opacity-70">Shown</div>
                        <div className="text-xl font-extrabold text-primary leading-none">{filteredCount}</div>
                      </div>
                    </div>
                  </div>

                  {/* Controls row */}
                  <div className="grid md:grid-cols-3 gap-3">
                    {/* FILTER */}
                    <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold">Filter</div>

                        <div className="tooltip tooltip-left" data-tip="Filter cards by type: All, Q&A, or MCQ">
                          <button className="btn btn-ghost btn-xs" type="button" aria-label="Filter help">
                            i
                          </button>
                        </div>
                      </div>

                      <select
                        className="select select-bordered w-full"
                        value={filterMode}
                        onChange={(e) => setFilterMode(e.target.value as FilterMode)}
                      >
                        <option value="all">All</option>
                        <option value="qa">Q&A only</option>
                        <option value="mcq">MCQ only</option>
                      </select>
                    </div>

                    {/* MCQ FORMATTING CARD */}
                    <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4 space-y-3">
                      <div>
                        <div className="text-sm font-semibold">Format MCQ Cards</div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs font-semibold opacity-70">Option numbering</div>
                        <select
                          className="select select-bordered w-full"
                          value={mcqStyle}
                          onChange={(e) => setMcqStyle(e.target.value as McqStyle)}
                        >
                          <option value="1)">1)</option>
                          <option value="1.">1.</option>
                          <option value="A)">A)</option>
                          <option value="a)">a)</option>
                          <option value="A.">A.</option>
                          <option value="a.">a.</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold opacity-70">Answer display</div>

                          <div
                            className="tooltip tooltip-left"
                            data-tip="Controls how MCQ answers are shown: keep original, label only, option text only, or label + option."
                          >
                            <button className="btn btn-ghost btn-xs" type="button" aria-label="MCQ answer display help">
                              i
                            </button>
                          </div>
                        </div>

                        <select
                          className="select select-bordered w-full"
                          value={mcqAnswerMode}
                          onChange={(e) => setMcqAnswerMode(e.target.value as McqAnswerMode)}
                        >
                          <option value="default">As Imported</option>
                          <option value="label_only">Option only</option>
                          <option value="option_only">Answer only</option>
                          <option value="label_plus_option">Option and Answer</option>
                        </select>
                      </div>
                    </div>

                    {/* AI ENGLISH */}
                    <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4 space-y-2">
                      <div className="text-sm font-semibold">Spelling consistency</div>

                      <select
                        className="select select-bordered w-full"
                        value={englishVariant}
                        onChange={(e) => setEnglishVariant(e.target.value as EnglishVariant)}
                        disabled={!canAI}
                        title={!canAI ? "Requires a paid plan" : "Choose spelling style for AI output"}
                      >
                        <option value="uk_au">AUS/UK spelling</option>
                        <option value="us">US spelling</option>
                      </select>
                      {!canAI && <div className="text-xs opacity-70">Subscribe in Account to enable this.</div>}
                    </div>
                  </div>

                  {/* Primary buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button className="btn btn-primary w-full" disabled={!raw || busy} onClick={doParse}>
                      Parse
                    </button>

                    <button className="btn btn-outline w-full" disabled={busy} onClick={clearAll}>
                      Clear Cards
                    </button>

                    <button
                      className={exportBtnClass}
                      disabled={!parsedCount || busy || (canApkg && !projectId)}
                      title={canApkg && !projectId ? "Parse while logged in to create a Project before exporting APKG" : exportTitle}
                      onClick={openExportModal}
                    >
                      {exportLabel}
                    </button>
                  </div>

                  {/* AI buttons */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button className="btn btn-ghost w-full" disabled={!parsedCount || busy || !canAI} onClick={() => void aiReviewAll(false, "content")}>
                        AI Content Review
                      </button>
                      <button className="btn btn-ghost w-full" disabled={!parsedCount || busy || !canAI} onClick={() => void aiReviewAll(false, "format")}>
                        AI Format Review
                      </button>
                      <button className="btn btn-ghost w-full" disabled={!parsedCount || busy || !canAI} onClick={() => void aiReviewAll(false, "both")}>
                        AI Content and Format Review
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button className="btn btn-outline w-full" disabled={!parsedCount || busy || !canAI} onClick={() => void aiReviewAll(true, "content")}>
                        Apply Content Changes
                      </button>
                      <button className="btn btn-outline w-full" disabled={!parsedCount || busy || !canAI} onClick={() => void aiReviewAll(true, "format")}>
                        Apply Format Changes
                      </button>
                      <button className="btn btn-outline w-full" disabled={!parsedCount || busy || !canAI} onClick={() => void aiReviewAll(true, "both")}>
                        Apply Content and Format Changes
                      </button>
                    </div>
                  </div>

                  {/* ✅ Post-parse check moved BELOW AI buttons */}
                  {parseReport && showParseReport && (
                    <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold">Post-parse check</div>
                          <div className="text-xs opacity-70">
                            Detected in file:{" "}
                            <span className="font-semibold">
                              {parseReport.rawCounts.questionTags} Question{parseReport.rawCounts.questionTags === 1 ? "" : "s"}
                            </span>{" "}
                            •{" "}
                            <span className="font-semibold">
                              {parseReport.rawCounts.mcqTags} MCQ{parseReport.rawCounts.mcqTags === 1 ? "" : "s"}
                            </span>{" "}
                            • Parsed: <span className="font-semibold">{parseReport.parsedCounts.total}</span> cards (
                            {parseReport.parsedCounts.qa} Q&A / {parseReport.parsedCounts.mcq} MCQ)
                          </div>
                        </div>

                        <div className="flex gap-2 items-center">
                          <button className="btn btn-xs btn-ghost" type="button" onClick={() => setShowParseReport(false)} title="Hide this panel">
                            Hide
                          </button>
                        </div>
                      </div>

                      {parseReport.issues.length === 0 ? (
                        <div className="alert alert-success">
                          <span>No obvious issues detected.</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="text-xs opacity-70">
                              Found <span className="font-semibold">{parseReport.issues.length}</span> item
                              {parseReport.issues.length === 1 ? "" : "s"} to review.
                            </div>

                            <button
                              className="btn btn-xs btn-outline"
                              type="button"
                              onClick={() => {
                                // Quick “copy report” to clipboard (nice UX; optional but helpful)
                                const lines = parseReport.issues.map((x) => {
                                  const tag = x.severity.toUpperCase();
                                  const where = x.cardId ? ` [card ${x.cardId}]` : "";
                                  const det = x.detail ? ` — ${x.detail.replace(/\s+/g, " ").trim()}` : "";
                                  return `${tag}${where}: ${x.title}${det}`;
                                });
                                const summary =
                                  `N2A Parse Report\nDetected: ${parseReport.rawCounts.questionTags} Question / ${parseReport.rawCounts.mcqTags} MCQ\nParsed: ${parseReport.parsedCounts.total} cards\n\n` +
                                  lines.join("\n");
                                navigator.clipboard
                                  .writeText(summary)
                                  .then(() => setStatus("Parse report copied to clipboard."))
                                  .catch(() => setStatus("Could not copy to clipboard (browser blocked)."));
                              }}
                            >
                              Copy report
                            </button>
                          </div>

                          <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
                            {parseReport.issues.map((iss) => (
                              <div key={iss.id} className="rounded-xl border border-base-300 bg-base-100/40 p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={["badge badge-sm", severityBadgeClass(iss.severity)].join(" ")}>
                                        {iss.severity.toUpperCase()}
                                      </span>
                                      <div className="text-sm font-semibold">{iss.title}</div>
                                    </div>
                                    {iss.detail ? <div className="text-xs opacity-80 whitespace-pre-wrap">{iss.detail}</div> : null}
                                  </div>

                                  {iss.cardId ? (
                                    <button className="btn btn-xs btn-primary" type="button" onClick={() => jumpToCard(iss.cardId!)} title="Scroll to this card">
                                      Jump
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="text-[11px] opacity-60">
                            Tip: if “Jump” can’t find the card, set Filter to <span className="font-semibold">All</span> and try again.
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!parseReport && (
                    <div className="text-xs opacity-60">
                      After parsing, N2A will run a quick check and list any cards that look incomplete or likely skipped.
                    </div>
                  )}

                  <div className="flex-1" />

                  {!showParseReport && parseReport && (
                    <div className="pt-1">
                      <button className="btn btn-xs btn-outline" type="button" onClick={() => setShowParseReport(true)}>
                        Show post-parse check
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CARDS BAND */}
      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-100">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">
                Cards <span className="text-primary">Preview</span>
              </h2>

              <p className="opacity-70 text-sm">
                Press Review to run AI content review, press Format to run AI format review, press Apply to apply AI suggested
                changes, press Edit to modify card, press Delete to remove card from export
              </p>
            </div>
          </div>

          {!filteredCards.length ? (
            <div className="card bg-base-200/40 border border-base-300 rounded-2xl">
              <div className="card-body text-center space-y-2">
                <div className="text-lg font-semibold">No cards to show</div>
                <div className="text-sm opacity-70">{cards.length ? "Try changing the Filter." : "Upload a Markdown export, then press Parse."}</div>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCards.map((c) => {
                const isEditing = editingIds.has(c.id);
                const isPersisted = /^\d+$/.test(c.id) && !!projectId;
                const isAiLoading = aiLoadingIds.has(c.id);

                const previewFront = c.card_type === "mcq" ? formatMcqOptions(c.front, mcqStyle) : c.front;

                const previewBack =
                  c.card_type === "mcq"
                    ? expandMcqAnswerIfLabelOnly({
                        cardFront: c.front,
                        cardBack: c.back,
                        style: mcqStyle,
                        mode: mcqAnswerMode,
                      })
                    : c.back;

                const hasAnyAiField =
                  c.ai_changed !== undefined ||
                  c.ai_flag !== undefined ||
                  c.ai_feedback !== undefined ||
                  c.ai_suggest_front !== undefined ||
                  c.ai_suggest_back !== undefined;

                const wasReviewedThisSession = aiReviewedIds.has(c.id);
                const showAiPanel = hasAnyAiField || wasReviewedThisSession;

                const changed = !!c.ai_changed;
                const flag = c.ai_flag ?? null;
                const feedback = (c.ai_feedback ?? "").trim();

                const incorrect = isIncorrectFlag(flag);
                const lastMode = aiLastModeById[c.id];
                const formatContext = lastMode === "format" || isFormatFlag(flag);

                const showDiff = changed && !incorrect && !formatContext;
                const showPlainSuggested = changed && !incorrect && formatContext;

                const disableApplyBecauseIncorrect = incorrect;

                return (
                  <div
                    key={c.id}
                    ref={(el) => {
                      cardRefs.current[c.id] = el;
                    }}
                    className="card bg-base-200/40 border border-base-300 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:bg-base-200"
                  >
                    <div className="card-body space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="badge badge-outline">{c.card_type.toUpperCase()}</div>

                        <div className="flex gap-2 flex-wrap justify-end items-center">
                          {isAiLoading && <span className="loading loading-spinner loading-xs text-primary" />}

                          <button
                            className="btn btn-xs btn-ghost"
                            disabled={busy || !canAI || !isPersisted || isAiLoading}
                            onClick={() => {
                              setStatus("Running AI review (content)…");
                              void aiReviewCard(c.id, false, "content")
                                .then(() => setStatus("AI review complete."))
                                .catch((e: any) => setStatus(e?.message ? `AI Review failed: ${e.message}` : "AI Review failed."));
                            }}
                          >
                            Review
                          </button>

                          <button
                            className="btn btn-xs btn-ghost"
                            disabled={busy || !canAI || !isPersisted || isAiLoading}
                            onClick={() => {
                              setStatus("Running AI review (format)…");
                              void aiReviewCard(c.id, false, "format")
                                .then(() => setStatus("AI review complete."))
                                .catch((e: any) => setStatus(e?.message ? `AI Review failed: ${e.message}` : "AI Review failed."));
                            }}
                          >
                            Format
                          </button>

                          <button
                            className="btn btn-xs btn-ghost"
                            disabled={busy || !canAI || !isPersisted || isAiLoading || disableApplyBecauseIncorrect}
                            title={disableApplyBecauseIncorrect ? "Cannot apply: card flagged as incorrect" : "Apply AI suggestions"}
                            onClick={() => {
                              setStatus("Applying AI (both)…");
                              void aiReviewCard(c.id, true, "both")
                                .then(() => setStatus("AI applied."))
                                .catch((e: any) => setStatus(e?.message ? `AI Apply failed: ${e.message}` : "AI Apply failed."));
                            }}
                          >
                            Apply
                          </button>

                          <button className="btn btn-xs btn-ghost" disabled={busy || isAiLoading} onClick={() => toggleEdit(c.id)}>
                            {isEditing ? "Close" : "Edit"}
                          </button>

                          <button className="btn btn-xs btn-ghost" disabled={busy || isAiLoading} onClick={() => void deleteCard(c.id)}>
                            Delete
                          </button>
                        </div>
                      </div>

                      {showAiPanel && (
                        <div className="rounded-xl border border-base-300 bg-base-100/40 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-semibold opacity-70">AI result</div>

                            <div className="flex gap-2 items-center">
                              {incorrect ? (
                                <span className="badge badge-sm badge-error">Incorrect</span>
                              ) : formatContext && changed ? (
                                <span className="badge badge-sm badge-info">Formatting updated</span>
                              ) : (
                                <span className={["badge badge-sm", changed ? "badge-warning" : "badge-success"].join(" ")}>
                                  {changed ? "Changes suggested" : "Reviewed"}
                                </span>
                              )}

                              {flag ? <span className="badge badge-sm badge-outline">{flag}</span> : null}
                            </div>
                          </div>

                          {incorrect ? (
                            <div className="rounded-xl border border-error/30 bg-error/10 p-3">
                              <div className="font-semibold text-error">This card appears incorrect.</div>
                              <div className="text-sm opacity-80 mt-1 whitespace-pre-wrap">
                                {feedback || "AI flagged the original answer as incorrect. No replacement answer is provided."}
                              </div>
                              <div className="text-xs opacity-70 mt-2">Tip: edit the card manually, then re-run AI review.</div>
                            </div>
                          ) : (
                            <div className="text-sm whitespace-pre-wrap opacity-80">
                              {feedback
                                ? feedback
                                : wasReviewedThisSession
                                ? "AI ran successfully, but returned no feedback for this card."
                                : "AI fields are empty for this card (no stored feedback)."}
                            </div>
                          )}

                          {!incorrect && changed && (c.ai_suggest_front || c.ai_suggest_back) && (
                            <details className="collapse collapse-arrow border border-base-300 bg-base-200/40 rounded-xl">
                              <summary className="collapse-title text-sm font-semibold">
                                {showDiff ? "View suggested front/back (changes highlighted)" : "View suggested front/back"}
                              </summary>

                              <div className="collapse-content space-y-4">
                                {showPlainSuggested && (
                                  <div className="text-xs opacity-70">
                                    Formatting changed for clarity (spacing/bullets/structure). Content meaning is intended to be unchanged.
                                  </div>
                                )}

                                <div className="space-y-2">
                                  <div className="text-xs font-semibold opacity-70">Suggested front</div>
                                  {showDiff ? (
                                    <DiffBlock original={c.front} suggested={c.ai_suggest_front ?? ""} />
                                  ) : (
                                    <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-base-100/40 border border-base-300 rounded-xl p-3">
                                      {c.ai_suggest_front ?? ""}
                                    </pre>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <div className="text-xs font-semibold opacity-70">Suggested back</div>
                                  {showDiff ? (
                                    <DiffBlock original={c.back} suggested={c.ai_suggest_back ?? ""} />
                                  ) : (
                                    <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-base-100/40 border border-base-300 rounded-xl p-3">
                                      {c.ai_suggest_back ?? ""}
                                    </pre>
                                  )}
                                </div>
                              </div>
                            </details>
                          )}
                        </div>
                      )}

                      <div className="text-xs font-semibold opacity-70">Front (preview)</div>
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-base-100/40 border border-base-300 rounded-xl p-3">{previewFront}</pre>

                      <div className="text-xs font-semibold opacity-70">Back (preview)</div>
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-base-100/40 border border-base-300 rounded-xl p-3">{previewBack}</pre>

                      {isEditing && (
                        <div className="rounded-2xl border border-base-300 bg-base-100/50 p-3 space-y-3">
                          <div className="text-xs font-semibold opacity-70">Front (edit)</div>
                          <textarea
                            className="textarea textarea-bordered w-full min-h-[96px] text-sm leading-relaxed"
                            value={c.front}
                            onChange={(e) => {
                              const nextFront = e.target.value;
                              updateCardLocal(c.id, { front: nextFront });
                              void persistCardEditIfPossible(c.id, nextFront, c.back);
                            }}
                          />

                          <div className="text-xs font-semibold opacity-70">Back (edit)</div>
                          <textarea
                            className="textarea textarea-bordered w-full min-h-[96px] text-sm leading-relaxed"
                            value={c.back}
                            onChange={(e) => {
                              const nextBack = e.target.value;
                              updateCardLocal(c.id, { back: nextBack });
                              void persistCardEditIfPossible(c.id, c.front, nextBack);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

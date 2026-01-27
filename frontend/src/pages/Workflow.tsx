// src/pages/Workflow.tsx
import React from "react";
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
/* Diff helper: line-based "good enough" visual diff for flashcards.   */
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

/* ------------------------------------------------------------------ */
/* File ingest: accepts Notion exports as .md, .html, or .zip.          */
/* - .zip: picks the first .md (preferred) else first .html inside      */
/* - requires: npm i fflate                                             */
/* ------------------------------------------------------------------ */
type IngestKind = "md" | "html";

function uid() {
  return Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
}

async function readFileAsText(file: File): Promise<string> {
  return await file.text();
}

async function extractFromZip(file: File): Promise<{ text: string; name: string; kind: IngestKind }> {
  // Notion exports .zip that contains lots of assets + one main .md or .html
  const { unzipSync, strFromU8 } = await import("fflate");
  const u8 = new Uint8Array(await file.arrayBuffer());
  const unz = unzipSync(u8);

  const entries = Object.keys(unz);
  const pick = (exts: string[]) => entries.find((p) => exts.some((e) => p.toLowerCase().endsWith(e)));

  const mdPath = pick([".md"]);
  const htmlPath = pick([".html", ".htm"]);
  const chosen = mdPath || htmlPath;

  if (!chosen) {
    throw new Error("Zip did not contain a .md or .html file. Export from Notion and upload the export zip.");
  }

  const bytes = unz[chosen];
  const text = strFromU8(bytes);

  const kind: IngestKind = mdPath ? "md" : "html";
  const baseName = chosen.split("/").pop() || chosen;
  return { text, name: baseName, kind };
}

/* ------------------------------------------------------------------ */
/* HTML -> pseudo-markdown lines (best-effort)                          */
/* We turn list items into '- ' lines; headings/paragraphs into lines.  */
/* Then we reuse the same markdown parsing logic.                       */
/* ------------------------------------------------------------------ */
function htmlToPseudoMarkdownLines(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;

  const lines: string[] = [];

  // Helpers
  const pushLine = (s: string) => {
    const t = (s ?? "").replace(/\u00a0/g, " ").replace(/\s+$/g, "");
    if (t.trim().length === 0) return;
    lines.push(t);
  };

  const walk = (node: Node, indent: string) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = (node.textContent || "").replace(/\s+/g, " ");
      if (txt.trim()) pushLine(indent + txt.trim());
      return;
    }

    if (!(node instanceof Element)) return;

    const tag = node.tagName.toLowerCase();

    // Treat these as line breaks / block lines
    const isBlock = ["p", "li", "summary", "h1", "h2", "h3", "h4", "h5", "h6"].includes(tag);

    if (tag === "li") {
      // list item -> bullet line with '- '
      const text = (node.textContent || "").trim();
      if (text) pushLine(indent + "- " + text);
      // nested lists under LI become more indented
      Array.from(node.children).forEach((ch) => {
        const childTag = ch.tagName.toLowerCase();
        if (childTag === "ul" || childTag === "ol") walk(ch, indent + "  ");
      });
      return;
    }

    if (tag === "ul" || tag === "ol") {
      Array.from(node.children).forEach((ch) => walk(ch, indent));
      return;
    }

    if (tag === "details") {
      // details acts like toggle: summary line, then contents indented
      const summary = node.querySelector(":scope > summary");
      if (summary) {
        const s = (summary.textContent || "").trim();
        if (s) pushLine(indent + "- " + s);
      }
      Array.from(node.children).forEach((ch) => {
        if (ch.tagName.toLowerCase() === "summary") return;
        walk(ch, indent + "  ");
      });
      return;
    }

    if (isBlock) {
      const text = (node.textContent || "").trim();
      if (text) pushLine(indent + text);
      return;
    }

    // Default: recurse
    Array.from(node.childNodes).forEach((ch) => walk(ch, indent));
  };

  Array.from(body.childNodes).forEach((n) => walk(n, ""));
  return lines;
}

/* ------------------------------------------------------------------ */
/* Parsing logic (improved for Notion exports)                          */
/* - Accept tags even when bullet/toggle prefixed ("- Question:")       */
/* - Accept Q: as Question                                               */
/* - Accept indentation of ANY number of spaces or a tab (not just 4)    */
/* - MCQ options: any bullet/indented line until Answer:                 */
/* - MCQ answer: supports Answer: same line OR following indented lines  */
/* ------------------------------------------------------------------ */
function stripLeadDecor(line: string): string {
  // remove leading bullets, checkbox markers, and indentation
  // Examples:
  // "- Question: ..." => "Question: ..."
  // "  - MCQ: ..."    => "MCQ: ..."
  return line.replace(/^\s*([-*•]\s+)+/, "").replace(/^\s+/, "");
}

function normTag(line: string): "question" | "mcq" | "answer" | null {
  const s0 = stripLeadDecor(line).trim().toLowerCase();

  // tolerate common misspellings
  if (
    s0.startsWith("question:") ||
    s0.startsWith("quesition:") ||
    s0.startsWith("quesiton:") ||
    s0.startsWith("q:")
  ) {
    return "question";
  }
  if (s0.startsWith("mcq:") || s0.startsWith("mcu:") || s0 === "mcq") return "mcq";
  if (s0.startsWith("answer:")) return "answer";
  return null;
}

function isIndentedOrBullet(line: string): boolean {
  // ANY leading whitespace counts (covers Notion "tab" that becomes 2 spaces)
  // Also treat list/toggle bullet as indented content
  return /^\s+/.test(line) || /^\s*[-*•]\s+/.test(line);
}

function cleanIndentedLine(line: string): string {
  // remove one layer of indentation/bullets but preserve inner structure
  return line.replace(/^\s*[-*•]\s+/, "").replace(/^\s+/, "").replace(/\s+$/g, "");
}

function parseMarkdownOrPseudoLines(mdOrLines: string | string[], kind: IngestKind): Omit<Card, "id">[] {
  const lines = Array.isArray(mdOrLines) ? mdOrLines : mdOrLines.split(/\r?\n/);

  const out: Omit<Card, "id">[] = [];
  let i = 0;

  while (i < lines.length) {
    const tag = normTag(lines[i]);
    if (!tag || tag === "answer") {
      i++;
      continue;
    }

    if (tag === "question") {
      const q = stripLeadDecor(lines[i]).split(":", 2)[1]?.trim() || "";
      i++;

      const ans: string[] = [];
      while (i < lines.length) {
        const t = normTag(lines[i]);
        if (t === "question" || t === "mcq") break;

        const nxt = lines[i];

        if (nxt.trim() === "") {
          if (ans.length) ans.push("");
          i++;
          continue;
        }

        if (isIndentedOrBullet(nxt)) {
          ans.push(cleanIndentedLine(nxt));
          i++;
          continue;
        }

        // flat, non-empty line ends the answer once we've started capturing
        if (ans.length) break;

        // otherwise ignore stray flat text before answer begins
        i++;
      }

      out.push({ card_type: "qa", front: q, back: ans.join("\n").trim() });
      continue;
    }

    // MCQ
    const stem = stripLeadDecor(lines[i]).split(":", 2)[1]?.trim() || "";
    i++;

    const opts: string[] = [];
    const ansLines: string[] = [];
    let inAns = false;

    while (i < lines.length) {
      const t = normTag(lines[i]);
      if (t === "question" || t === "mcq") break;

      const nxt = lines[i];

      if (nxt.trim() === "") {
        if (inAns && ansLines.length) ansLines.push("");
        i++;
        continue;
      }

      if (t === "answer") {
        const after = stripLeadDecor(nxt).split(":", 2)[1]?.trim() || "";
        inAns = true;
        if (after) ansLines.push(after);
        i++;
        continue;
      }

      if (!inAns) {
        if (isIndentedOrBullet(nxt)) {
          opts.push(cleanIndentedLine(nxt));
          i++;
          continue;
        }
        break;
      }

      if (isIndentedOrBullet(nxt)) {
        ansLines.push(cleanIndentedLine(nxt));
        i++;
        continue;
      }

      if (!ansLines.length) {
        ansLines.push(stripLeadDecor(nxt).trim());
        i++;
        continue;
      }

      break;
    }

    out.push({
      card_type: "mcq",
      front: opts.length ? `${stem}\n${opts.join("\n")}` : stem,
      back: ansLines.join("\n").trim(),
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Existing MCQ formatting / TSV / APKG helpers (unchanged)             */
/* ------------------------------------------------------------------ */
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

function formatMcqAnswer(back: string, style: McqStyle): string {
  const raw0 = (back || "").trim();
  if (!raw0) return raw0;

  const raw = raw0.replace(/^answer:\s*/i, "").trim();
  if (!raw) return raw0;

  const m = raw.match(/^([A-Za-z]|\d+)\s*([)\.:])?\s*(.*)$/);
  if (!m) return raw0;

  const token = m[1];
  const delim = m[2] || "";
  const rest = (m[3] || "").trim();

  const isNum = /^\d+$/.test(token);
  const isLetter = /^[A-Za-z]$/.test(token);

  if (isLetter) {
    const restStartsLower = rest.length > 0 && /^[a-z]/.test(rest);
    const looksLikeWordContinuation = !delim && restStartsLower;
    if (looksLikeWordContinuation) return raw0;
  }

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

function expandMcqAnswerIfLabelOnly(args: {
  cardFront: string;
  cardBack: string;
  style: McqStyle;
  mode: McqAnswerMode;
}): string {
  const { cardFront, cardBack, style, mode } = args;

  const original = (cardBack ?? "").trim();
  if (mode === "default") return original;

  const base = formatMcqAnswer(original, style).trim();
  if (!base) return base;

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

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s+/g, " ")
      .replace(/[^\w\s\-+./%()]/g, "")
      .trim();

  const labelTokenToIndex = (token: string) => {
    if (/^\d+$/.test(token)) return Math.max(parseInt(token, 10) - 1, 0);
    if (/^[A-Za-z]$/.test(token)) return token.toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
    return null;
  };

  const findIndex = (): number | null => {
    if (!optLines.length) return null;

    const pureLabel = base.match(/^([A-Za-z]|\d+)\s*([)\.])?$/);
    if (pureLabel) {
      const idx = labelTokenToIndex(pureLabel[1]);
      if (idx == null) return null;
      return idx >= 0 && idx < optLines.length ? idx : null;
    }

    const withLabel = base.match(/^\s*([A-Za-z]|\d+)\s*[)\.]\s+(.+)$/);
    if (withLabel) {
      const idx = labelTokenToIndex(withLabel[1]);
      if (idx != null && idx >= 0 && idx < optLines.length) return idx;

      const targetText = normalize(withLabel[2]);
      for (let i = 0; i < optLines.length; i++) {
        const optText = normalize(stripLeadingLabel(optLines[i]));
        if (optText && optText === targetText) return i;
      }
      return null;
    }

    const target = normalize(stripLeadingLabel(base));
    if (!target) return null;

    for (let i = 0; i < optLines.length; i++) {
      const optText = normalize(stripLeadingLabel(optLines[i]));
      if (optText && optText === target) return i;
    }

    return null;
  };

  const idx = findIndex();
  if (idx == null) return base;

  const optionLine = optLines[idx];
  const optionText = stripLeadingLabel(optionLine);

  if (mode === "label_only") return labelFor(idx);
  if (mode === "option_only") return optionText || base;

  return optionLine || `${labelFor(idx)} ${optionText}`.trim();
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fieldToHtml(field: string) {
  const noTabs = String(field ?? "").replaceAll("\t", "    ");
  return escapeHtml(noTabs).replace(/(?:\r\n|\r|\n)/g, "<br>");
}

// --- APKG download helper ---
async function downloadApkg(projectId: number) {
  const rawBase = (import.meta as any).env?.VITE_API_BASE;
  const API_BASE = (rawBase && String(rawBase).trim()) || "https://api.n2a.com.au";

  const url = `${API_BASE.replace(/\/+$/, "")}/export/apkg/${projectId}`;

  const resp = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/octet-stream" },
  });

  if (!resp.ok) {
    try {
      const j = await resp.json();
      throw new Error(j?.detail || `APKG export failed (${resp.status})`);
    } catch {
      throw new Error(`APKG export failed (${resp.status})`);
    }
  }

  const ct = (resp.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("text/html")) {
    const text = await resp.text();
    const firstLine = (text.split("\n")[0] || "").slice(0, 120);
    throw new Error(`APKG export returned HTML (wrong API base / routing). URL was: ${url}. First line: ${firstLine}`);
  }

  const blob = await resp.blob();
  const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  const looksZip = head.length === 2 && head[0] === 0x50 && head[1] === 0x4b;
  if (!looksZip) {
    try {
      const text = await blob.text();
      throw new Error(`APKG export did not look like a zip. First 120 chars: ${text.slice(0, 120)}`);
    } catch {
      throw new Error("APKG export did not look like a zip file (unexpected response).");
    }
  }

  const cd = resp.headers.get("content-disposition") || "";
  const m = cd.match(/filename="?([^"]+)"?/i);
  const filename = m?.[1] || "n2a_deck.apkg";

  const dlUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = dlUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(dlUrl);
}

/* ------------------------------------------------------------------ */
/* UI component: file drop + picker                                    */
/* ------------------------------------------------------------------ */
function FileDrop(props: {
  disabled?: boolean;
  onLoaded: (args: { text: string; filename: string; kind: IngestKind }) => void;
  onError: (msg: string) => void;
}) {
  const { disabled, onLoaded, onError } = props;
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFile = React.useCallback(
    async (file: File) => {
      try {
        const lower = (file.name || "").toLowerCase();

        if (lower.endsWith(".zip")) {
          const { text, name, kind } = await extractFromZip(file);
          onLoaded({ text, filename: name, kind });
          return;
        }

        if (lower.endsWith(".html") || lower.endsWith(".htm")) {
          const text = await readFileAsText(file);
          onLoaded({ text, filename: file.name, kind: "html" });
          return;
        }

        const text = await readFileAsText(file);
        onLoaded({ text, filename: file.name, kind: "md" });
      } catch (e: any) {
        const msg =
          e?.message ||
          "Failed to read file. If you're uploading a Notion export zip, install fflate: `npm i fflate` and retry.";
        onError(msg);
      }
    },
    [onLoaded, onError]
  );

  return (
    <div
      className={[
        "rounded-2xl border border-base-300 bg-base-200/40 p-4",
        disabled ? "opacity-60 pointer-events-none" : "cursor-pointer",
      ].join(" ")}
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const f = e.dataTransfer.files?.[0];
        if (f) void handleFile(f);
      }}
      aria-label="Upload a Notion export (.md, .html, or .zip)"
      title="Upload a Notion export (.md, .html, or .zip)"
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".md,.markdown,.html,.htm,.zip"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.currentTarget.value = "";
        }}
      />

      <div className="flex items-start gap-3">
        <div className="badge badge-outline mt-1">Upload</div>
        <div className="space-y-1">
          <div className="font-semibold">Drop a Notion export here</div>
          <div className="text-xs opacity-70">Accepted: .md, .html, or Notion export .zip</div>
        </div>
      </div>
    </div>
  );
}

export default function Workflow() {
  const [user, setUser] = React.useState<any>(null);
  const [authLoading, setAuthLoading] = React.useState(true);

  const [raw, setRaw] = React.useState("");
  const [filename, setFilename] = React.useState("");
  const [ingestKind, setIngestKind] = React.useState<IngestKind>("md");

  const [cards, setCards] = React.useState<Card[]>([]);
  const [status, setStatus] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [mcqStyle, setMcqStyle] = React.useState<McqStyle>("1)");
  const [mcqAnswerMode, setMcqAnswerMode] = React.useState<McqAnswerMode>("default");
  const [englishVariant, setEnglishVariant] = React.useState<EnglishVariant>("uk_au");
  const [filterMode, setFilterMode] = React.useState<FilterMode>("all");

  const [editingIds, setEditingIds] = React.useState<Set<string>>(() => new Set());
  const [projectId, setProjectId] = React.useState<number | null>(null);

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

  const canAI = !!user && user.plan && user.plan !== "free" && user.plan !== "guest";
  const canApkg = canAI;

  const heroSubtitle = canAI
    ? "Parse locally, edit freely, review with AI, export clean apkg for Anki"
    : "Parse locally, edit freely, export clean TSV for Anki. AI review and apkg export is available on paid plans";

  const filteredCards = React.useMemo(() => {
    if (filterMode === "all") return cards;
    return cards.filter((c) => c.card_type === filterMode);
  }, [cards, filterMode]);

  function clearAll() {
    setRaw("");
    setFilename("");
    setIngestKind("md");
    setCards([]);
    setStatus(null);
    setEditingIds(new Set());
    setProjectId(null);
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
      const parsedLocal =
        ingestKind === "html"
          ? parseMarkdownOrPseudoLines(htmlToPseudoMarkdownLines(raw), "html")
          : parseMarkdownOrPseudoLines(raw, "md");

      const localCards = parsedLocal.map((c) => ({ ...c, id: uid() }));
      setCards(localCards);
      setEditingIds(new Set());
      setProjectId(null);
      setStatus(`Parsed ${localCards.length} card${localCards.length === 1 ? "" : "s"}.`);
    } catch (e: any) {
      setStatus(e?.message ? `Parse failed: ${e.message}` : "Parse failed.");
    } finally {
      setBusy(false);
    }
  }

  function exportTSV() {
    const tsv = cards.map((c) => `${fieldToHtml(c.front)}\t${fieldToHtml(c.back)}`).join("\n");
    const blob = new Blob([tsv], { type: "text/tab-separated-values;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (filename ? filename.replace(/\.(md|markdown|html|htm)$/i, "") : "n2a") + ".tsv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8">
      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-100">
        <div className="max-w-6xl mx-auto text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Workflow: <span className="text-primary">Upload</span> → Parse → Review → Export
          </h1>
          <p className="opacity-75 max-w-2xl mx-auto">{heroSubtitle}</p>
        </div>
      </section>

      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-200">
        <div className="max-w-3xl mx-auto space-y-4">
          <FileDrop
            disabled={busy}
            onLoaded={({ text, filename, kind }) => {
              setRaw(text);
              setFilename(filename);
              setIngestKind(kind);
              setCards([]);
              setEditingIds(new Set());
              setStatus(null);
            }}
            onError={(msg) => setStatus(msg)}
          />

          <div className="text-sm opacity-70">
            File: <span className="font-semibold">{filename || "None"}</span>{" "}
            {filename ? <span className="opacity-60">({ingestKind.toUpperCase()})</span> : null}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button className="btn btn-primary" disabled={!raw || busy} onClick={doParse}>
              Parse
            </button>
            <button className="btn btn-outline" disabled={busy} onClick={clearAll}>
              Clear
            </button>
            <button className="btn btn-secondary" disabled={!cards.length || busy} onClick={exportTSV}>
              Export TSV
            </button>
            <a className="btn btn-ghost" href={NOTION_TEMPLATE_URL} target="_blank" rel="noopener noreferrer">
              N2A Notion Template
            </a>
          </div>

          {status && (
            <div className="alert">
              <span>{status}</span>
            </div>
          )}
        </div>
      </section>

      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-100">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-bold">Cards ({filteredCards.length})</div>
            <select className="select select-bordered" value={filterMode} onChange={(e) => setFilterMode(e.target.value as FilterMode)}>
              <option value="all">All</option>
              <option value="qa">Q&A only</option>
              <option value="mcq">MCQ only</option>
            </select>
          </div>

          {!filteredCards.length ? (
            <div className="opacity-70">No cards yet.</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCards.map((c) => {
                const isEditing = editingIds.has(c.id);
                return (
                  <div key={c.id} className="card bg-base-200/40 border border-base-300 rounded-2xl">
                    <div className="card-body space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="badge badge-outline">{c.card_type.toUpperCase()}</div>
                        <button className="btn btn-xs btn-ghost" onClick={() => toggleEdit(c.id)}>
                          {isEditing ? "Close" : "Edit"}
                        </button>
                      </div>

                      <div className="text-xs font-semibold opacity-70">Front</div>
                      <pre className="whitespace-pre-wrap text-sm bg-base-100/40 border border-base-300 rounded-xl p-3">{c.front}</pre>

                      <div className="text-xs font-semibold opacity-70">Back</div>
                      <pre className="whitespace-pre-wrap text-sm bg-base-100/40 border border-base-300 rounded-xl p-3">{c.back}</pre>

                      {isEditing && (
                        <>
                          <textarea
                            className="textarea textarea-bordered w-full min-h-[90px]"
                            value={c.front}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCards((prev) => prev.map((x) => (x.id === c.id ? { ...x, front: v } : x)));
                            }}
                          />
                          <textarea
                            className="textarea textarea-bordered w-full min-h-[90px]"
                            value={c.back}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCards((prev) => prev.map((x) => (x.id === c.id ? { ...x, back: v } : x)));
                            }}
                          />
                        </>
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

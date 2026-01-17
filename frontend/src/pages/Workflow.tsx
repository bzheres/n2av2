// src/pages/Workflow.tsx
import React from "react";
import { Link } from "react-router-dom";
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

type ParserIssueKind =
  | "qa_missing_answer"
  | "qa_empty_question"
  | "mcq_missing_options"
  | "mcq_missing_answer_tag"
  | "mcq_answer_not_indented"
  | "mcq_empty_stem";

type ParserDiagnostic = {
  kind: ParserIssueKind;
  line: number; // 1-based
  message: string;
  hint?: string;
  snippet?: string;
};

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
            <div key={idx} className="rounded px-1 py-[1px] bg-error/10 border border-error/20 line-through text-error/80">
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
/* Parser (frontend mirror) + Diagnostics                              */
/* ------------------------------------------------------------------ */

function parseMarkdownWithDiagnostics(md: string): { cards: Omit<Card, "id">[]; diagnostics: ParserDiagnostic[] } {
  const lines = md.split(/\r?\n/);

  const normTag = (l: string): "question" | "mcq" | null => {
    const s = l.trim().toLowerCase();

    // Q variants
    if (
      s.startsWith("question:") ||
      s.startsWith("quesition:") ||
      s.startsWith("quesiton:") ||
      s.startsWith("quesion:") ||
      s.startsWith("qestion:") ||
      s.startsWith("queston:") ||
      s.startsWith("qustion:") ||
      s.startsWith("q:")
    )
      return "question";

    // MCQ variants
    if (s.startsWith("mcq:") || s.startsWith("mcu:") || s.startsWith("mcv:") || s.startsWith("mvq:") || s.startsWith("mqc:") || s.startsWith("mc:"))
      return "mcq";

    return null;
  };

  const isAnswerTag = (l: string) => {
    const s = l.trim().toLowerCase();
    return (
      s.startsWith("answer:") ||
      s.startsWith("ans:") ||
      s.startsWith("anser:") ||
      s.startsWith("anwser:") ||
      s.startsWith("aswer:") ||
      s.startsWith("anwer:") ||
      s.startsWith("answer :") ||
      s.startsWith("ans :")
    );
  };

  const isIndentedOrBulleted = (l: string) => /^(\t|\s{4}|-\s|\*\s)/.test(l);

  const stripOnePrefix = (l: string) => l.replace(/^(\t|\s{4}|-\s|\*\s)/, "").trimEnd();

  const out: Omit<Card, "id">[] = [];
  const diagnostics: ParserDiagnostic[] = [];

  let i = 0;

  while (i < lines.length) {
    const tag = normTag(lines[i]);
    if (!tag) {
      i++;
      continue;
    }

    // ---------------- Q&A ----------------
    if (tag === "question") {
      const lineNo = i + 1;
      const q = (lines[i].split(":", 2)[1] || "").trim();

      if (!q) {
        diagnostics.push({
          kind: "qa_empty_question",
          line: lineNo,
          message: "Q&A tag found but the question text is empty.",
          hint: "Write the question on the SAME line after 'Question:'.",
          snippet: lines[i],
        });
      }

      i++;
      const ans: string[] = [];
      let sawAnyNonBlank = false;

      while (i < lines.length) {
        if (normTag(lines[i])) break;
        const nxt = lines[i];

        if (nxt.trim() === "") {
          if (ans.length) ans.push("");
          i++;
          continue;
        }

        sawAnyNonBlank = true;

        if (isIndentedOrBulleted(nxt)) {
          ans.push(stripOnePrefix(nxt));
          i++;
          continue;
        }

        // Stop once answer started; otherwise keep scanning until we hit real text (then it's a failure)
        if (ans.length) break;

        // This is non-indented text immediately after Question: -> will not be captured
        // We keep scanning, but if we never capture anything, we'll show a diagnostic.
        i++;
      }

      const back = ans.join("\n").trim();
      out.push({ card_type: "qa", front: q, back });

      if (!back && sawAnyNonBlank) {
        diagnostics.push({
          kind: "qa_missing_answer",
          line: lineNo,
          message: "Q&A parsed but no answer lines were captured.",
          hint: "Answers must be indented (TAB or 4 spaces) or use '- ' / '* ' bullets on the answer lines.",
          snippet: lines[lineNo - 1],
        });
      }

      continue;
    }

    // ---------------- MCQ ----------------
    if (tag === "mcq") {
      const lineNo = i + 1;
      const stem = (lines[i].split(":", 2)[1] || "").trim();

      if (!stem) {
        diagnostics.push({
          kind: "mcq_empty_stem",
          line: lineNo,
          message: "MCQ tag found but the stem (question text) is empty.",
          hint: "Write the MCQ question on the SAME line after 'MCQ:'.",
          snippet: lines[i],
        });
      }

      i++;
      const opts: string[] = [];
      const ansLines: string[] = [];
      let inAns = false;
      let sawAnswerTag = false;
      let answerHadNonIndentedLine = false;

      while (i < lines.length) {
        if (normTag(lines[i])) break;
        const nxt = lines[i];

        if (nxt.trim() === "") {
          i++;
          continue;
        }

        if (isAnswerTag(nxt)) {
          sawAnswerTag = true;
          inAns = true;

          // allow "Answer: B) ..."
          const after = nxt.split(":", 2)[1] || "";
          if (after.trim()) ansLines.push(after.trim());

          i++;
          continue;
        }

        if (inAns) {
          // multi-line answer ONLY if indented/bulleted
          if (isIndentedOrBulleted(nxt)) {
            ansLines.push(stripOnePrefix(nxt));
            i++;
            continue;
          }

          // Non-indented answer line will be ignored (by design), so we log it.
          answerHadNonIndentedLine = true;
          break;
        }

        // options
        if (isIndentedOrBulleted(nxt)) {
          opts.push(stripOnePrefix(nxt));
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

      if (!opts.length) {
        diagnostics.push({
          kind: "mcq_missing_options",
          line: lineNo,
          message: "MCQ parsed but no options were detected.",
          hint: "Options must be indented (TAB or 4 spaces) or use '- ' / '* ' bullets, one option per line.",
          snippet: lines[lineNo - 1],
        });
      }

      if (!sawAnswerTag) {
        diagnostics.push({
          kind: "mcq_missing_answer_tag",
          line: lineNo,
          message: "MCQ parsed but no Answer tag was found.",
          hint: "Add an 'Answer:' line after the options. Put the answer on the same line (Answer: B) …) OR on indented lines below it.",
          snippet: lines[lineNo - 1],
        });
      } else if (!ansLines.length) {
        diagnostics.push({
          kind: "mcq_answer_not_indented",
          line: lineNo,
          message: "MCQ found an Answer tag, but no answer lines were captured.",
          hint: "After 'Answer:' the answer lines must be indented (TAB or 4 spaces) or bulleted.",
          snippet: answerHadNonIndentedLine ? "Answer lines were not indented." : lines[lineNo - 1],
        });
      }

      continue;
    }
  }

  return { cards: out, diagnostics };
}

function uid() {
  return Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
}

function formatMcqOptions(front: string, style: McqStyle): string {
  const lines = front.split("\n");
  if (lines.length <= 1) return front;

  const stem = lines[0];
  const opts = lines
    .slice(1)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

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
    const cleaned = o.replace(/^\s*(?:([A-Za-z]|\d+)[\)\.])\s+/, "").trim();
    return `${labelFor(i)} ${cleaned}`;
  });

  return [stem, ...rebuilt].join("\n");
}

function formatMcqAnswer(back: string, style: McqStyle): string {
  const raw = (back || "").trim();
  if (!raw) return raw;

  const lines = raw.split("\n");
  const first = (lines[0] || "").trim();
  const rest = lines.slice(1);

  const m = first.match(/^(?:answer:\s*)?([A-Za-z]|\d+)\s*([\)\.])(?:\s+(.*))?$/i);
  if (!m) return raw;

  const token = m[1];
  const trailing = (m[3] || "").trim();

  const isNum = /^\d+$/.test(token);
  const idx = isNum ? Math.max(parseInt(token, 10) - 1, 0) : token.toUpperCase().charCodeAt(0) - "A".charCodeAt(0);

  if (idx < 0 || idx > 25) return raw;

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

  const firstLine = trailing ? `${label} ${trailing}` : label;
  return [firstLine, ...rest].join("\n").trim();
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
  const [englishVariant, setEnglishVariant] = React.useState<EnglishVariant>("uk_au");
  const [filterMode, setFilterMode] = React.useState<FilterMode>("all");

  // ✅ Diagnostics
  const [diagnostics, setDiagnostics] = React.useState<ParserDiagnostic[]>([]);
  const [showDiagnostics, setShowDiagnostics] = React.useState(true);

  // Edit toggle per-card
  const [editingIds, setEditingIds] = React.useState<Set<string>>(() => new Set());

  // Persistence
  const [projectId, setProjectId] = React.useState<number | null>(null);

  // Local UI memory
  const [aiReviewedIds, setAiReviewedIds] = React.useState<Set<string>>(() => new Set());

  // Per-card spinner
  const [aiLoadingIds, setAiLoadingIds] = React.useState<Set<string>>(() => new Set());

  // Track which mode was last run per card
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
    setDiagnostics([]);
    setEditingIds(new Set());
    setProjectId(null);
    setAiReviewedIds(new Set());
    setAiLoadingIds(new Set());
    setAiLastModeById({});
    setBatch({ running: false, total: 0, done: 0, errors: 0, mode: null, apply: false });
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
      const { cards: parsedLocal, diagnostics: diags } = parseMarkdownWithDiagnostics(raw);
      setDiagnostics(diags);

      // Guest mode: local-only
      if (!user) {
        const localCards = parsedLocal.map((c) => ({ ...c, id: uid() }));
        setCards(localCards);
        setEditingIds(new Set());
        setProjectId(null);
        setAiReviewedIds(new Set());
        setAiLoadingIds(new Set());
        setAiLastModeById({});
        setBatch({ running: false, total: 0, done: 0, errors: 0, mode: null, apply: false });
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

      const cr = await apiFetch<{ cards: Array<{ id: number; card_type: CardType; front: string; back: string }> }>("/cards", {
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
      });

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
      setStatus(`Parsed & saved ${persisted.length} card${persisted.length === 1 ? "" : "s"} to Project #${pid}.`);
    } catch (e: any) {
      setStatus(e?.message ? `Parse failed: ${e.message}` : "Parse failed.");
    } finally {
      setBusy(false);
    }
  }

  function exportCSV() {
    const exportedCards = cards.map((c) =>
      c.card_type === "mcq" ? { ...c, front: formatMcqOptions(c.front, mcqStyle), back: formatMcqAnswer(c.back, mcqStyle) } : c
    );

    const rows = [["Front", "Back"], ...exportedCards.map((c) => [c.front, c.back])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (filename ? filename.replace(/\.md$/i, "") : "n2a") + ".csv";
    a.click();
    URL.revokeObjectURL(url);
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

    setAiReviewedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    setAiLastModeById((prev) => ({ ...prev, [id]: mode }));

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

      setStatus(apply ? `AI complete: applied ${mode} for ${saved.length} card(s).` : `AI complete: reviewed ${mode} for ${saved.length} card(s).`);
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

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8">
      {/* HEADER BAND */}
      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-100">
        <div className="max-w-6xl mx-auto text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Workflow: <span className="text-primary">Upload</span> → Parse → Review → Export
          </h1>
          <p className="opacity-75 max-w-2xl mx-auto">Parse locally, edit freely, export clean CSV for Anki. AI review is available on paid plans.</p>

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
                    <p className="text-sm opacity-70">Drop your Notion export. We’ll parse it into cards.</p>
                  </div>

                  <UploadBox
                    onFile={(t, n) => {
                      setRaw(t);
                      setFilename(n);

                      setCards([]);
                      setDiagnostics([]);
                      setEditingIds(new Set());
                      setStatus(null);
                      setProjectId(null);
                      setAiReviewedIds(new Set());
                      setAiLoadingIds(new Set());
                      setAiLastModeById({});
                      setBatch({ running: false, total: 0, done: 0, errors: 0, mode: null, apply: false });
                    }}
                  />

                  <div className="text-xs opacity-70">
                    File: <span className="font-semibold">{filename || "None"}</span>
                  </div>

                  <div className="rounded-xl border border-base-300 bg-base-200/40 p-3">
                    <div className="text-sm font-semibold">Need a template?</div>
                    <div className="text-xs opacity-70 mt-1">
                      Duplicate the Notion template to copy the exact formatting N2A expects (especially MCQ answers).
                    </div>

                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <a className="btn btn-sm btn-outline" href={NOTION_TEMPLATE_URL} target="_blank" rel="noopener noreferrer">
                        Duplicate the Notion template
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
                      <p className="text-sm opacity-70">
                        {user ? "Parse creates a Project and saves cards for persistent AI review." : "Parse locally, edit, export. Login to persist + AI review."}
                      </p>
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

                  {/* ✅ Parser diagnostics panel */}
                  {diagnostics.length > 0 && (
                    <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Parser diagnostics</div>
                          <div className="text-xs opacity-70">
                            Some blocks were detected but didn’t fully parse. Fix these in Notion/Markdown and re-Parse.
                          </div>
                        </div>

                        <button className="btn btn-xs btn-ghost" onClick={() => setShowDiagnostics((v) => !v)}>
                          {showDiagnostics ? "Hide" : "Show"}
                        </button>
                      </div>

                      {showDiagnostics && (
                        <div className="mt-3 space-y-2">
                          {diagnostics.map((d, idx) => (
                            <div key={idx} className="rounded-xl border border-base-300 bg-base-100/50 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold">
                                  Line {d.line}: <span className="opacity-80">{d.message}</span>
                                </div>
                                <span className="badge badge-sm badge-outline">{d.kind}</span>
                              </div>

                              {d.snippet ? <div className="text-xs opacity-70 mt-1 whitespace-pre-wrap">Snippet: {d.snippet}</div> : null}
                              {d.hint ? <div className="text-xs opacity-80 mt-2">Tip: {d.hint}</div> : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Controls row */}
                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4 space-y-2">
                      <div className="text-sm font-semibold">Filter</div>
                      <div className="text-xs opacity-70">Show all cards or a subset.</div>
                      <select className="select select-bordered w-full" value={filterMode} onChange={(e) => setFilterMode(e.target.value as FilterMode)}>
                        <option value="all">All</option>
                        <option value="qa">Q&A only</option>
                        <option value="mcq">MCQ only</option>
                      </select>
                    </div>

                    <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4 space-y-2">
                      <div className="text-sm font-semibold">MCQ option style</div>
                      <div className="text-xs opacity-70">Affects preview/export and what AI sees.</div>
                      <select className="select select-bordered w-full" value={mcqStyle} onChange={(e) => setMcqStyle(e.target.value as McqStyle)}>
                        <option value="1)">1)</option>
                        <option value="1.">1.</option>
                        <option value="A)">A)</option>
                        <option value="a)">a)</option>
                        <option value="A.">A.</option>
                        <option value="a.">a.</option>
                      </select>
                    </div>

                    <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4 space-y-2">
                      <div className="text-sm font-semibold">AI English (paid)</div>
                      <div className="text-xs opacity-70">Controls AI output style.</div>
                      <select
                        className="select select-bordered w-full"
                        value={englishVariant}
                        onChange={(e) => setEnglishVariant(e.target.value as EnglishVariant)}
                        disabled={!canAI}
                        title={!canAI ? "Requires a paid plan" : "Choose AI review English"}
                      >
                        <option value="uk_au">English (UK/AUS)</option>
                        <option value="us">English (US)</option>
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
                      Clear
                    </button>
                    <button className="btn btn-secondary w-full" disabled={!parsedCount || busy} onClick={exportCSV}>
                      Export CSV
                    </button>
                  </div>

                  {/* AI buttons */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button className="btn btn-ghost w-full" disabled={!parsedCount || busy || !canAI} onClick={() => void aiReviewAll(false, "content")}>
                        AI Review all (content)
                      </button>
                      <button className="btn btn-ghost w-full" disabled={!parsedCount || busy || !canAI} onClick={() => void aiReviewAll(false, "format")}>
                        AI Review all (format)
                      </button>
                      <button className="btn btn-ghost w-full" disabled={!parsedCount || busy || !canAI} onClick={() => void aiReviewAll(false, "both")}>
                        AI Review all (both)
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button className="btn btn-outline w-full" disabled={!parsedCount || busy || !canAI} onClick={() => void aiReviewAll(true, "content")}>
                        Apply AI all (content)
                      </button>
                      <button className="btn btn-outline w-full" disabled={!parsedCount || busy || !canAI} onClick={() => void aiReviewAll(true, "format")}>
                        Apply AI all (format)
                      </button>
                      <button className="btn btn-outline w-full" disabled={!parsedCount || busy || !canAI} onClick={() => void aiReviewAll(true, "both")}>
                        Apply AI all (both)
                      </button>
                    </div>
                  </div>

                  <div className="flex-1" />
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
              <p className="opacity-70 text-sm">Preview is always shown. Click Edit to modify front/back. Delete removes the card from export.</p>
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
                const previewBack = c.card_type === "mcq" ? formatMcqAnswer(c.back, mcqStyle) : c.back;

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

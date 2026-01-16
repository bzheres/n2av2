// src/pages/Workflow.tsx
import React from "react";
import UploadBox from "../components/UploadBox";
import { meCached } from "../auth";
import { apiFetch } from "../api";

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
  const raw = (back || "").trim();
  if (!raw) return raw;

  const m = raw.match(/^(\s*(answer:\s*)?)\s*([A-Za-z]|\d+)[\)\.\:]?\s*(.*)$/i);
  if (!m) return raw;

  const token = m[3];
  const rest = (m[4] || "").trim();

  const isNum = /^\d+$/.test(token);
  const idx = isNum ? Math.max(parseInt(token, 10) - 1, 0) : token.toUpperCase().charCodeAt(0) - "A".charCodeAt(0);

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

  // Edit toggle per-card
  const [editingIds, setEditingIds] = React.useState<Set<string>>(() => new Set());

  // Persistence
  const [projectId, setProjectId] = React.useState<number | null>(null);

  // Local UI memory: mark cards "reviewed" even if backend returns null AI fields
  const [aiReviewedIds, setAiReviewedIds] = React.useState<Set<string>>(() => new Set());

  // Per-card spinner (single-card AI only)
  const [aiLoadingIds, setAiLoadingIds] = React.useState<Set<string>>(() => new Set());

  // Batch progress (AI review ALL only)
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
    setEditingIds(new Set());
    setProjectId(null);
    setAiReviewedIds(new Set());
    setAiLoadingIds(new Set());
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

    // mark reviewed for UI
    setAiReviewedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

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
                  ? "AI suggested formatting improvements (see suggested front/back)."
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

  // ✅ Full-page overlay ONLY for AI Review ALL
  if (batch.running) {
    return (
      <div className="fixed inset-0 z-[1000] bg-base-100/90 backdrop-blur flex items-center justify-center px-6">
        <div className="max-w-lg w-full space-y-6 text-center">
          <div className="flex justify-center">
            <span className="loading loading-spinner loading-lg" />
          </div>

          <div className="space-y-1">
            <div className="text-lg font-semibold">
              {batch.apply ? "Applying AI to all cards…" : "Reviewing all cards…"}
            </div>
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
          {/* Make the two columns equal height */}
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
                      setEditingIds(new Set());
                      setStatus(null);
                      setProjectId(null);
                      setAiReviewedIds(new Set());
                      setAiLoadingIds(new Set());
                      setBatch({ running: false, total: 0, done: 0, errors: 0, mode: null, apply: false });
                    }}
                  />

                  <div className="text-xs opacity-70">
                    File: <span className="font-semibold">{filename || "None"}</span>
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

                  {/* Primary buttons: symmetrical 3-wide */}
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

                  {/* AI buttons: symmetrical 3-wide x 2 rows */}
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
                const feedback = (c.ai_feedback ?? "").trim();
                const flag = c.ai_flag ?? null;

                return (
                  <div
                    key={c.id}
                    className="card bg-base-200/40 border border-base-300 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:bg-base-200"
                  >
                    <div className="card-body space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="badge badge-outline">{c.card_type.toUpperCase()}</div>

                        <div className="flex gap-2 flex-wrap justify-end items-center">
                          {isAiLoading && <span className="loading loading-spinner loading-xs opacity-80" />}

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
                            disabled={busy || !canAI || !isPersisted || isAiLoading}
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
                              <span className={["badge badge-sm", changed ? "badge-warning" : "badge-success"].join(" ")}>
                                {changed ? "Changes suggested" : "Reviewed"}
                              </span>
                              {flag ? <span className="badge badge-sm badge-outline">{flag}</span> : null}
                            </div>
                          </div>

                          <div className="text-sm whitespace-pre-wrap opacity-80">
                            {feedback
                              ? feedback
                              : wasReviewedThisSession
                              ? "AI ran successfully, but returned no feedback for this card."
                              : "AI fields are empty for this card (no stored feedback)."}
                          </div>

                          {changed && (c.ai_suggest_front || c.ai_suggest_back) && (
                            <details className="collapse collapse-arrow border border-base-300 bg-base-200/40 rounded-xl">
                              <summary className="collapse-title text-sm font-semibold">View suggested front/back</summary>
                              <div className="collapse-content space-y-2">
                                <div className="text-xs font-semibold opacity-70">Suggested front</div>
                                <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-base-100/40 border border-base-300 rounded-xl p-3">
                                  {c.ai_suggest_front ?? ""}
                                </pre>
                                <div className="text-xs font-semibold opacity-70">Suggested back</div>
                                <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-base-100/40 border border-base-300 rounded-xl p-3">
                                  {c.ai_suggest_back ?? ""}
                                </pre>
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

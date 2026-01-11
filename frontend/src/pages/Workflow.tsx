import React from "react";
import UploadBox from "../components/UploadBox";
import { me } from "../auth";
import { apiFetch } from "../api";

type CardType = "qa" | "mcq";
type EnglishVariant = "us" | "uk_au";
type McqStyle = "1)" | "1." | "A)" | "a)" | "A." | "a.";
type FilterMode = "all" | "qa" | "mcq";

type Card = { id: string; card_type: CardType; front: string; back: string };

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
    // If the option line already starts with a label like "A) ..." or "1. ...", strip it
    const cleaned = o.replace(/^\s*([A-Za-z]|\d+)[\)\.]\s+/, "").trim();
    return `${labelFor(i)} ${cleaned}`;
  });

  return [stem, ...rebuilt].join("\n");
}

function formatMcqAnswer(back: string, style: McqStyle): string {
  // Try to normalize to a single answer label; keep any extra explanation if present.
  // Examples input: "B", "B)", "2", "2)", "Answer: B", "B - because ...", "B) Because ..."
  const raw = (back || "").trim();
  if (!raw) return raw;

  // Capture leading token that looks like letter/number
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

  React.useEffect(() => {
    me().then((r) => setUser(r.user)).catch(() => setUser(null));
  }, []);

  const parsedCount = cards.length;

  // Plan gating (keep same loose gating as before)
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
  }

  function doParse() {
    setStatus(null);
    const parsed = parseMarkdown(raw).map((c) => ({ ...c, id: uid() }));
    setCards(parsed);
    setEditingIds(new Set());
    setStatus(`Parsed ${parsed.length} card${parsed.length === 1 ? "" : "s"}.`);
  }

  function updateCard(id: string, patch: Partial<Pick<Card, "front" | "back">>) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function deleteCard(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggleEdit(id: string) {
    setEditingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCSV() {
    // Apply MCQ formatting style at export-time (front + back)
    const exportedCards = cards.map((c) =>
      c.card_type === "mcq"
        ? { ...c, front: formatMcqOptions(c.front, mcqStyle), back: formatMcqAnswer(c.back, mcqStyle) }
        : c
    );

    const rows = [["Front", "Back"], ...exportedCards.map((c) => [c.front, c.back])];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (filename ? filename.replace(/\.md$/i, "") : "n2a") + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- AI Review ----
  async function aiReviewCard(id: string) {
    if (!canAI) {
      setStatus("AI Review is available on paid plans. Please subscribe in Account.");
      return;
    }

    const card = cards.find((c) => c.id === id);
    if (!card) return;

    setBusy(true);
    setStatus("Running AI review…");
    try {
      const payload = {
        card_type: card.card_type,
        front: card.card_type === "mcq" ? formatMcqOptions(card.front, mcqStyle) : card.front,
        back: card.card_type === "mcq" ? formatMcqAnswer(card.back, mcqStyle) : card.back,
        english_variant: englishVariant,
      };

      let res: any = null;
      try {
        res = await apiFetch("/ai/review", { method: "POST", body: JSON.stringify(payload) });
      } catch {
        res = await apiFetch("/ai/review-card", { method: "POST", body: JSON.stringify(payload) });
      }

      if (res?.front || res?.back) {
        updateCard(id, {
          front: res.front ?? card.front,
          back: res.back ?? card.back,
        });
      }

      setStatus(res?.notes ? `AI Review: ${res.notes}` : "AI Review complete.");
    } catch (e: any) {
      setStatus(
        e?.message
          ? `AI Review failed: ${e.message}`
          : "AI Review failed. Backend route may not be enabled yet."
      );
    } finally {
      setBusy(false);
    }
  }

  async function aiReviewAll() {
    if (!canAI) {
      setStatus("AI Review is available on paid plans. Please subscribe in Account.");
      return;
    }
    if (!cards.length) return;

    setBusy(true);
    setStatus("Running AI review on all cards…");
    try {
      for (const c of cards) {
        // eslint-disable-next-line no-await-in-loop
        await aiReviewCard(c.id);
      }
      setStatus("AI Review completed for all cards.");
    } catch (e: any) {
      setStatus(e?.message ? `AI Review failed: ${e.message}` : "AI Review failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8">
      {/* HEADER BAND */}
      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-100">
        <div className="max-w-6xl mx-auto text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Workflow: <span className="text-primary">Upload</span> → Parse → Review → Export
          </h1>
          <p className="opacity-75 max-w-2xl mx-auto">
            Parse locally, edit freely, export clean CSV for Anki. AI review is available on paid plans.
          </p>

          <div className="flex justify-center pt-2">
            <div className={["badge badge-lg", user ? "badge-primary badge-outline" : "badge-ghost"].join(" ")}>
              {user ? `Logged in (${user.plan})` : "Guest mode"}
            </div>
          </div>
        </div>
      </section>

      {/* UPLOAD + PARSE BAND */}
      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-200">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[420px_1fr] gap-6 items-start">
          {/* 1) Upload */}
          <div className="card bg-base-100 border border-base-300 rounded-2xl">
            <div className="card-body space-y-4">
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
            </div>
          </div>

          {/* 2) Parse & Review */}
          <div className="card bg-base-100 border border-base-300 rounded-2xl">
            <div className="card-body space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold">2) Parse & Review</h2>
                  <p className="text-sm opacity-70">Parse your file, tune formatting, then edit cards below.</p>
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

                <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4 space-y-2">
                  <div className="text-sm font-semibold">MCQ option style</div>
                  <div className="text-xs opacity-70">Affects preview/export/AI input (not parsing).</div>
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

                <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4 space-y-2">
                  <div className="text-sm font-semibold">AI English (paid)</div>
                  <div className="text-xs opacity-70">Paid users can pick the AI review variant.</div>
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

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button className="btn btn-primary" disabled={!raw || busy} onClick={doParse}>
                  Parse
                </button>
                <button className="btn btn-outline" disabled={busy} onClick={clearAll}>
                  Clear
                </button>
                <button className="btn btn-secondary" disabled={!parsedCount || busy} onClick={exportCSV}>
                  Export CSV
                </button>
                <button className="btn btn-ghost" disabled={!parsedCount || busy || !canAI} onClick={aiReviewAll}>
                  AI Review all
                </button>
              </div>

              <div className="text-sm opacity-75">
                Tips:
                <ul className="list-disc ml-5 mt-1">
                  <li>Use Filter to quickly scan MCQs or Q&As.</li>
                  <li>MCQ style updates preview/export and what the AI sees.</li>
                  <li>Edits only show when you click “Edit” per card.</li>
                </ul>
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
                Preview is always shown. Click Edit to modify front/back. Delete removes the card from export.
              </p>
            </div>
          </div>

          {!filteredCards.length ? (
            <div className="card bg-base-200/40 border border-base-300 rounded-2xl">
              <div className="card-body text-center space-y-2">
                <div className="text-lg font-semibold">No cards to show</div>
                <div className="text-sm opacity-70">
                  {cards.length ? "Try changing the Filter." : "Upload a Markdown export, then press Parse."}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCards.map((c) => {
                const isEditing = editingIds.has(c.id);

                const previewFront = c.card_type === "mcq" ? formatMcqOptions(c.front, mcqStyle) : c.front;
                const previewBack = c.card_type === "mcq" ? formatMcqAnswer(c.back, mcqStyle) : c.back;

                return (
                  <div
                    key={c.id}
                    className="card bg-base-200/40 border border-base-300 rounded-2xl
                               transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:bg-base-200"
                  >
                    <div className="card-body space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="badge badge-outline">{c.card_type.toUpperCase()}</div>

                        <div className="flex gap-2">
                          <button
                            className="btn btn-xs btn-ghost"
                            disabled={busy || !canAI}
                            onClick={() => aiReviewCard(c.id)}
                            title={canAI ? "AI Review this card" : "AI Review requires a paid plan"}
                          >
                            AI Review
                          </button>

                          <button
                            className="btn btn-xs btn-ghost"
                            disabled={busy}
                            onClick={() => toggleEdit(c.id)}
                            title="Toggle edit"
                          >
                            {isEditing ? "Close" : "Edit"}
                          </button>

                          <button
                            className="btn btn-xs btn-ghost"
                            disabled={busy}
                            onClick={() => deleteCard(c.id)}
                            title="Delete card"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Preview always visible */}
                      <div className="text-xs font-semibold opacity-70">Front (preview)</div>
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-base-100/40 border border-base-300 rounded-xl p-3">
                        {previewFront}
                      </pre>

                      <div className="text-xs font-semibold opacity-70">Back (preview)</div>
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-base-100/40 border border-base-300 rounded-xl p-3">
                        {previewBack}
                      </pre>

                      {/* Edit panel toggled */}
                      {isEditing && (
                        <div className="rounded-2xl border border-base-300 bg-base-100/50 p-3 space-y-3">
                          <div className="text-xs font-semibold opacity-70">Front (edit)</div>
                          <textarea
                            className="textarea textarea-bordered w-full min-h-[96px] text-sm leading-relaxed"
                            value={c.front}
                            onChange={(e) => updateCard(c.id, { front: e.target.value })}
                          />

                          <div className="text-xs font-semibold opacity-70">Back (edit)</div>
                          <textarea
                            className="textarea textarea-bordered w-full min-h-[96px] text-sm leading-relaxed"
                            value={c.back}
                            onChange={(e) => updateCard(c.id, { back: e.target.value })}
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

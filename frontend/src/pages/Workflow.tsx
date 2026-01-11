import React from "react";
import UploadBox from "../components/UploadBox";
import { me } from "../auth";
import { apiFetch } from "../api";

type CardType = "qa" | "mcq";
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

export default function Workflow() {
  const [user, setUser] = React.useState<any>(null);

  const [raw, setRaw] = React.useState("");
  const [filename, setFilename] = React.useState("");
  const [cards, setCards] = React.useState<Card[]>([]);

  const [status, setStatus] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    me().then((r) => setUser(r.user)).catch(() => setUser(null));
  }, []);

  const parsedCount = cards.length;

  function clearAll() {
    setRaw("");
    setFilename("");
    setCards([]);
    setStatus(null);
  }

  function doParse() {
    setStatus(null);
    const parsed = parseMarkdown(raw).map((c) => ({ ...c, id: uid() }));
    setCards(parsed);
    setStatus(`Parsed ${parsed.length} card${parsed.length === 1 ? "" : "s"}.`);
  }

  function updateCard(id: string, patch: Partial<Pick<Card, "front" | "back">>) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function deleteCard(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }

  function exportCSV() {
    const rows = [["Front", "Back"], ...cards.map((c) => [c.front, c.back])];
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

  // ---- AI Review (safe placeholder, won’t break your app) ----
  const canAI = !!user && user.plan && user.plan !== "free" && user.plan !== "guest";

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
      // Try common endpoints; adjust later once you confirm your backend route.
      // Expected response shape: { front?: string, back?: string, notes?: string }
      let res: any = null;
      try {
        res = await apiFetch("/ai/review", {
          method: "POST",
          body: JSON.stringify({ card_type: card.card_type, front: card.front, back: card.back }),
        });
      } catch {
        res = await apiFetch("/ai/review-card", {
          method: "POST",
          body: JSON.stringify({ card_type: card.card_type, front: card.front, back: card.back }),
        });
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
      // Sequential to avoid rate-limits while you’re early-stage.
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

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <button className="btn btn-primary" disabled={!raw || busy} onClick={doParse}>
              Parse
            </button>
            <button className="btn btn-outline" disabled={busy} onClick={clearAll}>
              Clear
            </button>
            <button className="btn btn-secondary" disabled={!parsedCount || busy} onClick={exportCSV}>
              Export CSV
            </button>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-1">
            <button className="btn btn-ghost" disabled={!parsedCount || busy || !canAI} onClick={aiReviewAll}>
              AI Review all
            </button>
          </div>

          <div className="flex justify-center pt-1">
            <div
              className={[
                "badge badge-lg",
                user ? "badge-primary badge-outline" : "badge-ghost",
              ].join(" ")}
            >
              {user ? `Logged in (${user.plan})` : "Guest mode"}
            </div>
          </div>
        </div>
      </section>

      {/* UPLOAD BAND */}
      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-200">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[420px_1fr] gap-6 items-start">
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
                  <span>
                    Guest mode works for parse/edit/export. Login to subscribe + AI.
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 rounded-2xl">
            <div className="card-body space-y-3">
              <h2 className="text-xl font-bold">2) Parse & Review</h2>

              <div className="grid sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4 text-center">
                  <div className="text-sm opacity-70">Cards</div>
                  <div className="text-2xl font-extrabold text-primary">{parsedCount}</div>
                </div>
                <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4 text-center">
                  <div className="text-sm opacity-70">Mode</div>
                  <div className="text-2xl font-extrabold">{user ? "User" : "Guest"}</div>
                </div>
                <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4 text-center">
                  <div className="text-sm opacity-70">AI Review</div>
                  <div className="text-2xl font-extrabold">{canAI ? "On" : "Off"}</div>
                </div>
              </div>

              <div className="text-sm opacity-75">
                Tips:
                <ul className="list-disc ml-5 mt-1">
                  <li>Edit cards before exporting to avoid messy Anki imports.</li>
                  <li>MCQs are stored as “stem + options” in the Front, and answer in the Back.</li>
                  <li>If parsing looks wrong: fix formatting in Notion and re-export.</li>
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
                Click into fields to edit. Delete anything you don’t want exported.
              </p>
            </div>
          </div>

          {!cards.length ? (
            <div className="card bg-base-200/40 border border-base-300 rounded-2xl">
              <div className="card-body text-center space-y-2">
                <div className="text-lg font-semibold">No cards yet</div>
                <div className="text-sm opacity-70">
                  Upload a Markdown export, then press <span className="font-semibold">Parse</span>.
                </div>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map((c) => (
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
                          onClick={() => deleteCard(c.id)}
                          title="Delete card"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="text-xs font-semibold opacity-70">Front</div>
                    <textarea
                      className="textarea textarea-bordered w-full min-h-[96px] text-sm leading-relaxed"
                      value={c.front}
                      onChange={(e) => updateCard(c.id, { front: e.target.value })}
                    />

                    <div className="text-xs font-semibold opacity-70">Back</div>
                    <textarea
                      className="textarea textarea-bordered w-full min-h-[96px] text-sm leading-relaxed"
                      value={c.back}
                      onChange={(e) => updateCard(c.id, { back: e.target.value })}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

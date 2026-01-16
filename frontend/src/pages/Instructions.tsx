import React from "react";
import { Link } from "react-router-dom";

type MediaType = "image" | "video";

type Step = {
  title: string;
  subtitle?: string;
  bullets: string[];
  mediaType: MediaType;

  // Fallback text if you haven't added media yet
  mediaHint: string;

  // ✅ Add these so you can link real media later
  mediaSrc?: string; // e.g. "/media/workflow-upload.png" or "https://..."
  mediaAlt?: string; // for images
  mediaPoster?: string; // for videos (optional)

  cta?: { label: string; to: string };
};

const STEPS: Step[] = [
  {
    title: "1) Quick tour: what N2A does",
    subtitle: "From Notion → cards → Anki, with a simple Workflow-first design.",
    bullets: [
      "Home: quick overview + examples",
      "Instructions: this guided walkthrough (with placeholders for your screenshots/videos)",
      "Workflow: upload → parse → preview/edit → export (and AI review for paid users)",
      "Account: login/signup + plan status (free vs paid) + manage subscription (paid)",
    ],
    mediaType: "video",
    mediaHint: "Placeholder: 20–40s tour clip: Home → Instructions → Workflow → Account",
    // mediaSrc: "/media/tour.mp4",
    // mediaPoster: "/media/tour-poster.jpg",
    cta: { label: "Open Workflow", to: "/workflow" },
  },
  {
    title: "2) Account & plans (Free vs Paid)",
    subtitle: "Free tier covers the entire core flow. Paid adds AI review features.",
    bullets: [
      "Free / Guest: upload, parse, preview, edit, delete, export CSV",
      "Logged-in Free: same as above, but projects/cards can be saved (depending on your backend rules)",
      "Paid plans: unlock AI Review (content / format / both) + Apply AI",
      "Workflow will show your current status (Guest vs Logged in + plan badge)",
    ],
    mediaType: "image",
    mediaHint: "Placeholder: screenshot of Account page showing free vs paid state (plan badge + actions)",
    // mediaSrc: "/media/account-plans.png",
    // mediaAlt: "Account page showing plan badge and actions",
    cta: { label: "Go to Account", to: "/account" },
  },
  {
    title: "3) Format your Notion page so N2A can parse it",
    subtitle: "Use explicit card labels. One card per block.",
    bullets: [
      "Q&A card must start with:  Question: <your question>",
      "Answer lines should be indented OR bullet points (e.g. 4 spaces, a tab, '-', '*')",
      "MCQ card must start with:  MCQ: <your stem>",
      "MCQ options should be indented or bulleted (one option per line)",
      "MCQ answer must be:  Answer:  then the selected option on the next indented line (e.g. '    B) ...' or '    2) ...')",
      "Avoid mixing multiple prompts in the same card block",
    ],
    mediaType: "image",
    mediaHint: "Placeholder: screenshot of a Notion page showing correct Q&A + MCQ blocks",
    // mediaSrc: "/media/notion-formatting.png",
    // mediaAlt: "Notion page showing correct Question/MCQ blocks",
  },
  {
    title: "4) Export from Notion + upload into Workflow",
    subtitle: "Export Markdown from Notion, then upload the .md file into Workflow.",
    bullets: [
      "In Notion: Share → Export → Markdown & CSV",
      "Include sub-pages if needed (optional), but start with one page for testing",
      "Don’t rename the exported file before uploading (keeps tracking simple)",
      "In Workflow: drag & drop the exported .md file into the upload box",
      "Confirm filename shows and Parse becomes available",
    ],
    mediaType: "video",
    mediaHint: "Placeholder: screen recording: Notion export settings → drag/drop into Workflow",
    // mediaSrc: "/media/notion-export-to-upload.mp4",
    // mediaPoster: "/media/notion-export-to-upload-poster.jpg",
    cta: { label: "Open Workflow", to: "/workflow" },
  },
  {
    title: "5) Parse: generate your card previews",
    subtitle: "Parsing turns your Markdown blocks into Q&A and MCQ cards.",
    bullets: [
      "Click Parse to generate cards (and save to a Project if logged in)",
      "Check Total vs Shown counts (use Filter: All / Q&A / MCQ)",
      "If card counts look wrong: fix labels/indentation in Notion and export again",
      "You can iterate quickly: export → upload → parse",
    ],
    mediaType: "image",
    mediaHint: "Placeholder: screenshot of Workflow after Parse (counts + project badge)",
    // mediaSrc: "/media/workflow-after-parse.png",
    // mediaAlt: "Workflow page showing counts and project badge after parsing",
  },
  {
    title: "6) Review your cards: preview + edit + delete",
    subtitle: "Clean up before export so your Anki import is smooth.",
    bullets: [
      "Each card shows Front (preview) and Back (preview)",
      "Use Edit to change the raw front/back text",
      "Edits to persisted cards (saved projects) should update the backend (if enabled)",
      "Use Delete to remove a card from export (and from the project if persisted)",
      "Spot-check a few cards for empty answers, broken MCQ options, or weird line breaks",
    ],
    mediaType: "video",
    mediaHint: "Placeholder: clip showing: open cards → Edit → Close → Delete",
    // mediaSrc: "/media/workflow-edit-delete.mp4",
    // mediaPoster: "/media/workflow-edit-delete-poster.jpg",
  },
  {
    title: "7) Export CSV (for Anki import)",
    subtitle: "Export from Workflow, then import into Anki as Front/Back fields.",
    bullets: [
      "Click Export CSV to download a .csv file",
      "In Anki: File → Import → select your CSV",
      "Map fields: Front → Front, Back → Back",
      "Do a small import first (test deck) before importing a huge set",
    ],
    mediaType: "image",
    mediaHint: "Placeholder: screenshot of Anki import mapping screen (Front/Back fields)",
    // mediaSrc: "/media/anki-import-mapping.png",
    // mediaAlt: "Anki import mapping screen showing Front and Back fields",
  },
  {
    title: "8) AI Review (Paid): overview",
    subtitle: "Paid users can ask AI to review content, formatting, or both.",
    bullets: [
      "AI Review (content): checks clarity + language variant (US vs UK/AUS) and suggests small improvements",
      "AI Review (format): improves readability only (structure, spacing, bullets) without changing meaning",
      "AI Review (both): includes BOTH content review + formatting suggestions when applicable",
      "AI Review does not create new facts — it should not add new information to your cards",
    ],
    mediaType: "image",
    mediaHint: "Placeholder: screenshot of Workflow AI buttons (Review all / Format all / Both + Apply)",
    // mediaSrc: "/media/workflow-ai-buttons.png",
    // mediaAlt: "Workflow AI buttons for reviewing and applying AI changes",
  },
  {
    title: "9) AI Review results: how to read them",
    subtitle: "See the AI panel on each card, and open the suggested diff view.",
    bullets: [
      "After an AI review, each card shows an AI result panel (Reviewed / Changes suggested)",
      "Open “View suggested front/back” to see suggested edits",
      "Line-by-line highlighting is used for content-level changes (obvious value)",
      "For small formatting-only tweaks, the feedback should summarise changes clearly (so it doesn’t feel like “nothing happened”)",
      "If a card is flagged incorrect, it should be clearly marked and the original text should remain unchanged",
    ],
    mediaType: "video",
    mediaHint: "Placeholder: clip: run AI → open AI result panel → expand suggested front/back → see highlights",
    // mediaSrc: "/media/ai-results-diff.mp4",
    // mediaPoster: "/media/ai-results-diff-poster.jpg",
  },
  {
    title: "10) Apply AI (Paid): write suggestions onto the cards",
    subtitle: "Apply updates the saved card text (persisted cards only).",
    bullets: [
      "Apply AI runs the AI and, if changes are suggested, writes the suggested front/back onto the card",
      "Apply works on saved/persisted cards (project cards with numeric IDs)",
      "If a card is flagged as incorrect, Apply should NOT overwrite content",
      "Use Apply All (content/format/both) to process your entire project in one go",
    ],
    mediaType: "image",
    mediaHint: "Placeholder: screenshot of a card after Apply (front/back updated + AI panel visible)",
    // mediaSrc: "/media/card-after-apply.png",
    // mediaAlt: "Card preview showing updated content after Apply AI",
  },
  {
    title: "11) Recommended workflow for best results",
    subtitle: "A simple repeatable loop that scales to large Notion pages.",
    bullets: [
      "Start small: one page → parse → fix formatting → re-export until counts look perfect",
      "Then scale up: larger pages or multiple exports",
      "Before exporting to Anki: do a final preview scan and fix obvious issues",
      "Paid users: run AI Review (content), then AI Review (format), then AI Review (both) if needed",
      "Export CSV → import into a test Anki deck → then import into your main deck",
    ],
    mediaType: "video",
    mediaHint: "Placeholder: optional “best practices” walkthrough video (60–120s)",
    // mediaSrc: "/media/best-practices.mp4",
    // mediaPoster: "/media/best-practices-poster.jpg",
    cta: { label: "Back to Workflow", to: "/workflow" },
  },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function Instructions() {
  const [idx, setIdx] = React.useState(0);
  const total = STEPS.length;
  const step = STEPS[idx];

  const progress = Math.round(((idx + 1) / total) * 100);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIdx((v) => clamp(v - 1, 0, total - 1));
      if (e.key === "ArrowRight") setIdx((v) => clamp(v + 1, 0, total - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8">
      {/* HEADER BAND */}
      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-100">
        <div className="max-w-6xl mx-auto text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Instructions that <span className="text-primary">actually</span> get you to Anki
          </h1>
          <p className="opacity-75 max-w-2xl mx-auto">
            Follow the steps. Each one has a media placeholder so you can drop in your own screenshots and screen recordings later.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <Link to="/workflow" className="btn btn-primary">
              Open Workflow
            </Link>
            <Link to="/account" className="btn btn-outline">
              Account
            </Link>
            <Link to="/" className="btn btn-ghost">
              Home
            </Link>
          </div>
        </div>
      </section>

      {/* CONTENT BAND */}
      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-200">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[360px_1fr] gap-6">
          {/* LEFT: Tracker / index */}
          <aside className="card bg-base-100 border border-base-300 rounded-2xl h-fit">
            <div className="card-body space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Progress</div>
                <div className="text-sm opacity-70">
                  Step <span className="text-primary font-semibold">{idx + 1}</span> / {total}
                </div>
              </div>

              <progress className="progress progress-primary w-full" value={progress} max={100} />
              <div className="text-xs opacity-70">{progress}% complete</div>

              <div className="divider my-2">Steps</div>

              <div className="space-y-2">
                {STEPS.map((s, i) => {
                  const active = i === idx;
                  return (
                    <button
                      key={s.title}
                      onClick={() => setIdx(i)}
                      className={[
                        "w-full text-left rounded-xl border px-3 py-2 transition-all",
                        active
                          ? "bg-base-200 border-primary/50 shadow-md shadow-primary/10"
                          : "bg-base-100 border-base-300 hover:border-primary/30 hover:bg-base-200/40",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-2">
                        <div className={["badge", active ? "badge-primary" : "badge-ghost"].join(" ")}>{i + 1}</div>
                        <div className="flex-1">
                          <div className="font-semibold leading-snug">{s.title.replace(/^\d+\)\s*/, "")}</div>
                          {s.subtitle && <div className="text-xs opacity-70 mt-0.5 line-clamp-2">{s.subtitle}</div>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="divider my-2" />

              <div className="flex gap-2">
                <button
                  className="btn btn-outline flex-1"
                  onClick={() => setIdx((v) => clamp(v - 1, 0, total - 1))}
                  disabled={idx === 0}
                >
                  ← Prev
                </button>
                <button
                  className="btn btn-primary flex-1"
                  onClick={() => setIdx((v) => clamp(v + 1, 0, total - 1))}
                  disabled={idx === total - 1}
                >
                  Next →
                </button>
              </div>

              <div className="text-xs opacity-60">
                Tip: use <span className="font-semibold">←</span> and <span className="font-semibold">→</span> keys.
              </div>
            </div>
          </aside>

          {/* RIGHT: Step content */}
          <main className="card bg-base-100 border border-base-300 rounded-2xl">
            <div className="card-body space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="badge badge-primary badge-outline mb-2">Step {idx + 1}</div>
                  <h2 className="text-2xl md:text-3xl font-bold">{step.title}</h2>
                  {step.subtitle && <p className="opacity-75 mt-2">{step.subtitle}</p>}
                </div>

                <div className="hidden md:flex gap-2">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => setIdx((v) => clamp(v - 1, 0, total - 1))}
                    disabled={idx === 0}
                  >
                    Prev
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => setIdx((v) => clamp(v + 1, 0, total - 1))}
                    disabled={idx === total - 1}
                  >
                    Next
                  </button>
                </div>
              </div>

              {/* Media block (shows real media if mediaSrc exists, otherwise placeholder) */}
              <div className="rounded-2xl border border-base-300 bg-base-200/40 overflow-hidden">
                <div className="p-4 md:p-5 flex items-center justify-between gap-3">
                  <div className="font-semibold">{step.mediaType === "video" ? "Video" : "Image"}</div>
                  <div className="badge badge-ghost">{step.mediaType.toUpperCase()}</div>
                </div>

                <div className="px-4 md:px-5 pb-5">
                  <div className="aspect-video rounded-xl bg-base-100 border border-base-300 overflow-hidden flex items-center justify-center">
                    {step.mediaSrc ? (
                      step.mediaType === "image" ? (
                        <img
                          src={step.mediaSrc}
                          alt={step.mediaAlt || step.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <video
                          src={step.mediaSrc}
                          poster={step.mediaPoster}
                          controls
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      )
                    ) : (
                      <div className="text-center space-y-2 px-6">
                        <div className="text-sm opacity-70">{step.mediaHint}</div>
                        <div className="text-xs opacity-50">
                          Add <span className="font-semibold">mediaSrc</span> to this step to show your image/video here (e.g.{" "}
                          <span className="font-semibold">/media/your-file.png</span>).
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bullets */}
              <div className="space-y-2">
                {step.bullets.map((b) => (
                  <div key={b} className="flex gap-3 items-start rounded-xl border border-base-300 bg-base-200/30 p-3">
                    <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <div className="opacity-85">{b}</div>
                  </div>
                ))}
              </div>

              {/* CTA row */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  className="btn btn-outline"
                  onClick={() => setIdx((v) => clamp(v - 1, 0, total - 1))}
                  disabled={idx === 0}
                >
                  ← Previous step
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() => setIdx((v) => clamp(v + 1, 0, total - 1))}
                  disabled={idx === total - 1}
                >
                  Next step →
                </button>

                {step.cta && (
                  <Link to={step.cta.to} className="btn">
                    {step.cta.label}
                  </Link>
                )}
              </div>
            </div>
          </main>
        </div>
      </section>

      {/* FOOTER BAND */}
      <section className="px-4 md:px-6 lg:px-8 py-10 bg-base-100">
        <div className="max-w-6xl mx-auto text-center space-y-3">
          <h3 className="text-xl md:text-2xl font-bold">
            Ready? Start in <span className="text-primary">Workflow</span>.
          </h3>
          <p className="opacity-75">Notion export → Upload → Parse → Review → Export → Anki.</p>
          <div className="flex justify-center gap-3 flex-col sm:flex-row pt-2">
            <Link to="/workflow" className="btn btn-primary">
              Open Workflow
            </Link>
            <Link to="/account" className="btn btn-outline">
              Account / Plans
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// src/pages/Instructions.tsx
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

  // Real media (served from /public via absolute paths like "/videos/...")
  mediaSrc?: string;
  mediaAlt?: string; // for images
  mediaPoster?: string; // for videos (optional)

  cta?: { label: string; to: string };
};

const STEPS: Step[] = [
  {
    title: "1) Quick tour: what N2A does",
    subtitle: "From Notion → cards → Anki",
    bullets: [
      "Home: Introduction to N2A",
      "Instructions: Comprehensive overview of N2A",
      "Workflow: This is where you upload you Notion file, generate cards, preview and edit cards, and export your CSV file",
      "Account: Manage your account - upgrade subscription, monitor usage",
    ],
    mediaType: "video",
    mediaHint: "Placeholder: 20–40s tour clip: Home → Instructions → Workflow → Account",
    // ✅ Use /public-relative URL (NOT the Windows filesystem path)
    mediaSrc: "/videos/n2a_step1_video.mp4",
    // mediaPoster: "/images/step1_poster.jpg",
    cta: { label: "Open Workflow", to: "/workflow" },
  },
  {
    title: "2) Account & plans",
    subtitle: "Free tier covers the entire core flow! Optionally, can upgrade to integrate AI review of your cards",
    bullets: [
      "Guests can utilise ALL the key features without an account",
      "Free Users with an account can utilise ALL the key features + cards can be saved for when you log back in",
      "Paid plans: Users can choose to upgrade to a paid plan. This unlocks the option to have your cards AI reviewed to ensure content is correct and to improve formatting",
      "Importantly, the AI WILL NOT make up answers or change meaning to your cards",
      "From the Account page, you can track how many cards you have generated as well as track how many AI reviews you have left (if applicable)",
    ],
    mediaType: "image",
    mediaHint: "Placeholder: screenshot of Account page showing free vs paid state (plan badge + actions)",
    // mediaSrc: "/images/account-plans.png",
    // mediaAlt: "Account page showing plan badge and actions",
    cta: { label: "Go to Account", to: "/account" },
  },
  {
    title: "3) Format your Notion page so N2A can parse it",
    subtitle: "It is important to follow these simple instructions to ensure N2A works correctly",
    bullets: [
      "Currently, N2A only supports simple back and front cards",
      "To make a Notion note a Q&A card, the line must begin with 'Question:' with the question written after",
      "The Answer to the Question must be indented beneath the Question OR bulleted (i.e. 4 spaces, '-', '*')",
      "To mae a Notion note a MCQ card, the line must begin with 'MCQ:' with the question stem written after",
      "The MCQ options must be indented OR bulleted underneath the question stem, with one option per line",
      "The MCQ Answer must be written as 'Answer:' with the answer written after OR on the next indented line",
      "Avoid mixing multiple prompts in the same card block",
      "The video above shows real examples of how to structure your Notion notes",
    ],
    mediaType: "image",
    mediaHint: "Placeholder: screenshot of a Notion page showing correct Q&A + MCQ blocks",
    // mediaSrc: "/images/notion-formatting.png",
    // mediaAlt: "Notion page showing correct Question/MCQ blocks",
  },
  {
    title: "4) Export from Notion and then upload into Workflow",
    subtitle: "Export Markdown from Notion, then upload the .md file into Workflow.",
    bullets: [
      "In Notion: Share → Export → Markdown & CSV",
      "In N2A Workflow: Drag & drop the exported .md file into the upload box OR select the .md file",
      "Confirm filename shows and Parse becomes available",
    ],
    mediaType: "video",
    mediaHint: "Placeholder: screen recording: Notion export settings → drag/drop into Workflow",
    // mediaSrc: "/videos/notion-export-to-upload.mp4",
    // mediaPoster: "/images/notion-export-to-upload-poster.jpg",
    cta: { label: "Open Workflow", to: "/workflow" },
  },
  {
    title: "5) Parse: generate your card previews",
    subtitle: "Parsing turns your Markdown blocks into Q&A and MCQ cards",
    bullets: ["Click Parse to generate cards", "Check Total vs Shown counts", "You can use the Filter to show only Q&A cards, only MCQ cards, or both by selecting 'All'"],
    mediaType: "image",
    mediaHint: "Placeholder: screenshot of Workflow after Parse (counts + project badge)",
    // mediaSrc: "/images/workflow-after-parse.png",
    // mediaAlt: "Workflow page showing counts and project badge after parsing",
  },
  {
    title: "6) Review your cards: preview, edit, delete",
    subtitle: "Clean up before export so your Anki import is smooth",
    bullets: ["Each card shows a preview of how the Front and Back will look in Anki", "Use Edit to change the raw front and back text", "Use Delete to remove a card from export"],
    mediaType: "video",
    mediaHint: "Placeholder: clip showing: open cards → Edit → Close → Delete",
    // mediaSrc: "/videos/workflow-edit-delete.mp4",
    // mediaPoster: "/images/workflow-edit-delete-poster.jpg",
  },
  {
    title: "7) Export CSV after reviewing for Anki import",
    subtitle: "Export from Workflow, then import into Anki",
    bullets: ["Click Export CSV to download a .csv file", "In Anki: File → Import → select your CSV", "You are ready to begin studying!"],
    mediaType: "image",
    mediaHint: "Placeholder: screenshot of Anki import mapping screen (Front/Back fields)",
    // mediaSrc: "/images/anki-import-mapping.png",
    // mediaAlt: "Anki import mapping screen showing Front and Back fields",
  },
  {
    title: "8) AI Review: Overview",
    subtitle: "Paid users can ask AI to review content, formatting, or both",
    bullets: [
      "AI Content Review: Checks clarity, fixes spelling (US or Aus/UK), suggests small improvements, and flags cards that may be incorrect",
      "AI Format Review: Improves readability only without changing meaning (in md structure)",
      "AI Review Both: Includes BOTH content review and formatting suggestions",
      "AI Review does not create new facts and it should not add new information to your cards",
      "AI is NOT perfect. Any suggested changes should be double checked",
    ],
    mediaType: "image",
    mediaHint: "Placeholder: screenshot of Workflow AI buttons (Review all / Format all / Both + Apply)",
    // mediaSrc: "/images/workflow-ai-buttons.png",
    // mediaAlt: "Workflow AI buttons for reviewing and applying AI changes",
  },
  {
    title: "9) AI Review results: how to read them",
    subtitle: "See the AI panel on each card, and open the suggested diff view",
    bullets: [
      "After an AI review, each card shows an AI result panel (Reviewed / Changes suggested)",
      "Open “View suggested front/back” to see suggested edits",
      "Line-by-line highlighting is used for content-level changes",
      "Cards that have been flagged as incorrect will show 'This card appears incorrect'",
    ],
    mediaType: "video",
    mediaHint: "Placeholder: clip: run AI → open AI result panel → expand suggested front/back → see highlights",
    // mediaSrc: "/videos/ai-results-diff.mp4",
    // mediaPoster: "/images/ai-results-diff-poster.jpg",
  },
  {
    title: "10) Apply AI (Paid): write suggestions onto the cards",
    subtitle: "Apply updates the saved card text",
    bullets: [
      "Apply AI runs the AI and, if changes are suggested, implemets the suggested changes onto the card",
      "If a card is flagged as incorrect, Apply should NOT overwrite content",
      "Use Apply All to process your entire project in one go",
    ],
    mediaType: "image",
    mediaHint: "Placeholder: screenshot of a card after Apply (front/back updated + AI panel visible)",
    // mediaSrc: "/images/card-after-apply.png",
    // mediaAlt: "Card preview showing updated content after Apply AI",
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

  // Zoom modal state
  const [zoomOpen, setZoomOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (zoomOpen && e.key === "Escape") {
        setZoomOpen(false);
        return;
      }
      if (e.key === "ArrowLeft") setIdx((v) => clamp(v - 1, 0, total - 1));
      if (e.key === "ArrowRight") setIdx((v) => clamp(v + 1, 0, total - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total, zoomOpen]);

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8">
      {/* HEADER BAND */}
      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-100">
        <div className="max-w-6xl mx-auto text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Instructions: From <span className="text-primary">Notion</span> notes to <span className="text-primary">Anki</span> flashcards
          </h1>

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
                {step.mediaSrc ? (
                  <>
                    {" "}
                    • Tip: click the media to <span className="font-semibold">zoom</span>.
                  </>
                ) : null}
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

              {/* Media block: no "Image/Video tag", supports click-to-zoom */}
              <div className="rounded-2xl border border-base-300 bg-base-200/40 overflow-hidden">
                <div className="px-4 md:px-5 py-5">
                  <div
                    className={[
                      "aspect-video rounded-xl bg-base-100 border border-base-300 overflow-hidden",
                      step.mediaSrc ? "cursor-zoom-in" : "",
                    ].join(" ")}
                  >
                    {step.mediaSrc ? (
                      <button
                        type="button"
                        onClick={() => setZoomOpen(true)}
                        className="w-full h-full text-left"
                        aria-label="Open media in full screen"
                      >
                        {step.mediaType === "image" ? (
                          <img
                            src={step.mediaSrc}
                            alt={step.mediaAlt || step.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          // ✅ Videos should NOT autoplay. Keep controls available.
                          <video
                            src={step.mediaSrc}
                            poster={step.mediaPoster}
                            controls
                            preload="metadata"
                            playsInline
                            className="w-full h-full object-cover"
                            onClick={(e) => {
                              // Prevent clicking controls from opening zoom.
                              // Only the outer button opens zoom; this keeps native controls usable.
                              e.stopPropagation();
                            }}
                          />
                        )}

                        {/* subtle hint overlay */}
                        <div className="pointer-events-none absolute" />
                      </button>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center space-y-2 px-6">
                          <div className="text-sm opacity-70">{step.mediaHint}</div>
                          <div className="text-xs opacity-50">
                            Add <span className="font-semibold">mediaSrc</span> to this step to show your media here (e.g.{" "}
                            <span className="font-semibold">/videos/your-file.mp4</span> or <span className="font-semibold">/images/your-file.png</span>).
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {step.mediaSrc ? (
                    <div className="mt-2 text-xs opacity-60">
                      Click to zoom • Press <span className="font-semibold">Esc</span> to close
                    </div>
                  ) : null}
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
                <button className="btn btn-outline" onClick={() => setIdx((v) => clamp(v - 1, 0, total - 1))} disabled={idx === 0}>
                  ← Previous step
                </button>

                <button className="btn btn-primary" onClick={() => setIdx((v) => clamp(v + 1, 0, total - 1))} disabled={idx === total - 1}>
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

      {/* Zoom modal (image/video). No autoplay for videos. */}
      {zoomOpen && step.mediaSrc && (
        <div
          className="fixed inset-0 z-[1100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZoomOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <button
              className="btn btn-sm btn-ghost absolute -top-12 right-0"
              onClick={() => setZoomOpen(false)}
              aria-label="Close"
            >
              ✕ Close
            </button>

            <div className="rounded-2xl border border-base-300 bg-base-100 overflow-hidden">
              {step.mediaType === "image" ? (
                <img src={step.mediaSrc} alt={step.mediaAlt || step.title} className="w-full h-auto" />
              ) : (
                <video
                  src={step.mediaSrc}
                  poster={step.mediaPoster}
                  controls
                  preload="metadata"
                  playsInline
                  className="w-full h-auto"
                />
              )}
            </div>

            <div className="mt-2 text-center text-xs text-white/70">
              Tip: press <span className="font-semibold">Esc</span> to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// src/pages/Instructions.tsx
import React from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo";

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

// ✅ Put your Notion template URL here (external link)
const NOTION_TEMPLATE_URL =
  "https://n2a-template.notion.site/N2A-Notion-Template-Read-Only-2eb54986383480a2b7b9c652a6893078";

/**
 * NOTE ABOUT TABS:
 * Your current parser supports: 4 spaces indentation OR "- " OR "* "
 * It does NOT reliably support literal Tab characters from Notion exports.
 */
const STEPS: Step[] = [
  {
    title: "1) Quick overview",
    subtitle: "What N2A does",
    bullets: [
      "Goal: convert your Notion notes into Anki-ready flashcards in minutes.",
      "Workflow page = Upload → Parse → Review → Export.",
      "Guest mode: You can parse, edit, and export without an account.",
      "Free account: Saves your latest project so you can come back later.",
      "Paid plans: Unlock AI review and APKG export.",
    ],
    mediaType: "video",
    mediaHint: "Record: site tour (Home → Instructions → Workflow → Account).",
    mediaSrc: "/videos/n2a_step_video.mp4",
    cta: { label: "Open Workflow", to: "/workflow" },
  },
  {
    title: "2) Start with the template",
    subtitle: "Starting with the N2A is the fastest way to avoid formatting mistakes",
    bullets: [
      "Duplicate the free N2A Notion template and write your notes inside it.",
      "The template uses formatting that N2A expects.",
      "If you don’t use the template, you can still use N2A — just follow the formatting rules in Step 3.",
    ],
    mediaType: "video",
    mediaHint: "Record: open the Notion template → duplicate → show where to type notes.",
    mediaSrc: "/videos/n2a_step_video.mp4",
    cta: { label: "Open N2A Notion Template", to: NOTION_TEMPLATE_URL },
  },
  {
    title: "3) Formatting rules",
    subtitle: "How to structure Q&A + MCQ blocks in Notion",
    bullets: [
      "N2A supports two card types: Q&A cards and MCQ cards.",
      "Everything starts with a tag line: either 'Question:' or 'MCQ:'",
      "Answers and options must be either: (a) indented by 4 spaces, OR (b) bulleted using '- ' or '* '",
      "Avoid putting multiple questions inside one block. Keep one Question/MCQ per block.",
      "If parsing misses cards, the post-parse check will tell you what to fix.",
      "Again, see the free N2A Notion template"
    ],
    mediaType: "video",
    mediaHint: "Record: show examples in Notion of correct vs incorrect formatting.",
    mediaSrc: "/videos/n2a_step_video.mp4",
    cta: { label: "Open N2A Notion Template", to: NOTION_TEMPLATE_URL },
  },
  {
    title: "4) Q&A card examples",
    subtitle: "Exact formats that N2A can parse",
    bullets: [
      "Q&A cards must start with: Question: <your question>",
      "Answer lines must be bulleted with '- ' or '* '",
    ],
    mediaType: "video",
    mediaHint: "Record: show a Q&A block in Notion, then show the exported .md briefly.",
    mediaSrc: "/videos/n2a_step_video.mp4",
    cta: { label: "Open Workflow", to: "/workflow" },
  },
  {
    title: "5) MCQ card examples",
    subtitle: "Options + Answer formatting",
    bullets: [
      "MCQ cards must start with: MCQ: <your question stem>",
      "Options must be one-per-line and bulleted with '- ' or '* '",
      "Then include an 'Answer:' line and the answer on the next line indented by 4 spaces.",
      "Good example:",
      "MCQ: Which interaction dominates at 30 keV?",
      "    - A) Photoelectric effect",
      "    - B) Compton scatter",
      "    - C) Pair production",
      "Answer:",
      "    A)",
      "Tip: The answer can be just the label (A), (A), (A), 'A)', or '1)' etc — N2A can format output later.",
    ],
    mediaType: "video",
    mediaHint: "Record: show MCQ block. Emphasize 4 spaces for options/answer.",
    mediaSrc: "/videos/n2a_step_video.mp4",
    cta: { label: "Open Workflow", to: "/workflow" },
  },
  {
    title: "6) Export from Notion",
    subtitle: "Export Markdown, then upload the .md file into Workflow",
    bullets: [
      "In Notion: Share → Export",
      "Choose: 'Markdown & CSV'",
      "Download the export zip, then locate the .md file inside it",
      "Upload that .md file into N2A Workflow (drag & drop or select file).",
      "Tip: If your export contains many files, upload the main .md file for your page (usually named after the page).",
    ],
    mediaType: "video",
    mediaHint: "Record: Notion export click path → show the downloaded zip → show the .md inside.",
    mediaSrc: "/videos/n2a_step_video.mp4",
    cta: { label: "Open Workflow", to: "/workflow" },
  },
  {
    title: "7) Parse and fix issues",
    subtitle: "How to fix common formatting problems",
    bullets: [
      "After you press Parse, N2A generates card previews.",
      "N2A also runs a post-parse check which warns you about cards likely missing answers, options, or MCQ answers.",
      "Errors usually mean that a card will export badly (fix it before exporting).",
      "Warnings usually mean that something is likely formatted wrong (often indentation or bullets).",
      "Use the 'Jump' button to scroll to the affected card and fix it quickly.",
    ],
    mediaType: "video",
    mediaHint: "Record: parse a file with a few mistakes → show panel → click Jump → fix in Edit → re-check.",
    mediaSrc: "/videos/n2a_step_video.mp4",
    cta: { label: "Open Workflow", to: "/workflow" },
  },
  {
    title: "8) Review cards",
    subtitle: "Clean up cards before export so your Anki import looks great",
    bullets: [
      "Each card shows a Front and Back preview.",
      "Use Filter (All / Q&A / MCQ) to focus your review.",
      "Use Edit to modify Front/Back text directly.",
      "Use Delete to remove a card from export.",
    ],
    mediaType: "video",
    mediaHint: "Record: show preview → Edit a card → Delete a card → show counts update.",
    mediaSrc: "/videos/n2a_step_video.mp4",
    cta: { label: "Open Workflow", to: "/workflow" },
  },
  {
    title: "9) AI review",
    subtitle: "Content review vs format review vs both",
    bullets: [
      "AI Content Review: Checks clarity and consistency; may flag cards that appear incorrect.",
      "AI Format Review: Improves the readability and structure of cards without changing meaning.",
      "AI Both: Combines content and formatting suggestions.",
      "If a card is flagged incorrect, N2A will not auto-apply a made-up answer — you should edit manually.",
      "Always double-check AI suggestions. AI helps, but it’s not perfect.",
    ],
    mediaType: "video",
    mediaHint: "Record: run AI review on 1–2 cards → show feedback panel → show incorrect flag behavior.",
    mediaSrc: "/videos/n2a_step_video.mp4",
    cta: { label: "Account", to: "/account" },
  },
  {
    title: "10) Export to Anki (TSV or APKG)",
    subtitle: "How to get your cards into Anki correctly",
    bullets: [
      "Guest and Free users: Export TSV. This imports cleanly into Anki using tab-separated fields.",
      "TSV import: In Anki select File → Import → select .tsv → choose the correct deck and note type → map Front/Back fields.",
      "Paid users: Export APKG. This downloads a ready-to-import Anki deck file with great formatting.",
    ],
    mediaType: "video",
    mediaHint: "Record: export TSV/APKG → show Anki import screen → confirm Front/Back mapping.",
    mediaSrc: "/videos/n2a_step_video.mp4",
    cta: { label: "Open Workflow", to: "/workflow" },
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
    <>
      <Seo
        title="Instructions"
        description="Learn the exact Notion Markdown formatting rules so N2A can parse Q&A and MCQ blocks into Anki cards."
        canonicalPath="/instructions"
      />

      <div className="-mx-4 md:-mx-6 lg:-mx-8">
        {/* HEADER BAND */}
        <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-100">
          <div className="max-w-6xl mx-auto text-center space-y-3">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Instructions: From <span className="text-primary">Notion</span> notes to{" "}
              <span className="text-primary">Anki</span> flashcards
            </h1>

            <p className="opacity-75 max-w-2xl mx-auto">
              Follow the steps on the left. The formatting rules (Steps 3–5) are the key to reliable parsing.
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
                          <div className={["badge", active ? "badge-primary" : "badge-ghost"].join(" ")}>
                            {i + 1}
                          </div>
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

                <div className="rounded-xl border border-base-300 bg-base-200/40 p-3 text-xs opacity-75">
                  <div className="font-semibold mb-1">Most common reason parsing fails</div>
                  <div>Answer/option lines are not indented with <span className="font-semibold">4 spaces</span> and are not bulleted.</div>
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

                {/* Media block: supports click-to-zoom */}
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
                            <video
                              src={step.mediaSrc}
                              poster={step.mediaPoster}
                              controls
                              preload="metadata"
                              playsInline
                              className="w-full h-full object-cover"
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                        </button>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center space-y-2 px-6">
                            <div className="text-sm opacity-70">{step.mediaHint}</div>
                            <div className="text-xs opacity-50">
                              Add <span className="font-semibold">mediaSrc</span> to this step to show your media here
                              (e.g. <span className="font-semibold">/videos/your-file.mp4</span> or{" "}
                              <span className="font-semibold">/images/your-file.png</span>).
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
                      <div className="opacity-85 whitespace-pre-wrap">{b}</div>
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

                  {step.cta &&
                    (step.cta.to.startsWith("http") ? (
                      <a href={step.cta.to} target="_blank" rel="noopener noreferrer" className="btn">
                        {step.cta.label}
                      </a>
                    ) : (
                      <Link to={step.cta.to} className="btn">
                        {step.cta.label}
                      </Link>
                    ))}
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
                Account
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
    </>
  );
}

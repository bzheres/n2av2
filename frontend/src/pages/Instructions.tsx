import React from "react";
import { Link } from "react-router-dom";

type MediaType = "image" | "video";

type Step = {
  title: string;
  subtitle?: string;
  bullets: string[];
  mediaType: MediaType;
  mediaHint: string; // what you plan to place here later
  cta?: { label: string; to: string };
};

const STEPS: Step[] = [
  {
    title: "1) Export from Notion",
    subtitle: "Create a clean Markdown export that N2A can parse reliably.",
    bullets: [
      "In Notion: Share → Export → Markdown & CSV",
      "Include subpages if your content is nested",
      "Avoid renaming files/folders after export",
    ],
    mediaType: "video",
    mediaHint: "Placeholder: 20–40s screen recording showing Notion export settings",
  },
  {
    title: "2) What N2A expects",
    subtitle: "Use consistent structure so cards import cleanly into Anki.",
    bullets: [
      "Use explicit labels like Question:, MCQ:, Options:, Answer:",
      "Keep one card per block (avoid mixing multiple prompts)",
      "Prefer short questions and clear, single answers",
    ],
    mediaType: "image",
    mediaHint: "Placeholder: screenshot of a well-structured Notion card block",
  },
  {
    title: "3) Upload to Workflow",
    subtitle: "Drop your export into N2A to begin parsing.",
    bullets: [
      "Go to Workflow page",
      "Upload your Markdown export (zip/folder depending on your setup)",
      "Confirm the filename appears and the buttons unlock",
    ],
    mediaType: "video",
    mediaHint: "Placeholder: short clip of upload interaction (drag & drop)",
    cta: { label: "Go to Workflow", to: "/workflow" },
  },
  {
    title: "4) Parse & generate cards",
    subtitle: "N2A builds card objects from your content structure.",
    bullets: [
      "Click Parse to generate previews",
      "If counts look wrong: fix formatting and re-export from Notion",
      "You can iterate fast—export → upload → parse",
    ],
    mediaType: "image",
    mediaHint: "Placeholder: screenshot of parse success state and card count",
  },
  {
    title: "5) Review your output",
    subtitle: "Scan for missing answers, broken MCQ options, or weird line breaks.",
    bullets: [
      "Look for empty answers and duplicated questions",
      "Confirm MCQ correct option is captured properly",
      "Spot-check a few cards across different sections",
    ],
    mediaType: "image",
    mediaHint: "Placeholder: card preview grid screenshot",
  },
  {
    title: "6) Edit before export",
    subtitle: "Fix small issues now to avoid messy imports later.",
    bullets: [
      "Edit prompts/answers for clarity (short + precise)",
      "Remove stray formatting characters from Notion exports",
      "Standardize MCQ option formatting if needed",
    ],
    mediaType: "video",
    mediaHint: "Placeholder: clip of editing a card (before → after)",
  },
  {
    title: "7) Export to Anki",
    subtitle: "Download CSV and import into Anki with consistent fields.",
    bullets: [
      "Export CSV from N2A",
      "In Anki: File → Import → select CSV",
      "Map fields correctly (Front/Back, tags if included)",
    ],
    mediaType: "image",
    mediaHint: "Placeholder: screenshot of Anki import mapping screen",
  },
  {
    title: "8) Recommended Anki settings",
    subtitle: "Make your study sessions efficient from day 1.",
    bullets: [
      "Use a sensible new card limit (e.g. 20–40/day)",
      "Set review limit high enough to avoid backlog",
      "Stick to daily reviews—consistency beats intensity",
    ],
    mediaType: "image",
    mediaHint: "Placeholder: Anki deck options screenshot",
  },
  {
    title: "9) Troubleshooting quick fixes",
    subtitle: "Most issues are formatting or export-related.",
    bullets: [
      "Wrong counts? Check your Notion card labels and spacing",
      "Login issues? Confirm cookies + correct backend URL",
      "Export issues? Validate CSV delimiter + Anki field mapping",
    ],
    mediaType: "image",
    mediaHint: "Placeholder: “common errors & fixes” graphic",
  },
  {
    title: "10) Ready to build your deck",
    subtitle: "You’re set—start with one page, then scale up.",
    bullets: [
      "Start small: one Notion page → validate results → then bulk export",
      "Iterate your structure until parsing is perfect",
      "Once stable: upgrade for AI review / higher limits (if desired)",
    ],
    mediaType: "video",
    mediaHint: "Placeholder: optional short “best practices” video",
    cta: { label: "Go to Account", to: "/account" },
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

  // Keyboard navigation: ← / → (nice touch, optional)
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
            Navigate step-by-step. Add screenshots/videos later (placeholders included).
          </p>

          {/* quick links */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <Link to="/workflow" className="btn btn-primary">
              Open Workflow
            </Link>
            <Link to="/account" className="btn btn-outline">
              Account
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

                {/* compact top nav */}
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

              {/* Media placeholder */}
              <div className="rounded-2xl border border-base-300 bg-base-200/40 overflow-hidden">
                <div className="p-4 md:p-5 flex items-center justify-between gap-3">
                  <div className="font-semibold">
                    {step.mediaType === "video" ? "Video placeholder" : "Image placeholder"}
                  </div>
                  <div className="badge badge-ghost">{step.mediaType.toUpperCase()}</div>
                </div>

                <div className="px-4 md:px-5 pb-5">
                  <div className="aspect-video rounded-xl bg-base-100 border border-base-300 flex items-center justify-center">
                    <div className="text-center space-y-2 px-6">
                      <div className="text-sm opacity-70">{step.mediaHint}</div>
                      <div className="text-xs opacity-50">
                        Later: replace this block with an &lt;img&gt; or &lt;video&gt; component.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bullets */}
              <div className="space-y-2">
                {step.bullets.map((b) => (
                  <div
                    key={b}
                    className="flex gap-3 items-start rounded-xl border border-base-300 bg-base-200/30 p-3"
                  >
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
          <p className="opacity-75">
            Export from Notion → Upload → Parse → Review → Export → Anki.
          </p>
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

import React from "react";
import { Link } from "react-router-dom";

type Step = { title: string; body: string };

const STEPS: Step[] = [
  {
    title: "Upload",
    body: "Drop your Notion Markdown export into Workflow.",
  },
  {
    title: "Parse",
    body: "N2A detects Q&A and MCQ blocks and turns them into cards.",
  },
  {
    title: "Edit",
    body: "Preview your cards and tweak anything before export.",
  },
  {
    title: "Export",
    body: "Download a CSV ready to import into Anki.",
  },
];

function useActiveOnScroll(count: number) {
  const refs = React.useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];

        if (!visible) return;
        const idx = Number((visible.target as HTMLElement).dataset.index || 0);
        if (!Number.isNaN(idx)) setActive(idx);
      },
      { threshold: [0.2, 0.35, 0.5, 0.65, 0.8] }
    );

    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [count]);

  return { refs, active, setActive };
}

function BadgeNumber({ n, active }: { n: number; active: boolean }) {
  return <div className={["badge", active ? "badge-primary" : "badge-ghost"].join(" ")}>{n}</div>;
}

export default function Home() {
  const { refs, active, setActive } = useActiveOnScroll(STEPS.length);

  // Examples: generic + intentionally styled exactly like Workflow preview blocks.
  const qaFront = "What is photosynthesis?";
  const qaBack = [
    "**Definition**",
    "Process where plants use sunlight to make energy (glucose).",
    "",
    "**Inputs**",
    "- Carbon dioxide (CO₂)",
    "- Water (H₂O)",
    "- Sunlight",
    "",
    "**Outputs**",
    "- Glucose",
    "- Oxygen (O₂)",
  ].join("\n");

  const mcqFront = [
    "Which planet is known as the Red Planet?",
    "1) Earth",
    "2) Mars",
    "3) Jupiter",
    "4) Venus",
  ].join("\n");

  const mcqBack = "2) Mars";

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8">
      {/* =========================
          HERO (no card look)
         ========================= */}
      <section className="px-4 md:px-6 lg:px-8 py-14 md:py-20 bg-base-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-5">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
              Turn <span className="text-primary">Notion</span> notes into <span className="text-primary">Anki</span>{" "}
              cards — <span className="text-primary">fast</span>.
            </h1>

            <p className="opacity-80 max-w-2xl mx-auto text-base md:text-lg">
              Upload a Notion Markdown export, generate cards, preview, edit, then export CSV to Anki. Optional AI review
              on paid plans.
            </p>

            <div className="pt-3 flex flex-col sm:flex-row justify-center gap-3">
              <Link to="/workflow" className="btn btn-primary">
                Go to Workflow
              </Link>
              <Link to="/instructions" className="btn btn-outline">
                View Instructions
              </Link>
              <Link to="/account" className="btn">
                Account
              </Link>
            </div>

            <div className="text-xs md:text-sm opacity-60">Built for speed. Designed for clean output. Made for spaced repetition.</div>
          </div>
        </div>
      </section>

      {/* =========================
          FLOW (free-tier overview)
          Scroll-activated highlight + hover polish
         ========================= */}
      <section className="px-4 md:px-6 lg:px-8 py-12 md:py-14 bg-base-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold">
              The <span className="text-primary">N2A</span> flow
            </h2>
          </div>

          <div className="space-y-4">
            {STEPS.map((s, i) => {
              const isActive = i === active;
              return (
                <div
                  key={s.title}
                  ref={(el) => (refs.current[i] = el)}
                  data-index={i}
                  onMouseEnter={() => setActive(i)}
                  className={[
                    "group rounded-2xl border transition-all duration-200",
                    "p-4 md:p-5",
                    isActive
                      ? "bg-base-100 border-primary/50 shadow-lg shadow-primary/10"
                      : "bg-base-200/40 border-base-300 hover:bg-base-100 hover:border-primary/30",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-4">
                    <div className="pt-0.5">
                      <BadgeNumber n={i + 1} active={isActive} />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-lg">{s.title}</div>

                        <div
                          className={[
                            "h-2 w-2 rounded-full transition-all",
                            isActive ? "bg-primary" : "bg-base-300 group-hover:bg-primary/60",
                          ].join(" ")}
                        />
                      </div>

                      <div className="text-sm md:text-base opacity-80 mt-1">{s.body}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-center">
            <Link to="/workflow" className="btn btn-primary">
              Try it now
            </Link>
          </div>
        </div>
      </section>

      {/* =========================
          PREVIEW (Match Workflow styling)
         ========================= */}
      <section className="px-4 md:px-6 lg:px-8 py-12 md:py-14 bg-base-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold">
              Preview exactly what <span className="text-primary">Workflow</span> generates
            </h2>
            <p className="opacity-75 mt-2">Same look, same structure — so you know what will export to Anki.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* Q&A Preview (Workflow-style) */}
            <div className="card bg-base-200/40 border border-base-300 rounded-2xl">
              <div className="card-body space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="badge badge-outline">QA</div>
                  <div className="text-xs opacity-60">Example</div>
                </div>

                <div className="text-xs font-semibold opacity-70">Front (preview)</div>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-base-100/40 border border-base-300 rounded-xl p-3">
                  {qaFront}
                </pre>

                <div className="text-xs font-semibold opacity-70">Back (preview)</div>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-base-100/40 border border-base-300 rounded-xl p-3">
                  {qaBack}
                </pre>
              </div>
            </div>

            {/* MCQ Preview (Workflow-style) */}
            <div className="card bg-base-200/40 border border-base-300 rounded-2xl">
              <div className="card-body space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="badge badge-outline">MCQ</div>
                  <div className="text-xs opacity-60">Example</div>
                </div>

                <div className="text-xs font-semibold opacity-70">Front (preview)</div>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-base-100/40 border border-base-300 rounded-xl p-3">
                  {mcqFront}
                </pre>

                <div className="text-xs font-semibold opacity-70">Back (preview)</div>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-base-100/40 border border-base-300 rounded-xl p-3">
                  {mcqBack}
                </pre>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-center gap-3 flex-col sm:flex-row">
            <Link to="/workflow" className="btn btn-primary">
              Generate my cards
            </Link>
            <Link to="/instructions" className="btn btn-outline">
              Learn formatting rules
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

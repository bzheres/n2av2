import { Link } from "react-router-dom";

export default function About() {
  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8">
      {/* HERO / INTRO BAND */}
      <section className="px-4 md:px-6 lg:px-8 py-12 md:py-16 bg-base-200">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            About <span className="text-primary">N2A</span>
          </h1>
          <p className="max-w-3xl mx-auto opacity-80 text-base md:text-lg leading-relaxed">
            N2A (Notion → Anki) turns your study notes into spaced-repetition flashcards in minutes.
            Export from Notion, parse into clean Q&amp;A and MCQ cards, review them, then export to Anki —
            without messy manual formatting.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <Link to="/workflow" className="btn btn-primary">
              Try the Workflow
            </Link>
            <Link to="/instructions" className="btn btn-outline">
              Read Instructions
            </Link>
            <Link to="/account" className="btn">
              Account
            </Link>
          </div>
        </div>
      </section>

      {/* WHY BAND */}
      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-100">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-4">
          <div className="card bg-base-200/60 border border-base-300 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:bg-base-200">
            <div className="card-body space-y-2">
              <div className="text-sm font-semibold opacity-70">The problem</div>
              <h2 className="text-xl font-bold">Good notes ≠ good revision</h2>
              <p className="text-sm opacity-75 leading-relaxed">
                Notion is great for structured notes, but turning those notes into high-quality flashcards
                takes time — and formatting mistakes break flow.
              </p>
            </div>
          </div>

          <div className="card bg-base-200/60 border border-base-300 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:bg-base-200">
            <div className="card-body space-y-2">
              <div className="text-sm font-semibold opacity-70">The solution</div>
              <h2 className="text-xl font-bold">Fast, reliable parsing</h2>
              <p className="text-sm opacity-75 leading-relaxed">
                N2A parses a clear Markdown structure into Q&amp;A + MCQ cards, gives you a clean preview,
                and exports a CSV that Anki can import immediately.
              </p>
            </div>
          </div>

          <div className="card bg-base-200/60 border border-base-300 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:bg-base-200">
            <div className="card-body space-y-2">
              <div className="text-sm font-semibold opacity-70">The goal</div>
              <h2 className="text-xl font-bold">More reps, less admin</h2>
              <p className="text-sm opacity-75 leading-relaxed">
                The aim is simple: spend less time reformatting and more time doing the reps that actually
                move the needle.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FUTURE BAND */}
      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-200">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-6 items-start">
          <div className="card bg-base-100 border border-base-300 rounded-2xl">
            <div className="card-body space-y-3">
              <h3 className="text-2xl font-extrabold tracking-tight">
                Where N2A is heading
              </h3>
              <p className="text-sm opacity-75 leading-relaxed">
                N2A is being built as a complete “notes → cards → review → export” pipeline. Over time,
                the focus is on improving reliability, editing workflows, and adding optional AI assistance
                for polishing cards — while keeping the core experience fast and simple.
              </p>

              <ul className="text-sm opacity-80 leading-relaxed list-disc ml-5 space-y-1">
                <li>More robust parsing edge-cases (real-world Notion exports)</li>
                <li>Better in-app editing for large decks</li>
                <li>Optional AI review for clarity, consistency, and formatting</li>
                <li>Quality-of-life tools (bulk actions, tagging, export options)</li>
              </ul>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 rounded-2xl">
            <div className="card-body space-y-3">
              <h3 className="text-2xl font-extrabold tracking-tight">
                Principles
              </h3>
              <p className="text-sm opacity-75 leading-relaxed">
                A few non-negotiables that guide the build:
              </p>

              <div className="space-y-2">
                <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4">
                  <div className="font-semibold">Speed first</div>
                  <div className="text-sm opacity-75">The workflow should feel instant and frictionless.</div>
                </div>
                <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4">
                  <div className="font-semibold">User control</div>
                  <div className="text-sm opacity-75">You can always edit, delete, and choose your output.</div>
                </div>
                <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4">
                  <div className="font-semibold">Optional AI</div>
                  <div className="text-sm opacity-75">AI should assist — not block the core product.</div>
                </div>
              </div>

              <div className="pt-2">
                <Link to="/contact" className="btn btn-primary">
                  Contact / Feedback
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

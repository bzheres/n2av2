import { Link } from "react-router-dom";
import Seo from "../components/Seo";

export default function About() {
  return (
    <>
      <Seo
        title="About"
        description="Learn what N2A is, why it exists, and how it converts Notion notes into Anki flashcards—fast."
        canonicalPath="/about"
      />

      <div className="-mx-4 md:-mx-6 lg:-mx-8">
        {/* HERO / INTRO BAND */}
        <section className="px-4 md:px-6 lg:px-8 py-12 md:py-16 bg-base-200">
          <div className="max-w-5xl mx-auto text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              About <span className="text-primary">N2A</span>
            </h1>

            <p className="max-w-3xl mx-auto opacity-80 text-base md:text-lg leading-relaxed">
              N2A turns your Notion notes into spaced-repetition flashcards in minutes.
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
                  can be time consuming.
                </p>
              </div>
            </div>

            <div className="card bg-base-200/60 border border-base-300 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:bg-base-200">
              <div className="card-body space-y-2">
                <div className="text-sm font-semibold opacity-70">The solution</div>
                <h2 className="text-xl font-bold">Fast, reliable parsing</h2>
                <p className="text-sm opacity-75 leading-relaxed">
                  N2A takes your Notion notes and immediately converts them into flashcards which can be
                  imported into Anki.
                </p>
              </div>
            </div>

            <div className="card bg-base-200/60 border border-base-300 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:bg-base-200">
              <div className="card-body space-y-2">
                <div className="text-sm font-semibold opacity-70">The goal</div>
                <h2 className="text-xl font-bold">More reps, less admin</h2>
                <p className="text-sm opacity-75 leading-relaxed">
                  The aim is simple: spend less time turning notes into flashcards and spend more time revising!
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
                <h3 className="text-2xl font-extrabold tracking-tight">Where N2A is heading</h3>
                <p className="text-sm opacity-75 leading-relaxed">
                  The future goal is to continue to improve N2A. We want to improve speed, efficiency, and
                  accuracy. Over time, N2A will add the ability to generate different Anki card types (e.g.
                  image occlusion, cloze cards, etc).
                </p>

                <ul className="text-sm opacity-80 leading-relaxed list-disc ml-5 space-y-1">
                  <li>Improve speed, efficiency, and accuracy</li>
                  <li>More robust parsing for real-world Notion exports</li>
                  <li>Better in-app editing for large decks</li>
                  <li>Support for more Anki card types (e.g. image occlusion, cloze)</li>
                </ul>
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300 rounded-2xl">
              <div className="card-body space-y-3">
                <h3 className="text-2xl font-extrabold tracking-tight">Principles</h3>
                <p className="text-sm opacity-75 leading-relaxed">N2A prides itself on:</p>

                <div className="space-y-2">
                  <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4">
                    <div className="font-semibold">Speed first</div>
                    <div className="text-sm opacity-75">
                      Efficient workflow to quickly convert notes into flashcards.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4">
                    <div className="font-semibold">User control</div>
                    <div className="text-sm opacity-75">
                      You can always edit, delete, and choose your output.
                    </div>
                  </div>

                  <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4">
                    <div className="font-semibold">Optional AI</div>
                    <div className="text-sm opacity-75">
                      AI should assist — not interfere or take over your notes. Only use it if YOU want.
                    </div>
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
    </>
  );
}

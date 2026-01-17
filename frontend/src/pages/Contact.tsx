import { Link } from "react-router-dom";

export default function Contact() {
  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8">
      {/* HERO / INTRO */}
      <section className="px-4 md:px-6 lg:px-8 py-12 md:py-16 bg-base-200">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Get in <span className="text-primary">touch</span>
          </h1>
          <p className="max-w-2xl mx-auto opacity-80 text-base md:text-lg leading-relaxed">
            Questions, feedback, feature ideas, or bug reports — happy to hear from you.
            N2A is actively evolving and user input genuinely helps shape the roadmap.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <Link to="/workflow" className="btn btn-outline">
              Try the Workflow
            </Link>
            <Link to="/about" className="btn">
              About N2A
            </Link>
          </div>
        </div>
      </section>

      {/* CONTACT DETAILS */}
      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-100">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
          {/* Email card */}
          <div className="card bg-base-200/60 border border-base-300 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:bg-base-200">
            <div className="card-body space-y-3">
              <div className="text-sm font-semibold opacity-70">Email</div>
              <h2 className="text-xl font-bold">Support &amp; enquiries</h2>
              <p className="text-sm opacity-75 leading-relaxed">
                For support, feedback, or general questions, the fastest way to reach out is email.
              </p>

              <a
                href="mailto:admin@n2a.com.au"
                className="btn btn-primary w-fit"
              >
                admin@n2a.com.au
              </a>
            </div>
          </div>

          {/* Expectations / response time */}
          <div className="card bg-base-200/60 border border-base-300 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:bg-base-200">
            <div className="card-body space-y-3">
              <div className="text-sm font-semibold opacity-70">What to expect</div>
              <h2 className="text-xl font-bold">Response time</h2>
              <p className="text-sm opacity-75 leading-relaxed">
                Messages are typically answered within 1–2 days. Feature requests and
                bug reports are logged and prioritised based on impact.
              </p>

              <p className="text-sm opacity-75 leading-relaxed">
                If something feels broken or unclear, that’s exactly the kind of feedback
                worth sending.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTNOTE / CTA */}
      <section className="px-4 md:px-6 lg:px-8 py-10 bg-base-200">
        <div className="max-w-4xl mx-auto text-center space-y-3">
          <p className="text-sm opacity-75">
            N2A is designed to stay focused, fast, and practical — especially for heavy
            study workflows.
          </p>
          <Link to="/account" className="btn btn-primary">
            Create an account
          </Link>
        </div>
      </section>
    </div>
  );
}

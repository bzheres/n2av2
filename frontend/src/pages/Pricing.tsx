// src/pages/Pricing.tsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../components/Seo";
import { apiFetch } from "../api";
import { useAuth } from "../auth_state";

type PlanKey = "free" | "silver" | "gold" | "platinum";

function normalizePlan(p: any): PlanKey {
  const raw = String(p ?? "free").toLowerCase();
  if (raw.includes("platinum")) return "platinum";
  if (raw.includes("gold")) return "gold";
  if (raw.includes("silver")) return "silver";
  return "free";
}

function planLabel(plan: PlanKey) {
  switch (plan) {
    case "platinum":
      return "Platinum";
    case "gold":
      return "Gold";
    case "silver":
      return "Silver";
    default:
      return "Free";
  }
}

type Plan = {
  key: PlanKey;
  title: string;
  subtitle: string;
  priceLabel: string;
  highlight?: boolean;
  aiReviewsPerMonth: number;
  features: string[];
};

const PLANS: Plan[] = [
  {
    key: "free",
    title: "Free",
    subtitle: "Everything you need to generate and export cards.",
    priceLabel: "$0",
    aiReviewsPerMonth: 0,
    features: [
      "Upload Notion Markdown export",
      "Parse Q&A and MCQ cards",
      "Preview, edit & delete cards",
      "Export TSV (HTML) for Anki import",
    ],
  },
  {
    key: "silver",
    title: "Silver",
    subtitle: "AI review for smaller decks and occasional use.",
    priceLabel: "$5",
    aiReviewsPerMonth: 2000,
    features: [
      "Everything in Free",
      "Up to 2,000 AI reviews / month",
      "AI review modes: content / format / both",
      "Apply AI suggestions",
    ],
  },
  {
    key: "gold",
    title: "Gold",
    subtitle: "Best value for regular studying and repeated review cycles.",
    priceLabel: "$7",
    aiReviewsPerMonth: 6000,
    highlight: true, // ✅ Best value highlight (border only; no sticker)
    features: [
      "Everything in Silver",
      "Up to 6,000 AI reviews / month",
      "AI review modes: content / format / both",
      "Apply AI suggestions",
    ],
  },
  {
    key: "platinum",
    title: "Platinum",
    subtitle: "Power users who run AI review on big decks every month.",
    priceLabel: "$10",
    aiReviewsPerMonth: 12000,
    features: [
      "Everything in Gold",
      "Up to 12,000 AI reviews / month",
      "AI review modes: content / format / both",
      "Apply AI suggestions",
    ],
  },
];

function planCardClass(active: boolean, highlight?: boolean) {
  return [
    "card rounded-2xl border transition-all duration-200 h-full",
    "min-w-0",
    active ? "bg-base-200 ring-1 ring-primary/30" : "bg-base-200/60",
    highlight ? "border-primary ring-1 ring-primary/30 shadow-lg shadow-primary/10" : "border-base-300",
    "hover:-translate-y-1 hover:bg-base-200 hover:border-primary/40",
  ].join(" ");
}

function formatNumber(n: number) {
  return n.toLocaleString("en-AU");
}

// ✅ Compare-table emphasis (no border / ring). Just subtle bg + scale.
function colEmphasisClass(selected: PlanKey, col: PlanKey) {
  const is = selected === col;
  return ["transition-all duration-200", is ? "scale-[1.02] bg-primary/5" : "opacity-90"].join(" ");
}

export default function Pricing() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const currentPlan: PlanKey = normalizePlan(user?.plan);

  const [selected, setSelected] = React.useState<PlanKey>("gold");
  const [err, setErr] = React.useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = React.useState<PlanKey | null>(null);
  const [portalBusy, setPortalBusy] = React.useState(false);

  React.useEffect(() => {
    if (!loading && user) setSelected(currentPlan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  async function doCheckout(plan: "silver" | "gold" | "platinum") {
    setErr(null);

    if (!user) {
      navigate("/account");
      return;
    }

    setCheckoutBusy(plan);
    try {
      const r = await apiFetch<{ url: string }>("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      window.location.href = r.url;
    } catch (e: any) {
      setErr(e?.message || "Checkout failed");
      setCheckoutBusy(null);
    }
  }

  async function doPortal() {
    setErr(null);
    setPortalBusy(true);
    try {
      const r = await apiFetch<{ url: string }>("/billing/portal", { method: "POST" });
      window.location.href = r.url;
    } catch (e: any) {
      setErr(e?.message || "Could not open portal");
      setPortalBusy(false);
    }
  }

  const selectedPlan = PLANS.find((p) => p.key === selected) || PLANS[0];

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8">
      <Seo
        title="Pricing"
        description="Compare N2A plans (Free, Silver, Gold, Platinum). Upgrade to unlock optional AI review for your Notion → Anki flashcards."
        canonicalPath="/pricing"
      />

      {/* HERO */}
      <section className="px-4 md:px-6 lg:px-8 py-12 md:py-16 bg-base-100">
        <div className="max-w-6xl mx-auto text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            <span className="text-primary">N2A</span> pricing plans
          </h1>

          <p className="max-w-3xl mx-auto opacity-80 text-base md:text-lg leading-relaxed">
            The core workflow is usable on Free. Upgrade only if you want optional AI review for your cards.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <Link to="/workflow" className="btn btn-primary">
              Try Workflow
            </Link>
            <Link to="/account" className="btn">
              Account
            </Link>
          </div>

          <div className="flex justify-center pt-3">
            <div className={["badge badge-lg", user ? "badge-primary badge-outline" : "badge-ghost"].join(" ")}>
              {user ? `Logged in (${user.plan})` : "Guest mode"}
            </div>
          </div>

          {err && (
            <div className="max-w-xl mx-auto">
              <div className="alert alert-error">
                <span>{err}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* PLAN PICKER + SUMMARY */}
      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-200">
        <div className="max-w-7xl 2xl:max-w-screen-2xl mx-auto grid lg:grid-cols-[1fr_420px] gap-6 items-start">
          {/* LEFT */}
          <div className="space-y-4 min-w-0">
            {/* Cards */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
              {PLANS.map((p) => {
                const active = selected === p.key;
                const isCurrent = user && currentPlan === p.key;

                return (
                  <button
                    key={p.key}
                    type="button"
                    className={planCardClass(active, p.highlight)}
                    onClick={() => setSelected(p.key)}
                    aria-pressed={active}
                  >
                    <div className="card-body text-left space-y-3 min-w-0">
                      <div className="flex items-start justify-between gap-3 min-w-0">
                        <div className="min-w-0">
                          <div className="text-xl font-bold break-words">{p.title}</div>
                          <div className="text-sm opacity-70 break-words">{p.subtitle}</div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {isCurrent && <div className="badge badge-outline">Current</div>}
                        </div>
                      </div>

                      <div className="mt-1 min-w-0">
                        <div className="text-3xl font-extrabold break-words">
                          {p.priceLabel}
                          {p.key !== "free" ? <span className="text-sm font-semibold opacity-70"> / month</span> : null}
                        </div>
                        <div className="text-sm opacity-80 mt-1 break-words">
                          AI reviews:{" "}
                          <span className="font-semibold">
                            {p.aiReviewsPerMonth ? formatNumber(p.aiReviewsPerMonth) : "0"}
                          </span>
                          <span className="opacity-70"> / month</span>
                        </div>
                      </div>

                      <ul className="text-sm opacity-80 space-y-1 list-disc list-inside min-w-0">
                        {p.features.slice(0, 4).map((f) => (
                          <li key={f} className="break-words">
                            {f}
                          </li>
                        ))}
                      </ul>

                      <div className="text-xs opacity-60">Click to compare →</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Mobile selected-plan summary */}
            <div className="block lg:hidden">
              <div className="card bg-base-100 border border-base-300 rounded-2xl">
                <div className="card-body space-y-3 min-w-0">
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="text-sm opacity-70">Selected plan</div>
                      <div className="text-2xl font-extrabold break-words">{selectedPlan.title}</div>
                      <div className="text-sm opacity-70 break-words">{selectedPlan.subtitle}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-base-300 bg-base-200/40 p-3 min-w-0">
                    <div className="text-sm opacity-70">Price</div>
                    <div className="text-3xl font-extrabold break-words">
                      {selectedPlan.priceLabel}
                      {selectedPlan.key !== "free" ? (
                        <span className="text-sm font-semibold opacity-70"> / month</span>
                      ) : null}
                    </div>
                    <div className="text-sm opacity-80 mt-1 break-words">
                      AI reviews:{" "}
                      <span className="font-semibold">
                        {selectedPlan.aiReviewsPerMonth ? formatNumber(selectedPlan.aiReviewsPerMonth) : "0"}
                      </span>
                      <span className="opacity-70"> / month</span>
                    </div>
                  </div>

                  {selectedPlan.key === "free" ? (
                    <div className="space-y-2">
                      <Link to="/workflow" className="btn btn-primary w-full">
                        Start Free
                      </Link>
                      <div className="text-xs opacity-60">
                        Use guest mode instantly. Create an account later if you want AI review.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {user && currentPlan === selectedPlan.key ? (
                        <button className="btn btn-primary w-full" onClick={doPortal} disabled={portalBusy}>
                          {portalBusy ? "Opening…" : "Manage subscription"}
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary w-full"
                          onClick={() => doCheckout(selectedPlan.key as any)}
                          disabled={checkoutBusy !== null}
                          title={!user ? "Login required for checkout" : "Continue to Stripe Checkout"}
                        >
                          {checkoutBusy === selectedPlan.key ? "Redirecting…" : `Choose ${selectedPlan.title}`}
                        </button>
                      )}

                      {!user && (
                        <div className="text-xs opacity-60">
                          Checkout requires login. You’ll be sent to <span className="font-semibold">Account</span>.
                        </div>
                      )}

                      <Link to="/workflow" className="btn btn-outline w-full">
                        Try Workflow first
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Compare table */}
            <div className="card bg-base-100 border border-base-300 rounded-2xl">
              <div className="card-body space-y-4">
                <div className="flex items-end justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-2xl font-bold">Compare plans</h2>
                  </div>
                  <div className="badge badge-outline">
                    Selected: <span className="ml-1 font-semibold">{planLabel(selected)}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Feature</th>
                        {PLANS.map((p) => (
                          <th key={p.key}>
                            <div className={colEmphasisClass(selected, p.key)}>
                              <span className={p.key === "gold" ? "text-primary font-bold" : ""}>{p.title}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      <tr>
                        <td className="font-semibold">Upload Notion Markdown export</td>
                        {PLANS.map((p) => (
                          <td key={p.key}>
                            <div className={colEmphasisClass(selected, p.key)}>✅</div>
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td className="font-semibold">Parse Q&A + MCQ cards</td>
                        {PLANS.map((p) => (
                          <td key={p.key}>
                            <div className={colEmphasisClass(selected, p.key)}>✅</div>
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td className="font-semibold">Preview / Edit / Delete cards</td>
                        {PLANS.map((p) => (
                          <td key={p.key}>
                            <div className={colEmphasisClass(selected, p.key)}>✅</div>
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td className="font-semibold">Export as TSV</td>
                        {PLANS.map((p) => (
                          <td key={p.key}>
                            <div className={colEmphasisClass(selected, p.key)}>{p.key === "free" ? "✅" : "—"}</div>
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td className="font-semibold">Export as APKG</td>
                        {PLANS.map((p) => (
                          <td key={p.key}>
                            <div className={colEmphasisClass(selected, p.key)}>{p.key === "free" ? "—" : "✅"}</div>
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td className="font-semibold">Optional AI Review</td>
                        {PLANS.map((p) => (
                          <td key={p.key}>
                            <div className={colEmphasisClass(selected, p.key)}>{p.key === "free" ? "—" : "✅"}</div>
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td className="font-semibold">AI reviews / month</td>
                        {PLANS.map((p) => (
                          <td key={p.key}>
                            <div className={colEmphasisClass(selected, p.key)}>
                              {p.aiReviewsPerMonth ? formatNumber(p.aiReviewsPerMonth) : "0"}
                            </div>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="text-xs opacity-60">
                  Note: AI can be wrong — suggested changes should be reviewed (especially for technical content).
                </div>
              </div>
            </div>

            {/* FAQs */}
            <div className="card bg-base-100 border border-base-300 rounded-2xl">
              <div className="card-body space-y-2">
                <h3 className="text-xl font-bold">FAQ</h3>

                <details className="collapse collapse-arrow border border-base-300 bg-base-200/40 rounded-xl">
                  <summary className="collapse-title text-sm font-semibold">Do I need an account to use N2A?</summary>
                  <div className="collapse-content text-sm opacity-80">
                    No — you can use Workflow in guest mode. An account is required to subscribe, export in apkg format,
                    and utilise AI reviews.
                  </div>
                </details>

                <details className="collapse collapse-arrow border border-base-300 bg-base-200/40 rounded-xl">
                  <summary className="collapse-title text-sm font-semibold">What does AI review do?</summary>
                  <div className="collapse-content text-sm opacity-80">
                    Paid plans can ask AI to review content, formatting, or both. It’s designed to assist (not invent new
                    facts) but you should still double-check suggestions.
                  </div>
                </details>

                <details className="collapse collapse-arrow border border-base-300 bg-base-200/40 rounded-xl">
                  <summary className="collapse-title text-sm font-semibold">Can I cancel anytime?</summary>
                  <div className="collapse-content text-sm opacity-80">
                    Yes — manage your subscription by pressing the &quot;Manage subscription&quot; button. If you cancel,
                    your plan reverts to the Free Plan at the end of the billing period.
                  </div>
                </details>
              </div>
            </div>
          </div>

          {/* RIGHT: sticky summary / CTA (desktop) */}
          <aside className="hidden lg:block lg:sticky lg:top-24 space-y-4 min-w-0">
            <div className="card bg-base-100 border border-base-300 rounded-2xl">
              <div className="card-body space-y-3 min-w-0">
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="text-sm opacity-70">Selected plan</div>
                    <div className="text-2xl font-extrabold break-words">{selectedPlan.title}</div>
                    <div className="text-sm opacity-70 break-words">{selectedPlan.subtitle}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-base-300 bg-base-200/40 p-3 min-w-0">
                  <div className="text-sm opacity-70">Price</div>
                  <div className="text-3xl font-extrabold break-words">
                    {selectedPlan.priceLabel}
                    {selectedPlan.key !== "free" ? (
                      <span className="text-sm font-semibold opacity-70"> / month</span>
                    ) : null}
                  </div>
                  <div className="text-sm opacity-80 mt-1 break-words">
                    AI reviews:{" "}
                    <span className="font-semibold">
                      {selectedPlan.aiReviewsPerMonth ? formatNumber(selectedPlan.aiReviewsPerMonth) : "0"}
                    </span>
                    <span className="opacity-70"> / month</span>
                  </div>
                </div>

                {selectedPlan.key === "free" ? (
                  <div className="space-y-2">
                    <Link to="/workflow" className="btn btn-primary w-full">
                      Start Free
                    </Link>
                    <div className="text-xs opacity-60">
                      Use guest mode instantly. Create an account later if you want AI review.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {user && currentPlan === selectedPlan.key ? (
                      <button className="btn btn-primary w-full" onClick={doPortal} disabled={portalBusy}>
                        {portalBusy ? "Opening…" : "Manage subscription"}
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary w-full"
                        onClick={() => doCheckout(selectedPlan.key as any)}
                        disabled={checkoutBusy !== null}
                        title={!user ? "Login required for checkout" : "Continue to Stripe Checkout"}
                      >
                        {checkoutBusy === selectedPlan.key ? "Redirecting…" : `Choose ${selectedPlan.title}`}
                      </button>
                    )}

                    {!user && (
                      <div className="text-xs opacity-60">
                        Checkout requires login. You’ll be sent to <span className="font-semibold">Account</span>.
                      </div>
                    )}

                    <Link to="/workflow" className="btn btn-outline w-full">
                      Try Workflow first
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

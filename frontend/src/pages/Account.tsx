import React from "react";
import { signup, login, logout, requestPasswordReset, resetPassword } from "../auth";
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

function planCardClass(active: boolean) {
  return [
    "card rounded-2xl border transition-all duration-200",
    "bg-base-200/60 border-base-300",
    "hover:-translate-y-1 hover:bg-base-200 hover:border-primary/40",
    active ? "border-primary ring-1 ring-primary/30 bg-base-200" : "",
  ].join(" ");
}

export default function Account() {
  const { user, loading, refresh, setUser } = useAuth();

  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [resetEmail, setResetEmail] = React.useState("");
  const [resetToken, setResetToken] = React.useState("");
  const [newPass, setNewPass] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [resetBusy, setResetBusy] = React.useState(false);

  const [checkoutBusy, setCheckoutBusy] = React.useState<null | PlanKey>(null);

  const currentPlan: PlanKey = normalizePlan(user?.plan);

  async function submitAuth() {
    setErr(null);
    setBusy(true);
    try {
      if (mode === "signup") await signup(username || "User", email, password);
      else await login(email, password);

      await refresh(); // pulls /auth/me and updates cache + context
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    try {
      await logout();
    } catch {
      // ignore
    }
    setUser(null); // instant UI update
  }

  async function doCheckout(plan: "silver" | "gold" | "platinum") {
    setErr(null);
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
    try {
      const r = await apiFetch<{ url: string }>("/billing/portal", { method: "POST" });
      window.location.href = r.url;
    } catch (e: any) {
      setErr(e?.message || "Could not open portal");
    }
  }

  const usage = {
    cardsMadeThisMonth: Number((user as any)?.cards_made_this_month ?? (user as any)?.usage?.cards_made_this_month ?? 0),
    aiReviewedThisMonth: Number((user as any)?.ai_reviews_this_month ?? (user as any)?.usage?.ai_reviews_this_month ?? 0),
  };

  const plans: Array<{
    key: PlanKey;
    title: string;
    subtitle: string;
    features: string[];
    priceLabel: string;
  }> = [
    {
      key: "free",
      title: "Free",
      subtitle: "For trying N2A and basic workflows.",
      priceLabel: "$0",
      features: ["Upload Notion Markdown export", "Parse Q&A and MCQ cards", "Edit & export CSV for Anki", "No AI review"],
    },
    {
      key: "silver",
      title: "Silver",
      subtitle: "Light AI support for small batches.",
      priceLabel: "Monthly",
      features: ["Everything in Free", "AI review (starter limit)", "Priority improvements & fixes"],
    },
    {
      key: "gold",
      title: "Gold",
      subtitle: "Best value for regular studying.",
      priceLabel: "Monthly",
      features: ["Everything in Silver", "Higher AI review limits", "Faster iteration on features"],
    },
    {
      key: "platinum",
      title: "Platinum",
      subtitle: "Power users + heavy AI review.",
      priceLabel: "Monthly",
      features: ["Everything in Gold", "Highest AI review limits", "Early access to new tools"],
    },
  ];

  function PlanAction({ planKey }: { planKey: PlanKey }) {
    const isActive = currentPlan === planKey;

    if (!user) {
      return (
        <button
          className="btn btn-primary w-full"
          onClick={() => {
            const el = document.getElementById("account-auth-card");
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          Login to choose
        </button>
      );
    }

    if (planKey === "free") {
      return (
        <button className={`btn w-full ${isActive ? "btn-primary" : "btn-outline"}`} disabled>
          {isActive ? "Current plan" : "Free"}
        </button>
      );
    }

    if (isActive) {
      return (
        <button
          className="btn btn-primary w-full"
          onClick={doPortal}
          disabled={!(user as any)?.stripe_customer_id}
          title={!(user as any)?.stripe_customer_id ? "Stripe customer not linked yet" : ""}
        >
          Manage subscription
        </button>
      );
    }

    const isBusy = checkoutBusy === planKey;

    return (
      <button className="btn btn-outline w-full" onClick={() => doCheckout(planKey as "silver" | "gold" | "platinum")} disabled={!!checkoutBusy}>
        {isBusy ? "Redirecting…" : `Choose ${planLabel(planKey)}`}
      </button>
    );
  }

  // IMPORTANT: this prevents guest UI flashing while auth is being revalidated
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8 space-y-10">
      {/* Header band */}
      <section className="px-4 md:px-6 lg:px-8 py-10 bg-base-200">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Welcome, <span className="text-primary">{user ? (user as any).username : "Guest"}</span>
              </h1>
              <p className="opacity-80 mt-2 max-w-2xl">Manage your account, subscription, and AI review usage.</p>
            </div>

            {user && (
              <div className="flex gap-2 flex-wrap">
                <button
                  className="btn btn-outline"
                  onClick={doPortal}
                  disabled={!(user as any)?.stripe_customer_id}
                  title={!(user as any)?.stripe_customer_id ? "Stripe customer not linked yet" : ""}
                >
                  Manage subscription
                </button>
                <button className="btn" onClick={doLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main content band */}
      <section className="px-4 md:px-6 lg:px-8 pb-12 bg-base-100">
        <div className="max-w-6xl mx-auto space-y-10">
          {/* Top grid: Auth + Profile */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Auth card */}
            <div id="account-auth-card" className="card bg-base-200/60 border border-base-300 rounded-2xl">
              <div className="card-body space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="card-title text-2xl">Account</h2>
                  {!user && (
                    <div className="tabs tabs-boxed">
                      <a className={`tab ${mode === "login" ? "tab-active" : ""}`} onClick={() => setMode("login")}>
                        Login
                      </a>
                      <a className={`tab ${mode === "signup" ? "tab-active" : ""}`} onClick={() => setMode("signup")}>
                        Create
                      </a>
                    </div>
                  )}
                </div>

                {!user ? (
                  <>
                    <form
                      className="space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!busy) submitAuth();
                      }}
                    >
                      {mode === "signup" && (
                        <input className="input input-bordered w-full" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
                      )}

                      <input
                        className="input input-bordered w-full"
                        placeholder="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                      />

                      <input
                        className="input input-bordered w-full"
                        placeholder="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      />

                      {err && <div className="alert alert-error">{err}</div>}

                      <button className="btn btn-primary w-full" type="submit" disabled={busy}>
                        {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Login"}
                      </button>
                    </form>

                    <div className="divider">Password reset</div>
                    <div className="space-y-3">
                      <input
                        className="input input-bordered w-full"
                        placeholder="Email for reset"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        type="email"
                      />
                      <button
                        className="btn btn-outline w-full"
                        disabled={resetBusy || !resetEmail}
                        onClick={async () => {
                          setResetBusy(true);
                          try {
                            await requestPasswordReset(resetEmail);
                            setSent(true);
                          } finally {
                            setResetBusy(false);
                          }
                        }}
                      >
                        {resetBusy ? "Sending…" : "Send reset email"}
                      </button>
                      {sent && (
                        <div className="alert">
                          <span>If that email exists, a reset link was sent.</span>
                        </div>
                      )}
                    </div>

                    <details className="mt-2">
                      <summary className="cursor-pointer opacity-80">Reset with token (testing)</summary>

                      <form
                        className="mt-3 space-y-3"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!resetToken || !newPass) return;
                          await resetPassword(resetToken, newPass);
                          await refresh();
                        }}
                      >
                        <input className="input input-bordered w-full" placeholder="Reset token" value={resetToken} onChange={(e) => setResetToken(e.target.value)} />
                        <input
                          className="input input-bordered w-full"
                          placeholder="New password"
                          type="password"
                          value={newPass}
                          onChange={(e) => setNewPass(e.target.value)}
                        />
                        <button className="btn btn-primary w-full" type="submit">
                          Reset password
                        </button>
                      </form>
                    </details>
                  </>
                ) : (
                  <>
                    {err && <div className="alert alert-error">{err}</div>}
                    <div className="alert">
                      <span>You’re logged in.</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Profile card */}
            <div className="card bg-base-200/60 border border-base-300 rounded-2xl">
              <div className="card-body space-y-4">
                <h3 className="card-title text-2xl">Profile</h3>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-base-100 border border-base-300">
                    <div className="text-sm opacity-70">Username</div>
                    <div className="font-semibold text-lg">{user ? (user as any).username : "Guest"}</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-base-100 border border-base-300">
                    <div className="text-sm opacity-70">Email</div>
                    <div className="font-semibold text-lg">{user ? (user as any).email : "—"}</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-base-100 border border-base-300">
                    <div className="text-sm opacity-70">Tier</div>
                    <div className="font-semibold text-lg text-primary">{planLabel(currentPlan)}</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-base-100 border border-base-300">
                    <div className="text-sm opacity-70">Stripe linked</div>
                    <div className="font-semibold text-lg">{(user as any)?.stripe_customer_id ? "Yes" : "No"}</div>
                  </div>
                </div>

                <div className="divider">Usage</div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-base-100 border border-base-300">
                    <div className="text-sm opacity-70">Cards made (month)</div>
                    <div className="font-semibold text-2xl">{usage.cardsMadeThisMonth}</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-base-100 border border-base-300">
                    <div className="text-sm opacity-70">AI reviewed (month)</div>
                    <div className="font-semibold text-2xl">{usage.aiReviewedThisMonth}</div>
                  </div>
                </div>

                <p className="text-sm opacity-70">
                  If these stay at <span className="font-semibold">0</span>, we’ll wire them to real counters from the backend later.
                </p>
              </div>
            </div>
          </div>

          {/* Plans */}
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-2xl font-bold">Plans</h3>
                <p className="opacity-80 text-sm">Checkout is handled by your backend Stripe endpoints.</p>
              </div>
              {user && <div className="badge badge-primary badge-outline">Current: {planLabel(currentPlan)}</div>}
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
              {plans.map((p) => {
                const active = currentPlan === p.key;
                return (
                  <div key={p.key} className={planCardClass(active)}>
                    <div className="card-body flex flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xl font-bold">{p.title}</div>
                          <div className="text-sm opacity-70">{p.subtitle}</div>
                        </div>
                        {active && <div className="badge badge-primary">Current</div>}
                      </div>

                      <div className="mt-2 text-sm opacity-80 min-h-[24px]">
                        <span className="font-semibold">{p.priceLabel}</span>
                        {p.key !== "free" ? <span className="opacity-70"> / month</span> : null}
                      </div>

                      <div className="mt-3 flex-1">
                        <ul className="text-sm opacity-80 space-y-1 list-disc list-inside">
                          {p.features.map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-4">
                        <PlanAction planKey={p.key} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

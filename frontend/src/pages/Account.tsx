import React from "react";
import { signup, login, logout, requestPasswordReset, resetPassword } from "../auth";
import { apiFetch } from "../api";
import { useAuth } from "../auth_state";

type PlanKey = "free" | "silver" | "gold" | "platinum";

type UsageResponse = {
  ok: boolean;
  plan: string;
  usage: {
    month: string; // "YYYY-MM"
    cards_created_total: number;
    cards_created_this_month: number;
    ai_reviews_used_this_month: number;
    ai_reviews_limit_this_month: number;
    ai_reviews_remaining_this_month: number;
  };
};

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

// Convert "YYYY-MM" -> "01/MM/YYYY" (shows month in AU convention)
function formatUsageMonthAU(yyyyMm?: string | null) {
  const raw = String(yyyyMm || "").trim();
  const m = raw.match(/^(\d{4})-(\d{2})$/);
  if (!m) return raw || "—";
  const yyyy = m[1];
  const mm = m[2];
  return `01/${mm}/${yyyy}`;
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
  const [portalBusy, setPortalBusy] = React.useState(false);

  // ✅ usage comes from backend /usage/me, not from user
  const [usage, setUsage] = React.useState<UsageResponse["usage"] | null>(null);
  const [usageBusy, setUsageBusy] = React.useState(false);

  const currentPlan: PlanKey = normalizePlan(user?.plan);

  async function refreshUsage() {
    if (!user) {
      setUsage(null);
      return;
    }
    setUsageBusy(true);
    try {
      const r = await apiFetch<UsageResponse>("/usage/me");
      setUsage(r.usage);
    } catch {
      setUsage(null);
    } finally {
      setUsageBusy(false);
    }
  }

  React.useEffect(() => {
    if (!loading && user) void refreshUsage();
    if (!loading && !user) setUsage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  async function submitAuth() {
    setErr(null);
    setBusy(true);
    try {
      if (mode === "signup") await signup(username || "User", email, password);
      else await login(email, password);

      await refresh(); // refresh auth state
      await refreshUsage(); // refresh counters right away
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
    setUsage(null);
    setUser(null);
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
    setPortalBusy(true);
    try {
      const r = await apiFetch<{ url: string }>("/billing/portal", { method: "POST" });
      window.location.href = r.url;
    } catch (e: any) {
      setErr(e?.message || "Could not open portal");
      setPortalBusy(false);
    }
  }

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
      subtitle: "Everything you need to generate and export cards.",
      priceLabel: "$0",
      features: ["Upload Notion Markdown export", "Parse Q&A and MCQ cards", "Preview, edit & delete cards", "Export CSV for Anki"],
    },
    {
      key: "silver",
      title: "Silver",
      subtitle: "AI review for smaller projects.",
      priceLabel: "$5",
      features: ["Everything in Free", "Up to 2,000 AI reviews / month", "AI review modes: content / format / both", "Apply AI suggestions"],
    },
    {
      key: "gold",
      title: "Gold",
      subtitle: "Best value for regular studying.",
      priceLabel: "$7",
      features: ["Everything in Silver", "Up to 6,000 AI reviews / month", "AI review modes: content / format / both", "Apply AI suggestions"],
    },
    {
      key: "platinum",
      title: "Platinum",
      subtitle: "Power users + heavy AI review.",
      priceLabel: "$10",
      features: ["Everything in Gold", "Up to 12,000 AI reviews / month", "AI review modes: content / format / both", "Apply AI suggestions"],
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
        <div className="space-y-2">
          <button className="btn btn-primary w-full" onClick={doPortal} disabled={portalBusy}>
            {portalBusy ? "Opening…" : "Manage / cancel subscription"}
          </button>
          <div className="text-xs opacity-70">
            Cancel or change plans in the Stripe Customer Portal. If you cancel, your plan will revert to{" "}
            <span className="font-semibold">Free</span> at the end of the current billing period.
          </div>
        </div>
      );
    }

    const isBusy = checkoutBusy === planKey;

    return (
      <button className="btn btn-outline w-full" onClick={() => doCheckout(planKey as any)} disabled={!!checkoutBusy}>
        {isBusy ? "Redirecting…" : `Choose ${planLabel(planKey)}`}
      </button>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  const aiUsed = usage?.ai_reviews_used_this_month ?? 0;
  const aiLimit = usage?.ai_reviews_limit_this_month ?? 0;
  const aiRemaining = usage?.ai_reviews_remaining_this_month ?? 0;

  const cardsTotal = usage?.cards_created_total ?? 0;
  const cardsThisMonth = usage?.cards_created_this_month ?? 0;

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8 space-y-10">
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
                <button className="btn btn-outline" onClick={doPortal} disabled={portalBusy}>
                  {portalBusy ? "Opening…" : "Manage / cancel subscription"}
                </button>

                <button className="btn btn-outline" onClick={refreshUsage} disabled={usageBusy}>
                  {usageBusy ? "Refreshing…" : "Refresh usage"}
                </button>

                <button className="btn" onClick={doLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="px-4 md:px-6 lg:px-8 pb-12 bg-base-100">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="grid lg:grid-cols-2 gap-6">
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
                      <span />
                    </div>
                  )}
                </div>

                {!user ? (
                  <>
                    <form
                      className="space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!busy) void submitAuth();
                      }}
                    >
                      {mode === "signup" && (
                        <input
                          className="input input-bordered w-full"
                          placeholder="Username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                        />
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
                          await refreshUsage();
                        }}
                      >
                        <input
                          className="input input-bordered w-full"
                          placeholder="Reset token"
                          value={resetToken}
                          onChange={(e) => setResetToken(e.target.value)}
                        />
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

                  {/* ✅ removed Stripe linked box */}
                </div>

                <div className="divider">Usage</div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-base-100 border border-base-300">
                    <div className="text-sm opacity-70">Cards created (total)</div>
                    <div className="font-semibold text-2xl">{cardsTotal}</div>
                    <div className="text-xs opacity-60 mt-1">This month: {cardsThisMonth}</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-base-100 border border-base-300">
                    <div className="text-sm opacity-70">AI reviews (this month)</div>
                    <div className="font-semibold text-2xl">
                      {aiUsed} / {aiLimit}
                    </div>
                    <div className="text-xs opacity-60 mt-1">Remaining: {aiRemaining}</div>
                  </div>
                </div>

                {!user ? null : usageBusy ? (
                  <p className="text-sm opacity-70">Refreshing usage…</p>
                ) : usage ? (
                  <p className="text-sm opacity-70">
                    Usage month: <span className="font-semibold">{formatUsageMonthAU(usage.month)}</span>
                  </p>
                ) : (
                  <p className="text-sm opacity-70">
                    Usage not available yet (check that <span className="font-semibold">/usage/me</span> is deployed).
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-2xl font-bold">Plans</h3>
                <p className="opacity-80 text-sm">
                  Upgrade for AI Review. You can change or cancel any time via the Stripe Customer Portal.
                </p>
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

            {/* ✅ explicit cancel hint (without changing Stripe/auth logic) */}
            {user && currentPlan !== "free" && (
              <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4">
                <div className="font-semibold">Cancel subscription</div>
                <div className="text-sm opacity-80 mt-1">
                  To cancel, open <span className="font-semibold">Manage / cancel subscription</span> above. Stripe will
                  handle cancellation and billing. After cancellation, your plan will revert to{" "}
                  <span className="font-semibold">Free</span> at the end of your billing period.
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

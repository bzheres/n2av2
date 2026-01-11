import React from "react";
import { me, signup, login, logout, requestPasswordReset, resetPassword } from "../auth";
import { apiFetch } from "../api";

type PlanKey = "free" | "silver" | "gold" | "platinum";

function planLabel(p?: string): { key: PlanKey; label: string } {
  const s = String(p || "").toLowerCase();

  if (s.includes("platinum") || s.includes("premium")) return { key: "platinum", label: "Platinum" };
  if (s.includes("gold")) return { key: "gold", label: "Gold" };
  if (s.includes("silver")) return { key: "silver", label: "Silver" };
  return { key: "free", label: "Free" };
}

function badgeClass(key: PlanKey) {
  // keep it simple / consistent with daisy
  if (key === "platinum") return "badge badge-primary";
  if (key === "gold") return "badge badge-secondary";
  if (key === "silver") return "badge badge-accent";
  return "badge badge-outline";
}

export default function Account() {
  const [user, setUser] = React.useState<any>(null);
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  const [resetEmail, setResetEmail] = React.useState("");
  const [resetToken, setResetToken] = React.useState("");
  const [newPass, setNewPass] = React.useState("");
  const [sent, setSent] = React.useState(false);

  async function refresh() {
    try {
      const r = await me();
      setUser(r.user);
    } catch {
      setUser(null);
    }
  }
  React.useEffect(() => {
    refresh();
  }, []);

  async function submit() {
    setErr(null);
    try {
      if (mode === "signup") await signup(username || "User", email, password);
      else await login(email, password);
      await refresh();
    } catch (e: any) {
      setErr(e.message || "Failed");
    }
  }

  async function doLogout() {
    await logout().catch(() => {});
    await refresh();
  }

  async function doCheckout(priceId: string) {
    const r = await apiFetch<{ url: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ price_id: priceId }),
    });
    window.location.href = r.url;
  }

  async function doPortal() {
    const r = await apiFetch<{ url: string }>("/billing/portal", { method: "POST" });
    window.location.href = r.url;
  }

  const planInfo = planLabel(user?.plan);
  const cardsMadeThisMonth = Number(user?.cards_this_month ?? 0);
  const aiReviewedThisMonth = Number(user?.ai_reviewed_this_month ?? 0);

  const prices = {
    silver: import.meta.env.VITE_STRIPE_PRICE_SILVER as string,
    gold: import.meta.env.VITE_STRIPE_PRICE_GOLD as string,
    platinum: import.meta.env.VITE_STRIPE_PRICE_PLATINUM as string,
  };

  const currentPlanKey = planInfo.key;

  return (
    <div className="-mx-4 md:-mx-6 lg:-mx-8">
      {/* INTRO BAND */}
      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-200">
        <div className="max-w-6xl mx-auto space-y-3 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Welcome,{" "}
            <span className="text-primary">
              {user ? user.username : "Guest"}
            </span>
          </h1>
          <p className="opacity-80 max-w-2xl mx-auto">
            Log in to manage your subscription and unlock AI review. Guest mode still lets you parse, edit, and export.
          </p>
        </div>
      </section>

      {/* MAIN CONTENT BAND */}
      <section className="px-4 md:px-6 lg:px-8 py-10 md:py-12 bg-base-100">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-5 space-y-6">
            {/* AUTH CARD (only when logged out) */}
            {!user && (
              <div className="card bg-base-200/60 border border-base-300 rounded-2xl">
                <div className="card-body space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-2xl font-bold">Account</h2>
                    <div className="tabs tabs-boxed">
                      <a
                        className={`tab ${mode === "login" ? "tab-active" : ""}`}
                        onClick={() => setMode("login")}
                      >
                        Login
                      </a>
                      <a
                        className={`tab ${mode === "signup" ? "tab-active" : ""}`}
                        onClick={() => setMode("signup")}
                      >
                        Create
                      </a>
                    </div>
                  </div>

                  {mode === "signup" && (
                    <input
                      className="input input-bordered"
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  )}

                  <input
                    className="input input-bordered"
                    placeholder="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />

                  <input
                    className="input input-bordered"
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />

                  {err && <div className="alert alert-error">{err}</div>}

                  <button className="btn btn-primary w-full" onClick={submit}>
                    {mode === "signup" ? "Create account" : "Login"}
                  </button>

                  <div className="divider">Password reset</div>

                  <div className="space-y-2">
                    <input
                      className="input input-bordered w-full"
                      placeholder="Email for reset"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                    />
                    <button
                      className="btn btn-outline w-full"
                      onClick={async () => {
                        await requestPasswordReset(resetEmail);
                        setSent(true);
                      }}
                    >
                      Send reset email
                    </button>
                    {sent && (
                      <div className="alert">
                        <span>If that email exists, a reset link was sent.</span>
                      </div>
                    )}
                  </div>

                  {/* Keep your existing testing reset UI (does not affect normal users) */}
                  <div className="divider">Reset with token (testing)</div>
                  <input
                    className="input input-bordered"
                    placeholder="Reset token"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                  />
                  <input
                    className="input input-bordered"
                    placeholder="New password"
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                  />
                  <button
                    className="btn btn-primary w-full"
                    onClick={async () => {
                      await resetPassword(resetToken, newPass);
                      await refresh();
                    }}
                  >
                    Reset password
                  </button>
                </div>
              </div>
            )}

            {/* PROFILE CARD (only when logged in) */}
            {user && (
              <div className="card bg-base-200/60 border border-base-300 rounded-2xl">
                <div className="card-body space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold">Profile</h2>
                      <div className="opacity-75 text-sm mt-1">{user.email}</div>
                    </div>

                    <div className={`shrink-0 ${badgeClass(planInfo.key)}`}>
                      {planInfo.label}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                      <div className="text-sm opacity-70">Cards made (this month)</div>
                      <div className="text-3xl font-extrabold mt-1">{cardsMadeThisMonth}</div>
                    </div>

                    <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                      <div className="text-sm opacity-70">AI reviews (this month)</div>
                      <div className="text-3xl font-extrabold mt-1">{aiReviewedThisMonth}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn btn-outline"
                      onClick={doPortal}
                      disabled={!user?.stripe_customer_id}
                      title={!user?.stripe_customer_id ? "No Stripe customer yet (subscribe first)." : ""}
                    >
                      Manage subscription
                    </button>
                    <button className="btn" onClick={doLogout}>
                      Logout
                    </button>
                  </div>

                  <div className="text-xs opacity-70 leading-relaxed">
                    Tip: If you’re on a paid plan, you’ll be able to use AI review in the Workflow page.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: PLANS */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Plans</h2>
                <p className="opacity-80 text-sm">
                  Choose a tier that fits your volume. Stripe checkout is handled securely by the backend.
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* FREE */}
              <div className="card bg-base-200/60 border border-base-300 rounded-2xl">
                <div className="card-body space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">Free</h3>
                    <span className={badgeClass("free")}>Default</span>
                  </div>
                  <ul className="text-sm opacity-80 space-y-2 list-disc pl-5">
                    <li>Upload Notion Markdown</li>
                    <li>Parse Q&amp;A + MCQ cards</li>
                    <li>Edit and export CSV</li>
                    <li>Manual review workflow</li>
                  </ul>

                  <button className="btn w-full" disabled>
                    {currentPlanKey === "free" ? "Current plan" : "Included"}
                  </button>
                </div>
              </div>

              {/* SILVER */}
              <div className="card bg-base-200/60 border border-base-300 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:bg-base-200">
                <div className="card-body space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">Silver</h3>
                    <span className={badgeClass("silver")}>Starter</span>
                  </div>
                  <ul className="text-sm opacity-80 space-y-2 list-disc pl-5">
                    <li>Everything in Free</li>
                    <li>AI review (up to 3,000 cards / month)</li>
                    <li>Faster iteration during review</li>
                  </ul>

                  <button
                    className="btn btn-primary w-full"
                    disabled={!user || !prices.silver || currentPlanKey === "silver"}
                    onClick={() => doCheckout(prices.silver)}
                    title={!user ? "Login required" : ""}
                  >
                    {currentPlanKey === "silver" ? "Current plan" : "Choose Silver"}
                  </button>
                </div>
              </div>

              {/* GOLD */}
              <div className="card bg-base-200/60 border border-base-300 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:bg-base-200">
                <div className="card-body space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">Gold</h3>
                    <span className={badgeClass("gold")}>Power</span>
                  </div>
                  <ul className="text-sm opacity-80 space-y-2 list-disc pl-5">
                    <li>Everything in Silver</li>
                    <li>AI review (up to 5,000 cards / month)</li>
                    <li>Best for large weekly imports</li>
                  </ul>

                  <button
                    className="btn btn-primary w-full"
                    disabled={!user || !prices.gold || currentPlanKey === "gold"}
                    onClick={() => doCheckout(prices.gold)}
                    title={!user ? "Login required" : ""}
                  >
                    {currentPlanKey === "gold" ? "Current plan" : "Choose Gold"}
                  </button>
                </div>
              </div>

              {/* PLATINUM */}
              <div className="card bg-base-200/60 border border-base-300 rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:bg-base-200">
                <div className="card-body space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">Platinum</h3>
                    <span className={badgeClass("platinum")}>Max</span>
                  </div>
                  <ul className="text-sm opacity-80 space-y-2 list-disc pl-5">
                    <li>Everything in Gold</li>
                    <li>AI review (up to 10,000 cards / month)</li>
                    <li>Built for heavy study workflows</li>
                  </ul>

                  <button
                    className="btn btn-primary w-full"
                    disabled={!user || !prices.platinum || currentPlanKey === "platinum"}
                    onClick={() => doCheckout(prices.platinum)}
                    title={!user ? "Login required" : ""}
                  >
                    {currentPlanKey === "platinum" ? "Current plan" : "Choose Platinum"}
                  </button>
                </div>
              </div>
            </div>

            {!user && (
              <div className="alert">
                <span>Login required to subscribe. You can still use the Workflow as a guest.</span>
              </div>
            )}

            {(user && !user?.stripe_customer_id) && (
              <div className="text-xs opacity-70">
                Note: “Manage subscription” becomes available after the first successful checkout (Stripe customer is created).
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

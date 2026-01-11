import React from "react";
import { me, signup, login, logout, requestPasswordReset, resetPassword } from "../auth";
import { apiFetch } from "../api";

export default function Account(){
  const [user,setUser]=React.useState<any>(null);
  const [mode,setMode]=React.useState<"login"|"signup">("login");
  const [username,setUsername]=React.useState("");
  const [email,setEmail]=React.useState("");
  const [password,setPassword]=React.useState("");
  const [err,setErr]=React.useState<string|null>(null);

  const [resetEmail,setResetEmail]=React.useState("");
  const [resetToken,setResetToken]=React.useState("");
  const [newPass,setNewPass]=React.useState("");
  const [sent,setSent]=React.useState(false);

  async function refresh(){ try{ const r=await me(); setUser(r.user);} catch{ setUser(null);} }
  React.useEffect(()=>{ refresh(); },[]);

  async function submit(){
    setErr(null);
    try{
      if(mode==="signup") await signup(username||"User", email, password);
      else await login(email, password);
      await refresh();
    }catch(e:any){ setErr(e.message||"Failed"); }
  }
  async function doLogout(){ await logout().catch(()=>{}); await refresh(); }

  async function doCheckout(priceId:string){
    const r = await apiFetch<{url:string}>("/billing/checkout", {method:"POST", body: JSON.stringify({price_id: priceId})});
    window.location.href = r.url;
  }

  async function doPortal(){
    const r = await apiFetch<{url:string}>("/billing/portal", {method:"POST"});
    window.location.href = r.url;
  }

  return (
    <div className="max-w-4xl mx-auto grid lg:grid-cols-2 gap-6">
      <div className="card bg-base-200 rounded-2xl border border-base-100">
        <div className="card-body space-y-3">
          <h2 className="card-title text-2xl">
            Welcome, {" "}
            <span className={'text-primary ${user ? "font-semibold" : "opacity-80"}'}>
            {user ? user.username : "Guest"}
            </span>  
          </h2>

          {!user && (
            <>
              <div className="tabs tabs-boxed">
                <a className={`tab ${mode==="login"?"tab-active":""}`} onClick={()=>setMode("login")}>Login</a>
                <a className={`tab ${mode==="signup"?"tab-active":""}`} onClick={()=>setMode("signup")}>Create</a>
              </div>

              {mode==="signup" && (
                <input className="input input-bordered" placeholder="Username" value={username} onChange={(e)=>setUsername(e.target.value)} />
              )}
              <input className="input input-bordered" placeholder="Email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} />
              <input className="input input-bordered" placeholder="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
              {err && <div className="alert alert-error">{err}</div>}
              <button className="btn btn-primary" onClick={submit}>{mode==="signup"?"Create account":"Login"}</button>

              <div className="divider">Password reset</div>
              <input className="input input-bordered" placeholder="Email for reset" value={resetEmail} onChange={(e)=>setResetEmail(e.target.value)} />
              <button className="btn btn-outline" onClick={async()=>{ await requestPasswordReset(resetEmail); setSent(true); }}>Send reset email</button>
              {sent && <div className="alert"><span>If that email exists, a reset link was sent.</span></div>}
            </>
          )}

          {user && (
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-outline" onClick={doPortal} disabled={!user?.stripe_customer_id}>Manage subscription</button>
              <button className="btn" onClick={doLogout}>Logout</button>
            </div>
          )}

          <div className="divider">Reset with token (testing)</div>
          <input className="input input-bordered" placeholder="Reset token" value={resetToken} onChange={(e)=>setResetToken(e.target.value)} />
          <input className="input input-bordered" placeholder="New password" type="password" value={newPass} onChange={(e)=>setNewPass(e.target.value)} />
          <button className="btn btn-primary" onClick={async()=>{ await resetPassword(resetToken,newPass); await refresh(); }}>Reset password</button>
        </div>
      </div>

      <div className="card bg-base-200 rounded-2xl border border-base-100">
        <div className="card-body space-y-3">
          <h3 className="card-title">Plans</h3>
          <p className="opacity-80 text-sm">Login required. Checkout handled by backend Stripe.</p>
          <button className="btn btn-primary" disabled={!user} onClick={()=>doCheckout(import.meta.env.VITE_STRIPE_PRICE_SILVER)}>Silver (3000/mo)</button>
          <button className="btn btn-primary" disabled={!user} onClick={()=>doCheckout(import.meta.env.VITE_STRIPE_PRICE_GOLD)}>Gold (5000/mo)</button>
          <button className="btn btn-primary" disabled={!user} onClick={()=>doCheckout(import.meta.env.VITE_STRIPE_PRICE_PLATINUM)}>Platinum (10000/mo)</button>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { Link, NavLink } from "react-router-dom";
import { me, logout } from "../auth";

const THEMES = ["light","dark","cupcake","corporate","synthwave","retro","cyberpunk","dracula","night","coffee"];

export default function Navbar() {
  const [user, setUser] = React.useState<any>(null);
  const [theme, setTheme] = React.useState<string>(() => localStorage.getItem("n2a_theme") || "dark");

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("n2a_theme", theme);
  }, [theme]);

  React.useEffect(() => { me().then(r => setUser(r.user)).catch(()=>setUser(null)); }, []);

  async function doLogout() {
    try { await logout(); } catch {}
    setUser(null);
    window.location.href = "/account";
  }

  return (
    <div className="navbar bg-base-100 border-b border-base-200 sticky top-0 z-50">
      <div className="navbar-start">
        <Link to="/" className="btn btn-ghost text-xl">N2A</Link>
        <div className="hidden md:flex">
          <ul className="menu menu-horizontal px-1">
            <li><NavLink to="/instructions">Instructions</NavLink></li>
            <li><NavLink to="/workflow">Workflow</NavLink></li>
            <li><NavLink to="/contact">Contact</NavLink></li>
            <li><NavLink to="/about">About</NavLink></li>
          </ul>
        </div>
      </div>
      <div className="navbar-end gap-2">
        <select className="select select-bordered select-sm" value={theme} onChange={(e)=>setTheme(e.target.value)}>
          {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <Link to="/account" className="btn btn-outline btn-sm">{user ? user.username : "Login"}</Link>
        {user && <button className="btn btn-ghost btn-sm" onClick={doLogout}>Logout</button>}
      </div>
    </div>
  );
}

import React from "react";
import { Link, NavLink } from "react-router-dom";
import { me, logout } from "../auth";

const THEMES = [
  // Core / most useful
  "light",
  "dim",
  "black",
  "dark",
  "night",
  "luxury",
  "forest",
  "business",
  "corporate",

  // Friendly / branded / aesthetic
  "valentine",
  "cupcake",
  "dracula",
  "emerald",
  "synthwave",
  "pastel",

  // Everything else
  "coffee",
  "retro",
  "cyberpunk",
  "halloween",
  "garden",
  "aqua",
  "lofi",
  "fantasy",
  "wireframe",
  "cmyk",
  "autumn",
  "acid",
  "lemonade",
  "winter"
];

export default function Navbar() {
  const [user, setUser] = React.useState<any>(null);
  const [theme, setTheme] = React.useState<string>(() => localStorage.getItem("n2a_theme") || "dark");

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("n2a_theme", theme);
  }, [theme]);

  // Load user once on mount
  React.useEffect(() => {
    me().then(r => setUser(r.user)).catch(() => setUser(null));
  }, []);

  async function doLogout() {
    try { await logout(); } catch {}
    setUser(null);
    window.location.href = "/account";
  }

  const navLinks = (
    <>
      <li><NavLink to="/instructions">Instructions</NavLink></li>
      <li><NavLink to="/workflow">Workflow</NavLink></li>
      <li><NavLink to="/contact">Contact</NavLink></li>
      <li><NavLink to="/about">About</NavLink></li>
    </>
  );

  return (
    <div className="navbar bg-base-100 border-b border-base-200 sticky top-0 z-50">
      {/* LEFT: Mobile dropdown + Brand */}
      <div className="navbar-start">
        {/* Mobile dropdown (shows <lg) */}
        <div className="dropdown lg:hidden">
          <label tabIndex={0} className="btn btn-ghost btn-circle">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </label>

          <ul
            tabIndex={0}
            className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-200 rounded-box w-56"
          >
            {navLinks}
            <li className="mt-2">
              <Link to="/account" className="btn btn-primary btn-sm w-full">
                {user ? user.username : "Login"}
              </Link>
            </li>
            {user && (
              <li className="mt-1">
                <button className="btn btn-ghost btn-sm w-full" onClick={doLogout}>
                  Logout
                </button>
              </li>
            )}
          </ul>
        </div>

        {/* Brand */}
        <Link to="/" className="btn btn-ghost px-2">
          <img
            src="/logo.svg"
            alt="N2A"
            className="h-8 w-auto md:h-9 lg:h-10 opacity-90 hover:opacity-100"
          />
        </Link>
      </div>

      {/* CENTER: Desktop nav (shows lg+) */}
      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal px-1 gap-1">
          {navLinks}
        </ul>
      </div>

      {/* RIGHT: Theme + Login/User + Logout (desktop) */}
      <div className="navbar-end gap-2">
        <select
          className="select select-bordered select-sm"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        >
          {THEMES.map(t => (
            <option key={t} value={t}>
             {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        <Link to="/account" className="btn btn-primary btn-sm">
          {user ? user.username : "Login"}
        </Link>

        {user && (
          <button className="btn btn-ghost btn-sm" onClick={doLogout}>
            Logout
          </button>
        )}
      </div>
    </div>
  );
}

// src/App.tsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import { useAuth } from "./auth_state";

// import your pages
import Home from "./pages/Home";
import Workflow from "./pages/Workflow";
import Account from "./pages/Account";
import Instructions from "./pages/Instructions";
import About from "./pages/About";
import Contact from "./pages/Contact";

// import your layout/nav if you have them
import Navbar from "./components/Navbar";

export default function App() {
  const { loading } = useAuth();

  // ✅ global render guard: no navbar/routes until auth is known
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/workflow" element={<Workflow />} />
        <Route path="/instructions" element={<Instructions />} />
        <Route path="/account" element={<Account />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
    </>
  );
}

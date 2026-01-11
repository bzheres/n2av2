import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Instructions from "./pages/Instructions";
import Workflow from "./pages/Workflow";
import Account from "./pages/Account";
import Contact from "./pages/Contact";
import About from "./pages/About";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-base-100">
      <Navbar />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/instructions" element={<Instructions />} />
          <Route path="/workflow" element={<Workflow />} />
          <Route path="/account" element={<Account />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

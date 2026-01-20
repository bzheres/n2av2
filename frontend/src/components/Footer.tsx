// src/components/Footer.tsx
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer footer-center p-6 bg-base-200 text-base-content">
      <aside className="space-y-2">
        <p>© 2026 N2A</p>

        <div className="flex gap-4">
          <Link className="link" to="/contact">
            Contact Us
          </Link>

          <a
            href="https://www.instagram.com/n2a.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="link"
          >
            Instagram
          </a>
        </div>
      </aside>
    </footer>
  );
}

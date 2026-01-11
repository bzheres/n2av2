import { Link } from "react-router-dom";
export default function Footer() {
  return (
    <footer className="footer footer-center p-6 bg-base-200 text-base-content">
      <aside>
        <p>© 2026 N2A</p>
        <p><Link className="link" to="/contact">Contact Us</Link></p>
      </aside>
    </footer>
  );
}

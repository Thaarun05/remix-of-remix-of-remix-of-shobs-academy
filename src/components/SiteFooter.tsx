import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { Logo } from "@/components/Logo";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3">
            <Logo size="sm" className="h-12 w-auto" />
            <span className="font-serif text-xl font-bold">Shobs Academy</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-primary-foreground/75">
            Personalised online tutoring for K-12 students. Live one-to-one classes,
            structured worksheets and regular progress reporting for parents.
          </p>
        </div>

        <nav aria-label="Footer navigation">
          <h2 className="font-serif text-sm font-bold uppercase tracking-wider text-primary-foreground">
            Explore
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm text-primary-foreground/75">
            <li><Link to="/" className="hover:text-primary-foreground hover:underline">Home</Link></li>
            <li><Link to="/about" className="hover:text-primary-foreground hover:underline">About us</Link></li>
            <li><Link to="/student-login" className="hover:text-primary-foreground hover:underline">Student portal</Link></li>
            <li><Link to="/teacher-login" className="hover:text-primary-foreground hover:underline">Teacher portal</Link></li>
            <li><Link to="/admin-login" className="hover:text-primary-foreground hover:underline">Admin portal</Link></li>
          </ul>
        </nav>

        <div>
          <h2 className="font-serif text-sm font-bold uppercase tracking-wider text-primary-foreground">
            Contact
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm text-primary-foreground/75">
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <a href="mailto:shobaraju@shobsacademy.com" className="break-all hover:text-primary-foreground hover:underline">
                shobaraju@shobsacademy.com
              </a>
            </li>
            <li className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <a href="mailto:shobsacademy@gmail.com" className="break-all hover:text-primary-foreground hover:underline">
                shobsacademy@gmail.com
              </a>
            </li>
            <li className="pt-1 text-primary-foreground/60">Coimbatore, India</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-primary-foreground/15">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-primary-foreground/65 sm:flex-row">
          <p>&copy; {year} Shobs Academy. All rights reserved.</p>
          <p>Online tutoring for students worldwide.</p>
        </div>
      </div>
    </footer>
  );
}

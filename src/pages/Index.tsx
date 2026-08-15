import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  GraduationCap, Users, Shield, ArrowRight, Globe2, CalendarCheck,
  LineChart, ClipboardList, MessageSquare, BookOpen,
} from "lucide-react";
import { DemoRequestForm } from "@/components/DemoRequestForm";
import { Logo } from "@/components/Logo";
import { Navbar } from "@/components/Navbar";
import { SiteFooter } from "@/components/SiteFooter";
import { useAuth } from "@/contexts/AuthContext";
import { Seo } from "@/components/Seo";

const countries = [
  { flagUrl: "https://flagcdn.com/w320/us.png", code: "US", name: "USA", description: "Students across multiple states" },
  { flagUrl: "https://flagcdn.com/w320/ca.png", code: "CA", name: "Canada", description: "Growing student base in Canada" },
  { flagUrl: "https://flagcdn.com/w320/au.png", code: "AU", name: "Australia", description: "Sessions across Australia and Oceania" },
  { flagUrl: "https://flagcdn.com/w320/nl.png", code: "NL", name: "Netherlands", description: "Supporting students in the Netherlands" },
  { flagUrl: "https://flagcdn.com/w320/nz.png", code: "NZ", name: "New Zealand", description: "Expanding across New Zealand" },
  { flagUrl: "https://flagcdn.com/w320/in.png", code: "IN", name: "India", description: "Headquarters in Coimbatore" },
  { flagUrl: "https://flagcdn.com/w320/ae.png", code: "AE", name: "Dubai", description: "Serving the UAE and Middle East" },
  { flagUrl: "https://flagcdn.com/w320/sg.png", code: "SG", name: "Singapore", description: "Southeast Asian education hub" },
];

const pillars = [
  { icon: Users, title: "One-to-one teaching", body: "Every session is led by a subject specialist working with a single student, so pace and explanation adapt in real time." },
  { icon: ClipboardList, title: "Structured practice", body: "Worksheets, quizzes and homework are set after each class and tracked to completion instead of being left to chance." },
  { icon: LineChart, title: "Visible progress", body: "Attendance, submissions and quiz scores are recorded in the portal, so parents can see exactly how term is going." },
  { icon: CalendarCheck, title: "Timetables that fit", body: "Classes are scheduled around your time zone and school commitments, with reschedules handled through the portal." },
  { icon: MessageSquare, title: "Direct communication", body: "Message your teacher or the academy office from inside the portal — no chasing across apps and inboxes." },
  { icon: BookOpen, title: "Wide subject cover", body: "Mathematics, Physics, Chemistry, Biology, English and standardised test preparation for K-12 and beyond." },
];

const steps = [
  { step: "01", title: "Book a free demo", body: "Tell us the student's year group, subject and goals. We arrange a no-obligation trial lesson." },
  { step: "02", title: "Meet your teacher", body: "The demo doubles as an assessment. The teacher identifies gaps and proposes a plan for the term." },
  { step: "03", title: "Start regular classes", body: "Lessons run to an agreed timetable with worksheets, quizzes and attendance logged after every session." },
  { step: "04", title: "Track the results", body: "Parents and students follow attendance, submissions and scores in the portal and receive regular updates." },
];

const portals = [
  { to: "/student-login", icon: GraduationCap, iconWrap: "bg-student/10 border-student/20", iconColor: "text-student", title: "Student portal", body: "Class links, assignments, worksheets, quizzes and attendance in one place.", variant: "student" as const },
  { to: "/teacher-login", icon: Users, iconWrap: "bg-teacher/10 border-teacher/20", iconColor: "text-teacher", title: "Teacher portal", body: "Record attendance, set work, build worksheets and message students.", variant: "teacher" as const },
  { to: "/admin-login", icon: Shield, iconWrap: "bg-admin/10 border-admin/20", iconColor: "text-admin", title: "Admin portal", body: "Manage accounts, fees, teacher submissions and academy-wide reporting.", variant: "admin" as const },
];

const Index = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && role) navigate(`/${role}`, { replace: true });
  }, [user, role, loading, navigate]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Seo
        title="Shobs Academy — Expert Online Tutoring for K-12"
        description="Personalised one-to-one online tutoring for K-12 students in Maths, Science and English. Live classes, worksheets, quizzes and progress tracking from expert teachers."
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          name: "Shobs Academy",
          url: "https://learn-together-hub-16.lovable.app/",
          description: "Personalised one-to-one online tutoring for K-12 students.",
          areaServed: countries.map((c) => c.name),
        }}
      />
      <Navbar showAboutLink={true} />

      <main id="main-content">
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-border bg-primary text-primary-foreground">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(900px 420px at 15% 0%, hsl(var(--primary-glow) / 0.35), transparent 60%), radial-gradient(700px 380px at 90% 20%, hsl(var(--gold) / 0.18), transparent 60%)",
            }}
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-28 md:grid-cols-[1.1fr_0.9fr] md:pb-24 md:pt-32">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]">
                <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
                Teaching students in 8 countries
              </p>
              <h1 className="font-serif text-4xl font-bold leading-[1.1] sm:text-5xl md:text-6xl">
                Shobs Academy
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-primary-foreground/85">
                Expert-led online tutoring for K-12. Personalised lesson plans, live one-to-one
                classes and honest progress reporting — so students master concepts, build
                confidence and earn better grades.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <DemoRequestForm />
                <Link to="/about">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-primary-foreground/35 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  >
                    How we teach
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
              </div>
              <p className="mt-5 text-sm text-primary-foreground/70">
                Free trial lesson · No card required · Flexible timetables across time zones
              </p>
            </div>

            <div className="relative hidden justify-self-center md:block">
              <div className="rounded-2xl border border-primary-foreground/20 bg-primary-foreground/[0.07] p-10 backdrop-blur-sm">
                <Logo size="lg" className="mx-auto" />
                <p className="mt-6 text-center font-serif text-lg italic text-primary-foreground/85">
                  Guiding students to academic excellence
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SIGN IN STRIP */}
        <div className="border-b border-border bg-secondary">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-6 py-3 text-sm">
            <span className="font-medium text-muted-foreground">Already with us? Sign in as</span>
            <Link to="/student-login" className="font-semibold text-student hover:underline">Student</Link>
            <span aria-hidden="true" className="text-border">|</span>
            <Link to="/teacher-login" className="font-semibold text-teacher hover:underline">Teacher</Link>
            <span aria-hidden="true" className="text-border">|</span>
            <Link to="/admin-login" className="font-semibold text-admin hover:underline">Admin</Link>
          </div>
        </div>

        {/* WHAT WE DO */}
        <section className="px-6 py-20" aria-labelledby="approach-heading">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Our approach</p>
              <h2 id="approach-heading" className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
                Tutoring that is planned, tracked and accountable
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Good tutoring is more than a weekly call. Every Shobs Academy student gets a plan,
                written practice between lessons and a record that parents can actually inspect.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {pillars.map(({ icon: Icon, title, body }) => (
                <article key={title} className="rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-y border-border bg-secondary/60 px-6 py-20" aria-labelledby="how-heading">
          <div className="mx-auto max-w-6xl">
            <h2 id="how-heading" className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              From first enquiry to steady progress, the path is the same for every family.
            </p>
            <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map(({ step, title, body }) => (
                <li key={step} className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <span className="font-mono text-sm font-semibold text-primary">{step}</span>
                  <h3 className="mt-3 font-serif text-lg font-bold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* WHERE WE TEACH */}
        <section id="about-section" className="px-6 py-20" aria-labelledby="reach-heading">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Where we teach</p>
              <h2 id="reach-heading" className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
                An academy without borders
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Headquartered in Coimbatore, India, we teach families across eight countries with
                timetables built around each student's local school day.
              </p>
            </div>

            <ul className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {countries.map((country) => (
                <li key={country.code} className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                  <img
                    src={country.flagUrl}
                    alt={`Flag of ${country.name}`}
                    loading="lazy"
                    width={64}
                    height={42}
                    className="mb-4 h-8 w-auto rounded border border-border object-cover"
                  />
                  <span className="block font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    {country.code}
                  </span>
                  <h3 className="mt-1 font-serif text-base font-bold text-foreground">{country.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{country.description}</p>
                </li>
              ))}
            </ul>

            <div className="mt-12">
              <Link to="/about">
                <Button variant="outline" size="lg">
                  Learn more about us
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* PORTALS */}
        <section className="border-t border-border bg-secondary/60 px-6 py-20" aria-labelledby="portals-heading">
          <div className="mx-auto max-w-6xl">
            <h2 id="portals-heading" className="font-serif text-3xl font-bold text-foreground sm:text-4xl">
              Sign in to your portal
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Accounts are created by the academy office. If you need access, request it from your teacher.
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {portals.map(({ to, icon: Icon, iconWrap, iconColor, title, body, variant }) => (
                <article key={to} className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-lg border ${iconWrap}`}>
                    <Icon className={`h-6 w-6 ${iconColor}`} aria-hidden="true" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-foreground">{title}</h3>
                  <p className="mb-6 mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  <Link to={to} className="mt-auto">
                    <Button variant={variant} className="w-full">
                      Sign in
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 py-20" aria-labelledby="cta-heading">
          <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-primary px-8 py-14 text-center text-primary-foreground shadow-lg">
            <h2 id="cta-heading" className="font-serif text-3xl font-bold sm:text-4xl">
              Start with a free demo lesson
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-primary-foreground/80">
              Tell us the subject and year group. We will match a specialist teacher and arrange a
              trial lesson at a time that suits your family.
            </p>
            <div className="mt-8 flex justify-center">
              <DemoRequestForm />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Index;

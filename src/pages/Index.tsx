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
import { Reveal } from "@/components/Reveal";
import { KineticHeadline } from "@/components/marketing/KineticHeadline";
import { MagneticButton } from "@/components/marketing/MagneticButton";
import { AnimatedCounter } from "@/components/marketing/AnimatedCounter";
import { SubjectExplorer } from "@/components/marketing/SubjectExplorer";
import { HowItWorks } from "@/components/marketing/HowItWorks";

const stats = [
  { value: 8, suffix: "", label: "Countries taught in" },
  { value: 12, suffix: "", label: "Grades covered, 1 to 12" },
  { value: 15, suffix: "+", label: "Subject specialists" },
  { value: 5000, suffix: "+", label: "Lessons delivered" },
];

const floatingChips = [
  { label: "Mathematics", top: "-4%", left: "-14%", delay: "0s" },
  { label: "Physics", top: "22%", left: "88%", delay: "1.2s" },
  { label: "English", top: "78%", left: "-10%", delay: "2.1s" },
  { label: "Chemistry", top: "96%", left: "72%", delay: "0.6s" },
];

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
        <section className="relative overflow-hidden border-b border-border bg-[image:var(--gradient-midnight)] text-primary-foreground">
          <span aria-hidden="true" className="hero-mesh" />
          <span aria-hidden="true" className="grid-lines" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-24 pt-28 md:grid-cols-[1.05fr_0.95fr] md:pb-28 md:pt-32">
            <div>
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground backdrop-blur-sm">
                <Globe2 className="spin-slow h-3.5 w-3.5" aria-hidden="true" />
                Teaching students in 8 countries
              </p>

              <KineticHeadline
                text="Online tutoring built around one student at a time"
                highlight={["one", "student"]}
                className="text-4xl font-extrabold leading-[1.08] tracking-tight text-primary-foreground sm:text-5xl md:text-[3.4rem]"
              />

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-primary-foreground/80">
                Shobs Academy pairs K-12 students with subject specialists for live one-to-one
                classes, written practice after every lesson and progress that parents can inspect
                in the portal.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <MagneticButton>
                  <DemoRequestForm />
                </MagneticButton>
                <Link to="/about">
                  <Button
                    size="lg"
                    variant="outline"
                    className="group border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  >
                    How we teach
                    <ArrowRight className="arrow-travel h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
              </div>

              <p className="mt-5 text-sm text-primary-foreground/65">
                Free trial lesson · No card required · Flexible timetables across time zones
              </p>
            </div>

            <div className="relative hidden justify-self-center md:block">
              {floatingChips.map(({ label, top, left, delay }) => (
                <span
                  key={label}
                  aria-hidden="true"
                  className="chip-float absolute rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold text-primary-foreground/90 backdrop-blur-sm"
                  style={{ top, left, animationDelay: delay }}
                >
                  {label}
                </span>
              ))}
              <div className="float-slow surface-rim rounded-3xl border border-primary-foreground/15 bg-primary-foreground/[0.06] p-10 backdrop-blur-md">
                <Logo size="lg" className="mx-auto" />
                <p className="mt-6 text-center font-display text-lg font-semibold text-primary-foreground/90">
                  Guiding students to academic excellence
                </p>
              </div>
            </div>
          </div>

          {/* COUNTERS */}
          <div className="relative border-t border-primary-foreground/10 bg-background/[0.03] px-6 py-10 backdrop-blur-sm">
            <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map(({ value, suffix, label }, i) => (
                <Reveal key={label} delay={i * 90}>
                  <AnimatedCounter value={value} suffix={suffix} label={label} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* SIGN IN STRIP */}
        <div className="border-b border-border bg-secondary">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-6 py-3 text-sm">
            <span className="font-medium text-muted-foreground">Already with ShobsAcademy? Sign in as</span>
            <Link to="/student-login" className="link-underline font-semibold text-student">Student</Link>
            <span aria-hidden="true" className="text-border">|</span>
            <Link to="/teacher-login" className="link-underline font-semibold text-teacher">Teacher</Link>
            <span aria-hidden="true" className="text-border">|</span>
            <Link to="/admin-login" className="link-underline font-semibold text-admin">Admin</Link>
          </div>
        </div>

        {/* SUBJECT EXPLORER */}
        <section className="px-6 py-20" aria-labelledby="explorer-heading">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-2xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Explore what we teach</p>
              <h2 id="explorer-heading" className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Pick a grade. See exactly what your child will study.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Subjects, topics and depth change with every year group. Choose a grade below to see
                the syllabus we cover and book a demo for that level.
              </p>
            </Reveal>

            <Reveal delay={120} className="mt-10">
              <SubjectExplorer />
            </Reveal>
          </div>
        </section>

        {/* WHAT WE DO */}
        <section className="border-y border-border bg-secondary/50 px-6 py-20" aria-labelledby="approach-heading">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-2xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Our approach</p>
              <h2 id="approach-heading" className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Tutoring that is planned, tracked and accountable
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Good tutoring is more than a weekly call. Every Shobs Academy student gets a plan,
                written practice between lessons and a record that parents can actually inspect.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {pillars.map(({ icon: Icon, title, body }, i) => (
                <Reveal key={title} as="article" delay={i * 80} className="group surface-rim glow-hover rounded-2xl border border-border/70 bg-card p-6">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 transition-colors duration-300 group-hover:bg-primary/20">
                    <Icon className="h-5 w-5 text-primary transition-transform duration-300 group-hover:scale-110" aria-hidden="true" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="px-6 py-20" aria-labelledby="how-heading">
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">The journey</p>
              <h2 id="how-heading" className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                How it works
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                From first enquiry to steady progress, the path is the same for every family.
              </p>
            </Reveal>
            <HowItWorks />
          </div>
        </section>


        {/* WHERE WE TEACH */}
        <section id="about-section" className="border-y border-border bg-secondary/50 px-6 py-20" aria-labelledby="reach-heading">
          <div className="mx-auto max-w-6xl">
            <Reveal className="max-w-2xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Where we teach</p>
              <h2 id="reach-heading" className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                An academy without borders
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Headquartered in Coimbatore, India, we teach families across eight countries with
                timetables built around each student's local school day.
              </p>
            </Reveal>

            <ul className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {countries.map((country, i) => (
                <Reveal key={country.code} as="li" delay={i * 60} className="group surface-rim glow-hover rounded-2xl border border-border/70 bg-card p-5">
                  <img
                    src={country.flagUrl}
                    alt={`Flag of ${country.name}`}
                    loading="lazy"
                    width={64}
                    height={42}
                    className="mb-4 h-8 w-auto rounded border border-border object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  <span className="block font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    {country.code}
                  </span>
                  <h3 className="mt-1 font-display text-base font-bold text-foreground">{country.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{country.description}</p>
                </Reveal>
              ))}
            </ul>

            <div className="mt-12">
              <Link to="/about">
                <Button variant="outline" size="lg" className="group">
                  Learn more about us
                  <ArrowRight className="arrow-travel h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* PORTALS */}
        <section className="px-6 py-20" aria-labelledby="portals-heading">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 id="portals-heading" className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Sign in to your portal
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
                Accounts are created by the academy office. If you need access, request it from your teacher.
              </p>
            </Reveal>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {portals.map(({ to, icon: Icon, iconWrap, iconColor, title, body, variant }, i) => (
                <Reveal key={to} as="article" delay={i * 90} className="surface-rim glow-hover flex flex-col rounded-2xl border border-border/70 bg-card p-6">
                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl border ${iconWrap}`}>
                    <Icon className={`h-6 w-6 ${iconColor}`} aria-hidden="true" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
                  <p className="mb-6 mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  <Link to={to} className="mt-auto">
                    <Button variant={variant} className="group w-full">
                      Sign in
                      <ArrowRight className="arrow-travel h-4 w-4" aria-hidden="true" />
                    </Button>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 pb-24 pt-4" aria-labelledby="cta-heading">
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border bg-[image:var(--gradient-midnight)] px-8 py-16 text-center text-primary-foreground shadow-[var(--shadow-xl)]">
            <span aria-hidden="true" className="hero-mesh" />
            <div className="relative">
              <h2 id="cta-heading" className="font-display text-3xl font-extrabold tracking-tight text-primary-foreground sm:text-4xl">
                Start with a free demo lesson
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-primary-foreground/80">
                Tell us the subject and year group. We will match a specialist teacher and arrange a
                trial lesson at a time that suits your family.
              </p>
              <div className="mt-8 flex justify-center">
                <MagneticButton>
                  <DemoRequestForm />
                </MagneticButton>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Index;

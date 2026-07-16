import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, Shield, ArrowRight } from "lucide-react";
import { DemoRequestForm } from "@/components/DemoRequestForm";
import { Logo } from "@/components/Logo";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Seo } from "@/components/Seo";
const countries = [{
  flagUrl: "https://flagcdn.com/w320/us.png",
  code: "US",
  name: "USA",
  description: "Serving students across different states"
}, {
  flagUrl: "https://flagcdn.com/w320/ca.png",
  code: "CA",
  name: "Canada",
  description: "Growing student base in Canada"
}, {
  flagUrl: "https://flagcdn.com/w320/au.png",
  code: "AU",
  name: "Australia",
  description: "Services in Australia and Oceania"
}, {
  flagUrl: "https://flagcdn.com/w320/nl.png",
  code: "NL",
  name: "Netherlands",
  description: "Supporting students in the Netherlands"
}, {
  flagUrl: "https://flagcdn.com/w320/nz.png",
  code: "NZ",
  name: "New Zealand",
  description: "Expanding in New Zealand"
}, {
  flagUrl: "https://flagcdn.com/w320/in.png",
  code: "IN",
  name: "India",
  description: "Primary location, headquarters in Coimbatore"
}, {
  flagUrl: "https://flagcdn.com/w320/ae.png",
  code: "AE",
  name: "Dubai",
  description: "Serving the UAE and Middle East"
}, {
  flagUrl: "https://flagcdn.com/w320/sg.png",
  code: "SG",
  name: "Singapore",
  description: "Southeast Asian education hub"
}];
const Index = () => {
  const {
    user,
    role,
    loading
  } = useAuth();
  const navigate = useNavigate();

  // Redirect logged-in users to their dashboard
  useEffect(() => {
    if (!loading && user && role) {
      navigate(`/${role}`, {
        replace: true
      });
    }
  }, [user, role, loading, navigate]);
  return <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      <Seo
        title="Shobs Academy — Expert Online Tutoring for K-12"
        description="Personalized online tutoring for K-12 students across Math, Science, English and more. Live classes, homework help, worksheets and quizzes from expert teachers."
        path="/"
      />
      {/* Global Navbar */}
      <Navbar showAboutLink={true} />

      {/* Sign Up Navigation - Top Right */}
      <div className="fixed top-20 right-4 z-40 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-border/50 shadow-sm">
        <span className="text-xs text-muted-foreground font-medium">Sign in as:</span>
        <Link to="/student-login" className="text-xs font-semibold text-student hover:underline">Student</Link>
        <span className="text-muted-foreground">|</span>
        <Link to="/teacher-login" className="text-xs font-semibold text-teacher hover:underline">Teacher</Link>
        <span className="text-muted-foreground">|</span>
        <Link to="/admin-login" className="text-xs font-semibold text-admin hover:underline">Admin</Link>
      </div>

      {/* 1. HERO SECTION */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-16 md:py-24 pt-24">
        {/* Logo */}
        <div className="mb-6 animate-fade-in">
          <Logo size="lg" />
        </div>

        {/* Brand Name */}
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-4 brand-name-float animate-fade-in" style={{
        animationDelay: "0.1s"
      }}>
          Shobs Academy&nbsp;
        </h1>

        {/* Tagline */}
        <p style={{
        animationDelay: "0.2s"
      }} className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 animate-fade-in font-sans">
          Guiding Students to Academic Excellence
        </p>

        {/* DEMO BUTTON */}
        <div className="mb-8 animate-fade-in animate-float" style={{
        animationDelay: "0.25s"
      }}>
          <DemoRequestForm />
        </div>
      </section>

      {/* Gold Gradient Divider */}
      <div className="w-full h-1" style={{
      background: 'linear-gradient(90deg, transparent, hsl(43 74% 49%), transparent)'
    }} />

      {/* 2. ABOUT US SECTION - Countries Only */}
      <section id="about-section" className="py-20 px-6 bg-gradient-to-b from-muted/30 to-background">
        <div className="max-w-6xl mx-auto">
          {/* About Us Heading */}
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-center mb-6 about-title-float">
            About Us
          </h2>

          {/* Intro Text */}
          <p className="text-muted-foreground max-w-3xl mx-auto mb-16 font-sans font-medium text-xl text-left">
            ​Expert-led tutoring with personalized lesson plans and flexible online sessions, helping students worldwide master concepts, boost confidence, and earn better grades.
          </p>

          {/* Countries Grid */}
          <div className="countries-section mb-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {countries.map(country => <div key={country.code} className="country-card bg-primary-foreground">
                  <img src={country.flagUrl} alt={`${country.name} flag`} className="country-flag-image" />
                  <span className="country-code text-xs font-bold tracking-widest text-primary uppercase mb-2 block">
                    {country.code}
                  </span>
                  <h3 className="font-semibold text-lg text-foreground mb-2">{country.name}</h3>
                  <p className="text-sm text-muted-foreground bg-primary-foreground">{country.description}</p>
                </div>)}
            </div>
          </div>

          {/* Link to full About page */}
          <div className="text-center">
            <Link to="/about">
              <Button variant="outline" size="lg" className="gap-2">
                Learn More About Us
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Gold Gradient Divider */}
      <div className="w-full h-1" style={{
      background: 'linear-gradient(90deg, transparent, hsl(43 74% 49%), transparent)'
    }} />

      {/* 3. PORTAL CARDS SECTION */}
      <section className="py-20 px-6 bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-center mb-12 text-foreground">
            Get Started Today
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Student Card */}
            <Link to="/student-login" className="group">
              <div className="portal-card min-h-[240px] flex flex-col card-hover-lift">
                <div className="h-16 w-16 rounded-2xl bg-student/10 border border-student/20 flex items-center justify-center mx-auto mb-5 group-hover:bg-student/15 transition-colors">
                  <GraduationCap className="h-8 w-8 text-student" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                  Student Portal
                </h3>
                <p className="text-sm text-muted-foreground mb-6 flex-1">
                  Access your attendance, assignments, and Zoom links
                </p>
                <Button variant="student" className="w-full group-hover:gap-3">
                  Sign In
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </Link>

            {/* Teacher Card */}
            <Link to="/teacher-login" className="group">
              <div className="portal-card min-h-[240px] flex flex-col card-hover-lift">
                <div className="h-16 w-16 rounded-2xl bg-teacher/10 border border-teacher/20 flex items-center justify-center mx-auto mb-5 group-hover:bg-teacher/15 transition-colors">
                  <Users className="h-8 w-8 text-teacher" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                  Teacher Portal
                </h3>
                <p className="text-sm text-muted-foreground mb-6 flex-1">
                  Manage attendance, create assignments, and more
                </p>
                <Button variant="teacher" className="w-full group-hover:gap-3">
                  Sign In
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </Link>

            {/* Admin Card */}
            <Link to="/admin-login" className="group">
              <div className="portal-card min-h-[240px] flex flex-col card-hover-lift">
                <div className="h-16 w-16 rounded-2xl bg-admin/10 border border-admin/20 flex items-center justify-center mx-auto mb-5 group-hover:bg-admin/15 transition-colors">
                  <Shield className="h-8 w-8 text-admin" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                  Admin Portal
                </h3>
                <p className="text-sm text-muted-foreground mb-6 flex-1">
                  Create teacher and student accounts, manage the system
                </p>
                <Button variant="admin" className="w-full group-hover:gap-3">
                  Sign In
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Gold Gradient Divider */}
      <div className="w-full h-1" style={{
      background: 'linear-gradient(90deg, transparent, hsl(43 74% 49%), transparent)'
    }} />

      {/* 4. FOOTER */}
      <footer className="bg-foreground text-background text-center py-10">
        <p className="text-sm opacity-80">
          © {new Date().getFullYear()} Shobs Academy. All rights reserved.
        </p>
      </footer>
    </div>;
};
export default Index;
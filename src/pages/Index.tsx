import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, Shield, ArrowRight, BookOpen, User, ClipboardCheck, Target, Calendar, Zap, Mail, Phone } from "lucide-react";
import { DemoRequestForm } from "@/components/DemoRequestForm";
import { Logo } from "@/components/Logo";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const countries = [
  { flagUrl: "https://flagcdn.com/w320/us.png", code: "US", name: "USA", description: "Serving students across all 50 states" },
  { flagUrl: "https://flagcdn.com/w320/ca.png", code: "CA", name: "Canada", description: "Growing student base in Canada" },
  { flagUrl: "https://flagcdn.com/w320/au.png", code: "AU", name: "Australia", description: "Services in Australia and Oceania" },
  { flagUrl: "https://flagcdn.com/w320/nl.png", code: "NL", name: "Netherlands", description: "European presence in the Netherlands" },
  { flagUrl: "https://flagcdn.com/w320/nz.png", code: "NZ", name: "New Zealand", description: "Expanding in New Zealand" },
  { flagUrl: "https://flagcdn.com/w320/in.png", code: "IN", name: "India", description: "Primary market, headquartered in Haryana" },
  { flagUrl: "https://flagcdn.com/w320/ae.png", code: "AE", name: "Dubai", description: "Serving the UAE and Middle East" },
  { flagUrl: "https://flagcdn.com/w320/sg.png", code: "SG", name: "Singapore", description: "Southeast Asian education hub" },
];

const features = [
  { icon: BookOpen, title: "Expert Tutoring", description: "One-on-one sessions with qualified teachers across multiple subjects" },
  { icon: User, title: "Personalized Learning", description: "Customized lesson plans tailored to each student's needs and pace" },
  { icon: ClipboardCheck, title: "Assignment Support", description: "Homework help, assignment tracking, and submission management" },
  { icon: Target, title: "Progress Tracking", description: "Detailed attendance records and performance monitoring" },
  { icon: Calendar, title: "Flexible Scheduling", description: "Convenient online sessions that fit your schedule" },
  { icon: Zap, title: "Interactive Platform", description: "Modern tools for seamless communication between students and teachers" },
];

const Index = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect logged-in users to their dashboard
  useEffect(() => {
    if (!loading && user && role) {
      navigate(`/${role}`, { replace: true });
    }
  }, [user, role, loading, navigate]);

  const scrollToAbout = () => {
    document.getElementById("about-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      {/* Global Navbar */}
      <Navbar showAboutLink={true} />

      {/* 1. HERO SECTION */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-16 md:py-24 pt-24">
        {/* Logo - Static, 80px, no rotation */}
        <div className="mb-6 animate-fade-in">
          <Logo size="lg" />
        </div>

        {/* Brand Name - Floating Animation */}
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-4 brand-name-float animate-fade-in" style={{ animationDelay: "0.1s" }}>
          Shobs Academy
        </h1>

        {/* About Us Link - Floating Gradient */}
        <button
          onClick={scrollToAbout}
          className="about-link-hero mb-8 animate-fade-in"
          style={{ animationDelay: "0.15s" }}
        >
          About Us ✨
        </button>

        {/* Tagline */}
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          Empowering Education, One Student at a Time
        </p>

        {/* 2. DEMO BUTTON - Floating, no block below */}
        <div className="mb-8 animate-fade-in animate-float" style={{ animationDelay: "0.25s" }}>
          <DemoRequestForm />
        </div>
      </section>

      {/* 3. ABOUT US SECTION - Full Content */}
      <section id="about-section" className="py-20 px-6 bg-gradient-to-b from-muted/30 to-background border-t border-border/50">
        <div className="max-w-6xl mx-auto">
          {/* 3.1 - About Us Heading */}
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-center mb-6 about-title-float">
            About Us
          </h2>

          {/* 3.2 - Intro Text */}
          <p className="text-lg text-muted-foreground text-center max-w-3xl mx-auto mb-16">
            We are empowering education across multiple countries, providing quality tutoring to students worldwide.
          </p>

          {/* 3.3 - Countries Grid */}
          <div className="countries-section mb-20">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {countries.map((country, idx) => (
                <div
                  key={country.code}
                  className="country-card"
                >
                  <img 
                    src={country.flagUrl}
                    alt={`${country.name} flag`}
                    className="country-flag-image"
                  />
                  <span className="country-code text-xs font-bold tracking-widest text-primary uppercase mb-2 block">
                    {country.code}
                  </span>
                  <h3 className="font-semibold text-lg text-foreground mb-2">{country.name}</h3>
                  <p className="text-sm text-muted-foreground">{country.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 3.4 - Features Section */}
          <div className="features-section mb-20">
            <h3 className="text-2xl sm:text-3xl font-display font-bold text-center mb-12 text-foreground">
              Our Features
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {features.map((feature, idx) => (
                <div
                  key={feature.title}
                  className="feature-card animate-fade-in"
                  style={{ animationDelay: `${0.1 * idx}s` }}
                >
                  <div className="feature-icon-wrapper">
                    <feature.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h4 className="font-semibold text-lg text-foreground mb-2">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 3.5 - Who We Serve Section */}
          <div className="who-serve-section mb-20">
            <h3 className="text-2xl sm:text-3xl font-display font-bold text-center mb-12 text-foreground">
              Who We Serve
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Students Card */}
              <div className="serve-card animate-fade-in" style={{ animationDelay: "0.1s" }}>
                <div className="serve-icon-wrapper">
                  <GraduationCap className="h-10 w-10 text-student" />
                </div>
                <h4 className="text-xl font-bold text-foreground mb-4">Students</h4>
                <ul className="serve-list space-y-3">
                  <li>
                    <span className="serve-check">✓</span>
                    K-12 students seeking academic support
                  </li>
                  <li>
                    <span className="serve-check">✓</span>
                    Students preparing for exams and tests
                  </li>
                  <li>
                    <span className="serve-check">✓</span>
                    Learners who benefit from one-on-one attention
                  </li>
                </ul>
              </div>

              {/* Parents Card */}
              <div className="serve-card animate-fade-in" style={{ animationDelay: "0.2s" }}>
                <div className="serve-icon-wrapper">
                  <Users className="h-10 w-10 text-teacher" />
                </div>
                <h4 className="text-xl font-bold text-foreground mb-4">Parents</h4>
                <ul className="serve-list space-y-3">
                  <li>
                    <span className="serve-check">✓</span>
                    Parents looking for quality tutoring services
                  </li>
                  <li>
                    <span className="serve-check">✓</span>
                    Families wanting to track their child's progress
                  </li>
                  <li>
                    <span className="serve-check">✓</span>
                    Those seeking flexible, online learning options
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* 3.6 - Get In Touch Section */}
          <div className="get-in-touch-section mb-16">
            <div className="get-in-touch-container">
              <h3 className="text-2xl font-bold text-foreground mb-8">Get In Touch</h3>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
                <div className="contact-item">
                  <Mail className="h-6 w-6 text-primary" />
                  <span className="text-muted-foreground font-medium">contact@shobsacademy.com</span>
                </div>
                <div className="contact-item">
                  <Phone className="h-6 w-6 text-primary" />
                  <span className="text-muted-foreground font-medium">(123) 456-7890</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. PORTAL CARDS SECTION (LAST) */}
      <section className="py-20 px-6 bg-gradient-to-b from-background to-muted/30 border-t border-border/50">
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
                  Sign In / Sign Up
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
                  Create teacher accounts and manage the system
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

      {/* 5. FOOTER */}
      <footer className="bg-foreground text-background text-center py-10">
        <p className="text-sm opacity-80">
          © {new Date().getFullYear()} Shobs Academy. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default Index;

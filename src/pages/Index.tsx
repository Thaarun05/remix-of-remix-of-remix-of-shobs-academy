import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, Shield, ArrowRight } from "lucide-react";
import { DemoRequestForm } from "@/components/DemoRequestForm";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const countries = [
  { flag: "🇮🇳", name: "India", description: "Primary market, headquartered in Haryana" },
  { flag: "🇺🇸", name: "USA", description: "Serving students from across all 50 states" },
  { flag: "🇬🇧", name: "UK", description: "Expanding presence in the United Kingdom" },
  { flag: "🇨🇦", name: "Canada", description: "Growing student base in Canada" },
  { flag: "🇦🇺", name: "Australia", description: "Services in Australia and Oceania" },
  { flag: "🇳🇱", name: "Netherlands", description: "European expansion hub" },
  { flag: "🇳🇿", name: "New Zealand", description: "Pacific region presence" },
  { flag: "🇸🇬", name: "Singapore", description: "Asian market penetration" },
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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Hero Section - Centered */}
      <main className="flex flex-col items-center justify-center text-center px-6 py-16 min-h-[80vh]">
        {/* Logo - Static, no rotation */}
        <div className="mb-6 animate-fade-in">
          <Logo size="lg" />
        </div>

        {/* Brand Name - Floating Animation */}
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-4 brand-name-float animate-fade-in" style={{ animationDelay: "0.1s" }}>
          Shobs Academy
        </h1>

        {/* About Us Link */}
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

        {/* Demo Request CTA - Floating animation */}
        <div className="mb-16 animate-fade-in animate-float" style={{ animationDelay: "0.25s" }}>
          <DemoRequestForm />
        </div>

        {/* Login Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl w-full animate-fade-in" style={{ animationDelay: "0.3s" }}>
          {/* Student Card */}
          <Link to="/student-login" className="group">
            <div className="portal-card min-h-[200px] flex flex-col card-hover-lift">
              <div className="h-14 w-14 rounded-2xl bg-student/10 border border-student/20 flex items-center justify-center mx-auto mb-4 group-hover:bg-student/15 transition-colors">
                <GraduationCap className="h-7 w-7 text-student" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                Student Portal
              </h3>
              <p className="text-sm text-muted-foreground mb-5 flex-1">
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
            <div className="portal-card min-h-[200px] flex flex-col card-hover-lift">
              <div className="h-14 w-14 rounded-2xl bg-teacher/10 border border-teacher/20 flex items-center justify-center mx-auto mb-4 group-hover:bg-teacher/15 transition-colors">
                <Users className="h-7 w-7 text-teacher" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                Teacher Portal
              </h3>
              <p className="text-sm text-muted-foreground mb-5 flex-1">
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
            <div className="portal-card min-h-[200px] flex flex-col card-hover-lift">
              <div className="h-14 w-14 rounded-2xl bg-admin/10 border border-admin/20 flex items-center justify-center mx-auto mb-4 group-hover:bg-admin/15 transition-colors">
                <Shield className="h-7 w-7 text-admin" />
              </div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                Admin Portal
              </h3>
              <p className="text-sm text-muted-foreground mb-5 flex-1">
                Create teacher accounts and manage the system
              </p>
              <Button variant="admin" className="w-full group-hover:gap-3">
                Sign In
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </Link>
        </div>
      </main>

      {/* About Us Section - Inline */}
      <section id="about-section" className="py-20 px-6 bg-gradient-to-b from-muted/30 to-background border-t border-border/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-center mb-4 about-title-float">
            About Us
          </h2>
          <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-12">
            We are empowering education across multiple countries, providing quality tutoring to students worldwide.
          </p>

          {/* Countries Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 mb-12">
            {countries.map((country, idx) => (
              <div
                key={country.name}
                className="country-card animate-fade-in"
                style={{ animationDelay: `${0.1 * idx}s` }}
              >
                <span className="text-4xl mb-3 block country-flag" style={{ animationDelay: `${0.1 * idx}s` }}>
                  {country.flag}
                </span>
                <h3 className="font-semibold text-foreground mb-1">{country.name}</h3>
                <p className="text-sm text-muted-foreground">{country.description}</p>
              </div>
            ))}
          </div>

          {/* Mission Statement */}
          <div className="text-center max-w-3xl mx-auto">
            <h3 className="font-display text-2xl font-semibold mb-4">Our Mission</h3>
            <p className="text-muted-foreground leading-relaxed">
              At Shobs Academy, we believe every student deserves access to quality education. 
              Our platform connects students with experienced teachers for personalized learning experiences. 
              We track attendance, manage assignments, and provide seamless communication between 
              students and teachers to ensure academic success.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-10 border-t border-border/50">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Shobs Academy. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default Index;

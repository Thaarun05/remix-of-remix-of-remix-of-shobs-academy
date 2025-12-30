import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  Target, 
  CheckCircle2, 
  Mail, 
  Phone,
  ArrowLeft,
  Sparkles,
  Globe
} from "lucide-react";
import { Logo } from "@/components/Logo";

const COUNTRIES = [
  { name: "USA", flag: "🇺🇸", description: "Comprehensive K-12 tutoring" },
  { name: "Canada", flag: "🇨🇦", description: "Provincial curriculum support" },
  { name: "Australia", flag: "🇦🇺", description: "ATAR exam preparation" },
  { name: "Netherlands", flag: "🇳🇱", description: "International & Dutch curricula" },
  { name: "New Zealand", flag: "🇳🇿", description: "NCEA aligned tutoring" },
  { name: "India", flag: "🇮🇳", description: "CBSE & ICSE programs" },
  { name: "Dubai", flag: "🇦🇪", description: "British & IB curriculum" },
  { name: "Singapore", flag: "🇸🇬", description: "MOE syllabus support" },
];

const About = () => {
  return (
    <div className="min-h-screen page bg-decorative-pattern">
      <div className="max-w-[1280px] mx-auto px-6">
        {/* Header */}
        <nav className="flex items-center justify-between py-6 mb-8">
          <Link to="/" className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="font-display text-xl font-semibold text-foreground">
              Shobs Academy
            </span>
          </Link>
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </nav>

        {/* Hero Section */}
        <div className="hero-section text-center mb-12 animate-fade-in">
          <div className="flex items-center justify-center gap-4 mb-6">
            <Logo size="lg" className="animate-pulse-glow" />
          </div>
          
          <div className="pill-badge mx-auto mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            About Us
          </div>

          <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-6 leading-[1.1]">
            <span className="heading-animated-underline">Online Tutoring Service</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            At Shobs Academy, we believe every student deserves access to quality education 
            tailored to their unique learning style. Our mission is to empower students 
            with the knowledge and skills they need to succeed.
          </p>
        </div>

        {/* Countries We Teach */}
        <div className="mb-16">
          <h2 className="font-display text-3xl font-bold text-foreground text-center mb-3">
            <span className="heading-animated-underline">Countries We Teach</span>
          </h2>
          <p className="text-center text-muted-foreground mb-8">
            Providing quality education across the globe
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-fade-in">
            {COUNTRIES.map((country, index) => (
              <Card 
                key={country.name} 
                className="glass-card card-hover-lift cursor-default"
                style={{ animationDelay: `${0.1 * (index + 1)}s` }}
              >
                <CardContent className="pt-6 text-center">
                  <div className="text-4xl mb-3">{country.flag}</div>
                  <h3 className="font-semibold text-foreground mb-1">{country.name}</h3>
                  <p className="text-xs text-muted-foreground">{country.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Mission Section */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <Card className="glass-card card-hover-lift">
            <CardContent className="pt-6">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 icon-hover-animate">
                <Target className="h-7 w-7 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">
                Our Mission
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                To provide accessible, high-quality tutoring services that help students 
                reach their full academic potential. We strive to create a supportive 
                learning environment where curiosity is encouraged and success is celebrated.
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card card-hover-lift">
            <CardContent className="pt-6">
              <div className="h-14 w-14 rounded-2xl bg-teacher/10 border border-teacher/20 flex items-center justify-center mb-4 icon-hover-animate">
                <BookOpen className="h-7 w-7 text-teacher" />
              </div>
              <h2 className="font-display text-2xl font-semibold text-foreground mb-4">
                Our Approach
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We combine experienced educators with modern technology to deliver 
                personalized one-on-one tutoring sessions. Our platform makes it easy 
                to track progress, manage assignments, and stay connected.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* What We Offer */}
        <div className="mb-16">
          <h2 className="font-display text-3xl font-bold text-foreground text-center mb-8">
            <span className="heading-animated-underline">What We Offer</span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-fade-in">
            {[
              {
                icon: GraduationCap,
                title: "Expert Tutoring",
                description: "One-on-one sessions with qualified teachers across multiple subjects",
              },
              {
                icon: Users,
                title: "Personalized Learning",
                description: "Customized lesson plans tailored to each student's needs and pace",
              },
              {
                icon: BookOpen,
                title: "Assignment Support",
                description: "Homework help, assignment tracking, and submission management",
              },
              {
                icon: CheckCircle2,
                title: "Progress Tracking",
                description: "Detailed attendance records and performance monitoring",
              },
              {
                icon: Target,
                title: "Flexible Scheduling",
                description: "Convenient online sessions that fit your schedule",
              },
              {
                icon: Globe,
                title: "Global Reach",
                description: "Serving students across 8 countries with localized curriculum support",
              },
            ].map((item, index) => (
              <Card 
                key={index} 
                className="glass-card hover:border-primary/30 transition-colors card-hover-lift"
                style={{ animationDelay: `${0.1 * (index + 1)}s` }}
              >
                <CardContent className="pt-6">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 icon-hover-animate">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Who We Serve */}
        <div className="mb-16">
          <h2 className="font-display text-3xl font-bold text-foreground text-center mb-8">
            <span className="heading-animated-underline">Who We Serve</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="glass-card border-student/30 card-hover-lift">
              <CardContent className="pt-6">
                <div className="h-14 w-14 rounded-2xl bg-student/10 border border-student/20 flex items-center justify-center mb-4 icon-hover-animate">
                  <GraduationCap className="h-7 w-7 text-student" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                  Students
                </h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-student mt-1 shrink-0" />
                    <span>K-12 students seeking academic support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-student mt-1 shrink-0" />
                    <span>Students preparing for exams and tests</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-student mt-1 shrink-0" />
                    <span>Learners who benefit from one-on-one attention</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="glass-card border-teacher/30 card-hover-lift">
              <CardContent className="pt-6">
                <div className="h-14 w-14 rounded-2xl bg-teacher/10 border border-teacher/20 flex items-center justify-center mb-4 icon-hover-animate">
                  <Users className="h-7 w-7 text-teacher" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                  Parents
                </h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teacher mt-1 shrink-0" />
                    <span>Parents looking for quality tutoring services</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teacher mt-1 shrink-0" />
                    <span>Families wanting to track their child's progress</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teacher mt-1 shrink-0" />
                    <span>Those seeking flexible, online learning options</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Contact Section */}
        <div className="mb-16">
          <Card className="glass-card max-w-2xl mx-auto card-hover-lift">
            <CardContent className="pt-8 pb-8">
              <h2 className="font-display text-2xl font-bold text-foreground text-center mb-6">
                <span className="heading-animated-underline">Get In Touch</span>
              </h2>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <a
                  href="mailto:contact@shobsacademy.com"
                  className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center icon-hover-animate">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <span>contact@shobsacademy.com</span>
                </a>
                <a
                  href="tel:+1234567890"
                  className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center icon-hover-animate">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <span>(123) 456-7890</span>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="text-center py-10 border-t border-border/50">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Shobs Academy. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default About;

import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { BookOpen, User, ClipboardCheck, Target, Calendar, Zap, GraduationCap, Users, Mail, ArrowLeft } from "lucide-react";
const features = [{
  icon: BookOpen,
  title: "Expert Tutoring",
  description: "One-on-one sessions with qualified teachers across multiple subjects"
}, {
  icon: User,
  title: "Personalized Learning",
  description: "Customized lesson plans tailored to each student's needs and pace"
}, {
  icon: ClipboardCheck,
  title: "Assignment Support",
  description: "Homework help, assignment tracking, and submission management"
}, {
  icon: Target,
  title: "Progress Tracking",
  description: "Detailed attendance records and performance monitoring"
}, {
  icon: Calendar,
  title: "Flexible Scheduling",
  description: "Convenient online sessions that fit your schedule"
}, {
  icon: Zap,
  title: "Interactive Platform",
  description: "Modern tools for seamless communication between students and teachers"
}];
const About = () => {
  return <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      <Navbar showAboutLink={false} />

      {/* Back to Home Button */}
      <section className="pt-24 px-6">
        <div className="max-w-5xl mx-auto">
          <Link to="/">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </section>

      {/* Hero */}
      <section className="pt-8 pb-12 px-6 text-center">
        <div className="mb-6">
          <Logo size="lg" className="mx-auto" />
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
          About Shobs Academy
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Empowering Education, One Student at a Time
        </p>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6 bg-gradient-to-b from-muted/30 to-background">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-center mb-12 text-foreground">
            Our Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => <div key={feature.title} className="feature-card animate-fade-in" style={{
            animationDelay: `${0.1 * idx}s`
          }}>
                <div className="feature-icon-wrapper">
                  <feature.icon className="h-8 w-8 text-primary" />
                </div>
                <h4 className="font-semibold text-lg text-foreground mb-2">{feature.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>)}
          </div>
        </div>
      </section>

      {/* Who We Serve Section */}
      <section className="py-16 px-6 bg-gradient-to-b from-background to-muted/30 border-t border-border/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-center mb-12 text-foreground">
            Who We Serve
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Students Card */}
            <div className="serve-card animate-fade-in" style={{
            animationDelay: "0.1s"
          }}>
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
            <div className="serve-card animate-fade-in" style={{
            animationDelay: "0.2s"
          }}>
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
      </section>

      {/* Get In Touch Section */}
      <section className="py-16 px-6 bg-gradient-to-b from-muted/30 to-background border-t border-border/50">
        <div className="max-w-3xl mx-auto">
          <div className="get-in-touch-container text-center">
            <h2 className="text-2xl font-bold text-foreground mb-8">Get In Touch</h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
              <div className="contact-item">
                <Mail className="h-6 w-6 text-primary" />
                <span className="text-muted-foreground font-medium">shobaraju@shobsacademy.com or shobsacademy@gmail.com
              </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-background text-center py-10">
        <p className="text-sm opacity-80">
          © {new Date().getFullYear()} Shobs Academy. All rights reserved.
        </p>
      </footer>
    </div>;
};
export default About;
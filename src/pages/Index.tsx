import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, Shield, BookOpen, ArrowRight, Sparkles } from "lucide-react";
import { DemoRequestForm } from "@/components/DemoRequestForm";

const Index = () => {
  return (
    <div className="min-h-screen page">
      {/* Container */}
      <div className="max-w-[1280px] mx-auto px-6">
        {/* Header */}
        <nav className="flex items-center justify-between py-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-md shadow-primary/20">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-semibold text-foreground">
              Shobs Academy
            </span>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="hero-section text-center mb-12 animate-fade-in">
          <div className="pill-badge mx-auto mb-6" style={{ animationDelay: "0.05s" }}>
            <Sparkles className="h-3.5 w-3.5" />
            Welcome to Your Learning Portal
          </div>

          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-6 leading-[1.1] animate-fade-up" style={{ animationDelay: "0.1s" }}>
            Empowering Education,{" "}
            <span className="text-gradient">One Student at a Time</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            Track attendance, manage assignments, and stay connected with your 
            learning journey through our comprehensive academy management system.
          </p>

          {/* Demo Request CTA */}
          <div className="mb-16 animate-fade-up" style={{ animationDelay: "0.25s" }}>
            <DemoRequestForm />
          </div>

          {/* Login Cards */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto animate-fade-up" style={{ animationDelay: "0.3s" }}>
            {/* Student Card */}
            <Link to="/student-login" className="group">
              <div className="portal-card min-h-[200px] flex flex-col">
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
              <div className="portal-card min-h-[200px] flex flex-col">
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
              <div className="portal-card min-h-[200px] flex flex-col">
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

export default Index;

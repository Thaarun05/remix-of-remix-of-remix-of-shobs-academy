import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, Shield, BookOpen, ArrowRight } from "lucide-react";
import { DemoRequestForm } from "@/components/DemoRequestForm";
const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-accent/20 to-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-8">
        <nav className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-semibold text-foreground">
              Shobs Academy
            </span>
          </div>
        </nav>

        <main className="max-w-5xl mx-auto text-center pt-12 pb-24">
          <div className="animate-fade-in">
            <span className="inline-block px-4 py-1.5 mb-6 text-sm font-medium bg-accent text-accent-foreground rounded-full">
              Welcome to Your Learning Portal
            </span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-6 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            Empowering Education,{" "}
            <span className="text-gradient">One Student at a Time</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            Track attendance, manage assignments, and stay connected with your 
            learning journey through our comprehensive academy management system.
          </p>

          {/* Demo Request CTA */}
          <div className="mb-12 animate-slide-up" style={{ animationDelay: "0.25s" }}>
            <DemoRequestForm />
          </div>
          {/* Login Cards */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto animate-slide-up" style={{ animationDelay: "0.3s" }}>
            {/* Student Card */}
            <Link to="/student-login" className="group">
              <div className="relative p-6 rounded-2xl bg-card border border-border hover:border-student/50 transition-all duration-300 hover:shadow-xl hover:shadow-student/10 hover:-translate-y-1">
                <div className="h-14 w-14 rounded-xl bg-student/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-student/20 transition-colors">
                  <GraduationCap className="h-7 w-7 text-student" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                  Student Portal
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
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
              <div className="relative p-6 rounded-2xl bg-card border border-border hover:border-teacher/50 transition-all duration-300 hover:shadow-xl hover:shadow-teacher/10 hover:-translate-y-1">
                <div className="h-14 w-14 rounded-xl bg-teacher/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-teacher/20 transition-colors">
                  <Users className="h-7 w-7 text-teacher" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                  Teacher Portal
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
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
              <div className="relative p-6 rounded-2xl bg-card border border-border hover:border-admin/50 transition-all duration-300 hover:shadow-xl hover:shadow-admin/10 hover:-translate-y-1">
                <div className="h-14 w-14 rounded-xl bg-admin/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-admin/20 transition-colors">
                  <Shield className="h-7 w-7 text-admin" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                  Admin Portal
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
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
        <footer className="text-center py-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Shobs Academy. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;

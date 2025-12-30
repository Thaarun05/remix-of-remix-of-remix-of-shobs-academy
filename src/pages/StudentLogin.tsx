import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { signIn, signUpStudent } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { GraduationCap, ArrowLeft, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { z } from "zod";

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  studentName: z.string().min(2, "Student name must be at least 2 characters").max(100, "Student name is too long"),
  fullName: z.string().max(100, "Full name is too long").optional(),
  phone: z.string().max(20, "Phone number is too long").optional(),
  grade: z.string().max(50, "Grade is too long").optional(),
});

const StudentLogin = () => {
  const [loading, setLoading] = useState(false);
  const [signInData, setSignInData] = useState({ email: "", password: "" });
  const [signUpData, setSignUpData] = useState({
    email: "",
    password: "",
    studentName: "",
    fullName: "",
    phone: "",
    grade: "",
  });
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, role, loading: authLoading } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user && role) {
      navigate(`/${role}`, { replace: true });
    }
  }, [user, role, authLoading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = signInSchema.parse(signInData);
      await signIn(validated.email, validated.password);
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
      // Navigation handled by AuthContext
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sign in failed",
          description: error.message || "Please check your credentials and try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = signUpSchema.parse(signUpData);
      await signUpStudent(
        validated.email,
        validated.password,
        validated.studentName,
        validated.fullName,
        validated.phone,
        validated.grade
      );
      toast({
        title: "Account created!",
        description: "Welcome to Shobs Academy.",
      });
      // Navigation handled by AuthContext
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else if (error.message?.includes("duplicate")) {
        toast({
          title: "Sign up failed",
          description: "This student name is already taken. Please choose a different one.",
          variant: "destructive",
        });
      } else if (error.message?.includes("already registered")) {
        toast({
          title: "Sign up failed",
          description: "This email is already registered. Please sign in instead.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sign up failed",
          description: error.message || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Show loading if checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen page flex flex-col bg-decorative-pattern">
      <div className="max-w-[1280px] mx-auto px-6 py-6 w-full">
        <nav className="flex items-center justify-between mb-8">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="font-display text-xl font-semibold text-foreground">
              Shobs Academy
            </span>
          </div>
        </nav>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <Card className="w-full max-w-md border-student/30 shadow-xl animate-fade-in">
          <CardHeader className="text-center pb-2">
            <div className="h-16 w-16 rounded-2xl bg-student/10 flex items-center justify-center mx-auto mb-4 icon-hover-animate">
              <GraduationCap className="h-8 w-8 text-student" />
            </div>
            <CardTitle className="font-display text-2xl">Student Portal</CardTitle>
            <CardDescription>
              Sign in to access your learning dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="student@example.com"
                      value={signInData.email}
                      onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                      className="input-focus-glow"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      className="input-focus-glow"
                      required
                    />
                  </div>
                  <Button type="submit" variant="student" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email *</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="student@example.com"
                      value={signUpData.email}
                      onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                      className="input-focus-glow"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password *</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                      className="input-focus-glow"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-name">Student Name *</Label>
                    <Input
                      id="student-name"
                      type="text"
                      placeholder="Your unique student name"
                      value={signUpData.studentName}
                      onChange={(e) => setSignUpData({ ...signUpData, studentName: e.target.value })}
                      className="input-focus-glow"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="full-name">Full Name</Label>
                      <Input
                        id="full-name"
                        type="text"
                        placeholder="John Doe"
                        value={signUpData.fullName}
                        onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                        className="input-focus-glow"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="grade">Grade</Label>
                      <Input
                        id="grade"
                        type="text"
                        placeholder="10th"
                        value={signUpData.grade}
                        onChange={(e) => setSignUpData({ ...signUpData, grade: e.target.value })}
                        className="input-focus-glow"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 234 567 8900"
                      value={signUpData.phone}
                      onChange={(e) => setSignUpData({ ...signUpData, phone: e.target.value })}
                      className="input-focus-glow"
                    />
                  </div>
                  <Button type="submit" variant="student" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentLogin;

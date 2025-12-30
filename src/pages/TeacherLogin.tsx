import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { signIn, getUserRole } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Users, ArrowLeft, Loader2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { z } from "zod";

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const TeacherLogin = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const validated = signInSchema.parse({ email, password });
      const { user } = await signIn(validated.email, validated.password);
      
      if (!user) {
        throw new Error("Sign in failed");
      }

      // Verify the user is a teacher
      const userRole = await getUserRole(user.id);
      
      if (userRole !== "teacher") {
        await supabase.auth.signOut();
        toast({
          title: "Access Denied",
          description: "This portal is for teachers only. Please use the appropriate login page.",
          variant: "destructive",
        });
        return;
      }

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
      {/* Global Navbar */}
      <Navbar showAboutLink={false} />

      <div className="flex-1 flex items-center justify-center px-6 pb-16 pt-24">
        <Card className="w-full max-w-md border-teacher/30 shadow-xl animate-fade-in">
          <CardHeader className="text-center pb-2">
            <div className="h-16 w-16 rounded-2xl bg-teacher/10 flex items-center justify-center mx-auto mb-4 icon-hover-animate">
              <Users className="h-8 w-8 text-teacher" />
            </div>
            <CardTitle className="font-display text-2xl">Teacher Portal</CardTitle>
            <CardDescription>
              Sign in with your teacher account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="teacher@shobsacademy.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-focus-glow"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-focus-glow"
                  required
                />
              </div>
              <Button type="submit" variant="teacher" className="w-full" disabled={loading}>
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
            <p className="text-center text-sm text-muted-foreground mt-6">
              Teacher accounts are created by administrators.
              <br />
              Contact your admin if you don't have an account.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeacherLogin;

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { signIn, getUserRole } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Seo } from "@/components/Seo";
import { z } from "zod";
import shobsLogo from "@/assets/shobs-academy-logo.png";
const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters")
});
const AdminLogin = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    user,
    role,
    loading: authLoading
  } = useAuth();
  useEffect(() => {
    if (!authLoading && user && role) {
      navigate(`/${role}`, {
        replace: true
      });
    }
  }, [user, role, authLoading, navigate]);
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const validated = signInSchema.parse({
        email,
        password
      });

      // Clear any existing session to prevent conflicts
      await supabase.auth.signOut({ scope: 'local' });

      const {
        user
      } = await signIn(validated.email, validated.password);
      if (!user) {
        throw new Error("Sign in failed");
      }
      const userRole = await getUserRole(user.id);
      if (userRole !== "admin") {
        await supabase.auth.signOut();
        toast({
          title: "Access Denied",
          description: "This portal is for administrators only.",
          variant: "destructive"
        });
        return;
      }
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in as administrator."
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) newErrors[err.path[0] as string] = err.message;
        });
        setErrors(newErrors);
      } else {
        toast({
          title: "Sign in failed",
          description: error.message || "Please check your credentials and try again.",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center auth-page-admin">
        <Loader2 className="h-8 w-8 animate-spin text-teacher" />
      </div>;
  }
  return <div className="min-h-screen flex flex-col auth-page-admin">
      <Seo
        title="Admin Login — Shobs Academy"
        description="Sign in to the Shobs Academy admin console to manage teachers, students, fees, and academy operations."
        path="/admin-login"
      />
      <Navbar showAboutLink={false} />

      <div className="flex-1 flex items-center justify-center px-4 py-8 pt-24">
        <div className="auth-card auth-card-admin animate-auth-fade-in">
          {/* Logo */}
          <div className="auth-logo auth-logo-admin">
            <img src={shobsLogo} alt="Shobs Academy" className="w-10 h-10 object-contain" />
          </div>

          {/* Header */}
          <h1 className="auth-heading">Admin Portal</h1>
          <p className="auth-subheading">
            Sign in with your administrator credentials
          </p>

          {/* Form */}
          <form onSubmit={handleSignIn} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Admin User ID</label>
              <Input type="email" placeholder="admin@shobsacademy.com" value={email} onChange={e => setEmail(e.target.value)} className={`auth-input auth-input-admin ${errors.email ? "auth-input-error" : ""}`} required />
              {errors.email && <div className="auth-error">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email}
                </div>}
            </div>

            <div className="auth-field">
              <label className="auth-label">Admin Password</label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} className={`auth-input auth-input-admin pr-10 ${errors.password ? "auth-input-error" : ""}`} required />
                <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <div className="auth-error">
                  <AlertCircle className="w-3 h-3" />
                  {errors.password}
                </div>}
            </div>

            <button type="submit" className="auth-button auth-button-admin" disabled={loading}>
              {loading ? <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </> : "Sign In"}
            </button>
          </form>

          {/* Footer Info */}
          <div className="auth-info-box auth-info-box-admin">
            <p className="text-sm text-center">
              Admin accounts are provisioned in the backend.
            </p>
          </div>
        </div>
      </div>
    </div>;
};
export default AdminLogin;
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { signIn, signUpStudent } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import { GraduationCap, Loader2, Eye, EyeOff, Check, AlertCircle } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { z } from "zod";
import shobsLogo from "@/assets/shobs-academy-logo.png";

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
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signInData, setSignInData] = useState({ email: "", password: "" });
  const [signUpData, setSignUpData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    studentName: "",
    fullName: "",
    phone: "",
    grade: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, role, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user && role) {
      navigate(`/${role}`, { replace: true });
    }
  }, [user, role, authLoading, navigate]);

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const getStrengthLabel = (strength: number) => {
    if (strength <= 1) return { label: "Weak", color: "bg-red-500" };
    if (strength <= 2) return { label: "Fair", color: "bg-orange-500" };
    if (strength <= 3) return { label: "Good", color: "bg-yellow-500" };
    return { label: "Strong", color: "bg-green-500" };
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const validated = signInSchema.parse(signInData);
      await signIn(validated.email, validated.password);
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) newErrors[err.path[0] as string] = err.message;
        });
        setErrors(newErrors);
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
    setErrors({});
    
    if (signUpData.password !== signUpData.confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match" });
      return;
    }
    
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
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) newErrors[err.path[0] as string] = err.message;
        });
        setErrors(newErrors);
      } else if (error.message?.includes("duplicate")) {
        setErrors({ studentName: "This student name is already taken" });
      } else if (error.message?.includes("already registered")) {
        setErrors({ email: "This email is already registered" });
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center auth-page-student">
        <Loader2 className="h-8 w-8 animate-spin text-student" />
      </div>
    );
  }

  const passwordStrength = getPasswordStrength(signUpData.password);
  const strengthInfo = getStrengthLabel(passwordStrength);

  return (
    <div className="min-h-screen flex flex-col auth-page-student">
      <Navbar showAboutLink={false} />

      <div className="flex-1 flex items-center justify-center px-4 py-8 pt-24">
        <div className="auth-card auth-card-student animate-auth-fade-in">
          {/* Logo */}
          <div className="auth-logo auth-logo-student">
            <img src={shobsLogo} alt="Shobs Academy" className="w-10 h-10 object-contain" />
          </div>

          {/* Header */}
          <h1 className="auth-heading">
            {activeTab === "signin" ? "Welcome Back!" : "Create Student Account"}
          </h1>
          <p className="auth-subheading">
            {activeTab === "signin" 
              ? "Sign in to access your personalized learning dashboard" 
              : "Join Shobs Academy and start your learning journey"}
          </p>

          {/* Tab Switcher */}
          <div className="auth-tabs">
            <button
              className={`auth-tab ${activeTab === "signin" ? "auth-tab-active-student" : ""}`}
              onClick={() => setActiveTab("signin")}
            >
              Sign In
            </button>
            <button
              className={`auth-tab ${activeTab === "signup" ? "auth-tab-active-student" : ""}`}
              onClick={() => setActiveTab("signup")}
            >
              Sign Up
            </button>
          </div>

          {/* Sign In Form */}
          {activeTab === "signin" && (
            <form onSubmit={handleSignIn} className="auth-form">
              <div className="auth-field">
                <label className="auth-label">Email</label>
                <Input
                  type="email"
                  placeholder="student@example.com"
                  value={signInData.email}
                  onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                  className={`auth-input auth-input-student ${errors.email ? "auth-input-error" : ""}`}
                  required
                />
                {errors.email && (
                  <div className="auth-error">
                    <AlertCircle className="w-3 h-3" />
                    {errors.email}
                  </div>
                )}
              </div>

              <div className="auth-field">
                <label className="auth-label">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={signInData.password}
                    onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                    className={`auth-input auth-input-student pr-10 ${errors.password ? "auth-input-error" : ""}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <div className="auth-error">
                    <AlertCircle className="w-3 h-3" />
                    {errors.password}
                  </div>
                )}
              </div>

              <button type="submit" className="auth-button auth-button-student" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          )}

          {/* Sign Up Form */}
          {activeTab === "signup" && (
            <form onSubmit={handleSignUp} className="auth-form">
              <div className="auth-field">
                <label className="auth-label">Email *</label>
                <Input
                  type="email"
                  placeholder="student@example.com"
                  value={signUpData.email}
                  onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                  className={`auth-input auth-input-student ${errors.email ? "auth-input-error" : ""}`}
                  required
                />
                {errors.email && (
                  <div className="auth-error">
                    <AlertCircle className="w-3 h-3" />
                    {errors.email}
                  </div>
                )}
              </div>

              <div className="auth-field">
                <label className="auth-label">Student Name *</label>
                <Input
                  type="text"
                  placeholder="Your unique student name"
                  value={signUpData.studentName}
                  onChange={(e) => setSignUpData({ ...signUpData, studentName: e.target.value })}
                  className={`auth-input auth-input-student ${errors.studentName ? "auth-input-error" : ""}`}
                  required
                />
                {errors.studentName && (
                  <div className="auth-error">
                    <AlertCircle className="w-3 h-3" />
                    {errors.studentName}
                  </div>
                )}
              </div>

              <div className="auth-field">
                <label className="auth-label">Password *</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 6 characters"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                    className={`auth-input auth-input-student pr-10 ${errors.password ? "auth-input-error" : ""}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {signUpData.password && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            passwordStrength >= level ? strengthInfo.color : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">{strengthInfo.label}</span>
                  </div>
                )}
                {errors.password && (
                  <div className="auth-error">
                    <AlertCircle className="w-3 h-3" />
                    {errors.password}
                  </div>
                )}
              </div>

              <div className="auth-field">
                <label className="auth-label">Confirm Password *</label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={signUpData.confirmPassword}
                    onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                    className={`auth-input auth-input-student pr-10 ${errors.confirmPassword ? "auth-input-error" : ""}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <div className="auth-error">
                    <AlertCircle className="w-3 h-3" />
                    {errors.confirmPassword}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="auth-field">
                  <label className="auth-label">Full Name</label>
                  <Input
                    type="text"
                    placeholder="John Doe"
                    value={signUpData.fullName}
                    onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                    className="auth-input auth-input-student"
                  />
                </div>
                <div className="auth-field">
                  <label className="auth-label">Grade</label>
                  <Input
                    type="text"
                    placeholder="10th"
                    value={signUpData.grade}
                    onChange={(e) => setSignUpData({ ...signUpData, grade: e.target.value })}
                    className="auth-input auth-input-student"
                  />
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label">Phone</label>
                <Input
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={signUpData.phone}
                  onChange={(e) => setSignUpData({ ...signUpData, phone: e.target.value })}
                  className="auth-input auth-input-student"
                />
              </div>

              <button type="submit" className="auth-button auth-button-student" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="auth-footer">
            {activeTab === "signin" ? (
              <p>
                Don't have an account?{" "}
                <button onClick={() => setActiveTab("signup")} className="auth-footer-link auth-footer-link-student">
                  Sign up now
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button onClick={() => setActiveTab("signin")} className="auth-footer-link auth-footer-link-student">
                  Sign in here
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentLogin;

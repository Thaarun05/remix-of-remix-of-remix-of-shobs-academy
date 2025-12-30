import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useState } from "react";

interface NavbarProps {
  showAboutLink?: boolean;
  variant?: "default" | "student" | "teacher" | "admin";
}

export function Navbar({ showAboutLink = true, variant = "default" }: NavbarProps) {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSigningOut(false);
    }
  };

  const scrollToAbout = () => {
    document.getElementById("about-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const isLoggedIn = !!user && !!role;
  const linkColorClass = variant === "student" ? "text-student" : "text-teacher";
  const logoutColorClass = variant === "student" 
    ? "text-student hover:bg-student/10" 
    : "text-teacher hover:bg-teacher/10";

  return (
    <nav className="navbar">
      {/* LEFT: Logo + Brand Name */}
      <Link to="/" className="navbar-brand">
        <div className="navbar-logo">
          <Logo size="md" className="w-full h-full object-contain" />
        </div>
        <span className="navbar-name hidden sm:block">Shobs Academy</span>
      </Link>

      {/* CENTER: Empty */}
      <div className="navbar-nav"></div>

      {/* RIGHT: User Info + Logout */}
      <div className="navbar-right">
        {isLoggedIn && (
          <>
            <span className="navbar-user-email hidden sm:block">
              {user?.email}
            </span>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className={`navbar-logout-btn ${logoutColorClass}`}
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-1.5 inline" />
                  <span className="hidden sm:inline">Sign Out</span>
                </>
              )}
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

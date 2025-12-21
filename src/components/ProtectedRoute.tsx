import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/lib/auth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: UserRole;
}

export function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Redirect to appropriate login page
    const loginPath = `/${allowedRole}-login`;
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (role !== allowedRole) {
    // Role mismatch - redirect to correct dashboard or show access denied
    if (role) {
      return <Navigate to={`/${role}`} replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

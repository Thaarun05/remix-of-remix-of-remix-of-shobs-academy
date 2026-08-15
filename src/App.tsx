import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingState } from "@/components/StateViews";
import Index from "./pages/Index";

const About = lazy(() => import("./pages/About"));
const StudentLogin = lazy(() => import("./pages/StudentLogin"));
const TeacherLogin = lazy(() => import("./pages/TeacherLogin"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SharedWhiteboard = lazy(() => import("./pages/SharedWhiteboard"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const RouteFallback = () => (
  <div className="flex min-h-dvh items-center justify-center px-6 py-24">
    <LoadingState label="Loading" description="Preparing this page." />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
          >
            Skip to main content
          </a>
          <ErrorBoundary area="This page">
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Index />} />
                <Route path="/about" element={<About />} />
                <Route path="/student-login" element={<StudentLogin />} />
                <Route path="/teacher-login" element={<TeacherLogin />} />
                <Route path="/admin-login" element={<AdminLogin />} />

                {/* Protected routes */}
                <Route
                  path="/student"
                  element={
                    <ProtectedRoute allowedRole="student">
                      <StudentDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/teacher"
                  element={
                    <ProtectedRoute allowedRole="teacher">
                      <TeacherDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRole="admin">
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Shared whiteboard view */}
                <Route path="/whiteboard" element={<SharedWhiteboard />} />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

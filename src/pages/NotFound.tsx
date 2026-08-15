import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { SiteFooter } from "@/components/SiteFooter";
import { Seo } from "@/components/Seo";
import { Compass } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Seo
        title="Page not found — Shobs Academy"
        description="The page you were looking for does not exist. Return to Shobs Academy to book a demo or sign in to your portal."
        path={location.pathname}
      />
      <Navbar showAboutLink />
      <main id="main-content" className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Compass className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <p className="mb-2 font-mono text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Error 404
          </p>
          <h1 className="font-serif text-3xl font-bold text-foreground">Page not found</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            The page you were looking for has moved or never existed. Let's get you back on track.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/"><Button size="lg">Back to home</Button></Link>
            <Link to="/about"><Button size="lg" variant="outline">About the academy</Button></Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default NotFound;

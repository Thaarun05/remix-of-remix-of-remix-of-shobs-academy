import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Short label describing the area, e.g. "Worksheet Builder". */
  area?: string;
}

interface State {
  error: Error | null;
}

/** Catches render errors so one failing panel never blanks the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, info);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" className="mx-auto flex max-w-lg flex-col items-center rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
        </div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Something went wrong
        </p>
        <h2 className="font-serif text-lg font-bold text-foreground">
          {this.props.area ? `${this.props.area} could not load` : "This section could not load"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          An unexpected error occurred. You can try again, or reload the page if the problem persists.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={this.reset}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>Reload page</Button>
        </div>
      </div>
    );
  }
}

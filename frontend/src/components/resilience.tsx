import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, CloudOff, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Card } from './ui';

/**
 * Shown INSTEAD of a section whose data is missing or malformed in the API
 * response (QA fix H2). It never pretends the values are zero.
 */
export function DataUnavailable({ what, compact = false }: { what: string; compact?: boolean }) {
  return (
    <div role="status" className={`flex items-start gap-3 text-sm ${compact ? '' : 'px-5 py-6'}`}>
      <CloudOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <div>
        <p className="font-medium text-ink">{what} is unavailable</p>
        <p className="mt-0.5 text-muted">
          The server did not send this information. It may be running an older FitSync version, or the data could not be loaded. Other information on this page is not affected.
        </p>
      </div>
    </div>
  );
}

/** Whole-section notice used when a dashboard response has no usable `fitness` object. */
export function FitnessSectionUnavailable() {
  return (
    <Card title="Fitness management">
      <DataUnavailable what="Plan completion, goal and feedback data" compact />
    </Card>
  );
}

interface BoundaryProps {
  children: ReactNode;
  /** Changing this value (e.g. the route path) clears a previous error. */
  resetKey?: string;
  homePath?: string;
}

interface BoundaryState {
  error: Error | null;
}

/**
 * Route-level error boundary (QA fix H2): if a page throws while rendering,
 * only the page area shows a recovery message; the navigation stays usable
 * and the user can retry or go back to the dashboard.
 */
export class PageErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('FitSync page error:', error, info.componentStack);
  }

  componentDidUpdate(prev: BoundaryProps): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="card mx-auto mt-6 flex max-w-xl flex-col items-center gap-3 px-6 py-10 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-danger/10 text-danger">
          <AlertTriangle className="size-5" aria-hidden />
        </span>
        <h2 className="text-base font-semibold text-ink">This page could not be displayed</h2>
        <p className="max-w-md text-sm text-muted">
          Something in the data received from the server was not in the expected format. Your data has not been changed. Try again, or use the menu to open another page.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button icon={RefreshCw} onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
          {this.props.homePath && (
            <Link to={this.props.homePath} className="inline-flex items-center rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-raised">
              Go to dashboard
            </Link>
          )}
        </div>
      </div>
    );
  }
}

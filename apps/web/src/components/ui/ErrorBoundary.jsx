import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('[ErrorBoundary]', error, info.componentStack); }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4" role="alert">
        <div className="card p-8 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-red-400" aria-hidden />
          </div>
          <h1 className="text-base font-semibold text-ink-primary">Something went wrong</h1>
          <p className="text-sm text-ink-secondary">
            An unexpected error occurred. The error has been logged.
          </p>
          {this.state.error?.message && (
            <pre className="text-left text-[10px] font-mono bg-canvas rounded-md p-3 text-ink-muted overflow-auto max-h-32">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/dashboard'; }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-accent/10 text-accent border border-accent/30 text-sm hover:bg-accent/20 transition-colors">
            <RefreshCw className="w-4 h-4" aria-hidden /> Return to Dashboard
          </button>
        </div>
      </div>
    );
  }
}

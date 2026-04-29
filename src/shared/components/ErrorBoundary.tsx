import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.label ?? '', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="text-red-500" size={18} />
            </div>
            <h2 className="font-semibold text-neutral-900 text-base">
              Une erreur est survenue{this.props.label ? ` dans ${this.props.label}` : ''}
            </h2>
          </div>
          <p className="text-red-600 font-mono text-sm mb-4 break-words bg-red-50 rounded-lg px-4 py-3">
            {this.state.error.message}
          </p>
          <pre className="text-neutral-400 text-xs overflow-auto max-h-40 bg-neutral-50 border border-neutral-200 rounded-xl p-4 mb-4">
            {this.state.error.stack}
          </pre>
          <button
            onClick={this.reset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-700 text-white text-sm font-medium transition-colors"
          >
            <RefreshCw size={14} />
            Réessayer
          </button>
        </div>
      </div>
    );
  }
}

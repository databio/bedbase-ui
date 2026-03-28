import { Component, type ReactNode } from 'react';
import { Undo2 } from 'lucide-react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-dvh gap-4 px-4 pb-16">
          <h1 className="text-xl font-light text-base-content">Something went wrong.</h1>
          <div className="bg-base-200/50 border border-base-300 rounded-lg px-4 py-3 max-w-lg w-full">
            <p className="text-xs font-mono text-base-content/50 break-words">
              {this.state.error.message}
            </p>
          </div>
          <button
            onClick={() => window.history.back()}
            className="btn btn-sm btn-primary gap-1.5 rounded-full"
          >
            <Undo2 size={14} />
            Return
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

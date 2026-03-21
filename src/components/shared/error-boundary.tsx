import { Component, type ReactNode } from 'react';

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
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
          <h1 className="text-lg font-semibold text-base-content">Something went wrong</h1>
          <p className="text-sm text-base-content/60 max-w-md text-center">
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="btn btn-sm btn-primary"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

import { Component, type ReactNode } from 'react';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary specifically for Relay GraphQL errors.
 * Catches errors from Relay queries/mutations and provides retry functionality.
 */
export class RelayErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[RelayErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full">
            <Alert type="error">
              <div className="space-y-3">
                <p className="font-medium">Something went wrong</p>
                <p className="text-sm">{this.state.error.message}</p>
                <Button onClick={this.handleRetry} variant="secondary" size="sm">
                  Try Again
                </Button>
              </div>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

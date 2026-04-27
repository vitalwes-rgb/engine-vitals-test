import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'An unexpected error occurred.';
      let isFirebaseError = false;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.authInfo) {
            errorMessage = `Firebase Permission Error: ${parsed.error} during ${parsed.operationType} on ${parsed.path}`;
            isFirebaseError = true;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6 text-white">
          <div className="max-w-md w-full bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">System Error</h1>
              <p className="text-[#A3A3A3] text-sm leading-relaxed">
                {errorMessage}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReset}
                className="w-full bg-[#F27D26] hover:bg-[#D96A1C] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw className="w-4 h-4" /> Restart Application
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-[#262626] hover:bg-[#323232] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
              >
                <Home className="w-4 h-4" /> Reload Page
              </button>
            </div>

            {isFirebaseError && (
              <p className="text-[10px] text-[#525252] italic">
                * This error is related to database permissions. Please contact support if it persists.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

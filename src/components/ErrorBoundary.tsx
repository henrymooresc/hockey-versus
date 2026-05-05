"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  label?: string;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[ErrorBoundary${this.props.label ? ` ${this.props.label}` : ""}]`, error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-6 py-5 text-center">
          <div className="text-sm font-semibold text-red-300">
            {this.props.label ? `${this.props.label} couldn't load` : "Something went wrong"}
          </div>
          <div className="mt-1 text-xs text-red-400/70">{this.state.error.message}</div>
          <button
            onClick={this.reset}
            className="mt-3 rounded-md border border-red-700/60 bg-red-900/30 px-3 py-1 text-xs font-medium text-red-200 hover:bg-red-900/50 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

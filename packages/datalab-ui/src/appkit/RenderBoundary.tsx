import { Component, type ErrorInfo, type ReactNode } from "react";

export interface RenderBoundaryProps {
  children: ReactNode;
  resetKey: string;
  fallback: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface RenderBoundaryState {
  error: Error | null;
}

/** Contains unexpected render/lifecycle failures and supports explicit reset. */
export class RenderBoundary extends Component<RenderBoundaryProps, RenderBoundaryState> {
  state: RenderBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): RenderBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, info);
      return;
    }
    console.error("contained React render failure", error, info);
  }

  componentDidUpdate(previous: RenderBoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  private readonly reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) return this.props.fallback(this.state.error, this.reset);
    return this.props.children;
  }
}

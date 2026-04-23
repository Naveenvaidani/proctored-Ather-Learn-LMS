/* eslint-disable */
/* eslint-disable react/forbid-dom-props */
import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Aether UI boundary captured an error", error, info);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="app-shell">
          <div className="card" style={{ padding: "2rem" }}>
            <h1 style={{ fontFamily: "var(--font-heading)", marginTop: 0 }}>Recovery Mode</h1>
            <p style={{ color: "var(--text-soft)", marginBottom: 0 }}>
              The interface hit an unexpected issue. Refresh to recover your session.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}



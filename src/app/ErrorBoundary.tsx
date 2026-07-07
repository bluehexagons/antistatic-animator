import React, { Component } from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  label: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, _info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label}]`, error);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className={`panelError ${this.props.label}`}>
          <div className="panelErrorInner">
            <span className="panelErrorIcon">⚠</span>
            <div>
              <strong>{this.props.label} crashed</strong>
              <p>{this.state.error.message}</p>
            </div>
            <button className="btn" onClick={this.handleReset}>
              Reset panel
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

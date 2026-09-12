import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    console.error('[ErrorBoundary]', error);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page container" style={{ paddingTop: 40 }}>
        <div className="panel panel-pad stack" style={{ gap: 14, alignItems: 'flex-start' }}>
          <span className="eyebrow">Something went wrong</span>
          <h2 className="display-lg" style={{ margin: 0 }}>The table lost its nerve.</h2>
          <p className="muted" style={{ margin: 0 }}>
            A render error crashed this view. Reload to get back to the action.
          </p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
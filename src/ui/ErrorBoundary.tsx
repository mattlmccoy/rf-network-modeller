import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; onReset: () => void }
interface State { error: string | null }

/** A project that can't be shown gets a way out, never a blank page (review I5). */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(e: unknown): State {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    return (
      <main className="home">
        <p className="bad">This project can't be shown: {this.state.error}</p>
        <button onClick={() => { this.setState({ error: null }); this.props.onReset(); }}>Open the O7 example instead</button>
      </main>
    );
  }
}

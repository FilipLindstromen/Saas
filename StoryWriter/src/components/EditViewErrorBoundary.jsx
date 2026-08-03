import { Component } from 'react';

export default class EditViewErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[Edit] Render error:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    const { fallback } = this.props;
    if (error) {
      if (fallback) return fallback;
      return (
        <div className="edit-view-fallback" role="alert">
          <p className="edit-view-fallback__title">Edit mode couldn&apos;t load</p>
          <p className="edit-view-fallback__detail">
            {error?.message || 'Something went wrong in the editor.'}
          </p>
          <button
            type="button"
            className="edit-view-fallback__retry"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Catches render errors in role layouts so users see recovery UI instead of a blank page.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { rbac } from '../utils/rbac';

class PageErrorBoundaryInner extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[PageErrorBoundary]', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 max-w-lg mx-auto my-8 text-center space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Something went wrong on this page</h2>
          <p className="text-sm text-muted-foreground">
            A display error occurred (often after changing filters). You can go back to your dashboard or try again.
          </p>
          {this.state.error?.message && (
            <p className="text-xs text-muted-foreground font-mono break-all">{this.state.error.message}</p>
          )}
          <div className="flex flex-wrap gap-2 justify-center">
            <Button type="button" variant="default" onClick={() => this.props.navigate(this.props.homePath)}>
              Go to dashboard
            </Button>
            <Button type="button" variant="outline" onClick={this.handleRetry}>
              Try again
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PageErrorBoundary({ children, userRole }) {
  const navigate = useNavigate();
  const homePath = rbac.getDefaultRoute(userRole);

  return (
    <PageErrorBoundaryInner navigate={navigate} homePath={homePath}>
      {children}
    </PageErrorBoundaryInner>
  );
}

export default PageErrorBoundary;

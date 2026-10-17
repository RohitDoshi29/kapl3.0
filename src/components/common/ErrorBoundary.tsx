import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('KAPL UI Error Caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="w-full max-w-lg border-destructive/30 shadow-2xl bg-card">
            <CardHeader className="text-center pb-3">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
                <AlertCircle className="w-8 h-8" />
              </div>
              <CardTitle className="text-xl font-bold font-display text-foreground">
                {this.props.fallbackTitle || 'Something went wrong'}
              </CardTitle>
              <CardDescription className="text-xs md:text-sm text-muted-foreground">
                {this.props.fallbackDescription || 'A momentary rendering hiccup occurred. You can reload this view safely.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/15 text-xs text-destructive font-mono overflow-auto max-h-32">
                  {this.state.error.message || String(this.state.error)}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button onClick={this.handleReset} className="flex-1 gap-2 bg-primary text-primary-foreground font-bold">
                  <RotateCcw className="w-4 h-4" />
                  Reload Page
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = '/';
                  }}
                  className="flex-1 gap-2 font-bold"
                >
                  <Home className="w-4 h-4 text-amber-400" />
                  Go to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}


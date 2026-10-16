import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, AlertCircle, Home, LogOut } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { isAuthenticated, isLoading, userRole, signOut } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center animate-pulse shadow-lg shadow-primary/20">
          <Trophy className="w-8 h-8 text-primary-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading KAPL 3.0...</p>
      </div>
    );
  }

  // Mandatory Authentication Check
  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Role-Based Authorization Check (if allowedRoles specified)
  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = userRole && (allowedRoles.includes(userRole) || userRole === 'admin');
    if (!hasRole) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
          <Card className="w-full max-w-md shadow-xl border-destructive/20 text-center">
            <CardHeader>
              <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle className="text-2xl font-bold">Access Restricted</CardTitle>
              <CardDescription>
                You need elevated privileges ({allowedRoles.join(' / ')}) to access this page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full h-11 gap-2" variant="default">
                <a href="/">
                  <Home className="w-4 h-4" />
                  Back to Scoreboard
                </a>
              </Button>
              <Button
                variant="outline"
                className="w-full h-11 gap-2 text-muted-foreground"
                onClick={() => signOut()}
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  return <>{children}</>;
}


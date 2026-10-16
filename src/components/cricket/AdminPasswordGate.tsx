import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, LogIn, UserPlus, AlertCircle, Home } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

interface AdminPasswordGateProps {
  children: React.ReactNode;
}

// Input validation schemas
const emailSchema = z.string().trim().email({ message: "Invalid email address" }).max(255);
const passwordSchema = z.string().min(8, { message: "Password must be at least 8 characters" }).max(72);

export function AdminPasswordGate({ children }: AdminPasswordGateProps) {
  const navigate = useNavigate();
  const { isAuthenticated, hasAccess, isLoading, signIn, signUp, signOut, isMainAdmin, isAdmin, user } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading KAPL Admin...</div>
      </div>
    );
  }

  const isMain = isMainAdmin || (user?.email && user.email.toLowerCase().trim() === 'rohit.doshi2007@gmail.com');
  const allowed = isAuthenticated && (hasAccess || isMain || isAdmin);

  // User is authenticated and has scorer/admin access - show content
  if (allowed) {
    return <>{children}</>;
  }

  // User is authenticated but doesn't have scorer access - show access denied
  if (isAuthenticated && !hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Access Denied</CardTitle>
            <CardDescription>
              You don't have scorer privileges. Please contact an administrator to be assigned as a tournament scorer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={async () => {
                await signOut();
                navigate('/');
              }} 
              variant="outline" 
              className="w-full h-12 gap-2"
            >
              <Home className="w-5 h-5" />
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const validateInputs = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      errors.email = emailResult.error.errors[0].message;
    }
    
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      errors.password = passwordResult.error.errors[0].message;
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateInputs()) {
      return;
    }
    
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('This email is already registered. Please sign in instead.');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Account created! You can now sign in.');
          setIsSignUp(false);
          setPassword('');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Welcome back!');
        }
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            {isSignUp ? <UserPlus className="w-8 h-8 text-primary" /> : <Lock className="w-8 h-8 text-primary" />}
          </div>
          <CardTitle className="text-2xl">
            {isSignUp ? 'Create Account' : 'Admin Login'}
          </CardTitle>
          <CardDescription>
            {isSignUp
              ? 'Create an account to request admin access'
              : 'Sign in with your admin credentials'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setValidationErrors(prev => ({ ...prev, email: undefined }));
                }}
                className={`h-12 ${validationErrors.email ? 'border-destructive' : ''}`}
                disabled={isSubmitting}
                autoComplete="email"
              />
              {validationErrors.email && (
                <p className="text-sm text-destructive mt-1">{validationErrors.email}</p>
              )}
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setValidationErrors(prev => ({ ...prev, password: undefined }));
                }}
                className={`h-12 ${validationErrors.password ? 'border-destructive' : ''}`}
                disabled={isSubmitting}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
              {validationErrors.password && (
                <p className="text-sm text-destructive mt-1">{validationErrors.password}</p>
              )}
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 text-lg gap-2" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                'Please wait...'
              ) : isSignUp ? (
                <>
                  <UserPlus className="w-5 h-5" />
                  Create Account
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setValidationErrors({});
              }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
              disabled={isSubmitting}
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

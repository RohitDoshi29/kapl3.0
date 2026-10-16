import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'co_admin' | 'scorer' | 'primary_scorer' | 'secondary_scorer' | 'owner' | 'captain' | 'player' | 'user' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCoAdmin: boolean;
  isSuperAdmin: boolean;
  isScorer: boolean;
  isOwner: boolean;
  isCaptain: boolean;
  isPlayer: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, desiredRole?: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  refreshUserRole: () => Promise<void>;
  assignUserRole: (userId: string, role: UserRole) => Promise<{ error: Error | null }>;
  assignRoleByEmail: (email: string, role: UserRole) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRole = useCallback(async (userId: string, userEmail?: string | null): Promise<UserRole> => {
    // Rohit Doshi is permanent super admin
    if (userEmail && userEmail.toLowerCase() === 'rohit.doshi2007@gmail.com') {
      return 'admin';
    }

    // Check pre-assigned role by email in localStorage
    if (userEmail) {
      try {
        const storedRoles = JSON.parse(localStorage.getItem('kapl_email_roles') || '{}');
        const assignedRole = storedRoles[userEmail.toLowerCase().trim()];
        if (assignedRole) {
          return assignedRole as UserRole;
        }
      } catch (e) {}
    }

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        console.error('Error checking user role:', error);
        return null;
      }

      const roles = data?.map(r => r.role) || [];
      if (roles.includes('admin')) return 'admin';
      if (roles.includes('co_admin')) return 'co_admin';
      if (roles.includes('scorer')) return 'scorer';
      if (roles.includes('primary_scorer')) return 'scorer';
      if (roles.includes('secondary_scorer')) return 'scorer';
      if (roles.includes('owner')) return 'owner';
      if (roles.includes('captain')) return 'captain';
      if (roles.includes('player')) return 'player';
      if (roles.includes('user')) return 'player';

      return 'player';
    } catch (err) {
      console.error('Error in fetchUserRole:', err);
      return null;
    }
  }, []);

  const refreshUserRole = useCallback(async () => {
    if (user) {
      const role = await fetchUserRole(user.id, user.email);
      setUserRole(role);
    }
  }, [user, fetchUserRole]);

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: Never stay stuck on loading for more than 1.5s
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setIsLoading(false);
      }
    }, 1500);

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const role = await fetchUserRole(session.user.id, session.user.email);
          if (isMounted) {
            setUserRole(role);
            setIsLoading(false);
          }
        } else {
          if (isMounted) {
            setUserRole(null);
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.warn('Session check error, resolving loading:', err);
        if (isMounted) setIsLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        try {
          const role = await fetchUserRole(session.user.id, session.user.email);
          if (isMounted) {
            setUserRole(role);
            setIsLoading(false);
          }
        } catch {
          if (isMounted) setIsLoading(false);
        }
      } else {
        if (isMounted) {
          setUserRole(null);
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchUserRole]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, desiredRole: string = 'player') => {
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { desired_role: 'player' },
      },
    });

    if (!error && data.user) {
      try {
        await supabase
          .from('user_roles')
          .insert({ user_id: data.user.id, role: 'player' as any })
          .select();
      } catch (e) {
        console.warn('Could not assign player role directly:', e);
      }
    }

    return { error: error ? new Error(error.message) : null };
  }, []);

  const assignUserRole = useCallback(async (userId: string, role: UserRole) => {
    if (!role) return { error: null };
    try {
      const { data: existing } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      let err: any = null;
      if (existing && existing.length > 0) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role: role as any })
          .eq('user_id', userId);
        err = error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: role as any });
        err = error;
      }
      return { error: err ? new Error(err.message) : null };
    } catch (e: any) {
      return { error: new Error(e.message || 'Failed to assign role') };
    }
  }, []);

  const assignRoleByEmail = useCallback(async (email: string, role: UserRole) => {
    if (!email.trim() || !role) return { error: null };
    try {
      const cleanEmail = email.toLowerCase().trim();
      const storedRoles = JSON.parse(localStorage.getItem('kapl_email_roles') || '{}');
      storedRoles[cleanEmail] = role;
      localStorage.setItem('kapl_email_roles', JSON.stringify(storedRoles));

      // If user currently signed in matches this email, immediately update active role
      if (user && user.email && user.email.toLowerCase() === cleanEmail) {
        setUserRole(role);
      }
      return { error: null };
    } catch (e: any) {
      return { error: new Error(e.message || 'Failed to assign role by email') };
    }
  }, [user]);

  const signInWithGoogle = useCallback(async () => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setSession(null);
      setUserRole(null);
    }
    return { error: error ? new Error(error.message) : null };
  }, []);

  const isAdmin = userRole === 'admin' || userRole === 'co_admin';
  const isCoAdmin = userRole === 'co_admin';
  const isSuperAdmin = user?.email?.toLowerCase() === 'rohit.doshi2007@gmail.com' || (userRole === 'admin' && userRole !== 'co_admin');
  const isScorer = userRole === 'admin' || userRole === 'co_admin' || userRole === 'scorer' || userRole === 'primary_scorer' || userRole === 'secondary_scorer';
  const isOwner = userRole === 'owner';
  const isCaptain = userRole === 'admin' || userRole === 'co_admin' || userRole === 'captain';
  const isPlayer = userRole === 'player' || !userRole || userRole === 'user';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole,
        isLoading,
        isAuthenticated: !!session,
        isAdmin,
        isCoAdmin,
        isSuperAdmin,
        isScorer,
        isOwner,
        isCaptain,
        isPlayer,
        signInWithPassword,
        signUp,
        signInWithGoogle,
        signOut,
        refreshUserRole,
        assignUserRole,
        assignRoleByEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


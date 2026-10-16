import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'co_admin' | 'scorer' | 'primary_scorer' | 'secondary_scorer' | 'owner' | 'captain' | 'player' | 'user' | null;

export interface UserProfile {
  name: string;
  email: string;
  photoUrl?: string;
  role: string;
  battingStyle: string;
  bowlingStyle: string;
  jerseyNumber?: number | null;
  mobileNumber?: string | null;
  bio?: string;
  tournamentId?: string;
  playerId?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole;
  profile: UserProfile | null;
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
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  refreshUserRole: () => Promise<void>;
  assignUserRole: (userId: string, role: UserRole) => Promise<{ error: Error | null }>;
  assignRoleByEmail: (email: string, role: UserRole) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserProfile = useCallback(async (userObj: User): Promise<UserProfile> => {
    const defaultName =
      userObj.user_metadata?.name ||
      userObj.user_metadata?.full_name ||
      userObj.email?.split('@')[0] ||
      'Player';
    const defaultPhoto = userObj.user_metadata?.avatar_url || userObj.user_metadata?.picture || '';

    // Check localStorage cache
    let localProfile: Partial<UserProfile> = {};
    try {
      const raw =
        localStorage.getItem(`kapl_profile_${userObj.id}`) ||
        (userObj.email ? localStorage.getItem(`kapl_profile_${userObj.email.toLowerCase()}`) : null);
      if (raw) localProfile = JSON.parse(raw);
    } catch {}

    let dbPlayer: any = null;
    try {
      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('user_id', userObj.id)
        .maybeSingle();
      if (data) dbPlayer = data;
    } catch (e) {
      console.warn('Could not query players table for user profile:', e);
    }

    const merged: UserProfile = {
      name: dbPlayer?.name || localProfile.name || defaultName,
      email: userObj.email || '',
      photoUrl: dbPlayer?.photo_url || localProfile.photoUrl || defaultPhoto,
      role: dbPlayer?.role || localProfile.role || 'all_rounder',
      battingStyle: dbPlayer?.batting_style || localProfile.battingStyle || 'Right-hand bat',
      bowlingStyle: dbPlayer?.bowling_style || localProfile.bowlingStyle || 'Right-arm medium',
      jerseyNumber: dbPlayer?.jersey_number ?? localProfile.jerseyNumber ?? null,
      mobileNumber: dbPlayer?.mobile_number ?? localProfile.mobileNumber ?? null,
      bio: localProfile.bio || '',
      tournamentId: dbPlayer?.tournament_id || localProfile.tournamentId || 'kapl-3-mens',
      playerId: dbPlayer?.id || localProfile.playerId || null,
    };

    return merged;
  }, []);

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
      const prof = await fetchUserProfile(user);
      setProfile(prof);
    }
  }, [user, fetchUserRole, fetchUserProfile]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>): Promise<{ error: Error | null }> => {
    if (!user) {
      return { error: new Error('You must be signed in to update your profile.') };
    }

    try {
      const current = profile || await fetchUserProfile(user);
      const updated: UserProfile = {
        name: updates.name?.trim() || current.name || user.email?.split('@')[0] || 'Player',
        email: user.email || '',
        photoUrl: updates.photoUrl !== undefined ? updates.photoUrl : (current.photoUrl || ''),
        role: updates.role || current.role || 'all_rounder',
        battingStyle: updates.battingStyle || current.battingStyle || 'Right-hand bat',
        bowlingStyle: updates.bowlingStyle || current.bowlingStyle || 'Right-arm medium',
        jerseyNumber: updates.jerseyNumber !== undefined ? updates.jerseyNumber : current.jerseyNumber,
        mobileNumber: updates.mobileNumber !== undefined ? updates.mobileNumber : current.mobileNumber,
        bio: updates.bio !== undefined ? updates.bio : current.bio,
        tournamentId: updates.tournamentId || current.tournamentId || 'kapl-3-mens',
        playerId: current.playerId,
      };

      // 1. Update Supabase Auth metadata
      try {
        await supabase.auth.updateUser({
          data: {
            name: updated.name,
            avatar_url: updated.photoUrl,
            phone: updated.mobileNumber,
          },
        });
      } catch (e) {
        console.warn('Could not update user metadata:', e);
      }

      // 2. Persist to localStorage
      try {
        localStorage.setItem(`kapl_profile_${user.id}`, JSON.stringify(updated));
        if (user.email) {
          localStorage.setItem(`kapl_profile_${user.email.toLowerCase()}`, JSON.stringify(updated));
        }
      } catch (e) {
        console.warn('Could not save profile to localStorage:', e);
      }

      // 3. Sync with database players table
      try {
        const { data: existingPlayer } = await supabase
          .from('players')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingPlayer) {
          await supabase
            .from('players')
            .update({
              name: updated.name,
              photo_url: updated.photoUrl || null,
              role: updated.role,
              batting_style: updated.battingStyle || null,
              bowling_style: updated.bowlingStyle || null,
              jersey_number: updated.jerseyNumber ? Number(updated.jerseyNumber) : null,
              mobile_number: updated.mobileNumber || null,
              tournament_id: updated.tournamentId || 'kapl-3-mens',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingPlayer.id);
          updated.playerId = existingPlayer.id;
        } else {
          const generatedId = `p_u_${user.id.slice(0, 8)}`;
          const { error: insErr } = await supabase
            .from('players')
            .insert({
              id: generatedId,
              user_id: user.id,
              name: updated.name,
              photo_url: updated.photoUrl || null,
              role: updated.role,
              batting_style: updated.battingStyle || null,
              bowling_style: updated.bowlingStyle || null,
              jersey_number: updated.jerseyNumber ? Number(updated.jerseyNumber) : null,
              mobile_number: updated.mobileNumber || null,
              tournament_id: updated.tournamentId || 'kapl-3-mens',
              base_price: 100,
              auction_status: 'pending',
            });
          if (!insErr) {
            updated.playerId = generatedId;
          }
        }
      } catch (dbErr) {
        console.warn('Non-fatal error syncing player record with database:', dbErr);
      }

      setProfile(updated);
      return { error: null };
    } catch (err: any) {
      console.error('Error in updateProfile:', err);
      return { error: new Error(err.message || 'Failed to update profile') };
    }
  }, [user, profile, fetchUserProfile]);

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
          const [role, prof] = await Promise.all([
            fetchUserRole(session.user.id, session.user.email),
            fetchUserProfile(session.user),
          ]);
          if (isMounted) {
            setUserRole(role);
            setProfile(prof);
            setIsLoading(false);
          }
        } else {
          if (isMounted) {
            setUserRole(null);
            setProfile(null);
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
          const [role, prof] = await Promise.all([
            fetchUserRole(session.user.id, session.user.email),
            fetchUserProfile(session.user),
          ]);
          if (isMounted) {
            setUserRole(role);
            setProfile(prof);
            setIsLoading(false);
          }
        } catch {
          if (isMounted) setIsLoading(false);
        }
      } else {
        if (isMounted) {
          setUserRole(null);
          setProfile(null);
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchUserRole, fetchUserProfile]);

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
      setProfile(null);
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
        profile,
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
        updateProfile,
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


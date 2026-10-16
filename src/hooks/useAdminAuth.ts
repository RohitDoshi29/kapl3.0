import { useAuth } from '@/contexts/AuthContext';

export function useAdminAuth() {
  const auth = useAuth();

  return {
    user: auth.user,
    session: auth.session,
    userRole: auth.userRole,
    isAdmin: auth.isAdmin,
    isCoAdmin: auth.isCoAdmin,
    isSuperAdmin: auth.isSuperAdmin,
    isMainAdmin: auth.isMainAdmin,
    hasAccess: Boolean(auth.isAdmin || auth.isMainAdmin || auth.isSuperAdmin || auth.isScorer),
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    signUp: auth.signUp,
    signIn: auth.signInWithPassword,
    signOut: auth.signOut,
    assignUserRole: auth.assignUserRole,
    assignRoleByEmail: auth.assignRoleByEmail,
  };
}

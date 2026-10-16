import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ScorerRole = 'scorer' | 'primary_scorer' | 'admin' | 'user' | null;

export function useScorerRole() {
  const [scorerRole, setScorerRole] = useState<ScorerRole>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkScorerRole = useCallback(async (userId: string): Promise<ScorerRole> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        console.error('Error checking scorer role:', error);
        return null;
      }

      // Check for specific roles in priority order
      const roles = data?.map(r => r.role) || [];
      
      if (roles.includes('admin') || roles.includes('co_admin')) return 'admin';
      if (roles.includes('scorer') || roles.includes('primary_scorer') || roles.includes('secondary_scorer')) return 'scorer';
      if (roles.includes('user')) return 'user';
      
      return null;
    } catch (error) {
      console.error('Error checking scorer role:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    const checkRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const role = await checkScorerRole(session.user.id);
        setScorerRole(role);
      }
      setIsLoading(false);
    };

    checkRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const role = await checkScorerRole(session.user.id);
          setScorerRole(role);
        } else {
          setScorerRole(null);
        }
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [checkScorerRole]);

  const isScorer = scorerRole === 'scorer' || scorerRole === 'primary_scorer' || scorerRole === 'admin';
  const isPrimaryScorer = isScorer;
  const isSecondaryScorer = false;
  const canScore = isScorer;

  return {
    scorerRole,
    isLoading,
    isScorer,
    isPrimaryScorer,
    isSecondaryScorer,
    canScore,
  };
}

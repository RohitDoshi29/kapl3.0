import { MatchFixture } from './cricketTypes';
import { supabase } from '@/integrations/supabase/client';

export const DEFAULT_MENS_FIXTURES: MatchFixture[] = [
  // Group A - Day 1
  {
    id: 'm-fix-1',
    tournamentId: 'kapl-3-mens',
    matchNumber: 1,
    team1Id: 'a1', // Kapil's Warriors
    team2Id: 'a2', // Kapil Falcons
    group: 'A',
    matchType: 'group',
    scheduledDate: 'Day 1 (Morning)',
    scheduledTime: '09:00 AM',
    venue: 'Ground 1 (Pitch A)',
    status: 'scheduled',
    notes: 'Tournament Opener • Group A Clash',
  },
  {
    id: 'm-fix-2',
    tournamentId: 'kapl-3-mens',
    matchNumber: 2,
    team1Id: 'a3', // Insta Paltans
    team2Id: 'a4', // Kapil's Devils
    group: 'A',
    matchType: 'group',
    scheduledDate: 'Day 1 (Morning)',
    scheduledTime: '10:15 AM',
    venue: 'Ground 1 (Pitch A)',
    status: 'scheduled',
    notes: 'Group A • Battle of Power Hitters',
  },
  {
    id: 'm-fix-3',
    tournamentId: 'kapl-3-mens',
    matchNumber: 3,
    team1Id: 'a1', // Kapil's Warriors
    team2Id: 'a3', // Insta Paltans
    group: 'A',
    matchType: 'group',
    scheduledDate: 'Day 1 (Mid-Day)',
    scheduledTime: '11:30 AM',
    venue: 'Ground 1 (Pitch A)',
    status: 'scheduled',
  },
  {
    id: 'm-fix-4',
    tournamentId: 'kapl-3-mens',
    matchNumber: 4,
    team1Id: 'a2', // Kapil Falcons
    team2Id: 'a4', // Kapil's Devils
    group: 'A',
    matchType: 'group',
    scheduledDate: 'Day 1 (Afternoon)',
    scheduledTime: '01:30 PM',
    venue: 'Ground 1 (Pitch A)',
    status: 'scheduled',
  },
  {
    id: 'm-fix-5',
    tournamentId: 'kapl-3-mens',
    matchNumber: 5,
    team1Id: 'a1', // Kapil's Warriors
    team2Id: 'a4', // Kapil's Devils
    group: 'A',
    matchType: 'group',
    scheduledDate: 'Day 1 (Evening)',
    scheduledTime: '02:45 PM',
    venue: 'Ground 1 (Pitch A)',
    status: 'scheduled',
  },
  {
    id: 'm-fix-6',
    tournamentId: 'kapl-3-mens',
    matchNumber: 6,
    team1Id: 'a2', // Kapil Falcons
    team2Id: 'a3', // Insta Paltans
    group: 'A',
    matchType: 'group',
    scheduledDate: 'Day 1 (Evening)',
    scheduledTime: '04:00 PM',
    venue: 'Ground 1 (Pitch A)',
    status: 'scheduled',
    notes: 'Group A Decider for Knockout Spots',
  },

  // Group B - Day 2
  {
    id: 'm-fix-7',
    tournamentId: 'kapl-3-mens',
    matchNumber: 7,
    team1Id: 'b1', // Goodness Royals
    team2Id: 'b2', // Kapil Ke Singham
    group: 'B',
    matchType: 'group',
    scheduledDate: 'Day 2 (Morning)',
    scheduledTime: '09:00 AM',
    venue: 'Ground 1 (Pitch A)',
    status: 'scheduled',
    notes: 'Group B Opener',
  },
  {
    id: 'm-fix-8',
    tournamentId: 'kapl-3-mens',
    matchNumber: 8,
    team1Id: 'b3', // Super Strikers
    team2Id: 'b4', // Kapil Avengers
    group: 'B',
    matchType: 'group',
    scheduledDate: 'Day 2 (Morning)',
    scheduledTime: '10:15 AM',
    venue: 'Ground 1 (Pitch A)',
    status: 'scheduled',
  },
  {
    id: 'm-fix-9',
    tournamentId: 'kapl-3-mens',
    matchNumber: 9,
    team1Id: 'b1', // Goodness Royals
    team2Id: 'b3', // Super Strikers
    group: 'B',
    matchType: 'group',
    scheduledDate: 'Day 2 (Mid-Day)',
    scheduledTime: '11:30 AM',
    venue: 'Ground 1 (Pitch A)',
    status: 'scheduled',
  },
  {
    id: 'm-fix-10',
    tournamentId: 'kapl-3-mens',
    matchNumber: 10,
    team1Id: 'b2', // Kapil Ke Singham
    team2Id: 'b4', // Kapil Avengers
    group: 'B',
    matchType: 'group',
    scheduledDate: 'Day 2 (Afternoon)',
    scheduledTime: '01:30 PM',
    venue: 'Ground 1 (Pitch A)',
    status: 'scheduled',
  },
  {
    id: 'm-fix-11',
    tournamentId: 'kapl-3-mens',
    matchNumber: 11,
    team1Id: 'b1', // Goodness Royals
    team2Id: 'b4', // Kapil Avengers
    group: 'B',
    matchType: 'group',
    scheduledDate: 'Day 2 (Evening)',
    scheduledTime: '02:45 PM',
    venue: 'Ground 1 (Pitch A)',
    status: 'scheduled',
  },
  {
    id: 'm-fix-12',
    tournamentId: 'kapl-3-mens',
    matchNumber: 12,
    team1Id: 'b2', // Kapil Ke Singham
    team2Id: 'b3', // Super Strikers
    group: 'B',
    matchType: 'group',
    scheduledDate: 'Day 2 (Evening)',
    scheduledTime: '04:00 PM',
    venue: 'Ground 1 (Pitch A)',
    status: 'scheduled',
    notes: 'Group B Qualification Decider',
  },

  // Knockouts - Day 3
  {
    id: 'm-fix-13',
    tournamentId: 'kapl-3-mens',
    matchNumber: 13,
    team1Id: 'a1',
    team2Id: 'b2',
    matchType: 'semi_final_1',
    scheduledDate: 'Day 3 (Finals Day)',
    scheduledTime: '10:00 AM',
    venue: 'Main Stadium',
    status: 'scheduled',
    notes: 'Semi Final 1 (Group A #1 vs Group B #2)',
  },
  {
    id: 'm-fix-14',
    tournamentId: 'kapl-3-mens',
    matchNumber: 14,
    team1Id: 'b1',
    team2Id: 'a2',
    matchType: 'semi_final_2',
    scheduledDate: 'Day 3 (Finals Day)',
    scheduledTime: '11:45 AM',
    venue: 'Main Stadium',
    status: 'scheduled',
    notes: 'Semi Final 2 (Group B #1 vs Group A #2)',
  },
  {
    id: 'm-fix-15',
    tournamentId: 'kapl-3-mens',
    matchNumber: 15,
    team1Id: 'a1',
    team2Id: 'b1',
    matchType: 'final',
    scheduledDate: 'Day 3 (Finals Day)',
    scheduledTime: '03:30 PM',
    venue: 'Main Stadium (Center Pitch)',
    status: 'scheduled',
    notes: '🏆 Grand Championship Final',
  },
];

export const DEFAULT_WOMENS_FIXTURES: MatchFixture[] = [
  {
    id: 'w-fix-1',
    tournamentId: 'kapl-3-womens',
    matchNumber: 1,
    team1Id: 'w_a1',
    team2Id: 'w_a2',
    group: 'A',
    matchType: 'group',
    scheduledDate: 'Day 1',
    scheduledTime: '09:30 AM',
    venue: 'Ground 2',
    status: 'scheduled',
  },
  {
    id: 'w-fix-2',
    tournamentId: 'kapl-3-womens',
    matchNumber: 2,
    team1Id: 'w_b1',
    team2Id: 'w_b2',
    group: 'B',
    matchType: 'group',
    scheduledDate: 'Day 1',
    scheduledTime: '11:00 AM',
    venue: 'Ground 2',
    status: 'scheduled',
  },
  {
    id: 'w-fix-3',
    tournamentId: 'kapl-3-womens',
    matchNumber: 3,
    team1Id: 'w_a1',
    team2Id: 'w_b1',
    matchType: 'final',
    scheduledDate: 'Day 2',
    scheduledTime: '02:00 PM',
    venue: 'Main Stadium',
    status: 'scheduled',
    notes: '🏆 Women\'s Grand Final',
  },
];

const FIXTURES_STORAGE_KEY_PREFIX = 'kapl_fixtures_';
const FIXTURES_CUSTOMIZED_KEY_PREFIX = 'kapl_fixtures_customized_';

/**
 * Synchronous local reader with localStorage cache.
 * Respects empty arrays [] when the user has deleted all matches.
 */
export function getStoredFixtures(tournamentId: string): MatchFixture[] {
  if (typeof window === 'undefined') {
    return tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_FIXTURES : DEFAULT_MENS_FIXTURES;
  }

  try {
    const raw = localStorage.getItem(`${FIXTURES_STORAGE_KEY_PREFIX}${tournamentId}`);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading stored fixtures:', e);
  }

  // Fallback to default fixtures and seed storage
  const defaults = tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_FIXTURES : DEFAULT_MENS_FIXTURES;
  saveStoredFixtures(tournamentId, defaults);
  return defaults;
}

/**
 * Asynchronously fetch tournament fixtures from Supabase tournaments.rules.fixtures.
 * Falls back to localStorage if network is offline.
 */
export async function fetchTournamentFixtures(tournamentId: string): Promise<MatchFixture[]> {
  try {
    const { data, error } = await supabase
      .from('tournaments')
      .select('rules')
      .eq('id', tournamentId)
      .maybeSingle();

    if (!error && data?.rules && typeof data.rules === 'object') {
      const dbFixtures = (data.rules as any).fixtures;
      if (Array.isArray(dbFixtures)) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(`${FIXTURES_STORAGE_KEY_PREFIX}${tournamentId}`, JSON.stringify(dbFixtures));
          localStorage.setItem(`${FIXTURES_CUSTOMIZED_KEY_PREFIX}${tournamentId}`, 'true');
          window.dispatchEvent(new CustomEvent('kapl-fixtures-updated', {
            detail: { tournamentId, fixtures: dbFixtures }
          }));
        }
        return dbFixtures;
      }
    }
  } catch (err) {
    console.warn('Error fetching fixtures from Supabase:', err);
  }

  return getStoredFixtures(tournamentId);
}

/**
 * Persist fixtures locally and to Supabase tournaments table.
 */
export async function saveStoredFixtures(tournamentId: string, fixtures: MatchFixture[]): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${FIXTURES_STORAGE_KEY_PREFIX}${tournamentId}`, JSON.stringify(fixtures));
      localStorage.setItem(`${FIXTURES_CUSTOMIZED_KEY_PREFIX}${tournamentId}`, 'true');
      window.dispatchEvent(new CustomEvent('kapl-fixtures-updated', {
        detail: { tournamentId, fixtures }
      }));
    } catch (e) {
      console.error('Error saving fixtures to localStorage:', e);
    }
  }

  try {
    const { data: tourn } = await supabase
      .from('tournaments')
      .select('rules')
      .eq('id', tournamentId)
      .maybeSingle();

    const currentRules = (tourn?.rules as Record<string, any>) || {};
    const updatedRules = {
      ...currentRules,
      fixtures,
    };

    const { error } = await supabase
      .from('tournaments')
      .update({
        rules: updatedRules,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tournamentId);

    if (error) {
      console.warn('Failed to sync fixtures to Supabase (saved locally):', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Network error syncing fixtures to cloud:', err);
    return false;
  }
}

/**
 * Reset fixtures to default schedule and persist.
 */
export async function resetToDefaultFixtures(tournamentId: string): Promise<MatchFixture[]> {
  const defaults = tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_FIXTURES : DEFAULT_MENS_FIXTURES;
  await saveStoredFixtures(tournamentId, defaults);
  return defaults;
}

/**
 * Update a single fixture.
 */
export async function updateFixture(tournamentId: string, updatedFixture: MatchFixture): Promise<MatchFixture[]> {
  const current = getStoredFixtures(tournamentId);
  const next = current.map((f) => (f.id === updatedFixture.id ? updatedFixture : f));
  await saveStoredFixtures(tournamentId, next);
  return next;
}



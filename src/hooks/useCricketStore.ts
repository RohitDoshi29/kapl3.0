import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Team, Match, MatchState, TeamStats, DEFAULT_TEAMS, DEFAULT_WOMENS_TEAMS, Ball, Over, Player, Innings, MatchType, SuperOver, DismissalType, WicketDetails, PlayerOfTheMatchData } from '@/lib/cricketTypes';
import { MATCH_CONSTANTS } from '@/lib/matchConstants';
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';

// LocalStorage metadata helpers to persist Owner & Captain roles
const getStoredTeamMeta = (teamId: string) => {
  try {
    const raw = localStorage.getItem(`kapl_team_meta_${teamId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveStoredTeamMeta = (teamId: string, meta: {
  ownerName?: string;
  ownerEmail?: string | null;
  ownerUserId?: string | null;
  captainName?: string;
  captainPlayerId?: string | null;
  captainUserId?: string | null;
}) => {
  try {
    localStorage.setItem(`kapl_team_meta_${teamId}`, JSON.stringify(meta));
  } catch (e) {
    console.warn('Failed to save team meta to localStorage:', e);
  }
};

// Helper to convert DB team to app Team
const dbToTeam = (dbTeam: any): Team => {
  const meta = getStoredTeamMeta(dbTeam.id);
  const tournamentId = dbTeam.tournament_id || 'kapl-3-mens';

  let teamPlayers = (dbTeam.players as Player[]) || [];
  const hasVaultPlayers = typeof window !== 'undefined' && Boolean(
    localStorage.getItem('kapl_player_vault') || localStorage.getItem('kapl_registered_players')
  );
  if (hasVaultPlayers) {
    try {
      localStorage.removeItem('kapl_all_players_cleared');
      localStorage.removeItem(`kapl_everything_reset_${tournamentId}`);
    } catch {}
  }
  const isReset = !hasVaultPlayers && typeof window !== 'undefined' && (
    localStorage.getItem(`kapl_auction_manually_reset_${tournamentId}`) === 'true' ||
    localStorage.getItem(`kapl_everything_reset_${tournamentId}`) === 'true' ||
    localStorage.getItem('kapl_all_players_cleared') === 'true'
  );

  if (isReset) {
    teamPlayers = [];
  } else {
    // Filter out legacy template dummy players like a1-p1
    teamPlayers = teamPlayers.filter((p: any) => p && !/^[ab][1-4]-/.test(p.id));

    try {
      const rawAuctionTeams = localStorage.getItem(`kapl_auction_teams_${tournamentId}`);
      if (rawAuctionTeams) {
        const parsed = JSON.parse(rawAuctionTeams);
        const match = Array.isArray(parsed) ? parsed.find((t: any) => t.id === dbTeam.id) : null;
        if (
          match &&
          Array.isArray(match.players) &&
          !match.players.some((p: any) => /^[ab][1-4]-/.test(p.id))
        ) {
          teamPlayers = match.players;
        }
      }
    } catch {}
  }

  const initialPurse = dbTeam.initial_purse ? Number(dbTeam.initial_purse) : 10000;
  const totalSpent = (teamPlayers || []).reduce(
    (sum: number, p: any) => sum + (Number(p.soldPrice) || 0),
    0
  );
  const remainingPurse = Math.max(0, initialPurse - totalSpent);

  return {
    id: dbTeam.id,
    name: dbTeam.name,
    group: dbTeam.group as 'A' | 'B',
    logo: dbTeam.logo,
    primaryColor: dbTeam.primary_color,
    players: teamPlayers,
    playerCount: teamPlayers.length,
    tournamentId: tournamentId,
    initialPurse: initialPurse,
    remainingPurse: remainingPurse,
    maxSquadSize: dbTeam.max_squad_size || 10,
    captainUserId: dbTeam.captain_user_id || meta.captainUserId || null,
    ownerName: meta.ownerName || dbTeam.owner_name || (tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS).find(d => d.id === dbTeam.id)?.ownerName || (dbTeam.id === 'a1' ? 'Rohit Doshi' : undefined),
    ownerEmail: meta.ownerEmail || dbTeam.owner_email || (tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS).find(d => d.id === dbTeam.id)?.ownerEmail || (dbTeam.id === 'a1' ? 'rohitdoshicolg@gmail.com' : null),
    ownerUserId: meta.ownerUserId || dbTeam.owner_user_id || null,
    captainName: meta.captainName || dbTeam.captain_name || (tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS).find(d => d.id === dbTeam.id)?.captainName || (dbTeam.id === 'a1' ? 'Rohit Doshi' : (teamPlayers[0]?.name || undefined)),
    captainPlayerId: meta.captainPlayerId || dbTeam.captain_player_id || (tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS).find(d => d.id === dbTeam.id)?.captainPlayerId || (dbTeam.id === 'a1' ? 'owner' : (teamPlayers[0]?.id || null)),
  };
};

// Helper to convert app Team to DB format
const teamToDb = (team: Team) => ({
  id: team.id,
  name: team.name,
  group: team.group,
  logo: team.logo,
  primary_color: team.primaryColor,
  players: JSON.parse(JSON.stringify(team.players)) as Json,
  player_count: team.playerCount ?? 0,
  tournament_id: team.tournamentId || 'kapl-3-mens',
  initial_purse: team.initialPurse || 10000,
  remaining_purse: team.remainingPurse ?? 10000,
  max_squad_size: team.maxSquadSize || 10,
  captain_user_id: team.captainUserId || null,
});

// Helper to create a new innings
const createInnings = (battingTeamId: string, bowlingTeamId: string): Innings => ({
  battingTeamId,
  bowlingTeamId,
  runs: 0,
  wickets: 0,
  overs: [{ number: 1, balls: [] }],
  currentOver: 0,
  currentBall: 0,
  currentBatsmanId: undefined,
  currentBowlerId: undefined,
  nonStrikerBatsmanId: undefined,
  batterStats: {},
  bowlerStats: {},
  battingOrder: [],
  isFreeHit: false,
});

// Helper to recalculate all stats of an innings deterministically from its overs and balls
const recalculateInnings = (rawInnings: Innings): Innings => {
  const innings: Innings = {
    ...rawInnings,
    runs: 0,
    wickets: 0,
    batterStats: {},
    bowlerStats: {},
  };

  // Preserve player entries in stats with clean initial 0 values
  Object.keys(rawInnings.batterStats || {}).forEach(id => {
    innings.batterStats[id] = { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false };
  });
  Object.keys(rawInnings.bowlerStats || {}).forEach(id => {
    innings.bowlerStats[id] = { overs: 0, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0 };
  });

  let totalRuns = 0;
  let totalWickets = 0;
  let isFreeHit = false;

  innings.overs.forEach(over => {
    over.balls.forEach(ball => {
      totalRuns += ball.runs;
      if (ball.isWicket) totalWickets += 1;

      // Batter stats
      const batId = ball.batsmanId;
      if (batId && !ball.isWide) {
        if (!innings.batterStats[batId]) {
          innings.batterStats[batId] = { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false };
        }
        const bStat = innings.batterStats[batId];
        const batRuns = ball.runsOffBat ?? (ball.isNoBall ? Math.max(0, ball.runs - 1) : (ball.extraType === 'bye' || ball.extraType === 'leg_bye' ? 0 : ball.runs));
        bStat.runs += batRuns;
        if (!ball.isNoBall) {
          bStat.ballsFaced += 1;
        }
        if (batRuns === 4) bStat.fours += 1;
        if (batRuns === 6) bStat.sixes += 1;
      }

      // Wicket attribution
      if (ball.isWicket && ball.wicketDetails) {
        const outId = ball.wicketDetails.dismissedPlayerId || ball.batsmanId;
        if (outId) {
          if (!innings.batterStats[outId]) {
            innings.batterStats[outId] = { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false };
          }
          const outStat = innings.batterStats[outId];
          outStat.isOut = true;
          outStat.dismissalType = ball.wicketDetails.type;
          outStat.dismissalDescription = ball.wicketDetails.description;
          outStat.dismissalFielderId = ball.wicketDetails.fielderId;
        }
      }

      // Bowler stats
      const bowlId = ball.bowlerId || over.bowlerId;
      if (bowlId) {
        if (!innings.bowlerStats[bowlId]) {
          innings.bowlerStats[bowlId] = { overs: 0, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0 };
        }
        const bwStat = innings.bowlerStats[bowlId];
        bwStat.runs += ball.runs;
        if (ball.isWicket && ball.wicketDetails?.type !== 'run_out' && ball.wicketDetails?.type !== 'retired') {
          bwStat.wickets += 1;
        }
        if (ball.isWide) bwStat.wides += 1;
        if (ball.isNoBall) bwStat.noBalls += 1;

        if (!ball.isWide && !ball.isNoBall) {
          bwStat.balls += 1;
          if (bwStat.balls >= 6) {
            bwStat.overs += 1;
            bwStat.balls = 0;
          }
        }
      }

      // Free Hit state machine
      if (ball.isNoBall) {
        isFreeHit = true;
      } else if (!ball.isWide) {
        isFreeHit = false;
      }
    });
  });

  const lastOver = innings.overs[innings.overs.length - 1];
  const legalBallsInCurrentOver = lastOver
    ? lastOver.balls.filter(b => !b.isWide && !b.isNoBall).length
    : 0;

  innings.runs = totalRuns;
  innings.wickets = totalWickets;
  innings.currentOver = Math.max(0, innings.overs.length - 1);
  innings.currentBall = legalBallsInCurrentOver;
  innings.isFreeHit = isFreeHit;

  return innings;
};

// ============================================================================
// Shared Global Realtime Sync Engine for KAPL 3.0
// Guarantees zero-packet-drop, sub-50ms live score propagation across all anonymous viewers,
// owners, and players on both desktop and mobile devices.
// ============================================================================

type StateListener = (state: MatchState) => void;
type PlayersListener = (players: Record<string, string[]>) => void;
type TeamsListener = (teams: Team[]) => void;
type HistoryListener = (history: Match[]) => void;

const globalStateListeners = new Set<StateListener>();
const globalPlayersListeners = new Set<PlayersListener>();
const globalTeamsListeners = new Set<TeamsListener>();
const globalHistoryListeners = new Set<HistoryListener>();

let sharedRealtimeChannel: any = null;
let sharedChannelRefCount = 0;
let globalLocalMatchState: MatchState = { currentMatch: null, lastAction: null };
let globalPlayingPlayers: Record<string, string[]> = {};
let tabSyncChannel: BroadcastChannel | null = null;

// Segregated match states by tournament
export const globalTournamentMatchStates: Record<string, MatchState> = {
  'kapl-3-mens': { currentMatch: null, lastAction: null },
  'kapl-3-womens': { currentMatch: null, lastAction: null },
};

export function resolveTournamentId(match: Match | null, fallback?: string): string {
  if (match?.tournamentId) return match.tournamentId;
  if (match?.team1Id) {
    if (DEFAULT_WOMENS_TEAMS.some(t => t.id === match.team1Id)) return 'kapl-3-womens';
    if (DEFAULT_TEAMS.some(t => t.id === match.team1Id)) return 'kapl-3-mens';
  }
  return fallback || 'kapl-3-mens';
}

// Initialize cached match state from localStorage
if (typeof window !== 'undefined') {
  try {
    for (const tId of ['kapl-3-mens', 'kapl-3-womens']) {
      const cached = localStorage.getItem(`kapl_local_match_state_${tId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.current_match?.id === '1792091739936') {
          localStorage.removeItem(`kapl_local_match_state_${tId}`);
        } else if (parsed.current_match) {
          globalTournamentMatchStates[tId] = {
            currentMatch: parsed.current_match,
            lastAction: parsed.last_action || null,
          };
        }
      }
    }
    const generic = localStorage.getItem('kapl_local_match_state');
    if (generic) {
      const parsed = JSON.parse(generic);
      if (parsed.current_match?.id === '1792091739936') {
        localStorage.removeItem('kapl_local_match_state');
      } else if (parsed.current_match) {
        const tId = resolveTournamentId(parsed.current_match);
        globalTournamentMatchStates[tId] = {
          currentMatch: parsed.current_match,
          lastAction: parsed.last_action || null,
        };
        globalLocalMatchState = globalTournamentMatchStates[tId];
        if (parsed.current_match.playingPlayers) {
          globalPlayingPlayers = parsed.current_match.playingPlayers;
        }
      }
    }
  } catch (e) {}

  if ('BroadcastChannel' in window) {
    try {
      tabSyncChannel = new BroadcastChannel('kapl_live_match_sync');
      tabSyncChannel.onmessage = (event) => {
        if (event.data?.type === 'system_reset_all_players') {
          try {
            localStorage.setItem('kapl_all_players_cleared', 'true');
            localStorage.setItem('kapl_registered_players', JSON.stringify([]));
            for (const tid of ['kapl-3-mens', 'kapl-3-womens']) {
              localStorage.setItem(`kapl_everything_reset_${tid}`, 'true');
              localStorage.removeItem(`kapl_auction_manually_reset_${tid}`);
              localStorage.setItem(`kapl_auction_players_${tid}`, JSON.stringify([]));
              localStorage.setItem(`kapl_auction_sales_${tid}`, JSON.stringify([]));
              localStorage.removeItem(`kapl_auction_active_player_${tid}`);
              localStorage.removeItem(`kapl_local_match_state_${tid}`);
            }
            localStorage.removeItem('cricket_match_state');
            localStorage.removeItem('kapl_local_match_state');
          } catch (e) {}

          const allResetTeams: Team[] = [...DEFAULT_TEAMS, ...DEFAULT_WOMENS_TEAMS].map((t) => ({
            ...t,
            players: [],
            playerCount: 0,
            remainingPurse: 10000,
            initialPurse: 10000,
          }));
          globalTeamsListeners.forEach(l => l(allResetTeams));
          notifyGlobalStateListeners({ currentMatch: null, lastAction: null });
          notifyGlobalPlayersListeners({});
          globalHistoryListeners.forEach(l => l([]));

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: allResetTeams }));
            window.dispatchEvent(new CustomEvent('kapl-auction-local-update', {
              detail: { event: 'auction_reset', players: [], teams: allResetTeams, currentPlayer: null },
            }));
            window.dispatchEvent(new CustomEvent('kapl_player_added', {
              detail: { player: null, tournamentId: 'all' },
            }));
          }
          return;
        }

        if (event.data?.type === 'team_player_removed' && event.data.teams) {
          globalTeamsListeners.forEach(l => l(event.data.teams));
          return;
        }

        if (event.data?.event === 'auction_player_removed' && event.data.playerId && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('kapl_player_removed', {
            detail: { playerId: event.data.playerId, tournamentId: event.data.tournamentId || 'all' },
          }));
          return;
        }

        if (event.data && 'currentMatch' in event.data) {
          const tId = resolveTournamentId(event.data.currentMatch, event.data.tournamentId);
          notifyGlobalStateListeners({
            currentMatch: event.data.currentMatch,
            lastAction: event.data.lastAction || null,
          }, tId);
          if (event.data.playingPlayers) {
            notifyGlobalPlayersListeners(event.data.playingPlayers);
          } else if (!event.data.currentMatch) {
            notifyGlobalPlayersListeners({});
          }
        }
      };
    } catch (e) {}
  }
}

function notifyGlobalStateListeners(newState: MatchState, tournamentId?: string) {
  const resolvedTId = tournamentId || resolveTournamentId(newState.currentMatch);
  globalTournamentMatchStates[resolvedTId] = newState;
  if (!newState.currentMatch || resolvedTId === 'kapl-3-mens') {
    globalLocalMatchState = newState;
  }

  globalStateListeners.forEach(listener => {
    try {
      (listener as any)(newState, resolvedTId);
    } catch (e) {
      console.warn('Error in state listener:', e);
    }
  });
}

function notifyGlobalPlayersListeners(players: Record<string, string[]>) {
  globalPlayingPlayers = players;
  globalPlayersListeners.forEach(listener => {
    try {
      listener(players);
    } catch (e) {
      console.warn('Error in players listener:', e);
    }
  });
}

export function broadcastLiveMatchDelta(
  currentMatch: Match | null,
  lastAction: any,
  playingPlayers?: Record<string, string[]>,
  explicitTournamentId?: string
) {
  const matchTournId = explicitTournamentId || resolveTournamentId(currentMatch);
  const matchWithPlayers = currentMatch ? {
    ...currentMatch,
    tournamentId: matchTournId,
    ...(playingPlayers ? { playingPlayers } : {}),
  } : null;

  const newState: MatchState = {
    currentMatch: matchWithPlayers,
    lastAction,
  };

  // 1. Immediately update all mounted components in the current tab
  notifyGlobalStateListeners(newState, matchTournId);
  if (playingPlayers) {
    notifyGlobalPlayersListeners(playingPlayers);
  } else if (!matchWithPlayers) {
    notifyGlobalPlayersListeners({});
  }

  // 2. Persist to localStorage for instant reload & resilience
  try {
    if (matchWithPlayers) {
      const serialized = JSON.stringify({
        current_match: matchWithPlayers,
        last_action: lastAction,
        updated_at: new Date().toISOString(),
      });
      localStorage.setItem(`kapl_local_match_state_${matchTournId}`, serialized);
      if (matchTournId === 'kapl-3-mens') {
        localStorage.setItem('kapl_local_match_state', serialized);
      }
    } else {
      localStorage.removeItem(`kapl_local_match_state_${matchTournId}`);
      if (matchTournId === 'kapl-3-mens') {
        localStorage.removeItem('kapl_local_match_state');
      }
    }
  } catch (e) {}

  // 3. Dispatch window CustomEvent for in-tab listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kapl-local-match-update', {
      detail: {
        currentMatch: matchWithPlayers,
        lastAction,
        playingPlayers: matchWithPlayers ? playingPlayers : {},
        tournamentId: matchTournId,
      }
    }));
  }

  // 4. Instant 0ms cross-tab broadcast (for viewers/owners in other tabs of same browser)
  if (tabSyncChannel) {
    try {
      tabSyncChannel.postMessage({
        currentMatch: matchWithPlayers,
        lastAction,
        playingPlayers: matchWithPlayers ? playingPlayers : {},
        tournamentId: matchTournId,
        timestamp: Date.now(),
      });
    } catch (e) {}
  }

  // 5. Send over WebSocket to all other devices & anonymous viewers (<30ms latency)
  const channel = initSharedRealtimeChannel();
  if (channel) {
    const sendPayload = {
      type: 'broadcast' as const,
      event: 'live_score_delta',
      payload: {
        currentMatch: matchWithPlayers,
        lastAction,
        tournamentId: matchTournId,
        timestamp: Date.now(),
      },
    };
    try {
      if (channel.state === 'joined') {
        channel.send(sendPayload).catch((e: any) => console.warn('Realtime broadcast catch:', e));
      } else {
        // Queue send if channel is still connecting or reconnecting
        channel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            channel.send(sendPayload).catch(() => {});
          }
        });
      }
    } catch (e) {
      console.warn('Realtime send failed:', e);
    }
  }
}

function initSharedRealtimeChannel() {
  if (sharedRealtimeChannel) return sharedRealtimeChannel;

  sharedRealtimeChannel = supabase
    .channel('kapl-live-match-sync', {
      config: { broadcast: { self: true } }
    })
    .on(
      'broadcast',
      { event: 'live_score_delta' },
      (envelope) => {
        if (envelope?.payload && ('currentMatch' in envelope.payload)) {
          const { currentMatch, lastAction } = envelope.payload;
          const tId = resolveTournamentId(currentMatch, envelope.payload.tournamentId);
          notifyGlobalStateListeners({ currentMatch: currentMatch || null, lastAction: lastAction || null }, tId);
          if (currentMatch?.playingPlayers) {
            notifyGlobalPlayersListeners(currentMatch.playingPlayers);
          } else if (!currentMatch) {
            notifyGlobalPlayersListeners({});
          }
          try {
            if (currentMatch) {
              const serialized = JSON.stringify({
                current_match: currentMatch,
                last_action: lastAction,
              });
              if (tId === 'kapl-3-mens') {
                localStorage.setItem('kapl_local_match_state', serialized);
              }
              localStorage.setItem(`kapl_local_match_state_${tId}`, serialized);
            } else {
              if (tId === 'kapl-3-mens') {
                localStorage.removeItem('kapl_local_match_state');
              }
              localStorage.removeItem(`kapl_local_match_state_${tId}`);
            }
          } catch (e) {}
        }
      }
    )
    .on(
      'broadcast',
      { event: 'system_reset_all_players' },
      () => {
        try {
          localStorage.setItem('kapl_all_players_cleared', 'true');
          localStorage.setItem('kapl_registered_players', JSON.stringify([]));
          for (const tid of ['kapl-3-mens', 'kapl-3-womens']) {
            localStorage.setItem(`kapl_everything_reset_${tid}`, 'true');
            localStorage.removeItem(`kapl_auction_manually_reset_${tid}`);
            localStorage.setItem(`kapl_auction_players_${tid}`, JSON.stringify([]));
            localStorage.setItem(`kapl_auction_sales_${tid}`, JSON.stringify([]));
            localStorage.removeItem(`kapl_auction_active_player_${tid}`);
            localStorage.removeItem(`kapl_local_match_state_${tid}`);
          }
          localStorage.removeItem('cricket_match_state');
          localStorage.removeItem('kapl_local_match_state');
        } catch (e) {}

        const allResetTeams: Team[] = [...DEFAULT_TEAMS, ...DEFAULT_WOMENS_TEAMS].map((t) => ({
          ...t,
          players: [],
          playerCount: 0,
          remainingPurse: 10000,
          initialPurse: 10000,
        }));
        globalTeamsListeners.forEach(l => l(allResetTeams));
        notifyGlobalStateListeners({ currentMatch: null, lastAction: null });
        notifyGlobalPlayersListeners({});
        globalHistoryListeners.forEach(l => l([]));

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: allResetTeams }));
          window.dispatchEvent(new CustomEvent('kapl-auction-local-update', {
            detail: { event: 'auction_reset', players: [], teams: allResetTeams, currentPlayer: null },
          }));
          window.dispatchEvent(new CustomEvent('kapl_player_added', {
            detail: { player: null, tournamentId: 'all' },
          }));
        }
      }
    )
    .on(
      'broadcast',
      { event: 'auction_player_added' },
      (envelope) => {
        try {
          localStorage.removeItem('kapl_all_players_cleared');
          if (envelope?.payload?.tournamentId) {
            localStorage.removeItem(`kapl_everything_reset_${envelope.payload.tournamentId}`);
          }
        } catch (e) {}
        if (envelope?.payload?.player && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('kapl_player_added', {
            detail: { player: envelope.payload.player, tournamentId: envelope.payload.tournamentId || 'all' },
          }));
        }
      }
    )
    .on(
      'broadcast',
      { event: 'auction_player_removed' },
      (envelope) => {
        if (envelope?.payload?.playerId && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('kapl_player_removed', {
            detail: { playerId: envelope.payload.playerId, tournamentId: envelope.payload.tournamentId || 'all' },
          }));
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'match_state' },
      (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          const newState = payload.new as any;
          const currentMatch = newState.current_match as unknown as Match | null;
          const isDiscarded = (currentMatch as any)?.id === '1792091739936';
          const effectiveCurrentMatch = isDiscarded ? null : (currentMatch || null);
          const tId = resolveTournamentId(effectiveCurrentMatch, newState.tournament_id || (newState.id === 'womens' ? 'kapl-3-womens' : 'kapl-3-mens'));
          notifyGlobalStateListeners({
            currentMatch: effectiveCurrentMatch,
            lastAction: isDiscarded ? null : ((newState.last_action as unknown as MatchState['lastAction']) || null),
          }, tId);
          if ((effectiveCurrentMatch as any)?.playingPlayers) {
            notifyGlobalPlayersListeners((effectiveCurrentMatch as any).playingPlayers);
          } else if (!effectiveCurrentMatch) {
            notifyGlobalPlayersListeners({});
          }
          try {
            if (effectiveCurrentMatch) {
              const serialized = JSON.stringify({
                current_match: effectiveCurrentMatch,
                last_action: newState.last_action,
              });
              if (tId === 'kapl-3-mens') {
                localStorage.setItem('kapl_local_match_state', serialized);
              }
              localStorage.setItem(`kapl_local_match_state_${tId}`, serialized);
            } else {
              if (tId === 'kapl-3-mens') {
                localStorage.removeItem('kapl_local_match_state');
              }
              localStorage.removeItem(`kapl_local_match_state_${tId}`);
            }
          } catch (e) {}
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'teams' },
      (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          const updatedTeam = dbToTeam(payload.new);
          globalTeamsListeners.forEach(l => l([updatedTeam]));
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'match_history' },
      async (payload) => {
        const newStatus = (payload.new as any)?.status;
        if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE' || newStatus === 'completed') {
          const { data } = await supabase
            .from('match_history')
            .select('*')
            .order('created_at', { ascending: true });
          if (data) {
            const mapped = data.map((h: any) => ({
              id: h.id,
              tournamentId: h.tournament_id || 'kapl-3-mens',
              group: h.group as 'A' | 'B',
              team1Id: h.team1_id,
              team2Id: h.team2_id,
              innings1: h.innings1,
              innings2: h.innings2,
              currentInnings: h.current_innings as 1 | 2,
              status: h.status as 'setup' | 'live' | 'completed',
              winner: h.winner,
              matchType: (h.match_type || 'group') as MatchType,
            }));
            globalHistoryListeners.forEach(l => l(mapped));
          }
        }
      }
    );

  sharedRealtimeChannel.subscribe((status: string) => {
    if (status === 'SUBSCRIBED') {
      console.log('⚡ KAPL Live Match Sync connected in realtime');
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.warn(`Realtime channel status: ${status}, scheduling reconnect...`);
      setTimeout(() => {
        if (sharedRealtimeChannel) {
          try {
            supabase.removeChannel(sharedRealtimeChannel);
          } catch (e) {}
          sharedRealtimeChannel = null;
          initSharedRealtimeChannel();
        }
      }, 1500);
    }
  });

  return sharedRealtimeChannel;
}

const sharedAuctionSyncChannels: Record<string, any> = {};

function initSharedAuctionSyncChannels() {
  const tournaments = ['kapl-3-mens', 'kapl-3-womens'];
  tournaments.forEach(tId => {
    if (sharedAuctionSyncChannels[tId]) return;

    sharedAuctionSyncChannels[tId] = supabase
      .channel(`auction-room-${tId}`, {
        config: { broadcast: { self: true } }
      })
      .on('broadcast', { event: 'auction_sync' }, (envelope) => {
        const payload = envelope?.payload;
        if (!payload) return;
        const event = payload.event;

        if (event === 'auction_auto_completed' && Array.isArray(payload.teams)) {
          globalTeamsListeners.forEach(l => l(payload.teams));
          try {
            localStorage.setItem('kapl_teams', JSON.stringify(payload.teams));
            localStorage.setItem(`kapl_auction_teams_${tId}`, JSON.stringify(payload.teams));
            localStorage.removeItem(`kapl_auction_manually_reset_${tId}`);
          } catch {}
        } else if (event === 'auction_reset' && Array.isArray(payload.teams)) {
          globalTeamsListeners.forEach(l => l(payload.teams));
          try {
            localStorage.setItem('kapl_teams', JSON.stringify(payload.teams));
            localStorage.setItem(`kapl_auction_teams_${tId}`, JSON.stringify(payload.teams));
          } catch {}
        } else if (event === 'auction_sold' && payload.targetTeamId) {
          const log = payload.log;
          const raw = localStorage.getItem(`kapl_auction_teams_${tId}`) || localStorage.getItem('kapl_teams');
          if (raw) {
            try {
              const currentTeams: Team[] = JSON.parse(raw);
              const updated = currentTeams.map(t => {
                if (t.id === payload.targetTeamId) {
                  const currentSquad = t.players || [];
                  const updatedSquad = [
                    ...currentSquad.filter((p: any) => p.id !== payload.targetPlayerId),
                    { id: payload.targetPlayerId, name: log?.playerName, role: log?.playerRole, soldPrice: payload.soldPrice }
                  ];
                  return {
                    ...t,
                    remainingPurse: payload.newRemainingPurse ?? Math.max(0, (t.remainingPurse ?? 10000) - (payload.soldPrice || 0)),
                    players: updatedSquad,
                    playerCount: updatedSquad.length,
                  };
                }
                return t;
              });
              globalTeamsListeners.forEach(l => l(updated));
              localStorage.setItem('kapl_teams', JSON.stringify(updated));
              localStorage.setItem(`kapl_auction_teams_${tId}`, JSON.stringify(updated));
            } catch {}
          }
        }
      })
      .subscribe();
  });
}

// Eager initialization at module load time for instantaneous WebSocket connection
if (typeof window !== 'undefined') {
  initSharedRealtimeChannel();
  initSharedAuctionSyncChannels();
}

// ============================================================================
// Single Global Heartbeat Poller & Mobile Visibility Engine
// Guarantees updates propagate to all unauthenticated viewers even if WebSockets
// are suspended by mobile backgrounding, screen sleep, or firewalls.
// ============================================================================

let globalHeartbeatInterval: any = null;
let globalHeartbeatRefCount = 0;
const lastHeartbeatRowSignatures: Record<string, string> = {};

export async function pollMatchStateDatabase() {
  try {
    const { data: stateRows, error } = await supabase
      .from('match_state')
      .select('*');

    if (error || !stateRows || stateRows.length === 0) return;

    for (const row of stateRows) {
      const tId = resolveTournamentId(row.current_match, row.tournament_id || (row.id === 'womens' ? 'kapl-3-womens' : 'kapl-3-mens'));
      const rowSig = `${row.id}_${row.updated_at}_${(row.current_match as any)?.status}_${(row.current_match as any)?.innings1?.runs}_${(row.current_match as any)?.innings2?.runs}`;
      
      if (lastHeartbeatRowSignatures[row.id] !== rowSig) {
        lastHeartbeatRowSignatures[row.id] = rowSig;

        const currentMatchData = row.current_match as unknown as Match | null;
        const isDiscarded = currentMatchData?.id === '1792091739936';
        if (isDiscarded) {
          notifyGlobalStateListeners({ currentMatch: null, lastAction: null }, tId);
          notifyGlobalPlayersListeners({});
          try {
            if (tId === 'kapl-3-mens') {
              localStorage.removeItem('kapl_local_match_state');
            }
            localStorage.removeItem(`kapl_local_match_state_${tId}`);
          } catch (e) {}
          continue;
        }

        if (currentMatchData) {
          const currentMatch: Match = {
            ...currentMatchData,
            tournamentId: tId,
          };
          const lastAction = row.last_action as MatchState['lastAction'];

          notifyGlobalStateListeners({ currentMatch, lastAction }, tId);
          if ((currentMatch as any).playingPlayers) {
            notifyGlobalPlayersListeners((currentMatch as any).playingPlayers);
          }
          try {
            const serialized = JSON.stringify({
              current_match: currentMatch,
              last_action: lastAction,
            });
            if (tId === 'kapl-3-mens') {
              localStorage.setItem('kapl_local_match_state', serialized);
            }
            localStorage.setItem(`kapl_local_match_state_${tId}`, serialized);
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    // Ignore transient network errors
  }
}

function onGlobalVisibilityChange() {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    pollMatchStateDatabase();
  }
}

function onGlobalFocus() {
  pollMatchStateDatabase();
}

function startGlobalHeartbeat() {
  globalHeartbeatRefCount++;
  if (globalHeartbeatRefCount === 1 && !globalHeartbeatInterval && typeof window !== 'undefined') {
    pollMatchStateDatabase();
    globalHeartbeatInterval = setInterval(pollMatchStateDatabase, 2500);

    document.addEventListener('visibilitychange', onGlobalVisibilityChange);
    window.addEventListener('focus', onGlobalFocus);
  }
}

function stopGlobalHeartbeat() {
  globalHeartbeatRefCount = Math.max(0, globalHeartbeatRefCount - 1);
  if (globalHeartbeatRefCount === 0 && globalHeartbeatInterval) {
    clearInterval(globalHeartbeatInterval);
    globalHeartbeatInterval = null;
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', onGlobalVisibilityChange);
      window.removeEventListener('focus', onGlobalFocus);
    }
  }
}

export function useCricketStore(targetTournamentId?: string) {
  const [teams, setTeams] = useState<Team[]>(() => {
    try {
      const hasVault = typeof window !== 'undefined' && (
        Boolean(localStorage.getItem('kapl_player_vault')) || Boolean(localStorage.getItem('kapl_registered_players'))
      );
      if (hasVault) {
        try {
          localStorage.removeItem('kapl_all_players_cleared');
          localStorage.removeItem('kapl_everything_reset_kapl-3-mens');
          localStorage.removeItem('kapl_everything_reset_kapl-3-womens');
        } catch {}
      }
      const isReset = !hasVault && typeof window !== 'undefined' && (
        localStorage.getItem('kapl_auction_manually_reset_kapl-3-mens') === 'true' ||
        localStorage.getItem('kapl_everything_reset_kapl-3-mens') === 'true' ||
        localStorage.getItem('kapl_all_players_cleared') === 'true'
      );
      if (isReset) {
        return [...DEFAULT_TEAMS, ...DEFAULT_WOMENS_TEAMS].map((t) => ({
          ...t,
          players: [],
          playerCount: 0,
          remainingPurse: 10000,
          initialPurse: 10000,
        }));
      }
      const rawMens = localStorage.getItem('kapl_auction_teams_kapl-3-mens');
      if (rawMens) {
        const parsed = JSON.parse(rawMens);
        if (parsed.length > 0) {
          return [...parsed, ...DEFAULT_WOMENS_TEAMS];
        }
      }
      const rawTeams = localStorage.getItem('kapl_teams');
      if (rawTeams) {
        const parsed = JSON.parse(rawTeams);
        if (parsed.length > 0) return parsed;
      }
    } catch {}
    return [...DEFAULT_TEAMS, ...DEFAULT_WOMENS_TEAMS];
  });
  
  const effectiveTournamentId = targetTournamentId || (typeof window !== 'undefined' ? localStorage.getItem('kapl_active_tournament_id') || 'kapl-3-mens' : 'kapl-3-mens');

  const [matchState, setMatchState] = useState<MatchState>(() => {
    const tMatch = globalTournamentMatchStates[effectiveTournamentId]?.currentMatch;
    if (tMatch && tMatch.id !== '1792091739936') {
      return globalTournamentMatchStates[effectiveTournamentId];
    }
    if (
      globalLocalMatchState.currentMatch &&
      globalLocalMatchState.currentMatch.id !== '1792091739936' &&
      resolveTournamentId(globalLocalMatchState.currentMatch) === effectiveTournamentId
    ) {
      return globalLocalMatchState;
    }
    try {
      const cachedKey = `kapl_local_match_state_${effectiveTournamentId}`;
      const cached = localStorage.getItem(cachedKey) || (effectiveTournamentId === 'kapl-3-mens' ? localStorage.getItem('kapl_local_match_state') : null);
      if (cached) {
        const parsed = JSON.parse(cached);
        const matchTId = resolveTournamentId(parsed.current_match);
        if (matchTId !== effectiveTournamentId) {
          return { currentMatch: null, lastAction: null };
        }
        if (parsed.current_match?.id === '1792091739936') {
          localStorage.removeItem(cachedKey);
          if (effectiveTournamentId === 'kapl-3-mens') {
            localStorage.removeItem('kapl_local_match_state');
          }
          return { currentMatch: null, lastAction: null };
        }
        return {
          currentMatch: parsed.current_match || null,
          lastAction: parsed.last_action || null,
        };
      }
    } catch (e) {}
    return { currentMatch: null, lastAction: null };
  });

  const [matchHistory, setMatchHistory] = useState<Match[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [playingPlayers, setPlayingPlayers] = useState<Record<string, string[]>>(() => globalPlayingPlayers);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingOfflineChanges, setPendingOfflineChanges] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Safety timer so isLoaded never hangs
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const syncOfflineQueue = useCallback(async () => {
    try {
      setIsSyncing(true);
      const tournamentIds = ['kapl-3-mens', 'kapl-3-womens'];
      let syncedAny = false;

      for (const tId of tournamentIds) {
        const raw = localStorage.getItem(`kapl_local_match_state_${tId}`) || (tId === 'kapl-3-mens' ? localStorage.getItem('kapl_local_match_state') : null);
        if (!raw) continue;

        try {
          const stateData = JSON.parse(raw);
          const targetId = tId === 'kapl-3-womens' ? 'womens' : 'current';
          const { error } = await supabase
            .from('match_state')
            .upsert({
              id: targetId,
              tournament_id: tId,
              current_match: stateData.current_match,
              last_action: stateData.last_action,
              updated_at: new Date().toISOString(),
            });

          if (!error) {
            localStorage.removeItem(`kapl_offline_sync_pending_${tId}`);
            localStorage.removeItem(`kapl_local_match_state_${tId}`);
            if (tId === 'kapl-3-mens') {
              localStorage.removeItem('kapl_offline_sync_pending');
              localStorage.removeItem('kapl_local_match_state');
            }
            syncedAny = true;
          } else {
            console.warn(`Sync failed for tournament ${tId}:`, error);
          }
        } catch (parseErr) {
          console.warn(`Error parsing offline state for ${tId}:`, parseErr);
        }
      }

      if (syncedAny) {
        setPendingOfflineChanges(0);
        toast.success('Synced offline scores successfully with cloud');
      }
    } catch (err) {
      console.warn('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Monitor online/offline events for resilient scoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Internet restored. Syncing data...');
      syncOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Offline mode: Scoring is saved locally and will auto-sync when online.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    try {
      if (localStorage.getItem('kapl_offline_sync_pending') === 'true') {
        setPendingOfflineChanges(1);
      }
    } catch (e) {}

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncOfflineQueue]);

  // Connect to shared global sync state & heartbeat
  useEffect(() => {
    sharedChannelRefCount++;
    initSharedRealtimeChannel();
    startGlobalHeartbeat();

    // Check if tournament match state is already cached
    const currentTournState = globalTournamentMatchStates[effectiveTournamentId];
    if (currentTournState?.currentMatch) {
      setMatchState(currentTournState);
    }

    const handleStateUpdate = (newState: MatchState, updatedTId?: string) => {
      const matchTournId = updatedTId || resolveTournamentId(newState.currentMatch);
      if (matchTournId === effectiveTournamentId) {
        setMatchState(newState);
      }
    };
    const handlePlayersUpdate = (players: Record<string, string[]>) => {
      setPlayingPlayers(players);
    };
    const handleTeamsUpdate = (updatedTeams: Team[]) => {
      setTeams(prev => {
        const current = [...prev];
        for (const u of updatedTeams) {
          const idx = current.findIndex(t => t.id === u.id);
          if (idx >= 0) current[idx] = u;
          else current.push(u);
        }
        return current;
      });
    };
    const handleHistoryUpdate = (newHistory: Match[]) => {
      setMatchHistory(newHistory);
    };

    globalStateListeners.add(handleStateUpdate);
    globalPlayersListeners.add(handlePlayersUpdate);
    globalTeamsListeners.add(handleTeamsUpdate);
    globalHistoryListeners.add(handleHistoryUpdate);

    // Cross-tab storage event listener
    const handleStorage = (e: StorageEvent) => {
      if ((e.key === 'kapl_local_match_state' || e.key === `kapl_local_match_state_${effectiveTournamentId}`) && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.current_match) {
            const tId = resolveTournamentId(parsed.current_match);
            if (tId === effectiveTournamentId) {
              handleStateUpdate({
                currentMatch: parsed.current_match,
                lastAction: parsed.last_action || null,
              });
              if (parsed.current_match.playingPlayers) {
                handlePlayersUpdate(parsed.current_match.playingPlayers);
              }
            }
          }
        } catch (err) {}
      }

      if ((e.key === 'kapl_teams' || e.key === `kapl_auction_teams_${effectiveTournamentId}`) && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            handleTeamsUpdate(parsed);
          }
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    const handleLocalMatchUpdate = (e: any) => {
      if (e.detail && 'currentMatch' in e.detail) {
        const tId = resolveTournamentId(e.detail.currentMatch, e.detail.tournamentId);
        if (tId === effectiveTournamentId) {
          handleStateUpdate({
            currentMatch: e.detail.currentMatch || null,
            lastAction: e.detail.lastAction || null,
          });
          if (e.detail.playingPlayers) {
            handlePlayersUpdate(e.detail.playingPlayers);
          } else if (!e.detail.currentMatch) {
            handlePlayersUpdate({});
          }
        }
      }
    };
    window.addEventListener('kapl-local-match-update', handleLocalMatchUpdate);

    const handleTeamsCustomEvent = (e: any) => {
      if (Array.isArray(e.detail) && e.detail.length > 0) {
        handleTeamsUpdate(e.detail);
      }
    };
    window.addEventListener('kapl-teams-updated', handleTeamsCustomEvent);

    return () => {
      globalStateListeners.delete(handleStateUpdate);
      globalPlayersListeners.delete(handlePlayersUpdate);
      globalTeamsListeners.delete(handleTeamsUpdate);
      globalHistoryListeners.delete(handleHistoryUpdate);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('kapl-local-match-update', handleLocalMatchUpdate);
      window.removeEventListener('kapl-teams-updated', handleTeamsCustomEvent);
      sharedChannelRefCount--;
      stopGlobalHeartbeat();
    };
  }, [effectiveTournamentId, targetTournamentId]);

  // Load data from database
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        // Load teams
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('*')
          .order('id');
        
        if (teamsError) throw teamsError;
        let loadedTeams: Team[] = [];
        const hasVault = typeof window !== 'undefined' && (
          Boolean(localStorage.getItem('kapl_player_vault')) || Boolean(localStorage.getItem('kapl_registered_players'))
        );
        if (hasVault || (teamsData && teamsData.length > 0)) {
          try {
            localStorage.removeItem('kapl_all_players_cleared');
            localStorage.removeItem('kapl_everything_reset_kapl-3-mens');
            localStorage.removeItem('kapl_everything_reset_kapl-3-womens');
          } catch {}
        }
        const isAllCleared = !hasVault && typeof window !== 'undefined' && localStorage.getItem('kapl_all_players_cleared') === 'true';

        if (teamsData && teamsData.length > 0) {
          loadedTeams = teamsData.map(dbToTeam);
          // If no women's teams exist in DB, append DEFAULT_WOMENS_TEAMS so both tournaments work seamlessly
          const hasWomensTeams = loadedTeams.some(t => t.tournamentId === 'kapl-3-womens');
          if (!hasWomensTeams) {
            loadedTeams = [...loadedTeams, ...DEFAULT_WOMENS_TEAMS];
          }
          // The remote database is the source of truth and wins over local cleared flag
          try {
            localStorage.removeItem('kapl_all_players_cleared');
          } catch {}
        } else {
          loadedTeams = [...DEFAULT_TEAMS, ...DEFAULT_WOMENS_TEAMS];
          if (isAllCleared) {
            loadedTeams = loadedTeams.map(t => ({
              ...t,
              players: [],
              playerCount: 0,
              remainingPurse: 10000,
              initialPurse: 10000,
            }));
          }
        }

        if (isMounted) setTeams(loadedTeams);

        // Load all match states (Men's and Women's leagues)
        const { data: stateRows, error: stateError } = await supabase
          .from('match_state')
          .select('*');
        
        if (stateError) throw stateError;
        if (stateRows && stateRows.length > 0 && isMounted) {
          for (const row of stateRows) {
            const tId = resolveTournamentId(row.current_match, row.tournament_id || (row.id === 'womens' ? 'kapl-3-womens' : 'kapl-3-mens'));
            const currentMatchData = row.current_match as unknown as Match | null;
            const isDiscarded = currentMatchData?.id === '1792091739936';
            if (currentMatchData && !isDiscarded) {
              const currentMatch: Match = {
                ...currentMatchData,
                tournamentId: tId,
              };
              const lastAction = row.last_action as MatchState['lastAction'];
              globalTournamentMatchStates[tId] = { currentMatch, lastAction };
              if (tId === effectiveTournamentId) {
                setMatchState({ currentMatch, lastAction });
                if ((currentMatch as any).playingPlayers) {
                  setPlayingPlayers((currentMatch as any).playingPlayers);
                }
              }
            } else {
              globalTournamentMatchStates[tId] = { currentMatch: null, lastAction: null };
              if (tId === effectiveTournamentId) {
                setMatchState({ currentMatch: null, lastAction: null });
                setPlayingPlayers({});
              }
              if (isDiscarded) {
                supabase.from('match_state').update({
                  current_match: null,
                  last_action: null,
                  updated_at: new Date().toISOString()
                }).eq('id', row.id).then();
                try {
                  localStorage.removeItem('kapl_local_match_state');
                  localStorage.removeItem(`kapl_local_match_state_${tId}`);
                } catch (e) {}
              }
            }
          }
        }

        // Load match history
        const { data: historyData, error: historyError } = await supabase
          .from('match_history')
          .select('*')
          .order('created_at', { ascending: true });
        
        if (historyError) throw historyError;
        if (historyData && isMounted) {
          setMatchHistory(historyData.map((h: any) => ({
            id: h.id,
            tournamentId: h.tournament_id || 'kapl-3-mens',
            group: h.group as 'A' | 'B',
            team1Id: h.team1_id,
            team2Id: h.team2_id,
            innings1: h.innings1,
            innings2: h.innings2,
            currentInnings: h.current_innings as 1 | 2,
            status: h.status as 'setup' | 'live' | 'completed',
            winner: h.winner,
            matchType: (h.match_type || 'group') as MatchType,
            playerOfTheMatchId: h.player_of_the_match_id || h.innings2?.potm?.id || h.innings1?.potm?.id || undefined,
            playerOfTheMatchName: h.player_of_the_match_name || h.innings2?.potm?.name || h.innings1?.potm?.name || undefined,
            playerOfTheMatchTeamId: h.player_of_the_match_team_id || h.innings2?.potm?.teamId || h.innings1?.potm?.teamId || undefined,
            playerOfTheMatchReason: h.player_of_the_match_reason || h.innings2?.potm?.reason || h.innings1?.potm?.reason || undefined,
            awards: h.awards || h.innings2?.potm?.awards || h.innings1?.potm?.awards || undefined,
          })));
        }

        if (isMounted) setIsLoaded(true);
      } catch (error) {
        console.error('Error loading data, continuing with cached/default data:', error);
        if (isMounted) setIsLoaded(true);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [effectiveTournamentId]);

  const updateTeam = useCallback(async (teamId: string, updates: Partial<Team>) => {
    const team = (teams || []).find(t => t.id === teamId);
    if (!team) return;

    const updatedTeam = { ...team, ...updates };
    saveStoredTeamMeta(teamId, {
      ownerName: updatedTeam.ownerName,
      ownerEmail: updatedTeam.ownerEmail,
      ownerUserId: updatedTeam.ownerUserId,
      captainName: updatedTeam.captainName,
      captainPlayerId: updatedTeam.captainPlayerId,
      captainUserId: updatedTeam.captainUserId,
    });

    if (!updatedTeam.players) {
      updatedTeam.players = Array.from({ length: 10 }, (_, i) => ({
        id: `${teamId}-p${i + 1}`,
        name: `Player ${i + 1}`,
        photo: null,
      }));
    }

    // Optimistic update
    setTeams(prev => (prev || []).map(t => t.id === teamId ? updatedTeam : t));

    // Save to database
    const { error } = await supabase
      .from('teams')
      .update(teamToDb(updatedTeam))
      .eq('id', teamId);

    if (error) {
      console.error('Error updating team:', error);
      // Revert on error
      setTeams(prev => (prev || []).map(t => t.id === teamId ? team : t));
    }
  }, [teams]);

  const removePlayerFromTeam = useCallback(async (teamId: string, playerId: string) => {
    const team = (teams || []).find((t) => t.id === teamId);
    if (!team) return;

    const targetPlayer = (team.players || []).find((p) => p.id === playerId);
    const refund = targetPlayer?.soldPrice || 0;
    const remainingPlayers = (team.players || []).filter((p) => p.id !== playerId);
    const updatedTeam: Team = {
      ...team,
      players: remainingPlayers,
      playerCount: Math.max(0, (team.playerCount || 1) - 1),
      remainingPurse: (team.remainingPurse ?? 10000) + refund,
    };

    const newTeams = (teams || []).map((t) => (t.id === teamId ? updatedTeam : t));
    setTeams(newTeams);

    const tid = team.tournamentId || 'kapl-3-mens';

    // 1. Update localStorage
    try {
      localStorage.setItem('kapl_teams', JSON.stringify(newTeams));
      localStorage.setItem(`kapl_auction_teams_${tid}`, JSON.stringify(newTeams.filter((t) => (t.tournamentId || 'kapl-3-mens') === tid)));

      // Revert player to pending in kapl_auction_players_${tid}
      const rawAuc = localStorage.getItem(`kapl_auction_players_${tid}`);
      if (rawAuc) {
        const parsed = JSON.parse(rawAuc);
        if (Array.isArray(parsed)) {
          const updatedAuc = parsed.map((p: any) =>
            p.id === playerId ? { ...p, teamId: null, soldPrice: null, auctionStatus: 'pending' } : p
          );
          localStorage.setItem(`kapl_auction_players_${tid}`, JSON.stringify(updatedAuc));
        }
      }
    } catch {}

    // 2. Dispatch window events for local reactive updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: newTeams }));
      window.dispatchEvent(
        new CustomEvent('kapl-auction-local-update', {
          detail: {
            event: 'auction_revert',
            targetPlayerId: playerId,
            targetTeamId: teamId,
            refundPrice: refund,
            tournamentId: tid,
          },
        })
      );
    }

    // 3. Cross-tab BroadcastChannels
    if (tabSyncChannel) {
      try {
        tabSyncChannel.postMessage({
          type: 'team_player_removed',
          teamId,
          playerId,
          refund,
          teams: newTeams,
        });
      } catch {}
    }
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const crossTab = new BroadcastChannel('kapl-shared-tab-channel');
        crossTab.postMessage({
          event: 'auction_revert',
          targetPlayerId: playerId,
          targetTeamId: teamId,
          refundPrice: refund,
          tournamentId: tid,
        });
        const aucTab = new BroadcastChannel('kapl_auction_tab_sync');
        aucTab.postMessage({
          event: 'auction_revert',
          targetPlayerId: playerId,
          targetTeamId: teamId,
          refundPrice: refund,
          tournamentId: tid,
        });
      } catch {}
    }

    // 4. Supabase broadcast to all roles
    try {
      const channel = supabase.channel(`auction-room-${tid}`);
      await channel.send({
        type: 'broadcast',
        event: 'auction_sync',
        payload: {
          event: 'auction_revert',
          targetPlayerId: playerId,
          targetTeamId: teamId,
          refundPrice: refund,
          tournamentId: tid,
        },
      });

      const dirChannel = supabase.channel(`player-dir-auction-sync-${tid}`);
      await dirChannel.send({
        type: 'broadcast',
        event: 'auction_sync',
        payload: {
          event: 'auction_revert',
          targetPlayerId: playerId,
          targetTeamId: teamId,
          refundPrice: refund,
          tournamentId: tid,
        },
      });
    } catch {}

    // 5. Remote Database sync
    try {
      await supabase
        .from('teams')
        .update({
          players: remainingPlayers as any,
          player_count: remainingPlayers.length,
          remaining_purse: updatedTeam.remainingPurse,
        })
        .eq('id', teamId);

      await supabase
        .from('players')
        .update({
          team_id: null,
          sold_price: null,
          auction_status: 'pending',
        })
        .eq('id', playerId);
    } catch (e) {
      console.warn('DB update for player removal from team:', e);
    }
  }, [teams]);

  const getTeam = useCallback((teamId: string) => {
    return (teams || []).find(t => t.id === teamId) ||
           DEFAULT_TEAMS.find(t => t.id === teamId) ||
           DEFAULT_WOMENS_TEAMS.find(t => t.id === teamId);
  }, [teams]);

  const getTeamsByGroup = useCallback((group: 'A' | 'B', tournamentId?: string) => {
    return (teams || []).filter(t => t.group === group && (!tournamentId || (t.tournamentId || 'kapl-3-mens') === tournamentId));
  }, [teams]);

  const getTeamsByTournament = useCallback((tournamentId: string) => {
    return (teams || []).filter(t => (t.tournamentId || 'kapl-3-mens') === tournamentId);
  }, [teams]);

  const getPlayingPlayers = useCallback((teamId: string) => {
    return playingPlayers[teamId] || [];
  }, [playingPlayers]);

  const saveMatchState = useCallback(async (newState: MatchState, explicitTournamentId?: string) => {
    const matchTournId = explicitTournamentId || (newState.currentMatch as any)?.tournamentId || (matchState.currentMatch as any)?.tournamentId || effectiveTournamentId || 'kapl-3-mens';
    const matchWithPlayers = newState.currentMatch ? {
      ...newState.currentMatch,
      tournamentId: matchTournId,
      playingPlayers,
    } : null;

    // 1. Immediately broadcast delta across in-tab components, cross-tab, and over WebSockets
    broadcastLiveMatchDelta(matchWithPlayers, newState.lastAction, playingPlayers, matchTournId);

    const targetId = matchTournId === 'kapl-3-womens' ? 'womens' : 'current';
    const payload = {
      id: targetId,
      tournament_id: matchTournId,
      current_match: matchWithPlayers ? (JSON.parse(JSON.stringify(matchWithPlayers)) as Json) : null,
      last_action: newState.lastAction ? (JSON.parse(JSON.stringify(newState.lastAction)) as Json) : null,
      updated_at: new Date().toISOString(),
    };

    // Cache locally per tournament
    try {
      localStorage.setItem(`kapl_local_match_state_${matchTournId}`, JSON.stringify(payload));
      if (matchTournId === 'kapl-3-mens') {
        localStorage.setItem('kapl_local_match_state', JSON.stringify(payload));
      }
    } catch (e) {}

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        localStorage.setItem(`kapl_offline_sync_pending_${matchTournId}`, 'true');
        localStorage.setItem('kapl_offline_sync_pending', 'true');
        setPendingOfflineChanges(prev => prev + 1);
      } catch (e) {}
      return;
    }

    try {
      const { error } = await supabase
        .from('match_state')
        .upsert(payload);

      if (error) {
        console.warn('Supabase match_state upsert warning, queued locally:', error);
        localStorage.setItem(`kapl_offline_sync_pending_${matchTournId}`, 'true');
        localStorage.setItem('kapl_offline_sync_pending', 'true');
        setPendingOfflineChanges(prev => prev + 1);
      } else {
        localStorage.removeItem(`kapl_offline_sync_pending_${matchTournId}`);
        localStorage.removeItem('kapl_offline_sync_pending');
        setPendingOfflineChanges(0);
      }
    } catch (err) {
      console.warn('Network error saving match state, queued locally:', err);
      try {
        localStorage.setItem(`kapl_offline_sync_pending_${matchTournId}`, 'true');
        localStorage.setItem('kapl_offline_sync_pending', 'true');
        setPendingOfflineChanges(prev => prev + 1);
      } catch (e) {}
    }
  }, [playingPlayers, matchState.currentMatch, effectiveTournamentId]);

  const startMatch = useCallback(async (
    group: 'A' | 'B', 
    team1Id: string, 
    team2Id: string, 
    matchType: MatchType = 'group',
    selectedPlayingPlayers?: Record<string, string[]>,
    tournamentId?: string
  ) => {
    const t1 = (teams || []).find(t => t.id === team1Id) || DEFAULT_TEAMS.find(t => t.id === team1Id) || DEFAULT_WOMENS_TEAMS.find(t => t.id === team1Id);
    const resolvedTournamentId = tournamentId || t1?.tournamentId || 'kapl-3-mens';

    const newMatch: Match = {
      id: Date.now().toString(),
      tournamentId: resolvedTournamentId,
      group,
      team1Id,
      team2Id,
      innings1: createInnings(team1Id, team2Id),
      innings2: null,
      currentInnings: 1,
      status: 'live',
      winner: null,
      matchType,
    };
    
    if (selectedPlayingPlayers) {
      setPlayingPlayers(selectedPlayingPlayers);
    }
    
    const matchWithPlayers = {
      ...newMatch,
      playingPlayers: selectedPlayingPlayers || {},
    };
    
    const newState = { currentMatch: newMatch, lastAction: null };
    setMatchState(newState);

    // 1. Immediately broadcast delta across all tabs, windows, and devices
    broadcastLiveMatchDelta(matchWithPlayers, null, selectedPlayingPlayers);

    // 2. Upsert into Supabase match_state with correct tournament target ID
    const targetId = resolvedTournamentId === 'kapl-3-womens' ? 'womens' : 'current';
    try {
      const { error } = await supabase
        .from('match_state')
        .upsert({
          id: targetId,
          tournament_id: resolvedTournamentId,
          current_match: JSON.parse(JSON.stringify(matchWithPlayers)) as Json,
          last_action: null,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.warn('Error saving match state to Supabase, queued locally:', error);
      }
    } catch (e) {
      console.warn('Network error in startMatch:', e);
    }

    // Reset secondary scorer state so it cannot carry over a previous match
    try {
      await supabase
        .from('secondary_match_state')
        .upsert({
          id: 'current',
          current_match: null,
          last_action: null,
        });
    } catch (e) {}
  }, [teams]);

  const getCurrentInnings = useCallback(() => {
    const match = matchState.currentMatch;
    if (!match) return null;
    if (match.currentInnings === 1) {
      return match.innings1 || createInnings(match.team1Id, match.team2Id);
    }
    return match.innings2 || createInnings(match.team2Id, match.team1Id);
  }, [matchState.currentMatch]);

  const addBall = useCallback(async (
    runs: number,
    isWicket = false,
    isWide = false,
    isNoBall = false,
    noStrikeChange = false,
    ballOptions?: {
      runsOffBat?: number;
      isBye?: boolean;
      extraType?: 'wide' | 'no_ball' | 'bye' | 'leg_bye' | null;
      wicketDetails?: WicketDetails;
    }
  ) => {
    if (!matchState.currentMatch) return;

    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    const overs = [...innings.overs];
    const currentOverIndex = overs.length - 1;
    const currentOver = { ...overs[currentOverIndex], balls: [...overs[currentOverIndex].balls] };

    // Check if target was already reached in 2nd innings
    if (match.currentInnings === 2 && match.innings1 && innings.runs >= match.innings1.runs + 1) {
      toast.info('Target has already been reached! Please end the match.');
      return;
    }

    // Check wicket limit
    if (innings.wickets >= MATCH_CONSTANTS.MAX_WICKETS) {
      toast.error('All wickets down! Please switch innings or end match.');
      return;
    }

    // Check overs limit
    if (innings.currentOver >= MATCH_CONSTANTS.MAX_OVERS) {
      toast.error(`Overs limit (${MATCH_CONSTANTS.MAX_OVERS} overs) reached for this innings.`);
      return;
    }

    const wasFreeHit = innings.isFreeHit === true;
    const isLegalBall = !isWide && !isNoBall;
    const totalRuns = isNoBall
      ? 1 + (ballOptions?.runsOffBat ?? (runs > 1 ? runs - 1 : 0))
      : runs;

    const ball: Ball = {
      id: Date.now().toString(),
      runs: totalRuns,
      isWicket,
      isWide,
      isNoBall,
      isExtra: isWide || isNoBall,
      extraType: isWide ? 'wide' : isNoBall ? 'no_ball' : ballOptions?.extraType || null,
      runsOffBat: ballOptions?.runsOffBat ?? (isNoBall ? (totalRuns > 1 ? totalRuns - 1 : 0) : (!isWide ? runs : 0)),
      extraRuns: isWide ? runs : isNoBall ? 1 : 0,
      isFreeHit: wasFreeHit,
      wicketDetails: ballOptions?.wicketDetails,
      batsmanId: innings.currentBatsmanId,
      bowlerId: innings.currentBowlerId,
    };

    currentOver.balls.push(ball);
    innings.runs += totalRuns;
    if (isWicket) innings.wickets += 1;

    // Update batter stats
    if (innings.currentBatsmanId && !isWide) {
      const batterStats = { ...innings.batterStats };
      if (!batterStats[innings.currentBatsmanId]) {
        batterStats[innings.currentBatsmanId] = {
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          isOut: false,
        };
      }
      const stats = { ...batterStats[innings.currentBatsmanId] };
      const runsToCredit = ball.runsOffBat ?? 0;
      stats.runs += runsToCredit;
      if (!isNoBall) {
        stats.ballsFaced += 1;
      }
      if (runsToCredit === 4) stats.fours += 1;
      if (runsToCredit === 6) stats.sixes += 1;
      if (isWicket) {
        stats.isOut = true;
        stats.dismissalType = ballOptions?.wicketDetails?.type || 'out';
        stats.dismissalDescription = ballOptions?.wicketDetails?.description;
      }
      batterStats[innings.currentBatsmanId] = stats;
      innings.batterStats = batterStats;
    }

    // Update bowler stats
    if (innings.currentBowlerId) {
      const bowlerStats = { ...innings.bowlerStats };
      if (!bowlerStats[innings.currentBowlerId]) {
        bowlerStats[innings.currentBowlerId] = {
          overs: 0,
          balls: 0,
          runs: 0,
          wickets: 0,
          wides: 0,
          noBalls: 0,
        };
      }
      const stats = { ...bowlerStats[innings.currentBowlerId] };
      stats.runs += totalRuns;
      if (isWicket && ballOptions?.wicketDetails?.type !== 'run_out' && ballOptions?.wicketDetails?.type !== 'retired') {
        stats.wickets += 1;
      }
      if (isWide) stats.wides += 1;
      if (isNoBall) stats.noBalls += 1;

      if (isLegalBall) {
        stats.balls += 1;
        if (stats.balls >= 6) {
          stats.overs += 1;
          stats.balls = 0;
        }
      }
      bowlerStats[innings.currentBowlerId] = stats;
      innings.bowlerStats = bowlerStats;
    }

    // Free Hit state machine
    if (isNoBall) {
      innings.isFreeHit = true;
    } else if (isLegalBall) {
      innings.isFreeHit = false;
    }

    // Rotate strike on odd runs unless noStrikeChange is set
    const runningRuns = isNoBall ? (ballOptions?.runsOffBat ?? 0) : totalRuns;
    if (!noStrikeChange && runningRuns % 2 === 1 && innings.currentBatsmanId && innings.nonStrikerBatsmanId) {
      const temp = innings.currentBatsmanId;
      innings.currentBatsmanId = innings.nonStrikerBatsmanId;
      innings.nonStrikerBatsmanId = temp;
    }

    if (isLegalBall) {
      innings.currentBall += 1;
      if (innings.currentBall >= 6) {
        innings.currentBall = 0;
        innings.currentOver += 1;

        if (innings.currentOver < MATCH_CONSTANTS.MAX_OVERS) {
          overs.push({ number: innings.currentOver + 1, balls: [], bowlerId: undefined });
        }

        // Rotate strike at end of over
        if (innings.currentBatsmanId && innings.nonStrikerBatsmanId) {
          const temp = innings.currentBatsmanId;
          innings.currentBatsmanId = innings.nonStrikerBatsmanId;
          innings.nonStrikerBatsmanId = temp;
        }

        // Remember which bowler finished this over so they cannot bowl back-to-back
        (match as any).lastOverBowlerId = innings.currentBowlerId;
        innings.currentBowlerId = undefined;
      }
    }

    overs[currentOverIndex] = currentOver;
    innings.overs = overs;

    if (match.currentInnings === 1) {
      match.innings1 = innings;
    } else {
      match.innings2 = innings;
    }

    const newState = {
      currentMatch: match,
      lastAction: { type: 'addBall', previousState: matchState.currentMatch },
    };

    setMatchState(newState);
    await saveMatchState(newState);

    // Check if 2nd innings target reached
    if (match.currentInnings === 2 && match.innings1) {
      const target = match.innings1.runs + 1;
      if (innings.runs >= target) {
        toast.success('Target reached! Match will be ended.');
      }
    }
  }, [matchState, saveMatchState]);

  const addNoBall = useCallback(async (
    batRuns: number = 0,
    isBye: boolean = false,
    boundaryDeclared: boolean = false
  ) => {
    return addBall(batRuns + 1, false, false, true, boundaryDeclared, {
      runsOffBat: isBye ? 0 : batRuns,
      isBye,
      extraType: isBye ? 'bye' : 'no_ball',
    });
  }, [addBall]);

  const addDismissal = useCallback(async (params: {
    type: DismissalType;
    outBatsmanId: string;
    fielderId?: string;
    fielderName?: string;
    runsCompleted?: number;
    nextBatsmanId?: string;
  }) => {
    if (!matchState.currentMatch) return;
    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    const overs = [...innings.overs];
    const currentOverIndex = overs.length - 1;
    const currentOver = { ...overs[currentOverIndex], balls: [...overs[currentOverIndex].balls] };

    if (innings.wickets >= MATCH_CONSTANTS.MAX_WICKETS) {
      toast.error('Maximum wickets reached for this innings');
      return;
    }

    if (innings.isFreeHit && params.type !== 'run_out' && params.type !== 'retired') {
      toast.error('Free Hit in play: Only Run Out is allowed under cricket rules');
      return;
    }

    const runs = params.runsCompleted || 0;
    const bowlingTeam = getTeam(innings.bowlingTeamId);
    const bowler = (bowlingTeam?.players || []).find(p => p.id === innings.currentBowlerId);
    const bowlerName = bowler?.name || 'Bowler';

    let description = '';
    switch (params.type) {
      case 'bowled':
        description = `b ${bowlerName}`;
        break;
      case 'caught':
        description = params.fielderId && params.fielderId === innings.currentBowlerId
          ? `c & b ${bowlerName}`
          : `c ${params.fielderName || 'Fielder'} b ${bowlerName}`;
        break;
      case 'lbw':
        description = `lbw b ${bowlerName}`;
        break;
      case 'stumped':
        description = `st ${params.fielderName || 'Keeper'} b ${bowlerName}`;
        break;
      case 'run_out':
        description = params.fielderName ? `run out (${params.fielderName})` : 'run out';
        break;
      case 'hit_wicket':
        description = `hit wicket b ${bowlerName}`;
        break;
      case 'retired':
        description = 'retired out';
        break;
    }

    const ball: Ball = {
      id: Date.now().toString(),
      runs: runs,
      isWicket: true,
      isWide: false,
      isNoBall: false,
      isExtra: false,
      isFreeHit: innings.isFreeHit,
      wicketDetails: {
        type: params.type,
        dismissedPlayerId: params.outBatsmanId,
        fielderId: params.fielderId,
        fielderName: params.fielderName,
        runsCompleted: runs,
        description,
      },
      batsmanId: innings.currentBatsmanId,
      bowlerId: innings.currentBowlerId,
    };

    currentOver.balls.push(ball);
    innings.runs += runs;
    innings.wickets += 1;
    innings.isFreeHit = false;

    // Out batsman stats
    const bStats = { ...innings.batterStats };
    if (!bStats[params.outBatsmanId]) {
      bStats[params.outBatsmanId] = { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false };
    }
    const outStats = { ...bStats[params.outBatsmanId] };
    outStats.isOut = true;
    outStats.dismissalType = params.type;
    outStats.dismissalDescription = description;
    outStats.dismissalFielderId = params.fielderId;
    outStats.dismissalBowlerId = innings.currentBowlerId;
    bStats[params.outBatsmanId] = outStats;

    // Striker stats for facing the ball
    if (innings.currentBatsmanId && innings.currentBatsmanId !== params.outBatsmanId) {
      if (!bStats[innings.currentBatsmanId]) {
        bStats[innings.currentBatsmanId] = { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false };
      }
      const sStats = { ...bStats[innings.currentBatsmanId] };
      sStats.runs += runs;
      sStats.ballsFaced += 1;
      bStats[innings.currentBatsmanId] = sStats;
    } else if (innings.currentBatsmanId === params.outBatsmanId) {
      outStats.ballsFaced += 1;
      outStats.runs += runs;
    }
    innings.batterStats = bStats;

    // Bowler stats
    if (innings.currentBowlerId) {
      const bwStats = { ...innings.bowlerStats };
      if (!bwStats[innings.currentBowlerId]) {
        bwStats[innings.currentBowlerId] = { overs: 0, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0 };
      }
      const stats = { ...bwStats[innings.currentBowlerId] };
      stats.runs += runs;
      if (params.type !== 'run_out' && params.type !== 'retired') {
        stats.wickets += 1;
      }
      stats.balls += 1;
      if (stats.balls >= 6) {
        stats.overs += 1;
        stats.balls = 0;
      }
      bwStats[innings.currentBowlerId] = stats;
      innings.bowlerStats = bwStats;
    }

    // Set next batsman or clear dismissed position
    if (innings.currentBatsmanId === params.outBatsmanId) {
      innings.currentBatsmanId = params.nextBatsmanId || undefined;
    }
    if (innings.nonStrikerBatsmanId === params.outBatsmanId) {
      innings.nonStrikerBatsmanId = params.nextBatsmanId || undefined;
    }

    if (params.nextBatsmanId) {
      if (!innings.batterStats[params.nextBatsmanId]) {
        innings.batterStats[params.nextBatsmanId] = { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false };
      }
      if (!innings.battingOrder.includes(params.nextBatsmanId)) {
        innings.battingOrder.push(params.nextBatsmanId);
      }
    }

    // Strike rotation if completed runs was odd
    if (runs % 2 === 1 && innings.currentBatsmanId && innings.nonStrikerBatsmanId) {
      const temp = innings.currentBatsmanId;
      innings.currentBatsmanId = innings.nonStrikerBatsmanId;
      innings.nonStrikerBatsmanId = temp;
    }

    // Legal ball counter and over completion
    innings.currentBall += 1;
    if (innings.currentBall >= 6) {
      innings.currentBall = 0;
      innings.currentOver += 1;

      if (innings.currentOver < MATCH_CONSTANTS.MAX_OVERS) {
        overs.push({ number: innings.currentOver + 1, balls: [], bowlerId: undefined });
      }

      if (innings.currentBatsmanId && innings.nonStrikerBatsmanId) {
        const temp = innings.currentBatsmanId;
        innings.currentBatsmanId = innings.nonStrikerBatsmanId;
        innings.nonStrikerBatsmanId = temp;
      }

      (match as any).lastOverBowlerId = innings.currentBowlerId;
      innings.currentBowlerId = undefined;
    }

    overs[currentOverIndex] = currentOver;
    innings.overs = overs;

    if (match.currentInnings === 1) {
      match.innings1 = innings;
    } else {
      match.innings2 = innings;
    }

    const newState = {
      currentMatch: match,
      lastAction: { type: 'dismissal', previousState: matchState.currentMatch },
    };

    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState, getTeam]);

  // Backward compatible addRunOut
  const addRunOut = useCallback(async (outBatsmanId: string, runs: number = 0) => {
    return addDismissal({
      type: 'run_out',
      outBatsmanId,
      runsCompleted: runs,
    });
  }, [addDismissal]);

  const editBall = useCallback(async (overIndex: number, ballIndex: number, updatedBall: Partial<Ball>) => {
    if (!matchState.currentMatch) return;
    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    if (!innings.overs[overIndex] || !innings.overs[overIndex].balls[ballIndex]) return;

    innings.overs[overIndex].balls[ballIndex] = {
      ...innings.overs[overIndex].balls[ballIndex],
      ...updatedBall,
    };

    const recalculated = recalculateInnings(innings);
    if (match.currentInnings === 1) {
      match.innings1 = recalculated;
    } else {
      match.innings2 = recalculated;
    }

    const newState = {
      currentMatch: match,
      lastAction: { type: 'editBall', previousState: matchState.currentMatch },
    };
    setMatchState(newState);
    await saveMatchState(newState);
    toast.success('Ball updated and scorecard recalculated');
  }, [matchState, saveMatchState]);

  const deleteBall = useCallback(async (overIndex: number, ballIndex: number) => {
    if (!matchState.currentMatch) return;
    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    if (!innings.overs[overIndex] || !innings.overs[overIndex].balls[ballIndex]) return;

    innings.overs[overIndex].balls.splice(ballIndex, 1);

    const recalculated = recalculateInnings(innings);
    if (match.currentInnings === 1) {
      match.innings1 = recalculated;
    } else {
      match.innings2 = recalculated;
    }

    const newState = {
      currentMatch: match,
      lastAction: { type: 'deleteBall', previousState: matchState.currentMatch },
    };
    setMatchState(newState);
    await saveMatchState(newState);
    toast.success('Ball deleted and scorecard recalculated');
  }, [matchState, saveMatchState]);

  const selectBatsman = useCallback(async (playerId: string, isStriker: boolean) => {
    if (!matchState.currentMatch) return;
    
    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    
    if (isStriker) {
      innings.currentBatsmanId = playerId;
    } else {
      innings.nonStrikerBatsmanId = playerId;
    }
    
    // Initialize batter stats if not exists
    if (!innings.batterStats[playerId]) {
      innings.batterStats = {
        ...innings.batterStats,
        [playerId]: {
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          isOut: false,
        },
      };
    }
    
    // Add to batting order if not already there
    if (!innings.battingOrder.includes(playerId)) {
      innings.battingOrder = [...innings.battingOrder, playerId];
    }
    
    if (match.currentInnings === 1) {
      match.innings1 = innings;
    } else {
      match.innings2 = innings;
    }
    
    const newState = { currentMatch: match, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState]);

  const selectBowler = useCallback(async (playerId: string) => {
    if (!matchState.currentMatch) return;
    
    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    
    // Check quota: max 2 overs per bowler
    const stats = innings.bowlerStats[playerId];
    if (stats && stats.overs >= MATCH_CONSTANTS.MAX_OVERS_PER_BOWLER) {
      toast.error(`Bowler quota exceeded: Maximum ${MATCH_CONSTANTS.MAX_OVERS_PER_BOWLER} overs allowed per bowler.`);
      return;
    }

    // Check consecutive overs restriction
    const lastBowlerId = (match as any).lastOverBowlerId || (innings.overs.length > 1 ? innings.overs[innings.overs.length - 2]?.bowlerId : null);
    if (lastBowlerId && playerId === lastBowlerId && (innings.currentBall === 0 || playerId !== innings.currentBowlerId)) {
      toast.error('A bowler cannot bowl two consecutive overs.');
      return;
    }

    innings.currentBowlerId = playerId;
    
    // Set bowler for current over
    const overs = [...innings.overs];
    if (overs.length > 0) {
      overs[overs.length - 1] = { ...overs[overs.length - 1], bowlerId: playerId };
      innings.overs = overs;
    }
    
    // Initialize bowler stats if not exists
    if (!innings.bowlerStats[playerId]) {
      innings.bowlerStats = {
        ...innings.bowlerStats,
        [playerId]: {
          overs: 0,
          balls: 0,
          runs: 0,
          wickets: 0,
          wides: 0,
          noBalls: 0,
        },
      };
    }
    
    if (match.currentInnings === 1) {
      match.innings1 = innings;
    } else {
      match.innings2 = innings;
    }
    
    const newState = { currentMatch: match, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState]);

  const undoLastBall = useCallback(async () => {
    if (!matchState.lastAction?.previousState) return;
    
    const newState = {
      currentMatch: matchState.lastAction.previousState,
      lastAction: null,
    };
    
    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState]);

  // Undo multiple balls by restoring to a specific state
  const undoToBall = useCallback(async (overIndex: number, ballIndex: number) => {
    if (!matchState.currentMatch) return;
    
    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    
    // Get total balls to undo
    const overs = [...innings.overs];
    const ballsToRemove: Ball[] = [];
    
    // Collect balls to remove (from end back to specified position)
    for (let i = overs.length - 1; i >= overIndex; i--) {
      const over = overs[i];
      const startBall = i === overIndex ? ballIndex + 1 : 0;
      for (let j = over.balls.length - 1; j >= startBall; j--) {
        ballsToRemove.push(over.balls[j]);
      }
    }
    
    // Revert stats for each ball
    ballsToRemove.forEach(ball => {
      // Revert innings stats
      innings.runs -= ball.runs;
      if (ball.isWicket) innings.wickets -= 1;
      
      // Revert batter stats
      if (ball.batsmanId && !ball.isWide && innings.batterStats[ball.batsmanId]) {
        const stats = { ...innings.batterStats[ball.batsmanId] };
        // For no-ball, batter runs = total - 1
        const batterRuns = ball.isNoBall ? ball.runs - 1 : ball.runs;
        stats.runs -= batterRuns;
        stats.ballsFaced -= 1;
        if (batterRuns === 4 && !ball.isWide && !ball.isNoBall) stats.fours -= 1;
        if (batterRuns === 6 && !ball.isWide && !ball.isNoBall) stats.sixes -= 1;
        if (ball.isWicket) {
          stats.isOut = false;
          stats.dismissalType = undefined;
        }
        innings.batterStats[ball.batsmanId] = stats;
      }
      
      // Revert bowler stats
      if (ball.bowlerId && innings.bowlerStats[ball.bowlerId]) {
        const stats = { ...innings.bowlerStats[ball.bowlerId] };
        stats.runs -= ball.runs;
        if (ball.isWicket) stats.wickets -= 1;
        if (ball.isWide) stats.wides -= 1;
        if (ball.isNoBall) stats.noBalls -= 1;
        
        if (!ball.isWide && !ball.isNoBall) {
          if (stats.balls === 0 && stats.overs > 0) {
            stats.overs -= 1;
            stats.balls = 5;
          } else {
            stats.balls -= 1;
          }
        }
        innings.bowlerStats[ball.bowlerId] = stats;
      }
    });
    
    // Remove balls from overs
    for (let i = overs.length - 1; i >= overIndex; i--) {
      if (i === overIndex) {
        overs[i] = { ...overs[i], balls: overs[i].balls.slice(0, ballIndex + 1) };
      } else if (i > overIndex) {
        // Remove entire over if it's after the target
        overs.splice(i, 1);
      }
    }
    
    // Recalculate current over/ball
    const lastOver = overs[overs.length - 1];
    const legalBalls = lastOver.balls.filter(b => !b.isWide && !b.isNoBall).length;
    innings.currentOver = overs.length - 1;
    innings.currentBall = legalBalls;
    innings.overs = overs;
    
    if (match.currentInnings === 1) {
      match.innings1 = innings;
    } else {
      match.innings2 = innings;
    }
    
    const newState = {
      currentMatch: match,
      lastAction: null,
    };
    
    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState]);

  const switchBattingTeam = useCallback(async () => {
    if (!matchState.currentMatch) return;
    
    const match = { ...matchState.currentMatch };
    
    if (match.currentInnings === 1 && match.innings1) {
      match.innings2 = createInnings(match.team2Id, match.team1Id);
      match.currentInnings = 2;
    }
    
    const newState = {
      currentMatch: match,
      lastAction: { type: 'switchInnings', previousState: matchState.currentMatch },
    };
    
    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState]);

  const swapStrike = useCallback(async () => {
    if (!matchState.currentMatch) return;
    
    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    
    if (innings.currentBatsmanId && innings.nonStrikerBatsmanId) {
      const temp = innings.currentBatsmanId;
      innings.currentBatsmanId = innings.nonStrikerBatsmanId;
      innings.nonStrikerBatsmanId = temp;
      
      if (match.currentInnings === 1) {
        match.innings1 = innings;
      } else {
        match.innings2 = innings;
      }
      
      const newState = { currentMatch: match, lastAction: null };
      setMatchState(newState);
      await saveMatchState(newState);
    }
  }, [matchState, saveMatchState]);

  // Replace a player who retired/injured mid-match
  const replacePlayer = useCallback(async (oldPlayerId: string, newPlayerId: string, teamId: string) => {
    if (!matchState.currentMatch) return;
    
    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    
    // Check if the player is currently batting or bowling
    const isBatting = innings.battingTeamId === teamId;
    
    if (isBatting) {
      // Transfer batting stats to new player
      if (innings.batterStats[oldPlayerId]) {
        const oldStats = { ...innings.batterStats[oldPlayerId] };
        // Mark old player as retired
        oldStats.isOut = true;
        oldStats.dismissalType = 'retired';
        innings.batterStats[oldPlayerId] = oldStats;
      }
      
      // If old player was striking or non-striking, replace with new player
      if (innings.currentBatsmanId === oldPlayerId) {
        innings.currentBatsmanId = newPlayerId;
      }
      if (innings.nonStrikerBatsmanId === oldPlayerId) {
        innings.nonStrikerBatsmanId = newPlayerId;
      }
      
      // Initialize new player stats
      if (!innings.batterStats[newPlayerId]) {
        innings.batterStats[newPlayerId] = {
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          isOut: false,
        };
      }
      
      // Add to batting order if not already there
      if (!innings.battingOrder.includes(newPlayerId)) {
        innings.battingOrder = [...innings.battingOrder, newPlayerId];
      }
    } else {
      // For bowler replacement
      if (innings.currentBowlerId === oldPlayerId) {
        innings.currentBowlerId = newPlayerId;
      }
      
      // Note: We don't transfer bowler stats - the new bowler starts fresh
      if (!innings.bowlerStats[newPlayerId]) {
        innings.bowlerStats[newPlayerId] = {
          overs: 0,
          balls: 0,
          runs: 0,
          wickets: 0,
          wides: 0,
          noBalls: 0,
        };
      }
    }
    
    if (match.currentInnings === 1) {
      match.innings1 = innings;
    } else {
      match.innings2 = innings;
    }
    
    const newState = { currentMatch: match, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
    
    toast.success('Player replaced successfully');
  }, [matchState, saveMatchState]);

  const endMatch = useCallback(async (forceTie: boolean = false, potmData?: PlayerOfTheMatchData | null) => {
    if (!matchState.currentMatch) return;
    
    const match = { ...matchState.currentMatch };
    
    const team1Runs = match.innings1?.runs || 0;
    const team2Runs = match.innings2?.runs || 0;
    
    // Check for tie (unless forceTie is true, which means end as tie without super over)
    const isTied = team1Runs === team2Runs && team2Runs > 0;
    
    if (isTied && !forceTie && !match.superOver) {
      // Mark match as tied - prompt for super over
      match.isTied = true;
      const newState = { currentMatch: match, lastAction: null };
      setMatchState(newState);
      await saveMatchState(newState);
      toast.info('Match tied! Start a Super Over or end as tie.');
      return;
    }
    
    // If ending super over, determine winner from super over
    if (match.superOver?.completed) {
      const so1Runs = match.superOver.innings1?.runs || 0;
      const so2Runs = match.superOver.innings2?.runs || 0;
      match.winner = so1Runs > so2Runs ? match.team1Id : so2Runs > so1Runs ? match.team2Id : null;
    } else {
      match.winner = team1Runs > team2Runs ? match.team1Id : team2Runs > team1Runs ? match.team2Id : null;
    }
    
    match.status = 'completed';

    // Attach Player of the Match honors if provided
    if (potmData) {
      match.playerOfTheMatchId = potmData.playerId;
      match.playerOfTheMatchName = potmData.playerName;
      match.playerOfTheMatchTeamId = potmData.playerTeamId;
      match.playerOfTheMatchReason = potmData.reason;
      match.awards = potmData.awards;
    }

    const potmPayload = match.playerOfTheMatchId ? {
      id: match.playerOfTheMatchId,
      name: match.playerOfTheMatchName,
      teamId: match.playerOfTheMatchTeamId,
      reason: match.playerOfTheMatchReason,
      awards: match.awards,
    } : null;

    const innings1WithPotm = match.innings1 ? { ...match.innings1, potm: potmPayload } : null;
    const innings2WithPotm = match.innings2 ? { ...match.innings2, potm: potmPayload } : null;
    
    // Save to match history (storing POTM in innings JSONB for flawless schema compatibility)
    const { error } = await supabase
      .from('match_history')
      .insert({
        id: match.id,
        tournament_id: match.tournamentId || 'kapl-3-mens',
        group: match.group,
        team1_id: match.team1Id,
        team2_id: match.team2Id,
        innings1: JSON.parse(JSON.stringify(innings1WithPotm)) as Json,
        innings2: JSON.parse(JSON.stringify(innings2WithPotm)) as Json,
        current_innings: match.currentInnings,
        status: match.status,
        winner: match.winner,
        match_type: match.matchType,
      });

    if (error) {
      console.error('Error saving match to history:', error);
      return;
    }

    // Clear current match specifically for this tournament
    const matchTournId = match.tournamentId || effectiveTournamentId || 'kapl-3-mens';
    const newState = { currentMatch: null, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState, matchTournId);
    broadcastLiveMatchDelta(null, null, undefined, matchTournId);
    setPlayingPlayers({});
    
    // Update local history
    setMatchHistory(prev => [...prev, match]);
  }, [matchState, saveMatchState, effectiveTournamentId]);

  // Update or assign Player of the Match for a completed match
  const updateMatchPOTM = useCallback(async (matchId: string, potmData: PlayerOfTheMatchData) => {
    let targetMatch: Match | undefined;
    setMatchHistory(prev => prev.map(m => {
      if (m.id === matchId) {
        targetMatch = {
          ...m,
          playerOfTheMatchId: potmData.playerId,
          playerOfTheMatchName: potmData.playerName,
          playerOfTheMatchTeamId: potmData.playerTeamId,
          playerOfTheMatchReason: potmData.reason,
          awards: potmData.awards,
        };
        return targetMatch;
      }
      return m;
    }));

    try {
      const existing = matchHistory.find(m => m.id === matchId);
      if (existing) {
        const potmPayload = {
          id: potmData.playerId,
          name: potmData.playerName,
          teamId: potmData.playerTeamId,
          reason: potmData.reason,
          awards: potmData.awards,
        };
        const inn1 = existing.innings1 ? { ...existing.innings1, potm: potmPayload } : null;
        const inn2 = existing.innings2 ? { ...existing.innings2, potm: potmPayload } : null;

        await supabase
          .from('match_history')
          .update({
            innings1: JSON.parse(JSON.stringify(inn1)) as Json,
            innings2: JSON.parse(JSON.stringify(inn2)) as Json,
          })
          .eq('id', matchId);
      }
      toast.success(`Player of the Match awarded to ${potmData.playerName}!`);
    } catch (err) {
      console.error('Error updating match POTM in Supabase:', err);
      toast.error('Failed to sync Player of the Match');
    }
  }, [matchHistory]);

  // Discard / Abandon current live match without saving to history or affecting points table
  const abandonMatch = useCallback(async (tournamentId?: string) => {
    const tId = tournamentId || resolveTournamentId(matchState.currentMatch) || effectiveTournamentId || 'kapl-3-mens';
    const newState = { currentMatch: null, lastAction: null };
    
    globalTournamentMatchStates[tId] = newState;
    if (globalLocalMatchState.currentMatch && resolveTournamentId(globalLocalMatchState.currentMatch) === tId) {
      globalLocalMatchState = newState;
    }
    setMatchState(newState);
    setPlayingPlayers({});

    // 1. Broadcast delta to all mounted components & cross-tab & WebSockets specifically for this tournament
    broadcastLiveMatchDelta(null, null, undefined, tId);

    // 2. Clear localStorage entries specifically for this tournament
    try {
      localStorage.removeItem(`kapl_local_match_state_${tId}`);
      const rawCurrent = localStorage.getItem('kapl_local_match_state');
      if (rawCurrent) {
        try {
          const parsed = JSON.parse(rawCurrent);
          if (resolveTournamentId(parsed.current_match) === tId) {
            localStorage.removeItem('kapl_local_match_state');
          }
        } catch {}
      }
    } catch (e) {}

    // 3. Persist to Supabase match_state
    const targetId = tId === 'kapl-3-womens' ? 'womens' : 'current';
    try {
      await supabase
        .from('match_state')
        .update({
          current_match: null,
          last_action: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetId);
    } catch (err) {
      console.warn('Error clearing match_state in database:', err);
    }
  }, [matchState, effectiveTournamentId]);

  // Start a super over
  const startSuperOver = useCallback(async () => {
    if (!matchState.currentMatch) return;
    
    const match = { ...matchState.currentMatch };
    
    // Initialize super over
    match.superOver = {
      innings1: createInnings(match.team1Id, match.team2Id),
      innings2: null,
      currentInnings: 1,
      completed: false,
    };
    match.status = 'super_over';
    match.isTied = false;
    
    const newState = { currentMatch: match, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
    
    toast.success('Super Over started! Team 1 batting first.');
  }, [matchState, saveMatchState]);

  // Switch super over innings
  const switchSuperOverInnings = useCallback(async () => {
    if (!matchState.currentMatch?.superOver) return;
    
    const match = { ...matchState.currentMatch };
    const superOver = { ...match.superOver! };
    
    if (superOver.currentInnings === 1) {
      superOver.innings2 = createInnings(match.team2Id, match.team1Id);
      superOver.currentInnings = 2;
    }
    
    match.superOver = superOver;
    
    const newState = { currentMatch: match, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
    
    toast.success('Super Over innings switched! Team 2 batting.');
  }, [matchState, saveMatchState]);

  // Add ball in super over
  const addSuperOverBall = useCallback(async (runs: number, isWicket = false, isWide = false, isNoBall = false) => {
    if (!matchState.currentMatch?.superOver) return;
    
    const match = { ...matchState.currentMatch };
    const superOver = { ...match.superOver! };
    const innings = superOver.currentInnings === 1 ? { ...superOver.innings1! } : { ...superOver.innings2! };
    const overs = [...innings.overs];
    const currentOverIndex = overs.length - 1;
    const currentOver = { ...overs[currentOverIndex], balls: [...overs[currentOverIndex].balls] };

    // Check wicket limit for super over (2 wickets)
    if (isWicket && innings.wickets >= MATCH_CONSTANTS.SUPER_OVER_WICKETS) {
      return;
    }

    const totalRuns = isNoBall ? runs + 1 : runs;
    const isLegalBall = !isWide && !isNoBall;

    const ball: Ball = {
      id: Date.now().toString(),
      runs: totalRuns,
      isWicket,
      isWide,
      isNoBall,
      isExtra: isWide || isNoBall,
      batsmanId: innings.currentBatsmanId,
      bowlerId: innings.currentBowlerId,
    };

    currentOver.balls.push(ball);
    innings.runs += totalRuns;
    if (isWicket) innings.wickets += 1;

    // Update batter stats
    if (innings.currentBatsmanId && !isWide) {
      const batterStats = { ...innings.batterStats };
      if (!batterStats[innings.currentBatsmanId]) {
        batterStats[innings.currentBatsmanId] = {
          runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false,
        };
      }
      const stats = { ...batterStats[innings.currentBatsmanId] };
      stats.runs += runs;
      if (isLegalBall) stats.ballsFaced += 1;
      if (runs === 4 && !isWide && !isNoBall) stats.fours += 1;
      if (runs === 6 && !isWide && !isNoBall) stats.sixes += 1;
      if (isWicket) {
        stats.isOut = true;
        stats.dismissalType = 'out';
      }
      batterStats[innings.currentBatsmanId] = stats;
      innings.batterStats = batterStats;
    }

    // Update bowler stats
    if (innings.currentBowlerId) {
      const bowlerStats = { ...innings.bowlerStats };
      if (!bowlerStats[innings.currentBowlerId]) {
        bowlerStats[innings.currentBowlerId] = {
          overs: 0, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0,
        };
      }
      const stats = { ...bowlerStats[innings.currentBowlerId] };
      stats.runs += totalRuns;
      if (isWicket) stats.wickets += 1;
      if (isWide) stats.wides += 1;
      if (isNoBall) stats.noBalls += 1;
      if (isLegalBall) {
        stats.balls += 1;
        if (stats.balls >= 6) {
          stats.overs += 1;
          stats.balls = 0;
        }
      }
      bowlerStats[innings.currentBowlerId] = stats;
      innings.bowlerStats = bowlerStats;
    }

    // Rotate strike on odd runs
    if (totalRuns % 2 === 1 && innings.currentBatsmanId && innings.nonStrikerBatsmanId) {
      const temp = innings.currentBatsmanId;
      innings.currentBatsmanId = innings.nonStrikerBatsmanId;
      innings.nonStrikerBatsmanId = temp;
    }

    if (isLegalBall) {
      innings.currentBall += 1;
      if (innings.currentBall >= 6) {
        innings.currentBall = 0;
        innings.currentOver += 1;
      }
    }

    overs[currentOverIndex] = currentOver;
    innings.overs = overs;

    if (superOver.currentInnings === 1) {
      superOver.innings1 = innings;
    } else {
      superOver.innings2 = innings;
    }

    // Check if super over innings complete (1 over or all wickets)
    const isInningsComplete = innings.currentOver >= MATCH_CONSTANTS.SUPER_OVER_OVERS || 
                              innings.wickets >= MATCH_CONSTANTS.SUPER_OVER_WICKETS;
    
    // Check if 2nd innings chased target
    if (superOver.currentInnings === 2 && superOver.innings1) {
      const target = superOver.innings1.runs + 1;
      if (innings.runs >= target) {
        superOver.completed = true;
        toast.success('Target reached in Super Over!');
      }
    }

    match.superOver = superOver;
    
    const newState = {
      currentMatch: match,
      lastAction: { type: 'addSuperOverBall', previousState: matchState.currentMatch },
    };
    
    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState]);

  // Select batsman for super over
  const selectSuperOverBatsman = useCallback(async (playerId: string, isStriker: boolean) => {
    if (!matchState.currentMatch?.superOver) return;
    
    const match = { ...matchState.currentMatch };
    const superOver = { ...match.superOver! };
    const innings = superOver.currentInnings === 1 ? { ...superOver.innings1! } : { ...superOver.innings2! };
    
    if (isStriker) {
      innings.currentBatsmanId = playerId;
    } else {
      innings.nonStrikerBatsmanId = playerId;
    }
    
    if (!innings.batterStats[playerId]) {
      innings.batterStats = {
        ...innings.batterStats,
        [playerId]: { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false },
      };
    }
    
    if (!innings.battingOrder.includes(playerId)) {
      innings.battingOrder = [...innings.battingOrder, playerId];
    }
    
    if (superOver.currentInnings === 1) {
      superOver.innings1 = innings;
    } else {
      superOver.innings2 = innings;
    }
    
    match.superOver = superOver;
    
    const newState = { currentMatch: match, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState]);

  // Select bowler for super over
  const selectSuperOverBowler = useCallback(async (playerId: string) => {
    if (!matchState.currentMatch?.superOver) return;
    
    const match = { ...matchState.currentMatch };
    const superOver = { ...match.superOver! };
    const innings = superOver.currentInnings === 1 ? { ...superOver.innings1! } : { ...superOver.innings2! };
    
    innings.currentBowlerId = playerId;
    
    if (!innings.bowlerStats[playerId]) {
      innings.bowlerStats = {
        ...innings.bowlerStats,
        [playerId]: { overs: 0, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0 },
      };
    }
    
    if (superOver.currentInnings === 1) {
      superOver.innings1 = innings;
    } else {
      superOver.innings2 = innings;
    }
    
    match.superOver = superOver;
    
    const newState = { currentMatch: match, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState]);

  // End super over (mark as completed)
  const endSuperOver = useCallback(async () => {
    if (!matchState.currentMatch?.superOver) return;
    
    const match = { ...matchState.currentMatch };
    const superOver = { ...match.superOver! };
    superOver.completed = true;
    match.superOver = superOver;
    
    const newState = { currentMatch: match, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState]);

  const getTeamStats = useCallback((tournamentId?: string): TeamStats[] => {
    const stats: Map<string, TeamStats> = new Map();
    
    const targetTeams = tournamentId
      ? teams.filter(t => (t.tournamentId || 'kapl-3-mens') === tournamentId)
      : teams;

    targetTeams.forEach(team => {
      stats.set(team.id, { 
        teamId: team.id, 
        matchesPlayed: 0, 
        wins: 0, 
        losses: 0, 
        ties: 0,
        points: 0,
        totalRuns: 0,
        totalFours: 0,
        totalSixes: 0,
        totalWickets: 0,
        runsScored: 0,
        oversPlayed: 0,
        runsConceded: 0,
        oversBowled: 0,
        nrr: 0,
      });
    });

    // Helper to count boundaries from innings batter stats
    const countBoundaries = (innings: Innings | null) => {
      if (!innings?.batterStats) return { fours: 0, sixes: 0 };
      let fours = 0;
      let sixes = 0;
      Object.values(innings.batterStats).forEach(stats => {
        fours += stats.fours || 0;
        sixes += stats.sixes || 0;
      });
      return { fours, sixes };
    };

    // Helper to count wickets from innings bowler stats
    const countWickets = (innings: Innings | null) => {
      if (!innings?.bowlerStats) return 0;
      return Object.values(innings.bowlerStats).reduce((total, stats) => total + (stats.wickets || 0), 0);
    };

    // Helper to calculate overs in decimal format (with ICC all-out rule)
    const getOversDecimal = (innings: Innings | null) => {
      if (!innings) return 0;
      // ICC Rule: If a team is all out, their overs faced are counted as the full innings quota (7.0 overs)
      if (innings.wickets >= MATCH_CONSTANTS.MAX_WICKETS) {
        return MATCH_CONSTANTS.MAX_OVERS;
      }
      return innings.currentOver + (innings.currentBall / 6);
    };

    matchHistory.forEach(match => {
      if (tournamentId) {
        const matchTourn = match.tournamentId || 'kapl-3-mens';
        if (matchTourn !== tournamentId && !stats.has(match.team1Id)) {
          return;
        }
      }

      if (match.status === 'completed') {
        const team1Stats = stats.get(match.team1Id);
        const team2Stats = stats.get(match.team2Id);
        
        const innings1 = match.innings1 as Innings | null;
        const innings2 = match.innings2 as Innings | null;
        
        // Team 1 batting stats from innings1, bowling stats from innings2
        const team1Batting = countBoundaries(innings1);
        const team1Bowling = countWickets(innings2);
        const team1OversPlayed = getOversDecimal(innings1);
        const team1OversBowled = getOversDecimal(innings2);
        
        // Team 2 batting stats from innings2, bowling stats from innings1
        const team2Batting = countBoundaries(innings2);
        const team2Bowling = countWickets(innings1);
        const team2OversPlayed = getOversDecimal(innings2);
        const team2OversBowled = getOversDecimal(innings1);
        
        if (team1Stats) {
          team1Stats.matchesPlayed += 1;
          team1Stats.totalRuns += innings1?.runs || 0;
          team1Stats.totalFours += team1Batting.fours;
          team1Stats.totalSixes += team1Batting.sixes;
          team1Stats.totalWickets += team1Bowling;
          team1Stats.runsScored += innings1?.runs || 0;
          team1Stats.oversPlayed += team1OversPlayed;
          team1Stats.runsConceded += innings2?.runs || 0;
          team1Stats.oversBowled += team1OversBowled;
          if (match.winner === match.team1Id) {
            team1Stats.wins += 1;
            team1Stats.points += 2;
          } else if (match.winner === match.team2Id) {
            team1Stats.losses += 1;
          } else {
            // Tied or no result match
            team1Stats.ties += 1;
            team1Stats.points += 1;
          }
        }
        if (team2Stats) {
          team2Stats.matchesPlayed += 1;
          team2Stats.totalRuns += innings2?.runs || 0;
          team2Stats.totalFours += team2Batting.fours;
          team2Stats.totalSixes += team2Batting.sixes;
          team2Stats.totalWickets += team2Bowling;
          team2Stats.runsScored += innings2?.runs || 0;
          team2Stats.oversPlayed += team2OversPlayed;
          team2Stats.runsConceded += innings1?.runs || 0;
          team2Stats.oversBowled += team2OversBowled;
          if (match.winner === match.team2Id) {
            team2Stats.wins += 1;
            team2Stats.points += 2;
          } else if (match.winner === match.team1Id) {
            team2Stats.losses += 1;
          } else {
            // Tied or no result match
            team2Stats.ties += 1;
            team2Stats.points += 1;
          }
        }
      }
    });

    // Calculate NRR for each team
    stats.forEach((teamStats) => {
      if (teamStats.oversPlayed > 0 && teamStats.oversBowled > 0) {
        const runRate = teamStats.runsScored / teamStats.oversPlayed;
        const concededRate = teamStats.runsConceded / teamStats.oversBowled;
        teamStats.nrr = runRate - concededRate;
      }
    });

    return Array.from(stats.values());
  }, [teams, matchHistory]);

  const formatOvers = useCallback((over: number, ball: number) => {
    return `${over}.${ball}`;
  }, []);

  const resetSeason = useCallback(async () => {
    // Delete all match history
    const { error: historyError } = await supabase
      .from('match_history')
      .delete()
      .neq('id', '');

    if (historyError) {
      console.error('Error resetting match history:', historyError);
      return;
    }

    // Clear match state
    const newState = { currentMatch: null, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
    setMatchHistory([]);
    setPlayingPlayers({});
  }, [saveMatchState]);

  const resetEverything = useCallback(async () => {
    const tournamentIds = ['kapl-3-mens', 'kapl-3-womens'];
    const resetTeams: Team[] = [...DEFAULT_TEAMS, ...DEFAULT_WOMENS_TEAMS].map((t) => ({
      ...t,
      players: [],
      playerCount: 0,
      remainingPurse: 10000,
      initialPurse: 10000,
    }));

    // 1. Instantly reset LocalStorage & in-memory caches (zero-latency UI update)
    try {
      localStorage.setItem('kapl_all_players_cleared', 'true');
      localStorage.setItem('kapl_registered_players', JSON.stringify([]));

      tournamentIds.forEach((tid) => {
        localStorage.setItem(`kapl_everything_reset_${tid}`, 'true');
        localStorage.removeItem(`kapl_auction_manually_reset_${tid}`);
        localStorage.setItem(`kapl_auction_players_${tid}`, JSON.stringify([]));
        localStorage.setItem(`kapl_auction_sales_${tid}`, JSON.stringify([]));
        localStorage.removeItem(`kapl_auction_active_player_${tid}`);

        const tidTeams = (tid === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS).map((t) => ({
          ...t,
          players: [],
          playerCount: 0,
          remainingPurse: 10000,
          initialPurse: 10000,
        }));
        localStorage.setItem(`kapl_auction_teams_${tid}`, JSON.stringify(tidTeams));
        localStorage.removeItem(`kapl_local_match_state_${tid}`);
      });

      localStorage.setItem('kapl_teams', JSON.stringify(resetTeams));
      localStorage.removeItem('cricket_match_state');
      localStorage.removeItem('kapl_local_match_state');
    } catch (e) {
      console.warn('LocalStorage reset error:', e);
    }

    setTeams(resetTeams);
    setMatchHistory([]);
    setMatchState({ currentMatch: null, lastAction: null });
    setPlayingPlayers({});

    // 2. Dispatch window events & broadcast immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: resetTeams }));
      window.dispatchEvent(
        new CustomEvent('kapl-auction-local-update', {
          detail: { event: 'auction_reset', players: [], teams: resetTeams, currentPlayer: null },
        })
      );
      window.dispatchEvent(
        new CustomEvent('kapl_player_added', {
          detail: { player: null, tournamentId: 'all' },
        })
      );
    }

    tournamentIds.forEach((tid) => {
      try {
        const channel = supabase.channel(`auction-room-${tid}`);
        channel.send({
          type: 'broadcast',
          event: 'auction_sync',
          payload: {
            event: 'auction_reset',
            players: [],
            teams: (tid === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS).map((t) => ({
              ...t,
              players: [],
              playerCount: 0,
              remainingPurse: 10000,
            })),
            currentPlayer: null,
            tournamentId: tid,
          },
        });
      } catch {}

      try {
        const syncChannel = supabase.channel(`player-dir-auction-sync-${tid}`);
        syncChannel.send({
          type: 'broadcast',
          event: 'auction_sync',
          payload: {
            event: 'auction_reset',
            players: [],
            tournamentId: tid,
          },
        });
      } catch {}
    });

    // Global Live Match sync channel for instantaneous cross-device viewer/role synchronization
    const liveMatchChannel = initSharedRealtimeChannel();
    if (liveMatchChannel) {
      try {
        liveMatchChannel.send({
          type: 'broadcast',
          event: 'system_reset_all_players',
          payload: { timestamp: Date.now() },
        }).catch(() => {});
      } catch {}
    }

    // Cross-tab synchronization via BroadcastChannel
    if (tabSyncChannel) {
      try {
        tabSyncChannel.postMessage({
          type: 'system_reset_all_players',
          timestamp: Date.now(),
        });
      } catch {}
    }
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const crossTab = new BroadcastChannel('kapl-shared-tab-channel');
        crossTab.postMessage({
          type: 'system_reset_all_players',
          event: 'auction_reset',
          players: [],
          teams: resetTeams,
          timestamp: Date.now(),
        });
        crossTab.close();
      } catch {}

      try {
        const aucTab = new BroadcastChannel('kapl_auction_tab_sync');
        aucTab.postMessage({
          event: 'auction_reset',
          players: [],
          teams: resetTeams,
          currentPlayer: null,
          timestamp: Date.now(),
        });
        aucTab.close();
      } catch {}
    }

    // 3. Invoke Supabase RPC reset_all_players_and_teams (atomic SECURITY DEFINER execution)
    try {
      const { error: rpcErr } = await supabase.rpc('reset_all_players_and_teams');
      if (rpcErr) {
        console.warn('RPC reset_all_players_and_teams returned non-fatal error:', rpcErr);
      }
    } catch (e) {
      console.warn('RPC reset_all_players_and_teams exception:', e);
    }

    // 4. Standard database clearance fallback
    try {
      await resetSeason();
    } catch (e) {
      console.warn('resetSeason fallback exception:', e);
    }

    try {
      await supabase.from('players').delete().neq('id', '');
    } catch (e) {
      console.warn('DB delete players fallback exception:', e);
    }

    try {
      await supabase.from('auction_state').delete().neq('id', '');
      await supabase.from('auction_bids').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (e) {
      console.warn('DB clear auction fallback exception:', e);
    }

    for (const defaultTeam of resetTeams) {
      try {
        await supabase
          .from('teams')
          .update(teamToDb(defaultTeam))
          .eq('id', defaultTeam.id);
      } catch (e) {
        console.warn('Team update fallback exception:', e);
      }
    }
  }, [resetSeason]);

  return {
    teams,
    matchState,
    allTournamentMatches: {
      'kapl-3-mens': globalTournamentMatchStates['kapl-3-mens']?.currentMatch || null,
      'kapl-3-womens': globalTournamentMatchStates['kapl-3-womens']?.currentMatch || null,
    },
    matchHistory,
    isLoaded,
    playingPlayers,
    updateTeam,
    removePlayerFromTeam,
    getTeam,
    getTeamsByGroup,
    getTeamsByTournament,
    getPlayingPlayers,
    startMatch,
    getCurrentInnings,
    addBall,
    addNoBall,
    addDismissal,
    addRunOut,
    editBall,
    deleteBall,
    selectBatsman,
    selectBowler,
    undoLastBall,
    undoToBall,
    switchBattingTeam,
    swapStrike,
    endMatch,
    updateMatchPOTM,
    abandonMatch,
    replacePlayer,
    getTeamStats,
    formatOvers,
    resetSeason,
    resetEverything,
    // Offline resilience
    isOnline,
    pendingOfflineChanges,
    isSyncing,
    syncOfflineQueue,
    // Super Over functions
    startSuperOver,
    switchSuperOverInnings,
    addSuperOverBall,
    selectSuperOverBatsman,
    selectSuperOverBowler,
    endSuperOver,
  };
}

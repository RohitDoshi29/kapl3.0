import { useMemo } from 'react';
import { useCricketStore } from '@/hooks/useCricketStore';
import { useTournament } from '@/contexts/TournamentContext';
import { CeremonyAwardWinner } from '@/components/cricket/TournamentCeremonyModal';

export interface TournamentLeaders {
  orangeCap: CeremonyAwardWinner | null;
  purpleCap: CeremonyAwardWinner | null;
  maxSixes: CeremonyAwardWinner | null;
  mvp: CeremonyAwardWinner | null;
}

export function useTournamentHonors(tournamentId?: string): TournamentLeaders {
  const { teams, matchHistory, matchState, getTeam } = useCricketStore();
  const { activeTournamentId } = useTournament();

  const currentTournamentId = tournamentId || activeTournamentId;

  return useMemo(() => {
    const allMatches = [...matchHistory];
    if (matchState.currentMatch) {
      allMatches.push(matchState.currentMatch);
    }

    const tournamentMatches = allMatches.filter(
      (m) => (m.tournamentId || 'kapl-3-mens') === currentTournamentId
    );

    interface PlayerAcc {
      playerId: string;
      name: string;
      photo: string | null;
      teamId: string | null;
      teamName: string | null;
      teamColor: string | null;
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
      wickets: number;
      overs: number;
      runsConceded: number;
      catches: number;
    }

    const map = new Map<string, PlayerAcc>();

    const getOrCreate = (playerId: string, teamId: string): PlayerAcc => {
      let acc = map.get(playerId);
      if (!acc) {
        const team = getTeam(teamId) || (teams || []).find((t) => t.id === teamId);
        const playerObj = (team?.players || []).find((p) => p.id === playerId);

        acc = {
          playerId,
          name: playerObj?.name || 'Player',
          photo: playerObj?.photo || null,
          teamId: team?.id || null,
          teamName: team?.name || 'Franchise',
          teamColor: team?.primaryColor || null,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          wickets: 0,
          overs: 0,
          runsConceded: 0,
          catches: 0,
        };
        map.set(playerId, acc);
      }
      return acc;
    };

    // Scan through all completed and current matches
    tournamentMatches.forEach((m) => {
      [m.innings1, m.innings2].forEach((innings) => {
        if (!innings) return;

        // Batting stats
        Object.entries(innings.batterStats || {}).forEach(([pId, stats]) => {
          if (!pId) return;
          const acc = getOrCreate(pId, innings.battingTeamId);
          acc.runs += stats.runs || 0;
          acc.balls += stats.ballsFaced || 0;
          acc.fours += stats.fours || 0;
          acc.sixes += stats.sixes || 0;
        });

        // Bowling stats
        Object.entries(innings.bowlerStats || {}).forEach(([pId, stats]) => {
          if (!pId) return;
          const acc = getOrCreate(pId, innings.bowlingTeamId);
          acc.wickets += stats.wickets || 0;
          acc.overs += stats.overs || 0;
          acc.runsConceded += stats.runs || 0;
        });
      });
    });

    const allPlayers = Array.from(map.values());

    // 1. Orange Cap: Most Runs
    const battingSorted = [...allPlayers].filter((p) => p.runs > 0).sort((a, b) => b.runs - a.runs || b.sixes - a.sixes);
    const topBatter = battingSorted[0];
    const orangeCap: CeremonyAwardWinner | null = topBatter
      ? {
          playerId: topBatter.playerId,
          name: topBatter.name,
          teamName: topBatter.teamName || 'Franchise',
          teamColor: topBatter.teamColor || undefined,
          photoUrl: topBatter.photo,
          primaryStat: topBatter.runs,
          primaryLabel: 'Runs',
          secondaryStat: topBatter.balls > 0 ? ((topBatter.runs / topBatter.balls) * 100).toFixed(1) : '0.0',
          secondaryLabel: 'SR',
        }
      : null;

    // 2. Purple Cap: Most Wickets
    const bowlingSorted = [...allPlayers].filter((p) => p.wickets > 0).sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded);
    const topBowler = bowlingSorted[0];
    const purpleCap: CeremonyAwardWinner | null = topBowler
      ? {
          playerId: topBowler.playerId,
          name: topBowler.name,
          teamName: topBowler.teamName || 'Franchise',
          teamColor: topBowler.teamColor || undefined,
          photoUrl: topBowler.photo,
          primaryStat: topBowler.wickets,
          primaryLabel: 'Wickets',
          secondaryStat: topBowler.overs > 0 ? (topBowler.runsConceded / topBowler.overs).toFixed(2) : '0.00',
          secondaryLabel: 'Econ',
        }
      : null;

    // 3. Max Sixes
    const sixesSorted = [...allPlayers].filter((p) => p.sixes > 0).sort((a, b) => b.sixes - a.sixes || b.runs - a.runs);
    const topSixHitter = sixesSorted[0];
    const maxSixes: CeremonyAwardWinner | null = topSixHitter
      ? {
          playerId: topSixHitter.playerId,
          name: topSixHitter.name,
          teamName: topSixHitter.teamName || 'Franchise',
          teamColor: topSixHitter.teamColor || undefined,
          photoUrl: topSixHitter.photo,
          primaryStat: topSixHitter.sixes,
          primaryLabel: 'Sixes',
        }
      : null;

    // 4. MVP: Impact formula: runs * 1 + sixes * 2 + wickets * 20
    const mvpSorted = [...allPlayers]
      .map((p) => ({
        ...p,
        impactScore: p.runs * 1 + p.sixes * 2 + p.wickets * 20,
      }))
      .filter((p) => p.impactScore > 0)
      .sort((a, b) => b.impactScore - a.impactScore);

    const topMvp = mvpSorted[0];
    const mvp: CeremonyAwardWinner | null = topMvp
      ? {
          playerId: topMvp.playerId,
          name: topMvp.name,
          teamName: topMvp.teamName || 'Franchise',
          teamColor: topMvp.teamColor || undefined,
          photoUrl: topMvp.photo,
          primaryStat: `${topMvp.impactScore} Pts`,
          primaryLabel: 'Impact',
          secondaryStat: `${topMvp.runs}R • ${topMvp.wickets}W`,
          secondaryLabel: 'Record',
        }
      : null;

    return {
      orangeCap,
      purpleCap,
      maxSixes,
      mvp,
    };
  }, [teams, matchHistory, matchState, getTeam, currentTournamentId]);
}


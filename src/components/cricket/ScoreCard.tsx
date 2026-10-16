import { Team, Innings } from '@/lib/cricketTypes';
import { TeamBadge } from './TeamBadge';
import { cn } from '@/lib/utils';

interface ScoreCardProps {
  battingTeam: Team;
  bowlingTeam: Team;
  innings: Innings;
  isBatting: boolean;
  className?: string;
}

export function ScoreCard({ battingTeam, bowlingTeam, innings, isBatting, className }: ScoreCardProps) {
  const formatOvers = () => {
    return `${innings.currentOver}.${innings.currentBall}`;
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl p-4 md:p-6 transition-all',
        isBatting ? 'ring-2 ring-cricket-accent' : 'opacity-80',
        className
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${battingTeam.primaryColor} / 0.9), hsl(${battingTeam.primaryColor} / 0.6))`,
      }}
    >
      {isBatting && (
        <div className="absolute top-2 right-2 bg-cricket-accent text-black text-[10px] md:text-xs font-bold px-2 py-1 rounded-full animate-pulse">
          BATTING
        </div>
      )}
      
      <div className="flex items-center justify-between">
        <TeamBadge team={battingTeam} size="md" showName={true} className="text-white" />
        
        <div className="text-right">
          <div className="text-3xl md:text-5xl font-bold text-white tracking-tight">
            {innings.runs}
            <span className="text-xl md:text-3xl opacity-80">/{innings.wickets}</span>
          </div>
          <div className="text-base md:text-xl text-white/80 font-medium">
            ({formatOvers()} ov)
          </div>
        </div>
      </div>

      <div className="mt-3 md:mt-4 flex items-center justify-between text-white/70 text-xs md:text-sm">
        <span>vs {bowlingTeam.name}</span>
        <span>Group {battingTeam.group}</span>
      </div>
    </div>
  );
}

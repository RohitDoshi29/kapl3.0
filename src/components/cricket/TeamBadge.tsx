import { Team } from '@/lib/cricketTypes';
import { cn } from '@/lib/utils';

interface TeamBadgeProps {
  team: Team;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

export function TeamBadge({ team, size = 'md', showName = true, className }: TeamBadgeProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-bold text-white shadow-lg',
          sizeClasses[size]
        )}
        style={{ backgroundColor: `hsl(${team.primaryColor})` }}
      >
        {team.logo ? (
          <img src={team.logo} alt={team.name} className="w-full h-full object-cover rounded-full" />
        ) : (
          <span className={textSizes[size]}>{team.name.charAt(0)}</span>
        )}
      </div>
      {showName && (
        <span className={cn('font-semibold', textSizes[size])}>{team.name}</span>
      )}
    </div>
  );
}

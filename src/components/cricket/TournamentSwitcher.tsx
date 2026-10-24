import { useTournament } from '@/contexts/TournamentContext';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface TournamentSwitcherProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function TournamentSwitcher({ className, size = 'md' }: TournamentSwitcherProps) {
  const { activeTournamentId, setActiveTournamentId, isMens, isWomens } = useTournament();

  const isSmall = size === 'sm';

  return (
    <div
      className={cn(
        'inline-flex items-center p-1 rounded-full bg-muted/80 backdrop-blur-md border border-border shadow-inner max-w-full select-none',
        className
      )}
    >
      {/* Men's League Option */}
      <button
        type="button"
        onClick={() => setActiveTournamentId('kapl-3-mens')}
        className={cn(
          'relative flex items-center justify-center gap-1.5 rounded-full font-extrabold transition-all duration-300 touch-manipulation min-h-[36px]',
          isSmall ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs sm:text-sm sm:px-3.5',
          isMens
            ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md scale-105'
            : 'text-muted-foreground hover:text-foreground active:bg-white/10'
        )}
      >
        <span>🏏</span>
        <span className="whitespace-nowrap">Men's KAPL</span>
        {isMens && <span className="w-1.5 h-1.5 rounded-full bg-black/60 animate-pulse ml-0.5" />}
      </button>

      {/* Women's League Option */}
      <button
        type="button"
        onClick={() => setActiveTournamentId('kapl-3-womens')}
        className={cn(
          'relative flex items-center justify-center gap-1.5 rounded-full font-extrabold transition-all duration-300 touch-manipulation min-h-[36px]',
          isSmall ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs sm:text-sm sm:px-3.5',
          isWomens
            ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md scale-105'
            : 'text-muted-foreground hover:text-foreground active:bg-white/10'
        )}
      >
        <span>👑</span>
        <span className="whitespace-nowrap">Women's KAPL</span>
        {isWomens && <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse ml-0.5" />}
      </button>
    </div>
  );
}


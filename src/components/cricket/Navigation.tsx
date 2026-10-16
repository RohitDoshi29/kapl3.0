import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Shield, Trophy, GitBranch, Users, Gavel, BarChart3 } from 'lucide-react';

const desktopNavItems = [
  { path: '/', label: 'Live', icon: Home },
  { path: '/auction', label: 'Auction', icon: Gavel },
  { path: '/players', label: 'Players', icon: Users },
  { path: '/points', label: 'Points', icon: Trophy },
  { path: '/stats', label: 'Stats', icon: BarChart3 },
  { path: '/bracket', label: 'Bracket', icon: GitBranch },
  { path: '/admin', label: 'Admin', icon: Shield },
];

const mobileNavItems = [
  { path: '/', label: 'Live', icon: Home },
  { path: '/auction', label: 'Auction', icon: Gavel },
  { path: '/players', label: 'Players', icon: Users },
  { path: '/points', label: 'Standings', icon: Trophy, alternatePaths: ['/points', '/bracket', '/stats'] },
  { path: '/admin', label: 'Admin', icon: Shield },
];

export function Navigation() {
  const location = useLocation();
  const { isAdmin, isScorer } = useAuth();
  const canAccessAdmin = isAdmin || isScorer;

  const currentDesktopItems = desktopNavItems.filter(item => item.path !== '/admin' || canAccessAdmin);
  const currentMobileItems = mobileNavItems.filter(item => item.path !== '/admin' || canAccessAdmin);

  return (
    <>
      {/* Desktop & Tablet Top/Sub Navbar */}
      <nav className="hidden md:block sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b shadow-xs">
        <div className="container mx-auto">
          <div className="flex items-center justify-center gap-1.5 py-2.5">
            {currentDesktopItems.map(({ path, label, icon: Icon }) => {
              const isActive =
                location.pathname === path ||
                (path === '/players' && location.pathname.startsWith('/players/'));

              return (
                <Link
                  key={path}
                  to={path}
                  className={cn(
                    'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all duration-150',
                    isActive
                      ? 'text-primary bg-primary/15 border border-primary/25 shadow-xs font-bold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive && 'text-primary')} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile-First Ergonomic Bottom Dock */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/80 shadow-lg px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5">
        <div className="flex items-center justify-around">
          {currentMobileItems.map(({ path, label, icon: Icon, alternatePaths }) => {
            const isActive =
              location.pathname === path ||
              (path === '/players' && location.pathname.startsWith('/players/')) ||
              (alternatePaths && alternatePaths.includes(location.pathname));

            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  'relative flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all duration-150 min-w-0',
                  isActive
                    ? 'text-primary font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div
                  className={cn(
                    'p-1 rounded-xl transition-all',
                    isActive ? 'bg-primary/15 text-primary scale-110 shadow-xs' : 'text-muted-foreground'
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full">
                  {label}
                </span>

                {/* Active Indicator Glow Pip */}
                {isActive && (
                  <span className="absolute bottom-0 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_hsl(var(--primary))]" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

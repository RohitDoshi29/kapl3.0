import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Shield, Trophy, GitBranch, Users, Gavel, BarChart3, User } from 'lucide-react';

const desktopNavItems: { path: string; label: string; icon: any; requiresAuth?: boolean }[] = [
  { path: '/', label: 'Live', icon: Home },
  { path: '/auction', label: 'Auction', icon: Gavel },
  { path: '/players', label: 'Players', icon: Users },
  { path: '/points', label: 'Points', icon: Trophy },
  { path: '/stats', label: 'Stats', icon: BarChart3 },
  { path: '/bracket', label: 'Bracket', icon: GitBranch },
  { path: '/profile', label: 'Profile', icon: User, requiresAuth: true },
  { path: '/admin', label: 'Admin', icon: Shield },
];

const mobileNavItems: { path: string; label: string; icon: any; alternatePaths?: string[]; requiresAuth?: boolean }[] = [
  { path: '/', label: 'Live', icon: Home },
  { path: '/auction', label: 'Auction', icon: Gavel },
  { path: '/players', label: 'Players', icon: Users },
  { path: '/points', label: 'Standings', icon: Trophy, alternatePaths: ['/points', '/bracket', '/stats'] },
  { path: '/profile', label: 'Profile', icon: User, requiresAuth: true },
  { path: '/admin', label: 'Admin', icon: Shield },
];

export function Navigation() {
  const location = useLocation();
  const { isAdmin, isScorer, isAuthenticated } = useAuth();
  const canAccessAdmin = isAdmin || isScorer;

  const currentDesktopItems = desktopNavItems.filter(item => {
    if (item.path === '/admin') return canAccessAdmin;
    if (item.requiresAuth) return isAuthenticated;
    return true;
  });
  const currentMobileItems = mobileNavItems.filter(item => {
    if (item.path === '/admin') return canAccessAdmin;
    if (item.requiresAuth) return isAuthenticated;
    return true;
  });

  return (
    <>
      {/* Desktop & Tablet Top/Sub Navbar */}
      <nav className="hidden md:block sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-white/[0.08] shadow-sm">
        <div className="container mx-auto">
          <div className="flex items-center justify-center gap-2 py-2">
            {currentDesktopItems.map(({ path, label, icon: Icon }) => {
              const isActive =
                location.pathname === path ||
                (path === '/players' && location.pathname.startsWith('/players/'));

              return (
                <Link
                  key={path}
                  to={path}
                  className={cn(
                    'flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-semibold transition-all duration-200 select-none',
                    isActive
                      ? 'text-amber-300 bg-gradient-to-r from-amber-500/20 to-yellow-500/15 border border-amber-500/35 shadow-sm shadow-amber-500/15 font-black'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-amber-400' : 'text-muted-foreground')} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile-First Ergonomic Bottom Dock */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-2xl border-t border-white/[0.1] shadow-2xl px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
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
                  'relative flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all duration-200 min-w-0 select-none',
                  isActive
                    ? 'text-amber-300 font-black'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div
                  className={cn(
                    'p-1.5 rounded-xl transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-br from-amber-500/25 to-yellow-500/15 text-amber-400 scale-110 shadow-sm border border-amber-500/35'
                      : 'text-muted-foreground'
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] tracking-tight mt-1 truncate max-w-full font-medium">
                  {label}
                </span>

                {/* Active Indicator Glow Pip */}
                {isActive && (
                  <span className="absolute bottom-0 w-2 h-0.5 bg-amber-400 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.9)]" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

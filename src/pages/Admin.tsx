import { useState } from 'react';
import { AdminPasswordGate } from '@/components/cricket/AdminPasswordGate';
import { Header } from '@/components/cricket/Header';
import { Navigation } from '@/components/cricket/Navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, PlayCircle, Users, Settings, LogOut, Home, BarChart3, Trophy, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useScorerRole } from '@/hooks/useScorerRole';
import AdminScorerTab from '@/components/admin/AdminScorerTab';
import AdminMatchSetupTab from '@/components/admin/AdminMatchSetupTab';
import AdminTeamsTab from '@/components/admin/AdminTeamsTab';
import AdminSettingsTab from '@/components/admin/AdminSettingsTab';
import PlayerStatsTab from '@/components/admin/PlayerStatsTab';
import { AdminTournamentTab } from '@/components/admin/AdminTournamentTab';
import AdminRolesGovernanceTab from '@/components/admin/AdminRolesGovernanceTab';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export default function Admin() {
  const { signOut, user, isAdmin, isCoAdmin } = useAdminAuth();
  const { scorerRole } = useScorerRole();
  const [activeTab, setActiveTab] = useState('scorer');

  return (
    <AdminPasswordGate>
      <div className="relative min-h-screen bg-background pb-20 md:pb-8">
        {/* Ambient Stadium Lighting Mesh */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-500/10 via-emerald-500/5 to-transparent blur-3xl opacity-60" />
        </div>

        <Header />
        <Navigation />

        <main className="relative z-10 container mx-auto px-4 py-4 md:py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5 border-b border-white/[0.08] pb-3">
            <div className="flex flex-wrap items-center gap-2 md:gap-4">
              <Link to="/">
                <Button variant="outline" size="sm" className="gap-1.5 h-8.5 rounded-xl border-white/10 bg-white/[0.04] text-xs font-bold text-foreground">
                  <Home className="w-3.5 h-3.5 text-amber-400" />
                  <span>Public View</span>
                </Button>
              </Link>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs font-semibold text-muted-foreground truncate max-w-[180px] md:max-w-none">
                  Signed in as <span className="text-foreground font-bold">{user?.email}</span>
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const { error } = await signOut();
                if (error) {
                  toast.error('Failed to sign out');
                } else {
                  toast.success('Signed out successfully');
                }
              }}
              className="gap-1.5 h-8.5 rounded-xl text-xs font-bold border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </Button>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex items-center justify-between mb-2">
              <TabsList className={`grid w-full max-w-4xl mx-auto bg-white/[0.04] border border-white/10 rounded-2xl p-1 backdrop-blur-md ${isAdmin ? 'grid-cols-7' : 'grid-cols-6'}`}>
                <TabsTrigger value="scorer" className="gap-2">
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">Scorer</span>
                </TabsTrigger>
                <TabsTrigger value="setup" className="gap-2">
                  <PlayCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Setup</span>
                </TabsTrigger>
                <TabsTrigger value="teams" className="gap-2">
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Teams</span>
                </TabsTrigger>
                <TabsTrigger value="stats" className="gap-2">
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Stats</span>
                </TabsTrigger>
                <TabsTrigger value="tournament" className="gap-2">
                  <Trophy className="w-4 h-4" />
                  <span className="hidden sm:inline">Bracket</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="gap-2">
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Settings</span>
                </TabsTrigger>
                {isAdmin && (
                  <TabsTrigger
                    value="governance"
                    className="gap-1.5 font-bold text-amber-600 dark:text-amber-400 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-500"
                  >
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span className="hidden sm:inline">Roles</span>
                  </TabsTrigger>
                )}
              </TabsList>
              {scorerRole && (
                <Badge variant="outline" className="ml-2 hidden md:flex font-semibold border-amber-500/40 text-foreground">
                  {user?.email?.toLowerCase() === 'rohit.doshi2007@gmail.com'
                    ? '👑 Main Admin'
                    : isCoAdmin
                    ? 'Co-Admin'
                    : scorerRole === 'admin'
                    ? 'Super Admin'
                    : 'Scorer'}
                </Badge>
              )}
            </div>

            <TabsContent value="scorer">
              <AdminScorerTab onNavigateToSetup={() => setActiveTab('setup')} />
            </TabsContent>

            <TabsContent value="setup">
              <AdminMatchSetupTab onNavigateToScorer={() => setActiveTab('scorer')} />
            </TabsContent>

            <TabsContent value="teams">
              <AdminTeamsTab />
            </TabsContent>

            <TabsContent value="stats">
              <PlayerStatsTab />
            </TabsContent>

            <TabsContent value="tournament">
              <AdminTournamentTab />
            </TabsContent>

            <TabsContent value="settings">
              <AdminSettingsTab />
            </TabsContent>

            {isAdmin && (
              <TabsContent value="governance">
                <AdminRolesGovernanceTab />
              </TabsContent>
            )}
          </Tabs>
        </main>
      </div>
    </AdminPasswordGate>
  );
}

import { useCricketStore } from '@/hooks/useCricketStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { RefreshCcw, Trash2, Database, History } from 'lucide-react';

export default function AdminSettingsTab() {
  const { matchHistory, resetSeason, resetEverything, teams } = useCricketStore();

  const handleResetSeason = () => {
    resetSeason();
    toast.success('Season reset! Match history cleared.');
  };

  const handleResetEverything = () => {
    resetEverything();
    toast.success('All data reset to defaults!');
  };

  // Calculate storage usage
  const getStorageSize = () => {
    let total = 0;
    for (const key in localStorage) {
      if (key.startsWith('kapl_')) {
        total += localStorage.getItem(key)?.length || 0;
      }
    }
    return (total / 1024).toFixed(2);
  };

  const completedMatches = matchHistory.filter(m => m.status === 'completed').length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Settings & Data</h2>

      {/* Storage Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Storage Information
          </CardTitle>
          <CardDescription>Current data usage in browser storage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-muted-foreground">Teams</p>
              <p className="text-2xl font-bold">{teams.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-muted-foreground">Matches Played</p>
              <p className="text-2xl font-bold">{completedMatches}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted col-span-2">
              <p className="text-muted-foreground">Storage Used</p>
              <p className="text-2xl font-bold">{getStorageSize()} KB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reset Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCcw className="w-5 h-5" />
            Reset Options
          </CardTitle>
          <CardDescription>Reset data for new season or fresh start</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Reset Season */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <h4 className="font-medium flex items-center gap-2">
                <History className="w-4 h-4" />
                Reset Season
              </h4>
              <p className="text-sm text-muted-foreground">
                Clears match history and current match. Keeps teams, logos, and players.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">Reset Season</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Season?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will clear all match history ({completedMatches} matches) and the current match.
                    Team names, logos, colors, and players will be preserved.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetSeason}>
                    Reset Season
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Reset Everything */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/50">
            <div>
              <h4 className="font-medium flex items-center gap-2 text-destructive">
                <Trash2 className="w-4 h-4" />
                Reset Everything
              </h4>
              <p className="text-sm text-muted-foreground">
                Deletes ALL data including teams, players, logos, and match history.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Reset All</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Everything?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete ALL data:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>All team customizations (names, logos, colors)</li>
                      <li>All player information and photos</li>
                      <li>All match history ({completedMatches} matches)</li>
                      <li>Current match progress</li>
                    </ul>
                    <span className="block mt-2 font-medium">This cannot be undone!</span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleResetEverything}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

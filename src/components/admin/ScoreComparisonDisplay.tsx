import { useRealtimeScoreComparison } from '@/hooks/useRealtimeScoreComparison';
import { useCricketStore } from '@/hooks/useCricketStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface ScoreComparisonDisplayProps {
  showAlert?: boolean;
}

export function ScoreComparisonDisplay({ showAlert = true }: ScoreComparisonDisplayProps) {
  const { getTeam } = useCricketStore();
  const {
    primaryMatch,
    secondaryMatch,
    primaryScore,
    secondaryScore,
    runsDiff,
    wicketsDiff,
    hasDiscrepancy,
  } = useRealtimeScoreComparison();

  const lastAlertTimeRef = useRef(0);

  const primaryInnings = primaryMatch?.currentInnings === 1 ? primaryMatch.innings1 : primaryMatch?.innings2;
  const secondaryInnings = secondaryMatch?.currentInnings === 1 ? secondaryMatch.innings1 : secondaryMatch?.innings2;
  const battingTeam = primaryMatch ? getTeam(primaryInnings?.battingTeamId || '') : null;

  // Show toast alert when discrepancy is detected
  useEffect(() => {
    if (showAlert && hasDiscrepancy && Date.now() - lastAlertTimeRef.current > 5000) {
      toast.error(`🚨 Score Mismatch! Runs differ by ${runsDiff}, Wickets differ by ${wicketsDiff}`, {
        duration: 8000,
      });
      lastAlertTimeRef.current = Date.now();
    }
  }, [hasDiscrepancy, runsDiff, wicketsDiff, showAlert]);

  if (!primaryMatch || !secondaryMatch || primaryMatch.id !== secondaryMatch.id) {
    return null;
  }

  return (
    <Card className="border-2 border-muted">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Real-time Score Comparison</span>
          {hasDiscrepancy ? (
            <Badge variant="destructive" className="animate-pulse">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Mismatch
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/50">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Synced
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-center text-xs text-muted-foreground mb-2">
          {battingTeam?.name || 'Batting Team'} - Innings {primaryMatch.currentInnings}
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Primary Scorer */}
          <div className="text-center p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-xs text-muted-foreground mb-1">Primary Scorer</p>
            <p className="text-2xl font-bold">
              {primaryInnings?.runs || 0}/{primaryInnings?.wickets || 0}
            </p>
            <p className="text-xs text-muted-foreground">
              ({primaryInnings?.currentOver || 0}.{primaryInnings?.currentBall || 0} ov)
            </p>
          </div>

          {/* Secondary Scorer */}
          <div className="text-center p-3 rounded-lg bg-secondary/50 border border-secondary">
            <p className="text-xs text-muted-foreground mb-1">Secondary Scorer</p>
            <p className="text-2xl font-bold">
              {secondaryInnings?.runs || 0}/{secondaryInnings?.wickets || 0}
            </p>
            <p className="text-xs text-muted-foreground">
              ({secondaryInnings?.currentOver || 0}.{secondaryInnings?.currentBall || 0} ov)
            </p>
          </div>
        </div>

        {hasDiscrepancy && (
          <Alert variant="destructive" className="mt-2 animate-pulse">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Score Discrepancy Detected!</AlertTitle>
            <AlertDescription>
              {runsDiff > 0 && <span>Runs differ by {runsDiff}. </span>}
              {wicketsDiff > 0 && <span>Wickets differ by {wicketsDiff}. </span>}
              Please verify with the other scorer immediately.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

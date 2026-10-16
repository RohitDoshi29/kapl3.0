import { useRealtimeScoreComparison } from '@/hooks/useRealtimeScoreComparison';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export function ScoreDiscrepancyAlert() {
  const {
    primaryMatch,
    secondaryMatch,
    runsDiff,
    wicketsDiff,
    hasDiscrepancy,
  } = useRealtimeScoreComparison();

  const lastAlertTimeRef = useRef(0);

  // Show toast alert when discrepancy is detected
  useEffect(() => {
    if (hasDiscrepancy && Date.now() - lastAlertTimeRef.current > 5000) {
      toast.error(`🚨 Score Mismatch! Runs differ by ${runsDiff}, Wickets differ by ${wicketsDiff}`, {
        duration: 8000,
      });
      lastAlertTimeRef.current = Date.now();
    }
  }, [hasDiscrepancy, runsDiff, wicketsDiff]);

  if (!primaryMatch || !secondaryMatch || primaryMatch.id !== secondaryMatch.id || !hasDiscrepancy) {
    return null;
  }

  return (
    <Alert variant="destructive" className="animate-pulse">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Score Discrepancy Detected!</AlertTitle>
      <AlertDescription>
        {runsDiff > 0 && <span>Runs differ by {runsDiff}. </span>}
        {wicketsDiff > 0 && <span>Wickets differ by {wicketsDiff}. </span>}
        Please verify with the other scorer.
      </AlertDescription>
    </Alert>
  );
}

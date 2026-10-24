import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { downloadRegistrationsCsv, getPendingRegistrations } from '@/lib/registrationBackup';

/** One click: download every registration ever made (opens in Excel). */
export default function RegistrationBackupCard() {
  const [busy, setBusy] = useState(false);
  const pending = getPendingRegistrations().length;

  const handleDownload = async () => {
    setBusy(true);
    try {
      const { count, usedDatabase } = await downloadRegistrationsCsv();
      toast.success(
        usedDatabase
          ? `Downloaded ${count} registrations (database archive + this device).`
          : `Downloaded ${count} registrations from this device only (database archive unavailable).`
      );
    } catch (e: any) {
      toast.error(`Export failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
      <div>
        <p className="font-semibold">Player registration backup</p>
        <p className="text-sm text-muted-foreground">
          Every registration is archived permanently, even if a player is deleted or the season is reset.
          {pending > 0 && ` ${pending} registration(s) on this device are still waiting to reach the database.`}
        </p>
      </div>
      <Button onClick={handleDownload} disabled={busy} className="gap-2">
        <Download className="h-4 w-4" />
        {busy ? 'Preparing…' : 'Download registrations (Excel / CSV)'}
      </Button>
    </div>
  );
}

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { auditLogger } from '@/lib/audit';

interface BackupMetadata {
  id: string;
  name: string;
  type: 'manual' | 'automatic';
  size: number;
  status: 'pending' | 'completed' | 'failed';
  createdBy?: string;
  createdAt: string;
  completedAt?: string;
  data: {
    players: number;
    teams: number;
    sales: number;
  };
}

export async function createBackup(
  backupName: string,
  backupType: 'manual' | 'automatic' = 'manual',
  userId?: string
): Promise<BackupMetadata> {
  try {
    logger.info('Creating backup', { backupName, backupType });

    const backup: BackupMetadata = {
      id: `backup_${Date.now()}`,
      name: backupName,
      type: backupType,
      size: 0,
      status: 'pending',
      createdBy: userId,
      createdAt: new Date().toISOString(),
      data: { players: 0, teams: 0, sales: 0 },
    };

    // Fetch data to backup
    const [playersResult, teamsResult, salesResult] = await Promise.all([
      supabase.from('players').select('*'),
      supabase.from('teams').select('*'),
      supabase.from('player_sales').select('*'),
    ]);

    if (playersResult.error || teamsResult.error || salesResult.error) {
      throw new Error('Failed to fetch data for backup');
    }

    const backupData = {
      metadata: backup,
      players: playersResult.data || [],
      teams: teamsResult.data || [],
      sales: salesResult.data || [],
    };

    backup.data = {
      players: playersResult.data?.length || 0,
      teams: teamsResult.data?.length || 0,
      sales: salesResult.data?.length || 0,
    };

    backup.size = JSON.stringify(backupData).length;
    backup.status = 'completed';
    backup.completedAt = new Date().toISOString();

    // Store backup metadata in database
    const { error: dbError } = await supabase.from('backups').insert([
      {
        backup_name: backup.name,
        backup_type: backup.type,
        backup_size: backup.size,
        status: backup.status,
        created_by: userId || 'system',
        created_at: backup.createdAt,
        completed_at: backup.completedAt,
      },
    ]);

    if (dbError) {
      logger.warn('Failed to store backup metadata', { error: dbError.message });
    }

    // Store actual backup data
    await localStorage.setItem(`backup_${backup.id}`, JSON.stringify(backupData));

    logger.info('Backup created successfully', {
      id: backup.id,
      players: backup.data.players,
      teams: backup.data.teams,
    });

    await auditLogger.playerAdded(`backup_${backup.id}`, backupName, userId);

    return backup;
  } catch (error) {
    logger.error('Failed to create backup', error);
    throw error;
  }
}

export async function getBackups(): Promise<BackupMetadata[]> {
  try {
    const backups: BackupMetadata[] = [];
    const keys = Object.keys(localStorage).filter((key) => key.startsWith('backup_'));

    for (const key of keys) {
      const data = localStorage.getItem(key);
      if (data) {
        const backup = JSON.parse(data);
        backups.push(backup.metadata);
      }
    }

    return backups.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    logger.error('Failed to get backups', error);
    return [];
  }
}

export async function restoreBackup(backupId: string): Promise<void> {
  try {
    logger.info('Restoring backup', { backupId });

    const backupData = localStorage.getItem(`backup_${backupId}`);
    if (!backupData) {
      throw new Error('Backup not found');
    }

    const parsed = JSON.parse(backupData);
    const { players, teams, sales } = parsed;

    // Restore players
    if (players && players.length > 0) {
      const { error: playersError } = await supabase.from('players').upsert(players);
      if (playersError) throw playersError;
    }

    // Restore teams
    if (teams && teams.length > 0) {
      const { error: teamsError } = await supabase.from('teams').upsert(teams);
      if (teamsError) throw teamsError;
    }

    // Restore sales
    if (sales && sales.length > 0) {
      const { error: salesError } = await supabase.from('player_sales').upsert(sales);
      if (salesError) throw salesError;
    }

    logger.info('Backup restored successfully', {
      backupId,
      playersRestored: players?.length,
      teamsRestored: teams?.length,
      salesRestored: sales?.length,
    });

    await auditLogger.playerAdded(backupId, `Restored backup: ${backupId}`, 'system');
  } catch (error) {
    logger.error('Failed to restore backup', error);
    throw error;
  }
}

export async function deleteBackup(backupId: string): Promise<void> {
  try {
    localStorage.removeItem(`backup_${backupId}`);
    logger.info('Backup deleted', { backupId });
  } catch (error) {
    logger.error('Failed to delete backup', error);
    throw error;
  }
}

export function downloadBackup(backupId: string): void {
  try {
    const backupData = localStorage.getItem(`backup_${backupId}`);
    if (!backupData) {
      throw new Error('Backup not found');
    }

    const parsed = JSON.parse(backupData);
    const csv = convertBackupToCSV(parsed);

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kapl-backup-${backupId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    logger.info('Backup downloaded', { backupId });
  } catch (error) {
    logger.error('Failed to download backup', error);
    throw error;
  }
}

function convertBackupToCSV(backup: any): string {
  const { players, teams, sales } = backup;

  let csv = '=== PLAYERS ===\n';
  if (players && players.length > 0) {
    csv += Object.keys(players[0]).join(',') + '\n';
    csv += players.map((p: any) => Object.values(p).map((v: any) => JSON.stringify(v)).join(',')).join('\n');
  }

  csv += '\n=== TEAMS ===\n';
  if (teams && teams.length > 0) {
    csv += Object.keys(teams[0]).join(',') + '\n';
    csv += teams.map((t: any) => Object.values(t).map((v: any) => JSON.stringify(v)).join(',')).join('\n');
  }

  csv += '\n=== SALES ===\n';
  if (sales && sales.length > 0) {
    csv += Object.keys(sales[0]).join(',') + '\n';
    csv += sales.map((s: any) => Object.values(s).map((v: any) => JSON.stringify(v)).join(',')).join('\n');
  }

  return csv;
}

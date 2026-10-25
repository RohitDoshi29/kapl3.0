import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type AuditAction =
  | 'PLAYER_ADDED'
  | 'PLAYER_UPDATED'
  | 'PLAYER_DELETED'
  | 'TEAM_CREATED'
  | 'TEAM_UPDATED'
  | 'PLAYER_SOLD'
  | 'BID_PLACED'
  | 'AUCTION_STARTED'
  | 'AUCTION_ENDED'
  | 'ADMIN_LOGIN'
  | 'ADMIN_LOGOUT'
  | 'SETTINGS_CHANGED'
  | 'DATA_EXPORTED'
  | 'DATA_RESTORED';

interface AuditEntry {
  action: AuditAction;
  userId?: string;
  details: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  timestamp?: string;
}

export async function createAuditLog(entry: AuditEntry) {
  try {
    const timestamp = entry.timestamp || new Date().toISOString();
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

    const auditRecord = {
      action: entry.action,
      user_id: entry.userId || null,
      details: entry.details,
      user_agent: userAgent,
      created_at: timestamp,
    };

    const { error } = await supabase
      .from('audit_logs')
      .insert([auditRecord]);

    if (error) {
      logger.warn('Failed to create audit log', { error: error.message, action: entry.action });
    } else {
      logger.debug(`Audit logged: ${entry.action}`, entry.details);
    }
  } catch (error) {
    logger.error('Error creating audit log', error, { action: entry.action });
  }
}

export async function getAuditLogs(filters?: {
  action?: AuditAction;
  userId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  try {
    let query = supabase.from('audit_logs').select('*');

    if (filters?.action) {
      query = query.eq('action', filters.action);
    }

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    query = query.order('created_at', { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to fetch audit logs', error);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error('Error fetching audit logs', error);
    return [];
  }
}

export async function exportAuditLogs(startDate: string, endDate: string) {
  try {
    const logs = await getAuditLogs({
      startDate,
      endDate,
      limit: 10000,
    });

    const csv = convertLogsToCSV(logs);
    downloadCSV(csv, `audit-logs-${new Date().toISOString()}.csv`);

    await createAuditLog({
      action: 'DATA_EXPORTED',
      details: { logsCount: logs.length, startDate, endDate },
    });
  } catch (error) {
    logger.error('Error exporting audit logs', error);
    throw error;
  }
}

function convertLogsToCSV(logs: any[]): string {
  const headers = ['Timestamp', 'Action', 'User ID', 'Details'];
  const rows = logs.map((log) => [
    log.created_at,
    log.action,
    log.user_id || 'N/A',
    JSON.stringify(log.details),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  return csv;
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export const auditLogger = {
  playerAdded: (playerId: string, playerName: string, userId?: string) =>
    createAuditLog({
      action: 'PLAYER_ADDED',
      userId,
      details: { playerId, playerName },
    }),

  playerUpdated: (playerId: string, changes: Record<string, unknown>, userId?: string) =>
    createAuditLog({
      action: 'PLAYER_UPDATED',
      userId,
      details: { playerId, changes },
    }),

  playerDeleted: (playerId: string, playerName: string, userId?: string) =>
    createAuditLog({
      action: 'PLAYER_DELETED',
      userId,
      details: { playerId, playerName },
    }),

  playerSold: (playerId: string, teamId: string, amount: number, userId?: string) =>
    createAuditLog({
      action: 'PLAYER_SOLD',
      userId,
      details: { playerId, teamId, amount },
    }),

  auctionStarted: (tournamentId: string, userId?: string) =>
    createAuditLog({
      action: 'AUCTION_STARTED',
      userId,
      details: { tournamentId },
    }),

  auctionEnded: (tournamentId: string, userId?: string) =>
    createAuditLog({
      action: 'AUCTION_ENDED',
      userId,
      details: { tournamentId },
    }),

  settingsChanged: (settingKey: string, oldValue: unknown, newValue: unknown, userId?: string) =>
    createAuditLog({
      action: 'SETTINGS_CHANGED',
      userId,
      details: { settingKey, oldValue, newValue },
    }),
};

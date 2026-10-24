import { supabase } from '@/integrations/supabase/client';
import { PlayerRecord } from './cricketTypes';

/**
 * Registration safety net.
 *
 * - BACKUP_KEY   : append-only copy of every registration made on this device.
 *                  It is never cleared by any reset button.
 * - PENDING_KEY  : registrations that could not be saved to the database yet.
 *                  They are retried automatically until they succeed.
 */
const BACKUP_KEY = 'kapl_registration_backup';
const PENDING_KEY = 'kapl_pending_registrations';

type BackupEntry = PlayerRecord & { registeredAt: string };

function readList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(key: string, list: unknown[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    console.warn('Could not write', key, e);
  }
}

/** Keep a permanent local copy of a registration. */
export function appendRegistrationBackup(player: PlayerRecord) {
  const list = readList<BackupEntry>(BACKUP_KEY);
  const idx = list.findIndex((p) => p.id === player.id);
  const entry: BackupEntry = { ...(idx >= 0 ? list[idx] : {}), ...player, registeredAt: idx >= 0 ? list[idx].registeredAt : new Date().toISOString() };
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  writeList(BACKUP_KEY, list);
}

export function getRegistrationBackup(): BackupEntry[] {
  return readList<BackupEntry>(BACKUP_KEY);
}

export function getPendingRegistrations(): PlayerRecord[] {
  return readList<PlayerRecord>(PENDING_KEY);
}

export function queuePendingRegistration(player: PlayerRecord) {
  const list = readList<PlayerRecord>(PENDING_KEY).filter((p) => p.id !== player.id);
  list.push(player);
  writeList(PENDING_KEY, list);
}

function removePending(playerId: string) {
  writeList(
    PENDING_KEY,
    readList<PlayerRecord>(PENDING_KEY).filter((p) => p.id !== playerId)
  );
}

/** Save a player to Supabase. Returns an error message instead of hiding it. */
export async function persistPlayerToDb(player: PlayerRecord): Promise<{ ok: boolean; error?: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const authUserId = sessionData.session?.user?.id || null;
  const userId = player.userId && authUserId === player.userId ? player.userId : authUserId;

  const { error: rpcError } = await supabase.rpc('register_new_player', {
    p_id: player.id,
    p_user_id: userId,
    p_name: player.name,
    p_role: player.role,
    p_batting_style: player.battingStyle || 'Right-hand bat',
    p_bowling_style: player.bowlingStyle || 'Right-arm medium',
    p_jersey_number: player.jerseyNumber ?? null,
    p_mobile_number: player.mobileNumber || null,
    p_photo_url: player.photoUrl || null,
    p_tournament_id: player.tournamentId || 'kapl-3-mens',
    p_base_price: player.basePrice || 100,
  });

  if (!rpcError) return { ok: true };

  const { error: upsertError } = await supabase.from('players').upsert(
    {
      id: player.id,
      user_id: userId,
      name: player.name,
      photo_url: player.photoUrl || null,
      role: player.role,
      batting_style: player.battingStyle || null,
      bowling_style: player.bowlingStyle || null,
      jersey_number: player.jerseyNumber ?? null,
      mobile_number: player.mobileNumber || null,
      tournament_id: player.tournamentId || 'kapl-3-mens',
      base_price: player.basePrice || 100,
      auction_status: 'pending',
    },
    { onConflict: 'id' }
  );

  if (!upsertError) return { ok: true };
  return { ok: false, error: `${rpcError.message} / ${upsertError.message}` };
}

/** Try again for every registration that is still waiting to reach the database. */
export async function flushPendingRegistrations(): Promise<number> {
  const pending = getPendingRegistrations();
  if (pending.length === 0) return 0;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return 0; // nothing can be saved until someone is logged in

  let saved = 0;
  for (const player of pending) {
    const res = await persistPlayerToDb(player);
    if (res.ok) {
      removePending(player.id);
      saved += 1;
    } else {
      console.warn('Registration still pending for', player.name, res.error);
    }
  }
  return saved;
}

/* ----------------------------- CSV / Excel export ----------------------------- */

const CSV_COLUMNS: Array<[string, string]> = [
  ['player_id', 'Player ID'],
  ['name', 'Name'],
  ['role', 'Role'],
  ['mobile_number', 'Mobile'],
  ['tournament_id', 'Tournament'],
  ['jersey_number', 'Jersey'],
  ['batting_style', 'Batting'],
  ['bowling_style', 'Bowling'],
  ['auction_status', 'Auction status'],
  ['team_id', 'Team'],
  ['sold_price', 'Sold price'],
  ['status', 'Record status'],
  ['registered_at', 'Registered at'],
];

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

type ExportRow = Record<string, unknown>;

export function registrationsToCsv(rows: ExportRow[]): string {
  const header = CSV_COLUMNS.map(([, label]) => csvCell(label)).join(',');
  const body = rows.map((row) => CSV_COLUMNS.map(([key]) => csvCell(row[key])).join(','));
  // BOM so Excel opens UTF-8 names correctly
  return '\uFEFF' + [header, ...body].join('\r\n');
}

/** Merge the database archive with this device's local backup, then download a CSV. */
export async function downloadRegistrationsCsv(): Promise<{ count: number; usedDatabase: boolean }> {
  const byId = new Map<string, ExportRow>();

  // 1. Local backup (works even without internet)
  for (const p of getRegistrationBackup()) {
    byId.set(p.id, {
      player_id: p.id,
      name: p.name,
      role: p.role,
      mobile_number: p.mobileNumber,
      tournament_id: p.tournamentId,
      jersey_number: p.jerseyNumber,
      batting_style: p.battingStyle,
      bowling_style: p.bowlingStyle,
      auction_status: p.auctionStatus,
      team_id: p.teamId,
      sold_price: p.soldPrice,
      status: 'local backup',
      registered_at: p.registeredAt,
    });
  }

  // 2. Database archive (includes players that were deleted later)
  let usedDatabase = false;
  try {
    const { data, error } = await (supabase as any).rpc('export_player_registrations');
    if (!error && Array.isArray(data)) {
      usedDatabase = true;
      for (const entry of data) {
        const s = entry.snapshot || {};
        byId.set(entry.player_id, {
          player_id: entry.player_id,
          name: s.name,
          role: s.role,
          mobile_number: s.mobile_number,
          tournament_id: s.tournament_id,
          jersey_number: s.jersey_number,
          batting_style: s.batting_style,
          bowling_style: s.bowling_style,
          auction_status: s.auction_status,
          team_id: s.team_id,
          sold_price: s.sold_price,
          status: entry.action === 'DELETE' ? 'DELETED (kept in archive)' : 'active',
          registered_at: s.created_at || entry.logged_at,
        });
      }
    } else if (error) {
      console.warn('Registration archive export failed:', error.message);
    }
  } catch (e) {
    console.warn('Registration archive export exception:', e);
  }

  const rows = Array.from(byId.values());
  const csv = registrationsToCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `kapl-registrations-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { count: rows.length, usedDatabase };
}

/* ------------------------- Players are never wiped by a reset ------------------------- */

const PLACEHOLDER_ID = /^w?p-\d+$/;

/** The 80 generated test players use ids like p-1 / wp-1. Real registrations never do. */
export function isPlaceholderPlayer(p: { id: string }): boolean {
  return PLACEHOLDER_ID.test(p.id);
}

export function resetPlayerRecord(p: PlayerRecord): PlayerRecord {
  return { ...p, teamId: null, soldPrice: null, auctionStatus: 'pending' };
}

/**
 * Every known player for a tournament (auction cache + registered list), de-duplicated.
 * With resetStatus = true they all go back to "pending", but nobody is removed.
 */
export function getKeptPlayers(tournamentId: string, resetStatus = false): PlayerRecord[] {
  const merged: PlayerRecord[] = [];
  const add = (p: PlayerRecord) => {
    if (!p || !p.id) return;
    const idx = merged.findIndex((m) => m.id === p.id || (m.userId && p.userId && m.userId === p.userId));
    if (idx >= 0) merged[idx] = { ...merged[idx], ...p };
    else merged.push(p);
  };

  readList<PlayerRecord>(`kapl_auction_players_${tournamentId}`).forEach(add);
  readList<PlayerRecord>('kapl_registered_players')
    .filter((p) => !p.tournamentId || p.tournamentId === tournamentId)
    .forEach((p) => add({ ...p, tournamentId }));

  return resetStatus ? merged.map(resetPlayerRecord) : merged;
}

/** Reset auction results in the local caches while keeping every player. */
export function resetPlayersCacheKeepingEveryone(tournamentId: string) {
  writeList(`kapl_auction_players_${tournamentId}`, getKeptPlayers(tournamentId, true));
  writeList('kapl_registered_players', readList<PlayerRecord>('kapl_registered_players').map(resetPlayerRecord));
}

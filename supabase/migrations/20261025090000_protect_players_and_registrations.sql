-- ==============================================================================
-- Migration: Protect players, archive every registration, fix admin roles
-- Date: 2026-10-25
--
-- 1. No player can be lost: every insert / profile change / delete of a player
--    is copied into an append-only archive table (player_registrations).
-- 2. "Reset" no longer deletes players: it only resets their auction status.
-- 3. Deleting a tournament no longer cascades into players.
-- 4. is_admin() now accepts owner and co_admin (the UI already treated them as admins).
-- 5. mobile_number is no longer readable by anon / authenticated users.
-- 6. Auction status constraint is re-asserted WITHOUT swallowing errors.
-- ==============================================================================

-- 0. Enum value used by the app when a player account is created
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'player';

-- 1. Admin check: admin, owner and co_admin (plus the hardcoded main admin email)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (COALESCE(auth.jwt()->>'email', '') = 'rohit.doshi2007@gmail.com') OR EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role::text IN ('admin', 'owner', 'co_admin')
  );
$$;

-- 2. Auction status constraint (no silent failure)
ALTER TABLE public.auction_state DROP CONSTRAINT IF EXISTS auction_state_status_check;
ALTER TABLE public.auction_state ADD CONSTRAINT auction_state_status_check
  CHECK (status IN ('idle', 'bidding', 'fair_warning', 'sold', 'unsold', 'completed', 'paused'));

-- 3. Deleting a tournament must never delete players
DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.players'::regclass
      AND confrelid = 'public.tournaments'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.players DROP CONSTRAINT %I', fk.conname);
  END LOOP;
  ALTER TABLE public.players
    ADD CONSTRAINT players_tournament_id_fkey
    FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE SET NULL;
END $$;

-- 4. Append-only archive of every registration
CREATE TABLE IF NOT EXISTS public.player_registrations (
  log_id BIGSERIAL PRIMARY KEY,
  player_id TEXT NOT NULL,
  action TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.player_registrations ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: nobody can read or change the archive directly.
REVOKE ALL ON TABLE public.player_registrations FROM anon, authenticated, public;
REVOKE ALL ON SEQUENCE public.player_registrations_log_id_seq FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.log_player_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.player_registrations (player_id, action, snapshot)
    VALUES (OLD.id, 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Only archive real profile changes, not every auction price update
    IF (OLD.name, OLD.role, OLD.mobile_number, OLD.tournament_id, OLD.jersey_number, OLD.photo_url,
        OLD.batting_style, OLD.bowling_style, OLD.user_id)
       IS NOT DISTINCT FROM
       (NEW.name, NEW.role, NEW.mobile_number, NEW.tournament_id, NEW.jersey_number, NEW.photo_url,
        NEW.batting_style, NEW.bowling_style, NEW.user_id) THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.player_registrations (player_id, action, snapshot)
  VALUES (NEW.id, TG_OP, to_jsonb(NEW));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_player_change ON public.players;
CREATE TRIGGER trg_log_player_change
  AFTER INSERT OR UPDATE OR DELETE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.log_player_change();

-- Backfill: archive everyone who already exists
INSERT INTO public.player_registrations (player_id, action, snapshot)
SELECT p.id, 'BACKFILL', to_jsonb(p)
FROM public.players p
WHERE NOT EXISTS (SELECT 1 FROM public.player_registrations r WHERE r.player_id = p.id);

-- 5. Admin export of the archive (latest snapshot per player, including deleted ones)
CREATE OR REPLACE FUNCTION public.export_player_registrations()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can export registrations.';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.logged_at)
    FROM (
      SELECT DISTINCT ON (player_id) player_id, action, snapshot, logged_at
      FROM public.player_registrations
      ORDER BY player_id, log_id DESC
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.export_player_registrations() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.export_player_registrations() TO authenticated, service_role;

-- 6. Reset NEVER deletes players: it only returns them to the auction pool
CREATE OR REPLACE FUNCTION public.reset_all_players_and_teams()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can reset tournament data.';
  END IF;

  -- Keep every player; just put them back in the auction pool
  UPDATE public.players
  SET team_id = NULL,
      sold_price = NULL,
      auction_status = 'pending',
      updated_at = now();

  UPDATE public.teams
  SET players = '[]'::jsonb,
      player_count = 0,
      remaining_purse = 10000;

  DELETE FROM public.auction_bids;
  DELETE FROM public.auction_state;
  DELETE FROM public.match_history;
  UPDATE public.match_state SET current_match = null, last_action = null;
  UPDATE public.secondary_match_state SET current_match = null, last_action = null;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_all_players_and_teams() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.reset_all_players_and_teams() TO authenticated, service_role;

-- 7. Own player row (mobile number included) for the logged-in user
CREATE OR REPLACE FUNCTION public.get_my_player()
RETURNS SETOF public.players
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.players WHERE user_id = auth.uid() LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_player() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_player() TO authenticated, service_role;

-- 8. Hide mobile_number from everyone except through the RPCs above
REVOKE SELECT ON TABLE public.players FROM anon, authenticated;
GRANT SELECT (
  id, name, photo_url, role, batting_style, bowling_style,
  tournament_id, team_id, jersey_number, base_price, sold_price,
  auction_status, created_at, updated_at
) ON public.players TO anon;
GRANT SELECT (
  id, user_id, name, photo_url, role, batting_style, bowling_style,
  tournament_id, team_id, jersey_number, base_price, sold_price,
  auction_status, created_at, updated_at
) ON public.players TO authenticated;

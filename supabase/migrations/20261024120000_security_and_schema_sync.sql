-- Migration: Security Hardening, Schema Sync, and Atomic RPCs
-- Date: 2026-10-24

-- 1. Ensure captain fields exist on public.teams
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS captain_name TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS captain_player_id TEXT;

-- 2. Update auction_state check constraint to allow 'completed' and 'paused'
DO $$
BEGIN
  ALTER TABLE public.auction_state DROP CONSTRAINT IF EXISTS auction_state_status_check;
  ALTER TABLE public.auction_state ADD CONSTRAINT auction_state_status_check 
    CHECK (status IN ('idle', 'bidding', 'fair_warning', 'sold', 'unsold', 'completed', 'paused'));
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- 3. Atomic Player Sale RPC
CREATE OR REPLACE FUNCTION public.sell_player_to_team(
  p_tournament_id TEXT,
  p_player_id TEXT,
  p_team_id TEXT,
  p_sold_price NUMERIC,
  p_bidder_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team RECORD;
  v_player RECORD;
  v_new_purse NUMERIC;
  v_updated_players JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can finalize player sales.';
  END IF;

  -- 1. Lock team row
  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Team not found: %', p_team_id;
  END IF;

  -- 2. Lock player row
  SELECT * INTO v_player FROM public.players WHERE id = p_player_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found: %', p_player_id;
  END IF;

  v_new_purse := v_team.remaining_purse - p_sold_price;
  IF v_new_purse < 0 THEN
    RAISE EXCEPTION 'Insufficient purse: team has % but sale price is %', v_team.remaining_purse, p_sold_price;
  END IF;

  -- 3. Update player
  UPDATE public.players
  SET
    team_id = p_team_id,
    sold_price = p_sold_price,
    auction_status = 'sold',
    updated_at = now()
  WHERE id = p_player_id;

  -- 4. Append player to team roster
  v_updated_players := (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(v_team.players, '[]'::jsonb)) AS elem
    WHERE elem->>'id' != p_player_id
  ) || jsonb_build_array(jsonb_build_object(
    'id', v_player.id,
    'name', v_player.name,
    'photo', v_player.photo_url,
    'role', v_player.role,
    'soldPrice', p_sold_price
  ));

  UPDATE public.teams
  SET
    remaining_purse = v_new_purse,
    players = v_updated_players,
    player_count = jsonb_array_length(v_updated_players),
    updated_at = now()
  WHERE id = p_team_id;

  -- 5. Update auction state
  INSERT INTO public.auction_state (id, tournament_id, current_player_id, current_bid, highest_bidder_team_id, status, timer_ends_at, updated_at)
  VALUES (p_tournament_id, p_tournament_id, p_player_id, p_sold_price, p_team_id, 'sold', NULL, now())
  ON CONFLICT (id) DO UPDATE SET
    tournament_id = EXCLUDED.tournament_id,
    current_player_id = EXCLUDED.current_player_id,
    current_bid = EXCLUDED.current_bid,
    highest_bidder_team_id = EXCLUDED.highest_bidder_team_id,
    status = 'sold',
    timer_ends_at = NULL,
    updated_at = now();

  -- 6. Record bid in auction_bids
  INSERT INTO public.auction_bids (tournament_id, player_id, team_id, bid_amount, bidder_user_id)
  VALUES (p_tournament_id, p_player_id, p_team_id, p_sold_price, p_bidder_user_id);

  RETURN jsonb_build_object('success', true, 'remainingPurse', v_new_purse);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sell_player_to_team FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sell_player_to_team TO authenticated, service_role;

-- 4. Secure RPC: reset_all_players_and_teams
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

  -- 1. Permanently delete all players
  DELETE FROM public.players;

  -- 2. Empty all team rosters and reset purses
  UPDATE public.teams
  SET 
    players = '[]'::jsonb,
    player_count = 0,
    remaining_purse = 10000;

  -- 3. Reset auction state and bids
  DELETE FROM public.auction_bids;
  DELETE FROM public.auction_state;

  -- 4. Clear match records and active match states
  DELETE FROM public.match_history;
  UPDATE public.match_state SET current_match = null, last_action = null;
  UPDATE public.secondary_match_state SET current_match = null, last_action = null;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_all_players_and_teams() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.reset_all_players_and_teams() TO authenticated, service_role;

-- 5. Secure RPC: delete_player_by_id
CREATE OR REPLACE FUNCTION public.delete_player_by_id(p_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can delete players.';
  END IF;

  DELETE FROM public.players WHERE id = p_id;

  -- If player was in any team roster, remove them and re-calculate count
  UPDATE public.teams
  SET 
    players = (
      SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      FROM jsonb_array_elements(players) AS elem
      WHERE elem->>'id' != p_id
    ),
    player_count = (
      SELECT count(*)
      FROM jsonb_array_elements(players) AS elem
      WHERE elem->>'id' != p_id
    )
  WHERE players @> jsonb_build_array(jsonb_build_object('id', p_id));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_player_by_id(TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.delete_player_by_id(TEXT) TO authenticated, service_role;

-- 6. Secure RPC: register_new_player
CREATE OR REPLACE FUNCTION public.register_new_player(
  p_id TEXT,
  p_name TEXT,
  p_role TEXT,
  p_batting_style TEXT DEFAULT 'Right-hand bat',
  p_bowling_style TEXT DEFAULT 'Right-arm medium',
  p_tournament_id TEXT DEFAULT 'kapl-3-mens',
  p_jersey_number INTEGER DEFAULT NULL,
  p_mobile_number TEXT DEFAULT NULL,
  p_photo_url TEXT DEFAULT NULL,
  p_base_price NUMERIC DEFAULT 100,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Verify caller is admin OR registering their own user_id
  IF NOT (public.is_admin() OR (auth.uid() IS NOT NULL AND auth.uid() = p_user_id)) THEN
    RAISE EXCEPTION 'Access Denied: Only administrators or the authenticated user can register or update this player profile.';
  END IF;

  INSERT INTO public.players (
    id, user_id, name, role, batting_style, bowling_style, 
    tournament_id, jersey_number, mobile_number, photo_url, 
    base_price, auction_status
  ) VALUES (
    p_id, p_user_id, p_name, p_role, p_batting_style, p_bowling_style, 
    p_tournament_id, p_jersey_number, p_mobile_number, p_photo_url, 
    p_base_price, 'pending'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    batting_style = EXCLUDED.batting_style,
    bowling_style = EXCLUDED.bowling_style,
    jersey_number = EXCLUDED.jersey_number,
    mobile_number = EXCLUDED.mobile_number,
    photo_url = EXCLUDED.photo_url,
    tournament_id = EXCLUDED.tournament_id,
    updated_at = now()
  RETURNING to_jsonb(public.players.*) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_new_player FROM anon, public;
GRANT EXECUTE ON FUNCTION public.register_new_player TO authenticated, service_role;

-- 7. Secure Row Level Security Policies
-- TEAMS: Public read, Admin write
DROP POLICY IF EXISTS "Anyone can update teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can manage teams" ON public.teams;
CREATE POLICY "Admins can manage teams" ON public.teams 
  FOR ALL TO authenticated 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

-- PLAYERS: Public read, Admin write, User update own profile
DROP POLICY IF EXISTS "Anyone can register or update players" ON public.players;
DROP POLICY IF EXISTS "Admins can manage all players" ON public.players;
DROP POLICY IF EXISTS "Users can update own player record" ON public.players;
DROP POLICY IF EXISTS "Users can insert own player record" ON public.players;

CREATE POLICY "Admins can manage all players" ON public.players 
  FOR ALL TO authenticated 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

CREATE POLICY "Users can update own player record" ON public.players 
  FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own player record" ON public.players 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- MATCH_STATE & SECONDARY_MATCH_STATE: Scorer & Admin write
DROP POLICY IF EXISTS "Anyone can manage match_state" ON public.match_state;
DROP POLICY IF EXISTS "Scorers and Admins can manage match_state" ON public.match_state;
CREATE POLICY "Scorers and Admins can manage match_state" ON public.match_state 
  FOR ALL TO authenticated 
  USING (public.is_admin() OR public.is_primary_scorer() OR public.is_secondary_scorer()) 
  WITH CHECK (public.is_admin() OR public.is_primary_scorer() OR public.is_secondary_scorer());

DROP POLICY IF EXISTS "Anyone can manage secondary_match_state" ON public.secondary_match_state;
DROP POLICY IF EXISTS "Scorers and Admins can manage secondary_match_state" ON public.secondary_match_state;
CREATE POLICY "Scorers and Admins can manage secondary_match_state" ON public.secondary_match_state 
  FOR ALL TO authenticated 
  USING (public.is_admin() OR public.is_primary_scorer() OR public.is_secondary_scorer()) 
  WITH CHECK (public.is_admin() OR public.is_primary_scorer() OR public.is_secondary_scorer());

-- MATCH_HISTORY: Scorer & Admin write
DROP POLICY IF EXISTS "Anyone can manage match_history" ON public.match_history;
DROP POLICY IF EXISTS "Scorers and Admins can manage match_history" ON public.match_history;
CREATE POLICY "Scorers and Admins can manage match_history" ON public.match_history 
  FOR ALL TO authenticated 
  USING (public.is_admin() OR public.is_primary_scorer() OR public.is_secondary_scorer()) 
  WITH CHECK (public.is_admin() OR public.is_primary_scorer() OR public.is_secondary_scorer());

-- TOURNAMENT_STATE: Admin write
DROP POLICY IF EXISTS "Anyone can manage tournament state" ON public.tournament_state;
DROP POLICY IF EXISTS "Admins can manage tournament state" ON public.tournament_state;
CREATE POLICY "Admins can manage tournament state" ON public.tournament_state 
  FOR ALL TO authenticated 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

-- AUCTION_STATE: Admin write
DROP POLICY IF EXISTS "Anyone can manage auction state" ON public.auction_state;
DROP POLICY IF EXISTS "Admins can manage auction state" ON public.auction_state;
CREATE POLICY "Admins can manage auction state" ON public.auction_state 
  FOR ALL TO authenticated 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

-- AUCTION_BIDS: Authenticated insert (bidders/admins), Admin manage
DROP POLICY IF EXISTS "Anyone can manage auction bids" ON public.auction_bids;
DROP POLICY IF EXISTS "Admins can manage auction bids" ON public.auction_bids;
DROP POLICY IF EXISTS "Authenticated users and Admins can insert bids" ON public.auction_bids;

CREATE POLICY "Authenticated users and Admins can insert bids" ON public.auction_bids 
  FOR INSERT TO authenticated 
  WITH CHECK (public.is_admin() OR auth.uid() = bidder_user_id);

CREATE POLICY "Admins can manage auction bids" ON public.auction_bids 
  FOR ALL TO authenticated 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

-- 8. Sensitive Column Protection: Revoke mobile_number and user_id from anon on public.players
REVOKE SELECT ON TABLE public.players FROM anon;
GRANT SELECT (
  id, name, photo_url, role, batting_style, bowling_style, 
  tournament_id, team_id, jersey_number, base_price, sold_price, 
  auction_status, created_at, updated_at
) ON public.players TO anon;

-- ==============================================================================
-- KAPL 3.0 — Phase 1 Schema Migration
-- Features:
--   1. Add 'captain' role to app_role enum
--   2. Create tournaments table (Men's & Women's concurrent support)
--   3. Enhance teams table (tournament_id, purses, squad constraints, captain)
--   4. Create normalized players table with auction and role attributes
--   5. Create auction_state and auction_bids tables
--   6. Enhance match_history and match_state with tournament_id
--   7. RLS policies, trigger updates, and Realtime publication
--   8. Automated data migration from teams.players JSONB to players table
-- ==============================================================================

-- 1. Add captain role to app_role enum if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'app_role' AND e.enumlabel = 'captain'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'captain';
  END IF;
END $$;

-- 2. Create tournaments table
CREATE TABLE IF NOT EXISTS public.tournaments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  edition TEXT NOT NULL DEFAULT '3.0',
  category TEXT NOT NULL CHECK (category IN ('mens', 'womens')),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'auction', 'live', 'completed')),
  rules JSONB NOT NULL DEFAULT '{"max_overs": 7, "max_overs_per_bowler": 2, "max_wickets": 10, "negative_runs_enabled": true}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Seed default Men's and Women's tournaments for KAPL 3.0
INSERT INTO public.tournaments (id, name, edition, category, status)
VALUES 
  ('kapl-3-mens', 'KAPL 3.0 Men''s Tournament', '3.0', 'mens', 'upcoming'),
  ('kapl-3-womens', 'KAPL 3.0 Women''s Tournament', '3.0', 'womens', 'upcoming')
ON CONFLICT (id) DO NOTHING;

-- 3. Enhance teams table with tournament, purse, and captain fields
ALTER TABLE public.teams 
  ADD COLUMN IF NOT EXISTS tournament_id TEXT REFERENCES public.tournaments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS initial_purse NUMERIC NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS remaining_purse NUMERIC NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS max_squad_size INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS captain_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Default existing teams to Men's tournament
UPDATE public.teams 
SET tournament_id = 'kapl-3-mens' 
WHERE tournament_id IS NULL;

-- 4. Create normalized players table
CREATE TABLE IF NOT EXISTS public.players (
  id TEXT PRIMARY KEY DEFAULT ('p_' || gen_random_uuid()),
  tournament_id TEXT REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'all_rounder' CHECK (role IN ('batter', 'bowler', 'all_rounder', 'wicket_keeper')),
  batting_style TEXT DEFAULT 'Right-hand bat',
  bowling_style TEXT DEFAULT 'Right-arm medium',
  photo_url TEXT,
  base_price NUMERIC NOT NULL DEFAULT 100,
  sold_price NUMERIC,
  auction_status TEXT NOT NULL DEFAULT 'pending' CHECK (auction_status IN ('pending', 'bidding', 'sold', 'unsold')),
  jersey_number INTEGER,
  mobile_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_players_tournament ON public.players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_players_team ON public.players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_user ON public.players(user_id);

-- 5. Create auction_state and auction_bids tables
CREATE TABLE IF NOT EXISTS public.auction_state (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  current_player_id TEXT REFERENCES public.players(id) ON DELETE SET NULL,
  current_bid NUMERIC NOT NULL DEFAULT 0,
  highest_bidder_team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
  bid_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'bidding', 'fair_warning', 'sold', 'unsold')),
  timer_ends_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

INSERT INTO public.auction_state (id, tournament_id, status)
VALUES 
  ('kapl-3-mens', 'kapl-3-mens', 'idle'),
  ('kapl-3-womens', 'kapl-3-womens', 'idle')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.auction_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id TEXT NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  bid_amount NUMERIC NOT NULL,
  bidder_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auction_bids_player ON public.auction_bids(player_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_tournament ON public.auction_bids(tournament_id);

-- 6. Enhance match_history and match_state for tournament segregation
ALTER TABLE public.match_history
  ADD COLUMN IF NOT EXISTS tournament_id TEXT REFERENCES public.tournaments(id) ON DELETE SET NULL;

UPDATE public.match_history 
SET tournament_id = 'kapl-3-mens' 
WHERE tournament_id IS NULL;

ALTER TABLE public.match_state
  ADD COLUMN IF NOT EXISTS tournament_id TEXT REFERENCES public.tournaments(id) ON DELETE SET NULL;

UPDATE public.match_state 
SET tournament_id = 'kapl-3-mens' 
WHERE id = 'current' AND tournament_id IS NULL;

-- Support Women's active match row in match_state
INSERT INTO public.match_state (id, tournament_id, current_match, last_action)
VALUES ('womens', 'kapl-3-womens', null, null)
ON CONFLICT (id) DO NOTHING;

-- 7. Add update triggers
CREATE OR REPLACE TRIGGER update_tournaments_updated_at 
  BEFORE UPDATE ON public.tournaments 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_players_updated_at 
  BEFORE UPDATE ON public.players 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_auction_state_updated_at 
  BEFORE UPDATE ON public.auction_state 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;

-- Public Read Policies
DROP POLICY IF EXISTS "Anyone can view tournaments" ON public.tournaments;
CREATE POLICY "Anyone can view tournaments" ON public.tournaments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view players" ON public.players;
CREATE POLICY "Anyone can view players" ON public.players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view auction state" ON public.auction_state;
CREATE POLICY "Anyone can view auction state" ON public.auction_state FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view auction bids" ON public.auction_bids;
CREATE POLICY "Anyone can view auction bids" ON public.auction_bids FOR SELECT USING (true);

-- Admin Management Policies
DROP POLICY IF EXISTS "Admins can manage tournaments" ON public.tournaments;
CREATE POLICY "Admins can manage tournaments" ON public.tournaments 
  FOR ALL TO authenticated 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage players" ON public.players;
CREATE POLICY "Admins can manage players" ON public.players 
  FOR ALL TO authenticated 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage auction state" ON public.auction_state;
CREATE POLICY "Admins can manage auction state" ON public.auction_state 
  FOR ALL TO authenticated 
  USING (public.is_admin()) 
  WITH CHECK (public.is_admin());

-- Captains and Admins can insert bids
DROP POLICY IF EXISTS "Captains and Admins can insert bids" ON public.auction_bids;
CREATE POLICY "Captains and Admins can insert bids" ON public.auction_bids 
  FOR INSERT TO authenticated 
  WITH CHECK (public.is_admin() OR public.has_role(auth.uid(), 'captain'));

-- 9. Realtime Publication & Replica Identity
ALTER TABLE public.tournaments REPLICA IDENTITY FULL;
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.auction_state REPLICA IDENTITY FULL;
ALTER TABLE public.auction_bids REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tournaments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'players') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'auction_state') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_state;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'auction_bids') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_bids;
  END IF;
END $$;

-- 10. Data Migration: Populate players table from existing teams.players JSONB
DO $$
DECLARE
  team_rec RECORD;
  player_item JSONB;
BEGIN
  FOR team_rec IN SELECT id, tournament_id, players FROM public.teams WHERE players IS NOT NULL LOOP
    IF jsonb_typeof(team_rec.players) = 'array' THEN
      FOR player_item IN SELECT jsonb_array_elements(team_rec.players) LOOP
        INSERT INTO public.players (
          id,
          tournament_id,
          team_id,
          name,
          photo_url,
          role,
          base_price,
          sold_price,
          auction_status
        ) VALUES (
          player_item->>'id',
          COALESCE(team_rec.tournament_id, 'kapl-3-mens'),
          team_rec.id,
          COALESCE(player_item->>'name', 'Unknown Player'),
          player_item->>'photo',
          'all_rounder',
          100,
          100,
          'sold'
        )
        ON CONFLICT (id) DO UPDATE SET
          team_id = EXCLUDED.team_id,
          tournament_id = EXCLUDED.tournament_id,
          name = EXCLUDED.name;
      END LOOP;
    END IF;
  END LOOP;
END $$;


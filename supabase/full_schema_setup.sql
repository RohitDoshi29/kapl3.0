-- ==============================================================================
-- KAPL 3.0 — Complete All-In-One Database Initialization Script
-- Use this script when creating a fresh Supabase project.
-- Run this entire script in your new Supabase Project -> SQL Editor -> Click 'Run'.
-- ==============================================================================

-- 1. ENUMS & EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'co_admin', 'owner', 'user', 'primary_scorer', 'secondary_scorer', 'captain');
  ELSE
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'co_admin';
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'primary_scorer';
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secondary_scorer';
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'captain';
  END IF;
END $$;

-- 2. UTILITY FUNCTIONS
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. USER ROLES & ACCESS CONTROL
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (COALESCE(auth.jwt()->>'email', '') = 'rohit.doshi2007@gmail.com') OR public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_primary_scorer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'primary_scorer'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_secondary_scorer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'secondary_scorer'
  )
$$;

-- Trigger to make rohit.doshi2007@gmail.com or the first user an admin automatically
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count integer;
BEGIN
  IF lower(NEW.email) = 'rohit.doshi2007@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
  END IF;

  IF lower(NEW.email) = 'rohitdoshicolg@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
  END IF;

  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_add_role ON auth.users;
CREATE TRIGGER on_auth_user_created_add_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- 4. TOURNAMENTS TABLE
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

INSERT INTO public.tournaments (id, name, edition, category, status)
VALUES 
  ('kapl-3-mens', 'KAPL 3.0 Men''s Tournament', '3.0', 'mens', 'upcoming'),
  ('kapl-3-womens', 'KAPL 3.0 Women''s Tournament', '3.0', 'womens', 'upcoming')
ON CONFLICT (id) DO NOTHING;

-- 5. TEAMS TABLE
CREATE TABLE IF NOT EXISTS public.teams (
  id TEXT PRIMARY KEY,
  tournament_id TEXT REFERENCES public.tournaments(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  "group" TEXT NOT NULL CHECK ("group" IN ('A', 'B')),
  logo TEXT,
  primary_color TEXT NOT NULL,
  players JSONB NOT NULL DEFAULT '[]'::jsonb,
  player_count INTEGER NOT NULL DEFAULT 10,
  initial_purse NUMERIC NOT NULL DEFAULT 10000,
  remaining_purse NUMERIC NOT NULL DEFAULT 10000,
  max_squad_size INTEGER NOT NULL DEFAULT 10,
  captain_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_name TEXT,
  owner_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Seed 8 Default Teams for Men's Tournament
INSERT INTO public.teams (id, tournament_id, name, "group", logo, primary_color, players, player_count, owner_name, owner_email) VALUES
  ('a1', 'kapl-3-mens', 'Kapil''s Warriors', 'A', null, '0 84% 60%', '[{"id":"a1-p1","name":"Player 1","photo":null},{"id":"a1-p2","name":"Player 2","photo":null},{"id":"a1-p3","name":"Player 3","photo":null},{"id":"a1-p4","name":"Player 4","photo":null},{"id":"a1-p5","name":"Player 5","photo":null},{"id":"a1-p6","name":"Player 6","photo":null},{"id":"a1-p7","name":"Player 7","photo":null},{"id":"a1-p8","name":"Player 8","photo":null},{"id":"a1-p9","name":"Player 9","photo":null},{"id":"a1-p10","name":"Player 10","photo":null}]', 10, 'Rohit Doshi', 'rohitdoshicolg@gmail.com'),
  ('a2', 'kapl-3-mens', 'Kapil Falcons', 'A', null, '174 72% 40%', '[{"id":"a2-p1","name":"Player 1","photo":null},{"id":"a2-p2","name":"Player 2","photo":null},{"id":"a2-p3","name":"Player 3","photo":null},{"id":"a2-p4","name":"Player 4","photo":null},{"id":"a2-p5","name":"Player 5","photo":null},{"id":"a2-p6","name":"Player 6","photo":null},{"id":"a2-p7","name":"Player 7","photo":null},{"id":"a2-p8","name":"Player 8","photo":null},{"id":"a2-p9","name":"Player 9","photo":null},{"id":"a2-p10","name":"Player 10","photo":null}]', 10),
  ('a3', 'kapl-3-mens', 'Insta Paltans', 'A', null, '267 84% 51%', '[{"id":"a3-p1","name":"Player 1","photo":null},{"id":"a3-p2","name":"Player 2","photo":null},{"id":"a3-p3","name":"Player 3","photo":null},{"id":"a3-p4","name":"Player 4","photo":null},{"id":"a3-p5","name":"Player 5","photo":null},{"id":"a3-p6","name":"Player 6","photo":null},{"id":"a3-p7","name":"Player 7","photo":null},{"id":"a3-p8","name":"Player 8","photo":null},{"id":"a3-p9","name":"Player 9","photo":null},{"id":"a3-p10","name":"Player 10","photo":null}]', 10),
  ('a4', 'kapl-3-mens', 'Kapil''s Devils', 'A', null, '222 47% 31%', '[{"id":"a4-p1","name":"Player 1","photo":null},{"id":"a4-p2","name":"Player 2","photo":null},{"id":"a4-p3","name":"Player 3","photo":null},{"id":"a4-p4","name":"Player 4","photo":null},{"id":"a4-p5","name":"Player 5","photo":null},{"id":"a4-p6","name":"Player 6","photo":null},{"id":"a4-p7","name":"Player 7","photo":null},{"id":"a4-p8","name":"Player 8","photo":null},{"id":"a4-p9","name":"Player 9","photo":null},{"id":"a4-p10","name":"Player 10","photo":null}]', 10),
  ('b1', 'kapl-3-mens', 'Goodness Royals', 'B', null, '43 96% 56%', '[{"id":"b1-p1","name":"Player 1","photo":null},{"id":"b1-p2","name":"Player 2","photo":null},{"id":"b1-p3","name":"Player 3","photo":null},{"id":"b1-p4","name":"Player 4","photo":null},{"id":"b1-p5","name":"Player 5","photo":null},{"id":"b1-p6","name":"Player 6","photo":null},{"id":"b1-p7","name":"Player 7","photo":null},{"id":"b1-p8","name":"Player 8","photo":null},{"id":"b1-p9","name":"Player 9","photo":null},{"id":"b1-p10","name":"Player 10","photo":null}]', 10),
  ('b2', 'kapl-3-mens', 'Kapil Ke Singham', 'B', null, '199 89% 48%', '[{"id":"b2-p1","name":"Player 1","photo":null},{"id":"b2-p2","name":"Player 2","photo":null},{"id":"b2-p3","name":"Player 3","photo":null},{"id":"b2-p4","name":"Player 4","photo":null},{"id":"b2-p5","name":"Player 5","photo":null},{"id":"b2-p6","name":"Player 6","photo":null},{"id":"b2-p7","name":"Player 7","photo":null},{"id":"b2-p8","name":"Player 8","photo":null},{"id":"b2-p9","name":"Player 9","photo":null},{"id":"b2-p10","name":"Player 10","photo":null}]', 10),
  ('b3', 'kapl-3-mens', 'Super Strikers', 'B', null, '280 68% 51%', '[{"id":"b3-p1","name":"Player 1","photo":null},{"id":"b3-p2","name":"Player 2","photo":null},{"id":"b3-p3","name":"Player 3","photo":null},{"id":"b3-p4","name":"Player 4","photo":null},{"id":"b3-p5","name":"Player 5","photo":null},{"id":"b3-p6","name":"Player 6","photo":null},{"id":"b3-p7","name":"Player 7","photo":null},{"id":"b3-p8","name":"Player 8","photo":null},{"id":"b3-p9","name":"Player 9","photo":null},{"id":"b3-p10","name":"Player 10","photo":null}]', 10),
  ('b4', 'kapl-3-mens', 'Kapil Avengers', 'B', null, '25 95% 53%', '[{"id":"b4-p1","name":"Player 1","photo":null},{"id":"b4-p2","name":"Player 2","photo":null},{"id":"b4-p3","name":"Player 3","photo":null},{"id":"b4-p4","name":"Player 4","photo":null},{"id":"b4-p5","name":"Player 5","photo":null},{"id":"b4-p6","name":"Player 6","photo":null},{"id":"b4-p7","name":"Player 7","photo":null},{"id":"b4-p8","name":"Player 8","photo":null},{"id":"b4-p9","name":"Player 9","photo":null},{"id":"b4-p10","name":"Player 10","photo":null}]', 10)
ON CONFLICT (id) DO NOTHING;

-- 6. PLAYERS TABLE
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

-- Populate players from default teams
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

-- 7. MATCH STATE TABLE (Active Live Match)
CREATE TABLE IF NOT EXISTS public.match_state (
  id TEXT PRIMARY KEY DEFAULT 'current',
  tournament_id TEXT REFERENCES public.tournaments(id) ON DELETE SET NULL,
  current_match JSONB,
  last_action JSONB,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

INSERT INTO public.match_state (id, tournament_id, current_match, last_action) 
VALUES 
  ('current', 'kapl-3-mens', null, null),
  ('womens', 'kapl-3-womens', null, null)
ON CONFLICT (id) DO NOTHING;

-- Secondary match state for secondary scorer verification
CREATE TABLE IF NOT EXISTS public.secondary_match_state (
  id TEXT PRIMARY KEY DEFAULT 'current',
  current_match JSONB,
  last_action JSONB,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

INSERT INTO public.secondary_match_state (id, current_match, last_action)
VALUES ('current', null, null)
ON CONFLICT (id) DO NOTHING;

-- 8. MATCH HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.match_history (
  id TEXT PRIMARY KEY,
  tournament_id TEXT REFERENCES public.tournaments(id) ON DELETE SET NULL,
  "group" TEXT NOT NULL CHECK ("group" IN ('A', 'B')),
  team1_id TEXT NOT NULL REFERENCES public.teams(id),
  team2_id TEXT NOT NULL REFERENCES public.teams(id),
  innings1 JSONB,
  innings2 JSONB,
  current_innings INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'live', 'completed')),
  winner TEXT,
  match_type TEXT NOT NULL DEFAULT 'group',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. TOURNAMENT KNOCKOUT STATE TABLE
CREATE TABLE IF NOT EXISTS public.tournament_state (
  id TEXT NOT NULL DEFAULT 'current' PRIMARY KEY,
  qualified_a1 TEXT,
  qualified_a2 TEXT,
  qualified_b1 TEXT,
  qualified_b2 TEXT,
  sf1_winner TEXT,
  sf2_winner TEXT,
  final_winner TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

INSERT INTO public.tournament_state (id) VALUES ('current') ON CONFLICT (id) DO NOTHING;

-- 10. AUCTION STATE & BIDS TABLES
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

-- 11. TRIGGERS
DROP TRIGGER IF EXISTS update_tournaments_updated_at ON public.tournaments;
CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_teams_updated_at ON public.teams;
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_players_updated_at ON public.players;
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_match_state_updated_at ON public.match_state;
CREATE TRIGGER update_match_state_updated_at BEFORE UPDATE ON public.match_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_auction_state_updated_at ON public.auction_state;
CREATE TRIGGER update_auction_state_updated_at BEFORE UPDATE ON public.auction_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secondary_match_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;

-- Public Read Policies
DROP POLICY IF EXISTS "Anyone can view user roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view tournaments" ON public.tournaments;
CREATE POLICY "Anyone can view tournaments" ON public.tournaments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage tournaments" ON public.tournaments;
CREATE POLICY "Admins can manage tournaments" ON public.tournaments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view teams" ON public.teams;
CREATE POLICY "Anyone can view teams" ON public.teams FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage teams" ON public.teams;
CREATE POLICY "Admins can manage teams" ON public.teams FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view players" ON public.players;
CREATE POLICY "Anyone can view players" ON public.players FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage players" ON public.players;
CREATE POLICY "Admins can manage players" ON public.players FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view match state" ON public.match_state;
CREATE POLICY "Anyone can view match state" ON public.match_state FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins and Scorers can update match_state" ON public.match_state;
CREATE POLICY "Admins and Scorers can update match_state" ON public.match_state FOR ALL TO authenticated USING (public.is_admin() OR public.is_primary_scorer()) WITH CHECK (public.is_admin() OR public.is_primary_scorer());

DROP POLICY IF EXISTS "Anyone can view secondary match state" ON public.secondary_match_state;
CREATE POLICY "Anyone can view secondary match state" ON public.secondary_match_state FOR SELECT USING (true);
DROP POLICY IF EXISTS "Secondary scorers can manage secondary_match_state" ON public.secondary_match_state;
CREATE POLICY "Secondary scorers can manage secondary_match_state" ON public.secondary_match_state FOR ALL TO authenticated USING (public.is_secondary_scorer() OR public.is_admin()) WITH CHECK (public.is_secondary_scorer() OR public.is_admin());

DROP POLICY IF EXISTS "Anyone can view match history" ON public.match_history;
CREATE POLICY "Anyone can view match history" ON public.match_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins and Scorers can manage match_history" ON public.match_history;
CREATE POLICY "Admins and Scorers can manage match_history" ON public.match_history FOR ALL TO authenticated USING (public.is_admin() OR public.is_primary_scorer()) WITH CHECK (public.is_admin() OR public.is_primary_scorer());

DROP POLICY IF EXISTS "Anyone can view tournament state" ON public.tournament_state;
CREATE POLICY "Anyone can view tournament state" ON public.tournament_state FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage tournament state" ON public.tournament_state;
CREATE POLICY "Admins can manage tournament state" ON public.tournament_state FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view auction state" ON public.auction_state;
CREATE POLICY "Anyone can view auction state" ON public.auction_state FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage auction state" ON public.auction_state;
CREATE POLICY "Admins can manage auction state" ON public.auction_state FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Anyone can view auction bids" ON public.auction_bids;
CREATE POLICY "Anyone can view auction bids" ON public.auction_bids FOR SELECT USING (true);
DROP POLICY IF EXISTS "Captains and Admins can insert bids" ON public.auction_bids;
CREATE POLICY "Captains and Admins can insert bids" ON public.auction_bids FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR public.has_role(auth.uid(), 'captain'));

-- 13. ENABLE REALTIME & REPLICA IDENTITY FULL
ALTER TABLE public.tournaments REPLICA IDENTITY FULL;
ALTER TABLE public.teams REPLICA IDENTITY FULL;
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.match_state REPLICA IDENTITY FULL;
ALTER TABLE public.secondary_match_state REPLICA IDENTITY FULL;
ALTER TABLE public.match_history REPLICA IDENTITY FULL;
ALTER TABLE public.auction_state REPLICA IDENTITY FULL;
ALTER TABLE public.auction_bids REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tournaments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'teams') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'players') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'match_state') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_state;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'secondary_match_state') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.secondary_match_state;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'match_history') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_history;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'auction_state') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_state;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'auction_bids') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_bids;
  END IF;
END $$;


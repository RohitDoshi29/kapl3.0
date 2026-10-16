-- Create teams table
CREATE TABLE public.teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "group" TEXT NOT NULL CHECK ("group" IN ('A', 'B')),
  logo TEXT,
  primary_color TEXT NOT NULL,
  players JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create match_state table (singleton - only one active match)
CREATE TABLE public.match_state (
  id TEXT PRIMARY KEY DEFAULT 'current',
  current_match JSONB,
  last_action JSONB,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create match_history table
CREATE TABLE public.match_history (
  id TEXT PRIMARY KEY,
  "group" TEXT NOT NULL CHECK ("group" IN ('A', 'B')),
  team1_id TEXT NOT NULL REFERENCES public.teams(id),
  team2_id TEXT NOT NULL REFERENCES public.teams(id),
  innings1 JSONB,
  innings2 JSONB,
  current_innings INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'live', 'completed')),
  winner TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;

-- Public read access for everyone (live scoring app)
CREATE POLICY "Anyone can view teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Anyone can view match state" ON public.match_state FOR SELECT USING (true);
CREATE POLICY "Anyone can view match history" ON public.match_history FOR SELECT USING (true);

-- For now, allow all writes (we'll use app-level admin password)
-- In production, you'd want proper auth here
CREATE POLICY "Allow all inserts on teams" ON public.teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates on teams" ON public.teams FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes on teams" ON public.teams FOR DELETE USING (true);

CREATE POLICY "Allow all inserts on match_state" ON public.match_state FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates on match_state" ON public.match_state FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes on match_state" ON public.match_state FOR DELETE USING (true);

CREATE POLICY "Allow all inserts on match_history" ON public.match_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all updates on match_history" ON public.match_history FOR UPDATE USING (true);
CREATE POLICY "Allow all deletes on match_history" ON public.match_history FOR DELETE USING (true);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_history;

-- Insert default teams
INSERT INTO public.teams (id, name, "group", logo, primary_color, players) VALUES
  ('a1', 'Team Alpha', 'A', null, '267 84% 51%', '[{"id":"a1-p1","name":"Player 1","photo":null},{"id":"a1-p2","name":"Player 2","photo":null},{"id":"a1-p3","name":"Player 3","photo":null},{"id":"a1-p4","name":"Player 4","photo":null},{"id":"a1-p5","name":"Player 5","photo":null},{"id":"a1-p6","name":"Player 6","photo":null},{"id":"a1-p7","name":"Player 7","photo":null},{"id":"a1-p8","name":"Player 8","photo":null},{"id":"a1-p9","name":"Player 9","photo":null},{"id":"a1-p10","name":"Player 10","photo":null}]'),
  ('a2', 'Team Bravo', 'A', null, '43 96% 56%', '[{"id":"a2-p1","name":"Player 1","photo":null},{"id":"a2-p2","name":"Player 2","photo":null},{"id":"a2-p3","name":"Player 3","photo":null},{"id":"a2-p4","name":"Player 4","photo":null},{"id":"a2-p5","name":"Player 5","photo":null},{"id":"a2-p6","name":"Player 6","photo":null},{"id":"a2-p7","name":"Player 7","photo":null},{"id":"a2-p8","name":"Player 8","photo":null},{"id":"a2-p9","name":"Player 9","photo":null},{"id":"a2-p10","name":"Player 10","photo":null}]'),
  ('a3', 'Team Charlie', 'A', null, '142 71% 45%', '[{"id":"a3-p1","name":"Player 1","photo":null},{"id":"a3-p2","name":"Player 2","photo":null},{"id":"a3-p3","name":"Player 3","photo":null},{"id":"a3-p4","name":"Player 4","photo":null},{"id":"a3-p5","name":"Player 5","photo":null},{"id":"a3-p6","name":"Player 6","photo":null},{"id":"a3-p7","name":"Player 7","photo":null},{"id":"a3-p8","name":"Player 8","photo":null},{"id":"a3-p9","name":"Player 9","photo":null},{"id":"a3-p10","name":"Player 10","photo":null}]'),
  ('a4', 'Team Delta', 'A', null, '0 84% 60%', '[{"id":"a4-p1","name":"Player 1","photo":null},{"id":"a4-p2","name":"Player 2","photo":null},{"id":"a4-p3","name":"Player 3","photo":null},{"id":"a4-p4","name":"Player 4","photo":null},{"id":"a4-p5","name":"Player 5","photo":null},{"id":"a4-p6","name":"Player 6","photo":null},{"id":"a4-p7","name":"Player 7","photo":null},{"id":"a4-p8","name":"Player 8","photo":null},{"id":"a4-p9","name":"Player 9","photo":null},{"id":"a4-p10","name":"Player 10","photo":null}]'),
  ('b1', 'Team Echo', 'B', null, '280 68% 51%', '[{"id":"b1-p1","name":"Player 1","photo":null},{"id":"b1-p2","name":"Player 2","photo":null},{"id":"b1-p3","name":"Player 3","photo":null},{"id":"b1-p4","name":"Player 4","photo":null},{"id":"b1-p5","name":"Player 5","photo":null},{"id":"b1-p6","name":"Player 6","photo":null},{"id":"b1-p7","name":"Player 7","photo":null},{"id":"b1-p8","name":"Player 8","photo":null},{"id":"b1-p9","name":"Player 9","photo":null},{"id":"b1-p10","name":"Player 10","photo":null}]'),
  ('b2', 'Team Foxtrot', 'B', null, '199 89% 48%', '[{"id":"b2-p1","name":"Player 1","photo":null},{"id":"b2-p2","name":"Player 2","photo":null},{"id":"b2-p3","name":"Player 3","photo":null},{"id":"b2-p4","name":"Player 4","photo":null},{"id":"b2-p5","name":"Player 5","photo":null},{"id":"b2-p6","name":"Player 6","photo":null},{"id":"b2-p7","name":"Player 7","photo":null},{"id":"b2-p8","name":"Player 8","photo":null},{"id":"b2-p9","name":"Player 9","photo":null},{"id":"b2-p10","name":"Player 10","photo":null}]'),
  ('b3', 'Team Golf', 'B', null, '25 95% 53%', '[{"id":"b3-p1","name":"Player 1","photo":null},{"id":"b3-p2","name":"Player 2","photo":null},{"id":"b3-p3","name":"Player 3","photo":null},{"id":"b3-p4","name":"Player 4","photo":null},{"id":"b3-p5","name":"Player 5","photo":null},{"id":"b3-p6","name":"Player 6","photo":null},{"id":"b3-p7","name":"Player 7","photo":null},{"id":"b3-p8","name":"Player 8","photo":null},{"id":"b3-p9","name":"Player 9","photo":null},{"id":"b3-p10","name":"Player 10","photo":null}]'),
  ('b4', 'Team Hotel', 'B', null, '326 78% 60%', '[{"id":"b4-p1","name":"Player 1","photo":null},{"id":"b4-p2","name":"Player 2","photo":null},{"id":"b4-p3","name":"Player 3","photo":null},{"id":"b4-p4","name":"Player 4","photo":null},{"id":"b4-p5","name":"Player 5","photo":null},{"id":"b4-p6","name":"Player 6","photo":null},{"id":"b4-p7","name":"Player 7","photo":null},{"id":"b4-p8","name":"Player 8","photo":null},{"id":"b4-p9","name":"Player 9","photo":null},{"id":"b4-p10","name":"Player 10","photo":null}]');

-- Insert default match state
INSERT INTO public.match_state (id, current_match, last_action) VALUES ('current', null, null);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_match_state_updated_at BEFORE UPDATE ON public.match_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Add player_count column to teams table
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS player_count integer NOT NULL DEFAULT 10;

-- Add constraint to ensure player_count is between 7 and 11
ALTER TABLE public.teams ADD CONSTRAINT teams_player_count_range CHECK (player_count >= 7 AND player_count <= 11);
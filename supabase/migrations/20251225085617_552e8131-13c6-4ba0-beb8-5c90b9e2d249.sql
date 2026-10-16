-- Create tournament_state table to store knockout stage selections
CREATE TABLE public.tournament_state (
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

-- Enable RLS
ALTER TABLE public.tournament_state ENABLE ROW LEVEL SECURITY;

-- Anyone can view tournament state
CREATE POLICY "Anyone can view tournament state"
ON public.tournament_state
FOR SELECT
USING (true);

-- Admins can manage tournament state
CREATE POLICY "Admins can insert tournament state"
ON public.tournament_state
FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admins can update tournament state"
ON public.tournament_state
FOR UPDATE
USING (is_admin());

CREATE POLICY "Admins can delete tournament state"
ON public.tournament_state
FOR DELETE
USING (is_admin());

-- Insert default row
INSERT INTO public.tournament_state (id) VALUES ('current');
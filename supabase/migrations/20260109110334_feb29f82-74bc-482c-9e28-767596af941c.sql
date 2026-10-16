-- Allow anyone to view secondary_match_state so primary scorer can see secondary scores for comparison
DROP POLICY IF EXISTS "Secondary scorer and admins can view secondary_match_state" ON public.secondary_match_state;

CREATE POLICY "Anyone can view secondary match state"
ON public.secondary_match_state
FOR SELECT
USING (true);
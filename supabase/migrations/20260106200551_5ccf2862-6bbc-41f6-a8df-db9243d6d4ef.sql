-- Create secondary match state table for the secondary scorer
CREATE TABLE public.secondary_match_state (
    id text NOT NULL DEFAULT 'current'::text PRIMARY KEY,
    current_match jsonb,
    last_action jsonb,
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.secondary_match_state ENABLE ROW LEVEL SECURITY;

-- Create function to check if user is a secondary scorer
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

-- Create function to check if user is a primary scorer
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

-- RLS Policies for secondary_match_state
-- Only secondary scorers can modify
CREATE POLICY "Secondary scorers can insert secondary_match_state"
ON public.secondary_match_state
FOR INSERT
WITH CHECK (is_secondary_scorer() OR is_admin());

CREATE POLICY "Secondary scorers can update secondary_match_state"
ON public.secondary_match_state
FOR UPDATE
USING (is_secondary_scorer() OR is_admin());

CREATE POLICY "Secondary scorers can delete secondary_match_state"
ON public.secondary_match_state
FOR DELETE
USING (is_secondary_scorer() OR is_admin());

-- Only secondary scorer and admins can view (NOT public)
CREATE POLICY "Secondary scorer and admins can view secondary_match_state"
ON public.secondary_match_state
FOR SELECT
USING (is_secondary_scorer() OR is_admin());
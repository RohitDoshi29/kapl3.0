-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table (separate from any profile table to prevent privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
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

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- RLS policies for user_roles table
-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Only admins can manage roles
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Drop existing overly permissive policies on teams, match_state, match_history
DROP POLICY IF EXISTS "Allow all deletes on teams" ON public.teams;
DROP POLICY IF EXISTS "Allow all inserts on teams" ON public.teams;
DROP POLICY IF EXISTS "Allow all updates on teams" ON public.teams;
DROP POLICY IF EXISTS "Allow all deletes on match_state" ON public.match_state;
DROP POLICY IF EXISTS "Allow all inserts on match_state" ON public.match_state;
DROP POLICY IF EXISTS "Allow all updates on match_state" ON public.match_state;
DROP POLICY IF EXISTS "Allow all deletes on match_history" ON public.match_history;
DROP POLICY IF EXISTS "Allow all inserts on match_history" ON public.match_history;
DROP POLICY IF EXISTS "Allow all updates on match_history" ON public.match_history;

-- Create new policies: Public read, Admin write

-- Teams table
CREATE POLICY "Admins can insert teams"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update teams"
ON public.teams
FOR UPDATE
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can delete teams"
ON public.teams
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Match State table
CREATE POLICY "Admins can insert match_state"
ON public.match_state
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update match_state"
ON public.match_state
FOR UPDATE
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can delete match_state"
ON public.match_state
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Match History table
CREATE POLICY "Admins can insert match_history"
ON public.match_history
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update match_history"
ON public.match_history
FOR UPDATE
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can delete match_history"
ON public.match_history
FOR DELETE
TO authenticated
USING (public.is_admin());
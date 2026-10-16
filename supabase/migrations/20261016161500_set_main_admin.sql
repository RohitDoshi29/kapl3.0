-- Ensure rohit.doshi2007@gmail.com is recognized as permanent Main Admin in RLS and trigger functions

-- 1. Update is_admin function to always evaluate true for rohit.doshi2007@gmail.com
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
      AND role = 'admin'
  );
$$;

-- 2. Update handle_new_user_role trigger function to assign admin role directly to rohit.doshi2007@gmail.com
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

-- 3. Retroactively ensure any existing auth user with email rohit.doshi2007@gmail.com has admin role
DO $$
DECLARE
  main_admin_id uuid;
BEGIN
  SELECT id INTO main_admin_id FROM auth.users WHERE lower(email) = 'rohit.doshi2007@gmail.com' LIMIT 1;
  IF main_admin_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (main_admin_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;


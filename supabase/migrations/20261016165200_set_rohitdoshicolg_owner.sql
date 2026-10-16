-- Migration: Add owner and co_admin roles and designate rohitdoshicolg@gmail.com as owner of Kapil's Warriors

-- 1. Ensure owner and co_admin enum values exist in app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'co_admin';

-- 2. Ensure owner columns exist on public.teams
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS owner_email TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Designate rohitdoshicolg@gmail.com as the franchise owner for Kapil's Warriors (a1)
UPDATE public.teams
SET 
  owner_name = 'Rohit Doshi',
  owner_email = 'rohitdoshicolg@gmail.com'
WHERE id = 'a1';

-- 4. Update handle_new_user_role trigger function to automatically grant owner role to rohitdoshicolg@gmail.com
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count integer;
BEGIN
  -- Rohit Doshi (main admin)
  IF lower(NEW.email) = 'rohit.doshi2007@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    RETURN NEW;
  END IF;

  -- Rohit Doshi Colg (team owner of Kapil's Warriors)
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

-- 5. Retroactively assign owner role if rohitdoshicolg@gmail.com already exists in auth.users
DO $$
DECLARE
  owner_user_record_id uuid;
BEGIN
  SELECT id INTO owner_user_record_id FROM auth.users WHERE lower(email) = 'rohitdoshicolg@gmail.com' LIMIT 1;
  IF owner_user_record_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (owner_user_record_id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.teams
    SET owner_user_id = owner_user_record_id
    WHERE id = 'a1';
  END IF;
END $$;

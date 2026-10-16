-- First just add the enum values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'primary_scorer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secondary_scorer';
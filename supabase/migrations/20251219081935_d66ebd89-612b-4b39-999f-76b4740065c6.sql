-- Add match_type column to match_history table
ALTER TABLE public.match_history 
ADD COLUMN match_type text NOT NULL DEFAULT 'group';

-- Update comment for clarity
COMMENT ON COLUMN public.match_history.match_type IS 'Type of match: group, semi_final_1, semi_final_2, or final';
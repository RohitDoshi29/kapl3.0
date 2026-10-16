-- Enable REPLICA IDENTITY FULL for all tables (needed for UPDATE/DELETE events)
ALTER TABLE public.teams REPLICA IDENTITY FULL;
ALTER TABLE public.match_state REPLICA IDENTITY FULL;
ALTER TABLE public.match_history REPLICA IDENTITY FULL;

-- Add remaining tables to realtime publication (teams already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'match_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_state;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'match_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_history;
  END IF;
END $$;
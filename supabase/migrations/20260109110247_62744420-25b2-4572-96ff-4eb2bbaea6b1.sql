-- Ensure realtime payloads include full rows (esp. for JSON columns)
ALTER TABLE public.match_state REPLICA IDENTITY FULL;
ALTER TABLE public.secondary_match_state REPLICA IDENTITY FULL;

-- Enable realtime on secondary_match_state (match_state/teams/match_history already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'secondary_match_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.secondary_match_state;
  END IF;
END $$;
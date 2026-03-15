
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['tags','task_tags','note_tags','timer_state','user_settings'])
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      -- already added, skip
    END;
  END LOOP;
END $$;

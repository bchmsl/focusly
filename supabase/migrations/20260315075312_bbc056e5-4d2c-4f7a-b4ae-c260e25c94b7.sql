ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS display_mode text NOT NULL DEFAULT 'pomodoro',
  ADD COLUMN IF NOT EXISTS show_seconds boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weather_city text DEFAULT NULL;
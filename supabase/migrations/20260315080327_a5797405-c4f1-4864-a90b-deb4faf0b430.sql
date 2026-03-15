ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS show_pomodoro boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_tasks boolean NOT NULL DEFAULT true;
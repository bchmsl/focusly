ALTER TABLE public.user_settings 
  ADD COLUMN theme_id text NOT NULL DEFAULT 'coral',
  ADD COLUMN color_mode text NOT NULL DEFAULT 'system';
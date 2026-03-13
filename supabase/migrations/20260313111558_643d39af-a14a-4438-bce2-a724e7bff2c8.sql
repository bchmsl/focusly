
CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  focus_duration integer NOT NULL DEFAULT 25,
  short_break_duration integer NOT NULL DEFAULT 5,
  long_break_duration integer NOT NULL DEFAULT 15,
  long_break_interval integer NOT NULL DEFAULT 4,
  auto_start_breaks boolean NOT NULL DEFAULT false,
  auto_start_focus boolean NOT NULL DEFAULT false,
  sound_enabled boolean NOT NULL DEFAULT true,
  sound_volume integer NOT NULL DEFAULT 70,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

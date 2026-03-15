
-- Create notes table
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own notes" ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own notes" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON public.notes FOR DELETE USING (auth.uid() = user_id);

-- Create note_tags junction table
CREATE TABLE public.note_tags (
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

ALTER TABLE public.note_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own note_tags" ON public.note_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.notes WHERE notes.id = note_tags.note_id AND notes.user_id = auth.uid()));

-- Add show_notes setting
ALTER TABLE public.user_settings ADD COLUMN show_notes BOOLEAN NOT NULL DEFAULT true;

-- Add updated_at trigger for notes
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notes
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;

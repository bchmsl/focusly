
ALTER TABLE public.tasks
  ADD COLUMN subtitle text,
  ADD COLUMN body text,
  ADD COLUMN position integer NOT NULL DEFAULT 0;

-- Backfill position based on created_at order per user
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
  FROM public.tasks
)
UPDATE public.tasks SET position = ranked.rn FROM ranked WHERE tasks.id = ranked.id;

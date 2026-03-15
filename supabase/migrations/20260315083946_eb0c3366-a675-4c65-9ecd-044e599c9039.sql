
ALTER TABLE public.user_settings ADD COLUMN card_layout JSONB NOT NULL DEFAULT '{"order":["clock","timer","tasks","notes"],"widths":{"clock":"full","timer":"half","tasks":"half","notes":"full"},"collapsed":[]}';

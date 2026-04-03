-- Add 'special' market type and a custom label column for special markets
ALTER TABLE markets DROP CONSTRAINT IF EXISTS markets_type_check;
ALTER TABLE markets ADD CONSTRAINT markets_type_check
  CHECK (type IN ('winner', 'method', 'has_submission', 'special'));

-- Label for special markets (e.g. "Primeiro a marcar pontos?")
ALTER TABLE markets ADD COLUMN IF NOT EXISTS label text;

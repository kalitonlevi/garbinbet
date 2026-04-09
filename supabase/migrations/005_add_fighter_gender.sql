-- Add gender column to fighters so the public Lutadores page can split
-- the listing into Masculino / Feminino sections.
ALTER TABLE fighters
  ADD COLUMN gender text NOT NULL DEFAULT 'M'
    CHECK (gender IN ('M', 'F'));

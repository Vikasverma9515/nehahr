-- =============================================================
-- 021: Public careers page and apply form
-- =============================================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT false;
-- Auto-screen applicants whose resume match is at least this (0-100); null = off.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS auto_screen_min_match INTEGER;

-- Every org gets a slug for its careers URL (/careers/<slug>).
UPDATE organizations
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(id::text, 1, 6)
WHERE slug IS NULL;

-- Anyone may read published, open jobs (the careers page uses the anon key).
DROP POLICY IF EXISTS "Public can read published jobs" ON jobs;
CREATE POLICY "Public can read published jobs" ON jobs
    FOR SELECT USING (published AND status = 'open');

CREATE OR REPLACE FUNCTION set_org_slug()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.slug IS NULL THEN
        NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(NEW.id::text, 1, 6);
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS set_org_slug ON organizations;
CREATE TRIGGER set_org_slug BEFORE INSERT ON organizations FOR EACH ROW EXECUTE FUNCTION set_org_slug();

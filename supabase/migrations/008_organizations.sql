-- =============================================================
-- 008: Organizations (multi-tenant)
--
-- Every business row now belongs to one organization, and signed-in users
-- only see rows of the organizations they are members of.
--
-- * Existing data is moved into one "Default organization" and every
--   existing user becomes its admin, so nothing disappears on upgrade.
-- * New sign-ups get their own organization automatically.
-- * Inserts that leave org_id empty are filled in: from the parent row
--   (a call inherits its candidate's org) or from the user's first org.
--   That keeps the dashboard's and backend's existing inserts working.
-- * The backend uses the service key (bypasses RLS) and filters by org
--   itself, see app/security.py and app/services/tenancy.py.
-- =============================================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    -- Per-org settings: branding, calling hours, retention, voice choice...
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_members (
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'recruiter'
        CHECK (role IN ('admin', 'recruiter', 'hiring_manager', 'interviewer', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);

CREATE TABLE IF NOT EXISTS org_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'recruiter'
        CHECK (role IN ('admin', 'recruiter', 'hiring_manager', 'interviewer', 'viewer')),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, email)
);

-- ── Membership helpers (SECURITY DEFINER so RLS on org_members can't recurse)

CREATE OR REPLACE FUNCTION is_org_member(target_org UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM org_members WHERE org_id = target_org AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION is_org_admin(target_org UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM org_members
        WHERE org_id = target_org AND user_id = auth.uid() AND role = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION current_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
    ORDER BY created_at LIMIT 1;
$$;

-- ── Backfill: one default org holding all existing data ───────────────

DO $$
DECLARE
    default_org UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM organizations) THEN
        INSERT INTO organizations (name, slug) VALUES ('Default organization', 'default')
        RETURNING id INTO default_org;

        INSERT INTO org_members (org_id, user_id, role)
        SELECT default_org, id, 'admin' FROM auth.users
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ── org_id on every business table ────────────────────────────────────

DO $$
DECLARE
    t TEXT;
    default_org UUID := (SELECT id FROM organizations ORDER BY created_at LIMIT 1);
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'jobs', 'candidates', 'calls', 'interviews', 'interviewers',
        'helpdesk_tickets', 'exit_interviews'
    ] LOOP
        EXECUTE format(
            'ALTER TABLE %I ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizations(id) ON DELETE CASCADE', t);
        EXECUTE format('UPDATE %I SET org_id = %L WHERE org_id IS NULL', t, default_org);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(org_id)', 'idx_' || t || '_org', t);
    END LOOP;
END $$;

-- ── Fill org_id on insert when the caller didn't set it ───────────────

CREATE OR REPLACE FUNCTION set_org_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    -- Read parent ids through jsonb: not every table has these columns.
    parent_candidate UUID := (to_jsonb(NEW)->>'candidate_id')::uuid;
    parent_job UUID := (to_jsonb(NEW)->>'job_id')::uuid;
BEGIN
    -- Child rows inherit from their parent.
    IF NEW.org_id IS NULL AND parent_candidate IS NOT NULL THEN
        SELECT org_id INTO NEW.org_id FROM candidates WHERE id = parent_candidate;
    END IF;
    IF NEW.org_id IS NULL AND parent_job IS NOT NULL THEN
        SELECT org_id INTO NEW.org_id FROM jobs WHERE id = parent_job;
    END IF;
    IF NEW.org_id IS NULL THEN
        NEW.org_id := current_org_id();
    END IF;
    RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'jobs', 'candidates', 'calls', 'interviews', 'interviewers',
        'helpdesk_tickets', 'exit_interviews'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_org_id_%s ON %I', t, t);
        EXECUTE format(
            'CREATE TRIGGER set_org_id_%s BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_org_id()', t, t);
    END LOOP;
END $$;

-- ── Replace the "any signed-in user" policies with org-scoped ones ────

DO $$
DECLARE
    t TEXT;
    p RECORD;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'jobs', 'candidates', 'calls', 'interviews', 'interviewers',
        'helpdesk_tickets', 'exit_interviews'
    ] LOOP
        FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p.policyname, t);
        END LOOP;
        EXECUTE format('CREATE POLICY "Org members can read" ON %I FOR SELECT USING (is_org_member(org_id))', t);
        EXECUTE format('CREATE POLICY "Org members can insert" ON %I FOR INSERT WITH CHECK (is_org_member(org_id))', t);
        EXECUTE format('CREATE POLICY "Org members can update" ON %I FOR UPDATE USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id))', t);
        EXECUTE format('CREATE POLICY "Org members can delete" ON %I FOR DELETE USING (is_org_member(org_id))', t);
    END LOOP;
END $$;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read their org" ON organizations
    FOR SELECT USING (is_org_member(id));
CREATE POLICY "Admins can update their org" ON organizations
    FOR UPDATE USING (is_org_admin(id));

CREATE POLICY "Members can see teammates" ON org_members
    FOR SELECT USING (is_org_member(org_id));
CREATE POLICY "Admins manage members" ON org_members
    FOR ALL USING (is_org_admin(org_id)) WITH CHECK (is_org_admin(org_id));

CREATE POLICY "Admins manage invites" ON org_invites
    FOR ALL USING (is_org_admin(org_id)) WITH CHECK (is_org_admin(org_id));

-- ── New sign-ups: accept a pending invite, or get a fresh org ─────────

CREATE OR REPLACE FUNCTION handle_new_user_org()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    new_org UUID;
    joined_count INTEGER := 0;
BEGIN
    INSERT INTO org_members (org_id, user_id, role)
    SELECT org_id, NEW.id, role FROM org_invites
    WHERE lower(email) = lower(NEW.email) AND accepted_at IS NULL
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS joined_count = ROW_COUNT;

    IF joined_count > 0 THEN
        UPDATE org_invites SET accepted_at = now()
        WHERE lower(email) = lower(NEW.email) AND accepted_at IS NULL;
    ELSE
        INSERT INTO organizations (name)
        VALUES (COALESCE(NULLIF(NEW.raw_user_meta_data->>'company', ''),
                         split_part(NEW.email, '@', 1) || '''s team'))
        RETURNING id INTO new_org;
        INSERT INTO org_members (org_id, user_id, role) VALUES (new_org, NEW.id, 'admin');
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_org ON auth.users;
CREATE TRIGGER on_auth_user_created_org
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_org();

CREATE TRIGGER set_updated_at_organizations
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Teammates with their emails (auth.users isn't readable from the client).
CREATE OR REPLACE FUNCTION org_member_directory()
RETURNS TABLE (user_id UUID, email TEXT, full_name TEXT, role TEXT, joined_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT m.user_id, u.email, p.full_name, m.role, m.created_at
    FROM org_members m
    JOIN auth.users u ON u.id = m.user_id
    LEFT JOIN profiles p ON p.id = m.user_id
    WHERE m.org_id = current_org_id()
    ORDER BY m.created_at;
$$;

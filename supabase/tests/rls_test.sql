-- Tenant isolation checks for migration 008. Fails (non-zero exit) on any mismatch.
\set ON_ERROR_STOP 1
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;

INSERT INTO auth.users (id, email) VALUES
    ('11111111-1111-1111-1111-111111111111', 'alice@a.com'),
    ('22222222-2222-2222-2222-222222222222', 'bob@b.com');

DO $$ BEGIN
    ASSERT (SELECT count(*) FROM org_members m JOIN organizations o ON o.id = m.org_id
            JOIN auth.users u ON u.id = m.user_id
            WHERE u.email = 'existing@a.com' AND o.name = 'Default organization') = 1,
        'existing user should be in the default org';
END $$;

SET ROLE authenticated;
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
INSERT INTO jobs (title) VALUES ('Alice job');
INSERT INTO candidates (name, phone, job_id) SELECT 'Cand A', '+911', id FROM jobs WHERE title = 'Alice job';

SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
DO $$ BEGIN
    ASSERT (SELECT count(*) FROM candidates) = 0, 'bob must not see alice''s candidates';
    ASSERT (SELECT count(*) FROM jobs) = 0, 'bob must not see alice''s jobs';
END $$;
UPDATE candidates SET name = 'hacked';
RESET ROLE;

DO $$ BEGIN
    ASSERT (SELECT name FROM candidates LIMIT 1) = 'Cand A', 'cross-org update must not apply';
END $$;

INSERT INTO calls (candidate_id, call_type) SELECT id, 'screening' FROM candidates LIMIT 1;
DO $$ BEGIN
    ASSERT (SELECT c.org_id = k.org_id FROM calls c JOIN candidates k ON k.id = c.candidate_id LIMIT 1),
        'calls inherit the candidate''s org';
END $$;

INSERT INTO org_invites (org_id, email, role)
SELECT org_id, 'carol@a.com', 'recruiter' FROM org_members
WHERE user_id = '11111111-1111-1111-1111-111111111111';
INSERT INTO auth.users (email) VALUES ('carol@a.com');
DO $$ BEGIN
    ASSERT (SELECT m.role FROM org_members m JOIN auth.users u ON u.id = m.user_id
            WHERE u.email = 'carol@a.com') = 'recruiter', 'invite should be accepted on sign-up';
END $$;

-- Background tasks: a claimed task can't be claimed twice.
INSERT INTO background_tasks (kind) VALUES ('t1');
DO $$ BEGIN
    ASSERT (SELECT count(*) FROM claim_background_tasks('w1', 10)) = 1, 'first claim gets the task';
    ASSERT (SELECT count(*) FROM claim_background_tasks('w2', 10)) = 0, 'second claim gets nothing';
END $$;

SELECT 'all checks passed';

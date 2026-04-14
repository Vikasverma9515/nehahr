-- ============================================
-- Neha HR - Seed Data for Testing
-- Run this AFTER 001_initial_schema.sql
-- Run this in Supabase SQL Editor
-- ============================================

-- NOTE: Profiles are auto-created when you sign up.
-- This seed only creates jobs, candidates, calls,
-- interviews, helpdesk tickets, and exit interviews.

-- ============================================
-- Jobs
-- ============================================
INSERT INTO jobs (id, title, department, location, work_model, role_type, required_skills, salary_range_min, salary_range_max, status, job_description) VALUES
('11111111-1111-1111-1111-111111111111', 'Senior Software Engineer', 'Engineering', 'Mumbai', 'hybrid', 'technical', ARRAY['React', 'Node.js', 'TypeScript', 'PostgreSQL'], 18, 30, 'open', 'Build and maintain our core product platform. Work with a cross-functional team to deliver features end-to-end.'),
('22222222-2222-2222-2222-222222222222', 'Account Manager', 'Sales', 'Delhi', 'office', 'client_facing', ARRAY['CRM', 'Negotiation', 'B2B Sales'], 12, 20, 'open', 'Manage key client accounts and drive upsell opportunities across the portfolio.'),
('33333333-3333-3333-3333-333333333333', 'Engineering Manager', 'Engineering', 'Bangalore', 'hybrid', 'team_handling', ARRAY['People Management', 'Agile', 'System Design'], 30, 45, 'open', 'Lead a team of 8-12 engineers. Own delivery, hiring, and technical direction for the platform team.'),
('44444444-4444-4444-4444-444444444444', 'Product Designer', 'Design', 'Remote', 'remote', 'other', ARRAY['Figma', 'User Research', 'Design Systems'], 15, 25, 'paused', 'Design intuitive interfaces for our AI products. Conduct user research and iterate on designs.');

-- ============================================
-- Candidates
-- ============================================
INSERT INTO candidates (id, job_id, name, email, phone, stage, score, qualification_status, score_breakdown, current_location, employment_status, notice_period_days, current_ctc, expected_ctc, work_model_preference, open_to_relocation, disqualification_reason) VALUES
-- Senior SWE candidates
('aaaa0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Rahul Sharma', 'rahul.sharma@gmail.com', '+919876543001', 'screened', 87, 'qualified', '{"location_fit": 90, "work_model": 100, "notice_period": 80, "ctc_alignment": 85, "role_experience": 90, "salary_trajectory": 80}', 'Mumbai', 'employed', 30, '{"fixed": 16, "variable": 2}', '{"min": 22, "max": 26}', 'hybrid', true, NULL),
('aaaa0002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Priya Patel', 'priya.p@outlook.com', '+919876543002', 'shortlisted', 92, 'qualified', '{"location_fit": 95, "work_model": 100, "notice_period": 90, "ctc_alignment": 90, "role_experience": 95, "salary_trajectory": 85}', 'Pune', 'notice_period', 60, '{"fixed": 20, "variable": 3}', '{"min": 25, "max": 30}', 'hybrid', true, NULL),
('aaaa0003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Amit Kumar', 'amit.k@yahoo.com', '+919876543003', 'scheduled', 78, 'qualified', '{"location_fit": 70, "work_model": 80, "notice_period": 75, "ctc_alignment": 80, "role_experience": 80, "salary_trajectory": 75}', 'Hyderabad', 'employed', 90, '{"fixed": 14, "variable": 1}', '{"min": 20, "max": 24}', 'remote', true, NULL),
('aaaa0004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Sneha Reddy', 'sneha.r@gmail.com', '+919876543004', 'rejected', 42, 'unqualified', '{"location_fit": 30, "work_model": 50, "notice_period": 40, "ctc_alignment": 35, "role_experience": 45, "salary_trajectory": 50}', 'Chennai', 'between_jobs', 0, '{"fixed": 8}', '{"min": 25, "max": 30}', 'office', false, 'CTC expectation significantly above range for experience level'),

-- Account Manager candidates
('aaaa0005-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'Vikram Singh', 'vikram.s@gmail.com', '+919876543005', 'interviewing', 85, 'qualified', '{"location_fit": 100, "work_model": 100, "notice_period": 80, "ctc_alignment": 85, "role_experience": 80, "salary_trajectory": 75}', 'Delhi', 'employed', 30, '{"fixed": 10, "variable": 4}', '{"min": 16, "max": 20}', 'office', false, NULL),
('aaaa0006-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 'Neha Gupta', 'neha.g@gmail.com', '+919876543006', 'offer', 91, 'qualified', '{"location_fit": 100, "work_model": 100, "notice_period": 95, "ctc_alignment": 90, "role_experience": 85, "salary_trajectory": 80}', 'Delhi', 'notice_period', 15, '{"fixed": 12, "variable": 3}', '{"min": 18, "max": 20}', 'office', false, NULL),

-- Engineering Manager candidates
('aaaa0007-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', 'Rajesh Iyer', 'rajesh.i@gmail.com', '+919876543007', 'screening', NULL, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('aaaa0008-0000-0000-0000-000000000008', '33333333-3333-3333-3333-333333333333', 'Deepa Nair', 'deepa.n@gmail.com', '+919876543008', 'new', NULL, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),

-- No job assigned
('aaaa0009-0000-0000-0000-000000000009', NULL, 'Arjun Mehta', 'arjun.m@gmail.com', '+919876543009', 'new', NULL, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('aaaa0010-0000-0000-0000-000000000010', NULL, 'Kavita Joshi', 'kavita.j@gmail.com', '+919876543010', 'new', NULL, 'pending', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- ============================================
-- Calls
-- ============================================
INSERT INTO calls (id, candidate_id, call_type, status, duration_seconds, direction, transcript, ai_summary, extracted_data, started_at, ended_at) VALUES
-- Rahul's screening call
('bbbb0001-0000-0000-0000-000000000001', 'aaaa0001-0000-0000-0000-000000000001', 'screening', 'completed', 480,  'outbound',
 'Neha: Hi, am I speaking with Rahul Sharma? This is Neha calling from SalesCode...\nRahul: Yes, hi Neha.\nNeha: Great! I''m calling about the Senior Software Engineer position...\nRahul: Yes, I''m interested.\nNeha: Which city are you based in?\nRahul: I''m in Mumbai.\nNeha: Are you open to relocation?\nRahul: Yes, within India.\nNeha: What''s your current CTC?\nRahul: 18 LPA, 16 fixed and 2 variable.\nNeha: And expected?\nRahul: Looking for 22-26 range.\nNeha: What''s your notice period?\nRahul: 30 days.\nNeha: Thank you Rahul, your profile looks strong. Our recruiter will follow up within 2-3 days.',
 'Rahul is a strong candidate — Mumbai-based, 30-day notice, currently at 18 LPA seeking 22-26. Open to relocation. Hybrid preference aligns with role. Qualified with score 87.',
 '{"current_location": "Mumbai", "open_to_relocation": true, "work_model_preference": "hybrid", "employment_status": "employed", "notice_period_days": 30, "current_ctc": {"fixed": 16, "variable": 2}, "expected_ctc": {"min": 22, "max": 26}}',
 now() - interval '3 days', now() - interval '3 days' + interval '8 minutes'),

-- Priya's screening call
('bbbb0002-0000-0000-0000-000000000002', 'aaaa0002-0000-0000-0000-000000000002', 'screening', 'completed', 540, 'outbound',
 'Neha: Hi Priya, this is Neha from SalesCode...\nPriya: Hi! Yes, I applied for the SWE role.\nNeha: Which city are you based in?\nPriya: Pune, but happy to relocate.\nNeha: What''s your current CTC and expected?\nPriya: 23 LPA currently, looking for 25-30.\nNeha: Notice period?\nPriya: 60 days, currently serving notice actually.\nNeha: Excellent. Your profile is a great fit!',
 'Priya is an excellent candidate — Pune-based, already serving notice (60 days), 23 LPA current, seeking 25-30. Strong technical background with React/Node. Score 92 — top candidate for this role.',
 '{"current_location": "Pune", "open_to_relocation": true, "work_model_preference": "hybrid", "employment_status": "notice_period", "notice_period_days": 60, "current_ctc": {"fixed": 20, "variable": 3}, "expected_ctc": {"min": 25, "max": 30}}',
 now() - interval '2 days', now() - interval '2 days' + interval '9 minutes'),

-- Sneha's screening call (rejected)
('bbbb0003-0000-0000-0000-000000000003', 'aaaa0004-0000-0000-0000-000000000004', 'screening', 'completed', 360, 'outbound',
 'Neha: Hi Sneha, this is Neha from SalesCode...\nSneha: Hi.\nNeha: I''m calling about the Senior SWE role. Are you still interested?\nSneha: Yes.\nNeha: What''s your current CTC?\nSneha: I was at 8 LPA at my last job.\nNeha: And expected CTC?\nSneha: 25-30 LPA.\nNeha: Thank you Sneha. Based on our conversation, there''s a gap between the current experience level and what this role requires. We''ll keep your profile on file.',
 'Sneha did not qualify — significant CTC gap (8 LPA current vs 25-30 expected), limited production experience, not open to relocation. Politely closed with reason.',
 '{"current_location": "Chennai", "open_to_relocation": false, "employment_status": "between_jobs", "current_ctc": {"fixed": 8}, "expected_ctc": {"min": 25, "max": 30}}',
 now() - interval '3 days', now() - interval '3 days' + interval '6 minutes'),

-- Priya's scheduling call
('bbbb0004-0000-0000-0000-000000000004', 'aaaa0002-0000-0000-0000-000000000002', 'scheduling', 'completed', 180, 'outbound',
 'Neha: Hi Priya, good news! We''d like to schedule your interview. I have slots on Tuesday at 2 PM, Wednesday at 10 AM, or Thursday at 3 PM.\nPriya: Wednesday at 10 AM works perfectly.\nNeha: Confirmed — Wednesday at 10 AM, video call. You''ll receive a Google Meet link.',
 'Interview scheduled for Wednesday 10 AM — video round with the engineering lead.',
 '{"confirmed_slot": "Wednesday 10:00 AM", "interview_type": "video"}',
 now() - interval '1 day', now() - interval '1 day' + interval '3 minutes'),

-- Vikram's reminder call
('bbbb0005-0000-0000-0000-000000000005', 'aaaa0005-0000-0000-0000-000000000005', 'reminder_candidate', 'completed', 120, 'outbound',
 'Neha: Hi Vikram, just a reminder about your interview today at 3 PM with Anil from the sales team.\nVikram: Yes, I''m all set. Thanks for the reminder!\nNeha: Great, best of luck!',
 'Vikram confirmed attendance for his 3 PM interview. All set.',
 NULL,
 now() - interval '5 hours', now() - interval '5 hours' + interval '2 minutes'),

-- Failed call
('bbbb0006-0000-0000-0000-000000000006', 'aaaa0009-0000-0000-0000-000000000009', 'screening', 'no_answer', NULL, 'outbound',
 NULL, NULL, NULL,
 now() - interval '1 hour', now() - interval '1 hour'),

-- Rajesh's ongoing screening
('bbbb0007-0000-0000-0000-000000000007', 'aaaa0007-0000-0000-0000-000000000007', 'screening', 'in_progress', NULL, 'outbound',
 'Neha: Hi Rajesh, this is Neha from SalesCode...', NULL, NULL,
 now() - interval '5 minutes', NULL);

-- ============================================
-- Interviews
-- ============================================
INSERT INTO interviews (id, candidate_id, job_id, round_number, interviewer_name, interviewer_email, interview_type, scheduled_at, status, feedback_status, feedback, result, result_communicated, candidate_reminded, interviewer_reminded) VALUES
-- Priya's interview (upcoming)
('cccc0001-0000-0000-0000-000000000001', 'aaaa0002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 1, 'Anil Kapoor', 'anil@salescode.ai', 'video', now() + interval '2 days', 'scheduled', 'pending', NULL, NULL, false, false, false),

-- Amit's interview (upcoming)
('cccc0002-0000-0000-0000-000000000002', 'aaaa0003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 1, 'Sanjay Mehta', 'sanjay@salescode.ai', 'video', now() + interval '3 days', 'scheduled', 'pending', NULL, NULL, false, false, false),

-- Vikram's interview (completed with feedback)
('cccc0003-0000-0000-0000-000000000003', 'aaaa0005-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 1, 'Anil Kapoor', 'anil@salescode.ai', 'in_person', now() - interval '2 days', 'completed', 'submitted', '{"technical": 4, "communication": 5, "culture_fit": 4, "overall": 4, "recommendation": "yes", "strengths": "Strong client relationships, excellent communication", "concerns": "Could improve on CRM tooling"}', 'pass', true, true, true),

-- Vikram's round 2 (upcoming)
('cccc0004-0000-0000-0000-000000000004', 'aaaa0005-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 2, 'Prateek Shah', 'prateek@salescode.ai', 'video', now() + interval '1 day', 'scheduled', 'pending', NULL, NULL, false, false, false),

-- Neha Gupta's completed interviews
('cccc0005-0000-0000-0000-000000000005', 'aaaa0006-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 1, 'Anil Kapoor', 'anil@salescode.ai', 'in_person', now() - interval '7 days', 'completed', 'submitted', '{"technical": 4, "communication": 5, "culture_fit": 5, "overall": 5, "recommendation": "strong_yes"}', 'pass', true, true, true),
('cccc0006-0000-0000-0000-000000000006', 'aaaa0006-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', 2, 'Prateek Shah', 'prateek@salescode.ai', 'video', now() - interval '4 days', 'completed', 'submitted', '{"technical": 5, "communication": 5, "culture_fit": 5, "overall": 5, "recommendation": "strong_yes"}', 'pass', true, true, true);

-- ============================================
-- Helpdesk Tickets
-- ============================================
INSERT INTO helpdesk_tickets (employee_name, employee_phone, employee_email, bucket, query_text, status, escalated_to, resolution) VALUES
('Rohit Verma', '+919876543020', 'rohit@salescode.ai', 'payroll', 'My April salary slip shows incorrect HRA amount. Can you check?', 'escalated', 'Payroll & Finance team', NULL),
('Anita Das', '+919876543021', 'anita@salescode.ai', 'time_attendance', 'I need to regularize attendance for March 28 — I was working from home but it shows absent.', 'resolved', NULL, 'Attendance regularized for March 28. Marked as WFH.'),
('Karan Malhotra', '+919876543022', 'karan@salescode.ai', 'it_helpdesk', 'VPN not connecting since yesterday. Getting timeout errors.', 'open', NULL, NULL),
('Meera Krishnan', '+919876543023', 'meera@salescode.ai', 'hr_documentation', 'Need my experience letter — last day is April 30.', 'open', NULL, NULL);

-- ============================================
-- Exit Interviews
-- ============================================
INSERT INTO exit_interviews (employee_name, employee_email, reason_for_leaving, manager_rating, team_rating, culture_rating, suggestions, tags, summary) VALUES
('Siddharth Rao', 'sid@salescode.ai', 'Got a better offer with 40% hike. Current role had limited growth.', 3, 4, 4, 'More transparent promotion criteria would help. Also, the remote work policy could be more flexible.', ARRAY['compensation', 'growth', 'remote_work'], 'Siddharth left primarily for compensation — 40% hike. Rated manager 3/5 (limited mentorship), team 4/5, culture 4/5. Suggests clearer promotion paths and flexible remote policy.'),
('Pooja Bhatt', 'pooja@salescode.ai', 'Relocating to Bangalore for personal reasons. No roles available there.', 5, 5, 4, 'Would love if the company had a Bangalore office or allowed full remote.', ARRAY['relocation', 'remote_work'], 'Pooja left due to relocation — not a dissatisfaction issue. Very positive about manager (5/5) and team (5/5). Suggests Bangalore presence or full remote option.');

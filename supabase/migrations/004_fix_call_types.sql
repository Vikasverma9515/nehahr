-- Fix: add 'reminder' as an accepted call_type (code uses 'reminder',
-- original schema only had 'reminder_candidate' and 'reminder_interviewer')
ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_call_type_check;
ALTER TABLE calls ADD CONSTRAINT calls_call_type_check CHECK (call_type IN (
    'screening', 'scheduling',
    'reminder', 'reminder_candidate', 'reminder_interviewer',
    'result', 'pre_joining', 'engagement', 'exit', 'helpdesk', 'pulse_check'
));

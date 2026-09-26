import { FeedbackForm } from "./feedback-form";

const BACKEND_URL = process.env.BACKEND_API_URL || "http://localhost:8000";

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Fetch interview context from the public endpoint
  let data: {
    already_submitted: boolean;
    interview_id?: string;
    candidate_name?: string;
    job_title?: string;
    interview_type?: string;
    scheduled_at?: string;
    ai_draft?: { strengths: string; concerns: string; notes: string } | null;
  };

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/interviews/feedback-form/${token}`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      return <ErrorPage message="This feedback link is invalid or has expired." />;
    }
    data = await res.json();
  } catch {
    return <ErrorPage message="Could not connect to the server. Please try again." />;
  }

  if (data.already_submitted) {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#7dd4a8]/10">
            <svg className="h-8 w-8 text-[#7dd4a8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-[20px] font-bold text-dark-text">Feedback already submitted</h1>
          <p className="mt-2 text-[14px] text-dark-text-secondary">
            Thank you — your feedback for this interview has been recorded.
          </p>
        </div>
      </Shell>
    );
  }

  const scheduledAt = data.scheduled_at ? new Date(data.scheduled_at) : null;

  return (
    <Shell>
      <div className="mb-6 text-center">
        <h1 className="text-[20px] font-bold text-dark-text">Interview Feedback</h1>
        <p className="mt-1 text-[14px] text-dark-text-secondary">
          {data.candidate_name} — {data.job_title}
        </p>
        {scheduledAt && (
          <p className="mt-0.5 text-[12px] text-dark-text-muted">
            {scheduledAt.toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}{" "}
            ·{" "}
            {scheduledAt.toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
      <FeedbackForm token={token} candidateName={data.candidate_name || "Candidate"} draft={data.ai_draft || null} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090d] px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#111116] p-8">
        {children}
      </div>
    </div>
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <Shell>
      <div className="text-center">
        <h1 className="text-[20px] font-bold text-dark-text">Link expired</h1>
        <p className="mt-2 text-[14px] text-dark-text-secondary">{message}</p>
      </div>
    </Shell>
  );
}

import { getPublicInterview } from "@/app/actions/ai-interviews";
import { InterviewRoom } from "@/app/components/interview-room/interview-room";
import { LogoMark } from "@/app/components/logo";

export const metadata = { title: "Your interview · Neha" };

export default async function InterviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await getPublicInterview(token);

  return (
    <main className="min-h-screen bg-[#0a0a0f] px-4 py-6 text-dark-text sm:px-8">
      <header className="mx-auto mb-6 flex max-w-6xl items-center gap-2.5">
        <LogoMark className="h-8 w-8" />
        <span className="text-[15px] font-bold">{info?.company || "Neha"}</span>
        <span className="text-[12px] text-dark-text-muted">· Interview</span>
      </header>
      <div className="mx-auto max-w-6xl">
        {!info ? (
          <Message title="This link isn't valid" body="Please check the link in your email, or reply to it and the recruiting team will help." />
        ) : info.status === "completed" ? (
          <Message title="You're all done" body="Thanks for your time. The hiring team will review your interview and get back to you." />
        ) : info.status === "expired" || info.status === "cancelled" ? (
          <Message title="This interview link has expired" body="Reply to the invitation email and the recruiting team can send you a new one." />
        ) : (
          <InterviewRoom token={token} info={info} />
        )}
      </div>
    </main>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="card-glass mx-auto mt-16 max-w-lg rounded-2xl p-8 text-center">
      <h1 className="font-display text-[24px]">{title}</h1>
      <p className="mt-3 text-[14px] text-dark-text-secondary">{body}</p>
    </div>
  );
}

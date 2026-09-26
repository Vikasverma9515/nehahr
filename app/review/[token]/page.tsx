import { getReviewPage } from "@/app/actions/reviews";
import { ReviewBoard } from "@/app/components/review-board";
import { LogoMark } from "@/app/components/logo";

export const metadata = { title: "Candidate review · Neha" };

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { page, error } = await getReviewPage(token);
  return (
    <main className="min-h-screen bg-[#0a0a0f] px-4 py-6 text-dark-text sm:px-8">
      <header className="mx-auto mb-6 flex max-w-5xl items-center gap-2.5">
        <LogoMark className="h-8 w-8" />
        <span className="text-[15px] font-bold">Candidate review</span>
        {page?.job_title && <span className="text-[12px] text-dark-text-muted">· {page.job_title}</span>}
      </header>
      <div className="mx-auto max-w-5xl">
        {page ? <ReviewBoard token={token} page={page} /> : (
          <div className="card-glass rounded-2xl p-8 text-center">
            <h1 className="font-display text-[22px]">{error || "This link isn't valid"}</h1>
            <p className="mt-2 text-[14px] text-dark-text-secondary">Ask the recruiter to send a new link.</p>
          </div>
        )}
      </div>
    </main>
  );
}

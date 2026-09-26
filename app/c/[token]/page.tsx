import { getPortal } from "@/app/actions/portal";
import { CandidatePortal } from "@/app/components/candidate-portal";
import { LogoMark } from "@/app/components/logo";

export const metadata = { title: "Your application · Neha" };

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await getPortal(token);
  return (
    <main className="min-h-screen bg-[#0a0a0f] px-4 py-6 text-dark-text sm:px-8">
      <header className="mx-auto mb-6 flex max-w-2xl items-center gap-2.5">
        <LogoMark className="h-8 w-8" />
        <span className="text-[15px] font-bold">{info?.company || "Neha"}</span>
        <span className="text-[12px] text-dark-text-muted">· Your application</span>
      </header>
      <div className="mx-auto max-w-2xl">
        {info ? (
          <CandidatePortal token={token} info={info} />
        ) : (
          <div className="card-glass rounded-2xl p-8 text-center">
            <h1 className="font-display text-[22px]">This link isn&apos;t valid</h1>
            <p className="mt-2 text-[14px] text-dark-text-secondary">Check the link in your message, or reply to it and we&apos;ll help.</p>
          </div>
        )}
      </div>
    </main>
  );
}

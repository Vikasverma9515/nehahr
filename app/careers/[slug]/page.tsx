import Link from "next/link";
import { getCareers } from "@/app/actions/careers";
import { LogoMark } from "@/app/components/logo";

export default async function CareersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getCareers(slug);
  return (
    <main className="min-h-screen bg-[#0a0a0f] px-4 py-8 text-dark-text sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center gap-2.5">
          <LogoMark className="h-8 w-8" />
          <span className="text-[16px] font-bold">{data?.company || "Careers"}</span>
        </header>
        {!data ? (
          <p className="text-[14px] text-dark-text-secondary">This careers page doesn&apos;t exist.</p>
        ) : (
          <>
            <h1 className="font-display text-[32px]">Open roles at {data.company}</h1>
            <p className="mt-2 text-[14px] text-dark-text-secondary">
              Apply in two minutes. Our AI recruiter Neha will call you for a short chat, usually the same day.
            </p>
            <div className="mt-8 space-y-3">
              {data.jobs.length === 0 && <p className="text-[14px] text-dark-text-muted">No open roles right now. Check back soon.</p>}
              {data.jobs.map((j) => (
                <Link key={j.id} href={`/careers/${slug}/${j.id}`}
                  className="card-glass block rounded-2xl p-5 transition hover:border-accent/40">
                  <p className="text-[16px] font-semibold text-dark-text">{j.title}</p>
                  <p className="mt-1 text-[13px] text-dark-text-muted">
                    {[j.department, j.location, j.work_model].filter(Boolean).join(" · ")}
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

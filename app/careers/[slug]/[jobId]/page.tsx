import Link from "next/link";
import { getCareerJob } from "@/app/actions/careers";
import { ApplyForm } from "@/app/components/apply-form";
import { LogoMark } from "@/app/components/logo";

export default async function CareerJobPage({ params }: { params: Promise<{ slug: string; jobId: string }> }) {
  const { slug, jobId } = await params;
  const data = await getCareerJob(slug, jobId);
  return (
    <main className="min-h-screen bg-[#0a0a0f] px-4 py-8 text-dark-text sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-center gap-2.5">
          <LogoMark className="h-8 w-8" />
          <Link href={`/careers/${slug}`} className="text-[16px] font-bold">{data?.company || "Careers"}</Link>
        </header>
        {!data ? (
          <p className="text-[14px] text-dark-text-secondary">This role is no longer open.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[1fr_320px]">
            <article>
              <h1 className="font-display text-[30px]">{data.job.title}</h1>
              <p className="mt-2 text-[13px] text-dark-text-muted">
                {[data.job.department, data.job.location, data.job.work_model].filter(Boolean).join(" · ")}
                {data.job.salary_range_max ? ` · ₹${data.job.salary_range_min}–${data.job.salary_range_max} LPA` : ""}
              </p>
              {data.job.required_skills?.length ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {data.job.required_skills.map((s) => (
                    <span key={s} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] text-dark-text-secondary">{s}</span>
                  ))}
                </div>
              ) : null}
              <div className="mt-6 whitespace-pre-wrap text-[14px] leading-relaxed text-dark-text-secondary">
                {data.job.job_description || "Details coming soon."}
              </div>
            </article>
            <ApplyForm slug={slug} jobId={jobId} company={data.company} />
          </div>
        )}
      </div>
    </main>
  );
}

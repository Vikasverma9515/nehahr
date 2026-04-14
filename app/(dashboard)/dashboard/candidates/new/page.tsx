import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/app/components/ui/page-header";

async function createCandidate(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.from("candidates").insert({
    name: formData.get("name") as string,
    email: (formData.get("email") as string) || null,
    phone: formData.get("phone") as string,
    job_id: (formData.get("job_id") as string) || null,
  });
  if (error) throw new Error(error.message);
  redirect("/dashboard/candidates");
}

export default async function NewCandidatePage() {
  const supabase = await createClient();
  const { data: jobs } = await supabase.from("jobs").select("id, title").eq("status", "open");

  return (
    <>
      <PageHeader title="Add Candidate" description="Add a new candidate to the pipeline" />
      <div className="card-glass max-w-lg rounded-2xl p-6">
        <form action={createCandidate} className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-[12px] font-normal uppercase tracking-[0.1em] text-dark-text-muted">Full Name *</label>
            <input id="name" name="name" type="text" required className="mt-2 block w-full rounded-xl px-4 py-2.5 text-[13px]" />
          </div>
          <div>
            <label htmlFor="phone" className="block text-[12px] font-normal uppercase tracking-[0.1em] text-dark-text-muted">Phone Number *</label>
            <input id="phone" name="phone" type="tel" required placeholder="+91 9876543210" className="mt-2 block w-full rounded-xl px-4 py-2.5 text-[13px]" />
          </div>
          <div>
            <label htmlFor="email" className="block text-[12px] font-normal uppercase tracking-[0.1em] text-dark-text-muted">Email</label>
            <input id="email" name="email" type="email" className="mt-2 block w-full rounded-xl px-4 py-2.5 text-[13px]" />
          </div>
          <div>
            <label htmlFor="job_id" className="block text-[12px] font-normal uppercase tracking-[0.1em] text-dark-text-muted">Job</label>
            <select id="job_id" name="job_id" className="mt-2 block w-full rounded-xl px-4 py-2.5 text-[13px]">
              <option value="">Select a job (optional)</option>
              {jobs?.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white">Add Candidate</button>
            <a href="/dashboard/candidates" className="rounded-xl border border-white/[0.08] px-5 py-2.5 text-[13px] font-medium text-dark-text-secondary hover:bg-white/[0.04] transition-all">Cancel</a>
          </div>
        </form>
      </div>
    </>
  );
}

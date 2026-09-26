import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/app/components/ui/page-header";

async function createCandidate(formData: FormData) {
  "use server";
  const supabase = await createClient();

  const currentCtc = formData.get("current_ctc") as string;
  const expectedCtc = formData.get("expected_ctc") as string;
  const noticePeriod = formData.get("notice_period_days") as string;

  const { error } = await supabase.from("candidates").insert({
    name: formData.get("name") as string,
    email: (formData.get("email") as string) || null,
    phone: formData.get("phone") as string,
    job_id: (formData.get("job_id") as string) || null,
    current_location: (formData.get("current_location") as string) || null,
    experience_years: formData.get("experience_years") ? Number(formData.get("experience_years")) : null,
    current_ctc: currentCtc ? Number(currentCtc) : null,
    expected_ctc: expectedCtc ? Number(expectedCtc) : null,
    notice_period_days: noticePeriod ? Number(noticePeriod) : null,
    preferred_work_model: (formData.get("preferred_work_model") as string) || null,
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
      <div className="max-w-2xl">
        <form action={createCandidate}>
          <div className="card-glass space-y-5 rounded-2xl p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-text-muted">
              Basic Info
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="name" className="block text-[12px] font-medium text-dark-text-secondary">
                  Full Name <span className="text-[#e8908a]">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoFocus
                  className="mt-1.5 block w-full rounded-xl px-4 py-2.5 text-[13px]"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-[12px] font-medium text-dark-text-secondary">
                  Phone <span className="text-[#e8908a]">*</span>
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  className="mt-1.5 block w-full rounded-xl px-4 py-2.5 text-[13px]"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-[12px] font-medium text-dark-text-secondary">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="mt-1.5 block w-full rounded-xl px-4 py-2.5 text-[13px]"
                />
              </div>

              <div>
                <label htmlFor="job_id" className="block text-[12px] font-medium text-dark-text-secondary">
                  Job Position
                </label>
                <select
                  id="job_id"
                  name="job_id"
                  className="mt-1.5 block w-full rounded-xl px-4 py-2.5 text-[13px]"
                >
                  <option value="">Select a job (optional)</option>
                  {jobs?.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="current_location" className="block text-[12px] font-medium text-dark-text-secondary">
                  Current Location
                </label>
                <input
                  id="current_location"
                  name="current_location"
                  type="text"
                  placeholder="e.g. Bangalore"
                  className="mt-1.5 block w-full rounded-xl px-4 py-2.5 text-[13px]"
                />
              </div>
            </div>
          </div>

          <div className="card-glass mt-4 space-y-5 rounded-2xl p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-text-muted">
              Experience & Compensation
            </p>
            <p className="text-[11px] text-dark-text-muted">
              Optional — helps Neha score and shortlist candidates automatically.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="experience_years" className="block text-[12px] font-medium text-dark-text-secondary">
                  Years of Experience
                </label>
                <input
                  id="experience_years"
                  name="experience_years"
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  placeholder="e.g. 5"
                  className="mt-1.5 block w-full rounded-xl px-4 py-2.5 text-[13px]"
                />
              </div>

              <div>
                <label htmlFor="preferred_work_model" className="block text-[12px] font-medium text-dark-text-secondary">
                  Work Model Preference
                </label>
                <select
                  id="preferred_work_model"
                  name="preferred_work_model"
                  className="mt-1.5 block w-full rounded-xl px-4 py-2.5 text-[13px]"
                >
                  <option value="">Not specified</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                </select>
              </div>

              <div>
                <label htmlFor="current_ctc" className="block text-[12px] font-medium text-dark-text-secondary">
                  Current CTC (₹ LPA)
                </label>
                <input
                  id="current_ctc"
                  name="current_ctc"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 12"
                  className="mt-1.5 block w-full rounded-xl px-4 py-2.5 text-[13px]"
                />
              </div>

              <div>
                <label htmlFor="expected_ctc" className="block text-[12px] font-medium text-dark-text-secondary">
                  Expected CTC (₹ LPA)
                </label>
                <input
                  id="expected_ctc"
                  name="expected_ctc"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 15"
                  className="mt-1.5 block w-full rounded-xl px-4 py-2.5 text-[13px]"
                />
              </div>

              <div>
                <label htmlFor="notice_period_days" className="block text-[12px] font-medium text-dark-text-secondary">
                  Notice Period (days)
                </label>
                <input
                  id="notice_period_days"
                  name="notice_period_days"
                  type="number"
                  min="0"
                  max="180"
                  placeholder="e.g. 30"
                  className="mt-1.5 block w-full rounded-xl px-4 py-2.5 text-[13px]"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="submit"
              className="btn-primary rounded-xl px-6 py-2.5 text-[13px] font-semibold text-white"
            >
              Add Candidate
            </button>
            <a
              href="/dashboard/candidates"
              className="rounded-xl border border-white/[0.08] px-5 py-2.5 text-[13px] font-medium text-dark-text-secondary transition-all hover:bg-white/[0.04]"
            >
              Cancel
            </a>
          </div>
        </form>
      </div>
    </>
  );
}

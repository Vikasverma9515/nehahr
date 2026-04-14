import { createClient } from "@/app/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/app/components/ui/page-header";

async function createJob(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const skills = (formData.get("required_skills") as string).split(",").map((s) => s.trim()).filter(Boolean);
  const { error } = await supabase.from("jobs").insert({
    title: formData.get("title") as string,
    department: (formData.get("department") as string) || null,
    location: (formData.get("location") as string) || null,
    work_model: (formData.get("work_model") as string) || null,
    role_type: (formData.get("role_type") as string) || null,
    job_description: (formData.get("job_description") as string) || null,
    required_skills: skills.length > 0 ? skills : null,
    salary_range_min: formData.get("salary_min") ? Number(formData.get("salary_min")) : null,
    salary_range_max: formData.get("salary_max") ? Number(formData.get("salary_max")) : null,
    default_interviewer_id: (formData.get("default_interviewer_id") as string) || null,
    default_interview_type: (formData.get("default_interview_type") as string) || "video",
    default_interview_duration_minutes: formData.get("default_duration") ? Number(formData.get("default_duration")) : 60,
    total_interview_rounds: formData.get("total_rounds") ? Number(formData.get("total_rounds")) : 1,
  });
  if (error) throw new Error(error.message);
  redirect("/dashboard/jobs");
}

export default async function NewJobPage() {
  const supabase = await createClient();
  const { data: interviewers } = await supabase
    .from("interviewers")
    .select("id, name, email")
    .eq("is_active", true)
    .order("name");

  const labelClass = "block text-[12px] font-normal uppercase tracking-[0.1em] text-dark-text-muted";
  const inputClass = "mt-2 block w-full rounded-xl px-4 py-2.5 text-[13px]";

  return (
    <>
      <PageHeader title="Create Job" description="Add a new open position" />
      <div className="card-glass max-w-lg rounded-2xl p-6">
        <form action={createJob} className="space-y-5">
          <div><label htmlFor="title" className={labelClass}>Job Title *</label><input id="title" name="title" type="text" required placeholder="Senior Software Engineer" className={inputClass} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label htmlFor="department" className={labelClass}>Department</label><input id="department" name="department" type="text" placeholder="Engineering" className={inputClass} /></div>
            <div><label htmlFor="location" className={labelClass}>Location</label><input id="location" name="location" type="text" placeholder="Mumbai" className={inputClass} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label htmlFor="work_model" className={labelClass}>Work Model</label><select id="work_model" name="work_model" className={inputClass}><option value="">Select</option><option value="office">Office</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></div>
            <div><label htmlFor="role_type" className={labelClass}>Role Type</label><select id="role_type" name="role_type" className={inputClass}><option value="">Select</option><option value="technical">Technical</option><option value="client_facing">Client Facing</option><option value="team_handling">Team Handling</option><option value="other">Other</option></select></div>
          </div>
          <div><label htmlFor="required_skills" className={labelClass}>Required Skills (comma-separated)</label><input id="required_skills" name="required_skills" type="text" placeholder="React, Node.js" className={inputClass} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label htmlFor="salary_min" className={labelClass}>Salary Min (LPA)</label><input id="salary_min" name="salary_min" type="number" className={inputClass} /></div>
            <div><label htmlFor="salary_max" className={labelClass}>Salary Max (LPA)</label><input id="salary_max" name="salary_max" type="number" className={inputClass} /></div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
            <p className="text-[11px] font-normal uppercase tracking-[0.1em] text-dark-text-muted">Interview Defaults</p>
            <div>
              <label htmlFor="default_interviewer_id" className={labelClass}>Default Interviewer</label>
              <select id="default_interviewer_id" name="default_interviewer_id" className={inputClass}>
                <option value="">None (HR will pick manually)</option>
                {interviewers?.map((i) => (
                  <option key={i.id} value={i.id}>{i.name} ({i.email})</option>
                ))}
              </select>
              {(!interviewers || interviewers.length === 0) && (
                <p className="mt-1 text-[11px] text-dark-text-muted">
                  Add interviewers in Settings first.
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="default_interview_type" className={labelClass}>Format</label>
                <select id="default_interview_type" name="default_interview_type" className={inputClass} defaultValue="video">
                  <option value="video">Video (Google Meet)</option>
                  <option value="in_person">In person</option>
                  <option value="phone">Phone</option>
                </select>
              </div>
              <div>
                <label htmlFor="default_duration" className={labelClass}>Duration (min)</label>
                <input id="default_duration" name="default_duration" type="number" defaultValue={60} className={inputClass} />
              </div>
              <div>
                <label htmlFor="total_rounds" className={labelClass}>Total Rounds</label>
                <input id="total_rounds" name="total_rounds" type="number" min={1} max={5} defaultValue={1} className={inputClass} />
              </div>
            </div>
          </div>

          <div><label htmlFor="job_description" className={labelClass}>Job Description</label><textarea id="job_description" name="job_description" rows={4} placeholder="Describe the role..." className={inputClass} /></div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white">Create Job</button>
            <a href="/dashboard/jobs" className="rounded-xl border border-white/[0.08] px-5 py-2.5 text-[13px] font-medium text-dark-text-secondary hover:bg-white/[0.04] transition-all">Cancel</a>
          </div>
        </form>
      </div>
    </>
  );
}

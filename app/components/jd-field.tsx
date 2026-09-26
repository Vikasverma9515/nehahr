"use client";

import { useRef, useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { draftJobDescription } from "@/app/actions/jd";

/** Job description textarea with "Write with AI" from the rest of the form. */
export function JdField({ labelClass, inputClass }: { labelClass: string; inputClass: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const draft = () => {
    const form = ref.current?.form;
    if (!form) return;
    const get = (n: string) => ((form.elements.namedItem(n) as HTMLInputElement | null)?.value || "").trim();
    const title = get("title");
    if (!title) return setError("Add a job title first");
    setError(null);
    startTransition(async () => {
      const min = get("salary_min"), max = get("salary_max");
      const res = await draftJobDescription({
        title, notes: ref.current?.value || "", location: get("location"), workModel: get("work_model"),
        skills: get("required_skills"), salary: min && max ? `${min}-${max} LPA` : "",
      });
      if (res.error) setError(res.error);
      else if (ref.current && res.description) ref.current.value = res.description;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor="job_description" className={labelClass}>Job Description</label>
        <button type="button" onClick={draft} disabled={pending}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent disabled:opacity-50">
          <Sparkles className="h-3 w-3" /> {pending ? "Writing..." : "Write with AI"}
        </button>
      </div>
      <textarea ref={ref} id="job_description" name="job_description" rows={pending ? 4 : 8}
        placeholder="Jot rough notes (must-haves, team, why this role matters), then 'Write with AI'..." className={inputClass} />
      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
    </div>
  );
}

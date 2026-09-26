import { createClient } from "@/app/lib/supabase/server";
import { PageHeader } from "@/app/components/ui/page-header";
import { Playground } from "@/app/components/playground/playground";

export default async function PlaygroundPage() {
  const supabase = await createClient();
  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, name, jobs(title)")
    .order("created_at", { ascending: false })
    .limit(200);

  const options = (candidates || []).map((c) => {
    const job = Array.isArray(c.jobs) ? c.jobs[0] : c.jobs;
    return { id: c.id as string, name: c.name as string, job: (job?.title as string) || "" };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Playground"
        description="Talk to Neha in your browser. Test any call type against a real candidate profile; nothing changes on their record."
      />
      <Playground candidates={options} />
    </div>
  );
}

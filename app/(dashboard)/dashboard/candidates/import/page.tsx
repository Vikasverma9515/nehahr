import { createClient } from "@/app/lib/supabase/server";
import { PageHeader } from "@/app/components/ui/page-header";
import { ImportPanels } from "@/app/components/import-panels";

export default async function ImportCandidatesPage() {
  const supabase = await createClient();
  const { data: jobs } = await supabase.from("jobs").select("id, title").eq("status", "open").order("created_at", { ascending: false });
  return (
    <>
      <PageHeader
        title="Import candidates"
        description="Bring in a sheet or a folder of resumes. Duplicates (same phone or email) are skipped."
      />
      <ImportPanels jobs={(jobs || []) as { id: string; title: string }[]} />
    </>
  );
}

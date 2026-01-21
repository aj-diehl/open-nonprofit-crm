import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import { Card } from "@/components/ui/card";
import { UsersTable } from "./ui";

export default async function UsersAdminPage() {
  const viewer = await getViewer();
  if (viewer?.profile?.role !== "executive") {
    return (
      <Card className="p-6">
        <div className="font-medium">Not authorized</div>
        <div className="mt-2 text-sm text-slate-600">Only executives can manage user approvals.</div>
      </Card>
    );
  }

  const supabase = createSupabaseServerClient();
  const orgId = viewer?.profile?.org_id;

  const { data: users } = await supabase
    .from("profiles")
    .select("id, username, display_name, contact_email, role, status, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-slate-600">Approve new users and manage access.</p>
      </div>

      <Card className="p-6">
        <UsersTable users={users || []} />
      </Card>
    </div>
  );
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { OrgProfileEditor, DiscoveryRunner, UpdatesList, ReceiptSettings } from "./ui";

export default async function OrgProfilePage() {
  const supabase = createSupabaseServerClient();
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;

  const [{ data: profile }, { data: updates }, { data: org }] = await Promise.all([
    supabase.from("org_profiles").select("*").eq("org_id", orgId).single(),
    supabase
      .from("org_profile_updates")
      .select("id, status, summary, proposed, sources, created_at, decided_at, agent_run_id")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("organizations").select("name, invite_code").eq("id", orgId).single(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organization profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          Central source of truth. Used by grant writing, communications, and other agents.
        </p>
        <Alert className="mt-4 flex items-center gap-3 border-emerald-200 bg-emerald-50 text-emerald-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3z" />
              <path d="M5 16l.75 1.75L7.5 18l-1.75.75L5 20l-.75-1.25L2.5 18l1.75-.25L5 16z" />
            </svg>
          </span>
          <div className="text-xs text-emerald-800/80">
            Coming Soon: Complete scrape of your website for more detail and document collection.
          </div>
          <span className="ml-auto rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900">
            Soon
          </span>
        </Alert>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="font-medium">Profile</div>
              <div className="mt-1 text-sm text-slate-600">Keep this accurate. Agents prefer approved profile fields.</div>
            </div>
            <div className="text-xs text-slate-600">
              Invite code: <span className="font-mono">{org?.invite_code || "—"}</span>
            </div>
          </div>
          <div className="mt-4">
            <OrgProfileEditor profile={profile || {}} />
          </div>
        </Card>

        <Card className="p-6">
          <div className="font-medium">Discovery</div>
          <div className="mt-2 text-sm text-slate-600">
            Run an agent to scrape your website (if provided) and search the web for recent mentions. Suggested updates
            require human approval.
          </div>
          <div className="mt-4">
            <DiscoveryRunner />
          </div>
          {profile?.last_discovered_at ? (
            <div className="mt-4 text-xs text-slate-500">
              Last run: {new Date(profile.last_discovered_at).toLocaleString()}
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="p-6">
        <div className="font-medium">Receipts & branding</div>
        <div className="mt-1 text-sm text-slate-600">Configure the details used in tax receipts.</div>
        <div className="mt-4">
          <ReceiptSettings profile={profile || {}} orgName={org?.name} />
        </div>
      </Card>

      <Card className="p-6">
        <div className="font-medium">Suggested updates</div>
        <div className="mt-1 text-sm text-slate-600">Review and accept/reject updates from discovery runs.</div>
        <div className="mt-4">
          <UpdatesList updates={updates || []} />
        </div>
      </Card>
    </div>
  );
}

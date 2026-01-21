import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/getViewer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function PendingPage() {
  const viewer = await getViewer();
  if (!viewer?.user) redirect("/auth/login");
  if (viewer.profile?.status === "active") redirect("/app/dashboard");

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-md px-6 py-16">
        <Card className="p-8">
          <h1 className="text-xl font-semibold">Approval required</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your account is pending approval by an executive for your organization.
          </p>
          <div className="mt-6 rounded-xl border bg-white p-4">
            <div className="text-sm font-medium">What happens next?</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
              <li>An executive will review and approve your access.</li>
              <li>Once approved, you can sign in normally and access your organization workspace.</li>
            </ul>
          </div>

          <div className="mt-6 flex gap-3">
            <Link href="/auth/logout">
              <Button variant="secondary">Sign out</Button>
            </Link>
            <Link href="/auth/login">
              <Button>Refresh / sign in</Button>
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}

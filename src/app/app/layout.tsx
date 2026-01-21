import { redirect } from "next/navigation";
import Link from "next/link";
import { getViewer } from "@/lib/auth/getViewer";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { BackgroundJobNotifier } from "@/components/notifications/background-job-notifier";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer?.user) redirect("/auth/login");
  if (viewer.profile?.status === "pending") redirect("/auth/pending");
  if (viewer.profile?.status !== "active") redirect("/auth/login");
  const orgId = viewer.profile?.org_id || "";
  const userId = viewer.user?.id || "";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <Sidebar viewer={viewer} />
        <div className="min-h-screen flex-1">
          <Topbar viewer={viewer} />
          <BackgroundJobNotifier orgId={orgId} userId={userId} />
          <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

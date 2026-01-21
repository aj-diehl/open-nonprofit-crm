import Link from "next/link";
import { Menu } from "lucide-react";

export function Topbar({ viewer }: { viewer: any }) {
  return (
    <div className="sticky top-0 z-10 border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="md:hidden">
            <Menu className="h-5 w-5 text-slate-600" />
          </div>
          <div className="text-sm font-medium text-slate-900">{viewer?.organization?.name || "Workspace"}</div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden text-sm text-slate-600 md:block">{viewer?.profile?.display_name}</div>
          <Link className="text-sm text-slate-600 underline underline-offset-4" href="/auth/logout">
            Sign out
          </Link>
        </div>
      </div>
    </div>
  );
}

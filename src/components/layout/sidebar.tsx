import Link from "next/link";
import { Home, Users, HeartHandshake, FileText, Sparkles, Settings, Database, ScrollText } from "lucide-react";
import { cn } from "@/lib/shared/cn";

const nav = [
  { href: "/app/dashboard", label: "Dashboard", icon: Home },
  { href: "/app/crm/donors", label: "CRM", icon: HeartHandshake },
  { href: "/app/grants", label: "Grants", icon: FileText },
  { href: "/app/comms", label: "Communications", icon: Sparkles },
  { href: "/app/knowledge", label: "Knowledge", icon: Database },
  { href: "/app/org-profile", label: "Org profile", icon: Settings },
  { href: "/app/audit", label: "Audit", icon: ScrollText },
];

export function Sidebar({ viewer }: { viewer: any }) {
  const profile = viewer?.profile;
  const isExec = profile?.role === "executive";
  const displayName = profile?.display_name || profile?.contact_email || profile?.username;
  const identifier = profile?.contact_email || (profile?.username ? `@${profile.username}` : null);

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-white md:block">
      <div className="px-5 py-5">
        <div className="text-sm text-slate-600">Organization</div>
        <div className="mt-1 text-base font-semibold">{viewer?.organization?.name || "Workspace"}</div>
        <div className="mt-3 h-px bg-slate-100" />
      </div>

      <nav className="px-3">
        {nav.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
        ))}

        {isExec ? (
          <div className="mt-4">
            <div className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">Admin</div>
            <NavLink href="/app/admin/users" label="Users" icon={Users} />
          </div>
        ) : null}
      </nav>

      <div className="absolute bottom-0 w-64 border-t bg-white px-5 py-4">
        <div className="text-xs text-slate-600">Signed in as</div>
        <div className="text-sm font-medium">{displayName}</div>
        {identifier ? <div className="text-xs text-slate-600">{identifier}</div> : null}
        <div className="mt-3">
          <Link className="text-xs text-slate-600 underline underline-offset-4" href="/auth/logout">
            Sign out
          </Link>
        </div>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const POLL_INTERVAL_MS = 6000;

type JobRow = {
  id: string;
  status: "succeeded" | "failed";
  title: string | null;
  return_path: string | null;
  error: string | null;
  completed_at: string | null;
  type: string;
};

export function BackgroundJobNotifier({ orgId, userId }: { orgId: string; userId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const currentPath = query ? `${pathname}?${query}` : pathname;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const seen = useRef(new Set<string>());
  const lastChecked = useRef(new Date(Date.now() - 5000).toISOString());

  useEffect(() => {
    if (!orgId || !userId) return;

    let active = true;

    const poll = async () => {
      const { data, error } = await supabase
        .from("background_jobs")
        .select("id, status, title, return_path, error, completed_at, type")
        .eq("org_id", orgId)
        .eq("created_by", userId)
        .in("status", ["succeeded", "failed"])
        .gt("completed_at", lastChecked.current)
        .order("completed_at", { ascending: true });

      if (!active) return;
      if (error || !data) return;

      let latest = lastChecked.current;
      for (const job of data as JobRow[]) {
        if (!job.completed_at) continue;
        if (seen.current.has(job.id)) continue;
        seen.current.add(job.id);
        if (job.completed_at > latest) latest = job.completed_at;

        const title = job.title || job.type || "Background job";
        const success = job.status === "succeeded";
        const message = success ? `${title} completed` : `${title} failed`;

        const returnPath = job.return_path || "";
        const action =
          returnPath.length > 0
            ? {
                label: currentPath === returnPath ? "Refresh" : "Open",
                onClick: () => {
                  if (currentPath === returnPath) {
                    router.refresh();
                  } else {
                    router.push(returnPath);
                  }
                },
              }
            : undefined;

        const description = !success && job.error ? job.error : undefined;
        const fn = success ? toast.success : toast.error;
        fn(message, { description, action });
      }

      lastChecked.current = latest;
    };

    void poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [orgId, userId, currentPath, router, supabase]);

  return null;
}

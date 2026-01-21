import { cache as reactCache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Viewer = {
  user: { id: string; email?: string | null } | null;
  profile: any | null;
  organization: any | null;
};

async function loadViewer(): Promise<Viewer | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user || null;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id, role, status, display_name, contact_email, username")
    .eq("id", user.id)
    .single();
  const orgId = profile?.org_id;

  const { data: organization } = orgId
    ? await supabase.from("organizations").select("id, name, slug, invite_code").eq("id", orgId).single()
    : { data: null };

  return { user: { id: user.id, email: user.email }, profile, organization };
}

export const viewerCacheEnabled = typeof reactCache === "function";

const cacheFn: <T extends (...args: any[]) => any>(fn: T) => T = viewerCacheEnabled ? reactCache : ((fn) => fn);

export const getViewer = cacheFn(loadViewer);

export async function getViewerUncached(): Promise<Viewer | null> {
  return loadViewer();
}

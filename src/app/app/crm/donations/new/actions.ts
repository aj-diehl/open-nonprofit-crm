"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import { audit } from "@/lib/audit/audit";

const schema = z.object({
  donorEmail: z.string().email().optional().or(z.literal("")),
  donorFirstName: z.string().optional(),
  donorLastName: z.string().optional(),
  donorOrgName: z.string().optional(),
  donorType: z.enum(["individual", "organization"]),
  amount: z.coerce.number().positive(),
  currency: z.string().min(3).max(3).default("USD"),
  donatedAt: z.string().min(1),
  campaign: z.string().optional(),
  channel: z.string().optional(),
  goodsOrServicesProvided: z.string().optional(),
  goodsOrServicesDescription: z.string().optional(),
  goodsOrServicesValue: z.string().optional(),
});

export type NewDonationState = { error?: string };

export async function createDonationAction(_prev: NewDonationState, formData: FormData): Promise<NewDonationState> {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) return { error: "Not authenticated." };

  const parsed = schema.safeParse({
    donorEmail: String(formData.get("donorEmail") || "").trim(),
    donorFirstName: String(formData.get("donorFirstName") || "").trim() || undefined,
    donorLastName: String(formData.get("donorLastName") || "").trim() || undefined,
    donorOrgName: String(formData.get("donorOrgName") || "").trim() || undefined,
    donorType: String(formData.get("donorType") || "individual"),
    amount: formData.get("amount"),
    currency: String(formData.get("currency") || "USD").trim().toUpperCase(),
    donatedAt: String(formData.get("donatedAt") || "").trim(),
    campaign: String(formData.get("campaign") || "").trim() || undefined,
    channel: String(formData.get("channel") || "").trim() || undefined,
    goodsOrServicesProvided: String(formData.get("goodsOrServicesProvided") || "false"),
    goodsOrServicesDescription: String(formData.get("goodsOrServicesDescription") || "").trim() || undefined,
    goodsOrServicesValue: String(formData.get("goodsOrServicesValue") || "").trim() || undefined,
  });

  if (!parsed.success) return { error: "Please check the form fields." };

  const goodsProvided = parsed.data.goodsOrServicesProvided === "true";
  const goodsDescription = parsed.data.goodsOrServicesDescription?.trim() || undefined;
  const goodsValueRaw = parsed.data.goodsOrServicesValue?.trim() || "";
  const goodsValue = goodsValueRaw ? Number(goodsValueRaw) : undefined;

  if (goodsProvided) {
    if (!goodsDescription) return { error: "Please describe goods/services provided." };
    if (!Number.isFinite(goodsValue ?? NaN)) return { error: "Please enter a valid goods/services value." };
    if ((goodsValue ?? 0) < 0) return { error: "Goods/services value must be 0 or more." };
  }

  const supabase = createSupabaseServerClient();

  // Resolve donor
  let donorId: string | null = null;

  if (parsed.data.donorEmail) {
    const { data: existing } = await supabase
      .from("donors")
      .select("id")
      .eq("org_id", orgId)
      .eq("email", parsed.data.donorEmail)
      .maybeSingle();

    donorId = existing?.id || null;
  }

  if (!donorId) {
    const { data: created, error: donorErr } = await supabase
      .from("donors")
      .insert({
        org_id: orgId,
        donor_type: parsed.data.donorType,
        first_name: parsed.data.donorFirstName || null,
        last_name: parsed.data.donorLastName || null,
        organization_name: parsed.data.donorOrgName || null,
        email: parsed.data.donorEmail || null,
      })
      .select("id")
      .single();

    if (donorErr || !created?.id) return { error: "Unable to create donor." };
    donorId = created.id;
  }

  const { data: donation, error: donationErr } = await supabase
    .from("donations")
    .insert({
      org_id: orgId,
      donor_id: donorId,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      donated_at: new Date(parsed.data.donatedAt).toISOString(),
      campaign: parsed.data.campaign || null,
      channel: parsed.data.channel || null,
      goods_or_services_provided: goodsProvided,
      goods_or_services_description: goodsProvided ? goodsDescription || null : null,
      goods_or_services_value: goodsProvided ? goodsValue ?? null : null,
      created_by: viewer.user.id,
    })
    .select("id")
    .single();

  if (donationErr || !donation?.id) return { error: "Unable to create donation." };

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "donation.create",
    entityType: "donation",
    entityId: donation.id,
    metadata: { donorId },
  });

  redirect("/app/crm/donations");
}

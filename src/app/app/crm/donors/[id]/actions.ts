"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/getViewer";
import { audit } from "@/lib/audit/audit";

const donationSchema = z.object({
  donorId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  currency: z.string().min(3).max(3).default("USD"),
  donatedAt: z.string().min(4),
  campaign: z.string().optional(),
  channel: z.string().optional(),
  goodsOrServicesProvided: z.string().optional(),
  goodsOrServicesDescription: z.string().optional(),
  goodsOrServicesValue: z.string().optional(),
});

export async function createDonationForDonorAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");

  const parsed = donationSchema.parse({
    donorId: String(formData.get("donorId")),
    amount: formData.get("amount"),
    currency: String(formData.get("currency") || "USD").trim().toUpperCase(),
    donatedAt: String(formData.get("donatedAt") || "").trim(),
    campaign: String(formData.get("campaign") || "").trim() || undefined,
    channel: String(formData.get("channel") || "").trim() || undefined,
    goodsOrServicesProvided: String(formData.get("goodsOrServicesProvided") || "false"),
    goodsOrServicesDescription: String(formData.get("goodsOrServicesDescription") || "").trim() || undefined,
    goodsOrServicesValue: String(formData.get("goodsOrServicesValue") || "").trim() || undefined,
  });

  const goodsProvided = parsed.goodsOrServicesProvided === "true";
  const goodsDescription = parsed.goodsOrServicesDescription?.trim() || undefined;
  const goodsValueRaw = parsed.goodsOrServicesValue?.trim() || "";
  const goodsValue = goodsValueRaw ? Number(goodsValueRaw) : undefined;

  if (goodsProvided) {
    if (!goodsDescription) throw new Error("Please describe goods/services provided.");
    if (!Number.isFinite(goodsValue ?? NaN)) throw new Error("Please enter a valid goods/services value.");
    if ((goodsValue ?? 0) < 0) throw new Error("Goods/services value must be 0 or more.");
  }

  const supabase = createSupabaseServerClient();

  const { data: donation, error } = await supabase
    .from("donations")
    .insert({
      org_id: orgId,
      donor_id: parsed.donorId,
      amount: parsed.amount,
      currency: parsed.currency,
      donated_at: new Date(parsed.donatedAt).toISOString(),
      campaign: parsed.campaign || null,
      channel: parsed.channel || null,
      goods_or_services_provided: goodsProvided,
      goods_or_services_description: goodsProvided ? goodsDescription || null : null,
      goods_or_services_value: goodsProvided ? goodsValue ?? null : null,
      created_by: viewer.user.id,
    })
    .select("id")
    .single();

  if (error || !donation?.id) throw new Error("Unable to create donation");

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "donation.created",
    entityType: "donation",
    entityId: donation.id,
    metadata: { donorId: parsed.donorId },
  });

  revalidatePath(`/app/crm/donors/${parsed.donorId}`);
}

const interactionSchema = z.object({
  donorId: z.string().uuid(),
  type: z.string().min(2),
  subject: z.string().optional(),
  body: z.string().optional(),
  occurredAt: z.string().min(4),
});

export async function createInteractionAction(formData: FormData) {
  const viewer = await getViewer();
  const orgId = viewer?.profile?.org_id;
  if (!orgId || !viewer.user) throw new Error("Not authenticated");

  const parsed = interactionSchema.parse({
    donorId: String(formData.get("donorId")),
    type: String(formData.get("type") || "").trim(),
    subject: String(formData.get("subject") || "").trim() || undefined,
    body: String(formData.get("body") || "").trim() || undefined,
    occurredAt: String(formData.get("occurredAt") || "").trim(),
  });

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("interactions")
    .insert({
      org_id: orgId,
      donor_id: parsed.donorId,
      type: parsed.type,
      subject: parsed.subject || null,
      body: parsed.body || null,
      occurred_at: new Date(parsed.occurredAt).toISOString(),
      created_by: viewer.user.id,
    })
    .select("id")
    .single();

  if (error || !data?.id) throw new Error("Unable to create interaction");

  await audit(supabase, {
    orgId,
    actorId: viewer.user.id,
    action: "interaction.created",
    entityType: "interaction",
    entityId: data.id,
    metadata: { donorId: parsed.donorId },
  });

  revalidatePath(`/app/crm/donors/${parsed.donorId}`);
}

import { createHash } from "crypto";
import { z } from "zod";

const EXTERNAL_ID_UNIQUENESS_THRESHOLD = 0.99;
const fieldSchema = z.object({
  column: z.string().optional(),
  default: z.any().optional(),
  transform: z.string().optional(),
});

export const donationsMappingSchema = z.object({
  kind: z.literal("donations"),
  donor: z.record(fieldSchema),
  donation: z.record(fieldSchema),
  notes: z.string().optional(),
  confidence: z.number().optional(),
});

export const donorsMappingSchema = z.object({
  kind: z.literal("donors"),
  donor: z.record(fieldSchema),
  notes: z.string().optional(),
  confidence: z.number().optional(),
});

export type DonationsMapping = z.infer<typeof donationsMappingSchema>;
export type DonorsMapping = z.infer<typeof donorsMappingSchema>;

export async function applyDonationMapping({
  supabase,
  orgId,
  userId,
  table,
  mapping,
  jobId,
}: {
  supabase: any;
  orgId: string;
  userId: string;
  table: { headers: string[]; rows: Record<string, any>[] };
  mapping: DonationsMapping;
  jobId: string;
}) {
  const m = donationsMappingSchema.parse(mapping);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let missingRequired = 0;
  let errorCount = 0;
  const errorSamples: string[] = [];
  const externalIdColumn = m.donation["external_id"]?.column;
  const externalIdBlocked = externalIdColumn ? isRowNumberColumn(externalIdColumn) : false;
  const externalIdStats = computeExternalIdUniqueness(table.rows, externalIdColumn);
  const useMappedExternalId =
    !!externalIdColumn && !externalIdBlocked && externalIdStats.ratio >= EXTERNAL_ID_UNIQUENESS_THRESHOLD;

  for (const [index, row] of table.rows.entries()) {
    let donorData: any;
    let donationData: any;
    try {
      donorData = buildDonor(row, m.donor);
      donationData = buildDonation(row, m.donation);
      const rawDate = getString(row, m.donation["donated_at"]);

      if (donationData.amount === undefined || donationData.amount === null || !donationData.donated_at) {
        skipped++;
        missingRequired++;
        continue;
      }

      // Resolve donor
      const donorId = await resolveDonor({ supabase, orgId, donorData, userId });

      // Insert donation (dedupe via external_id if present)
      const payload: any = {
        org_id: orgId,
        donor_id: donorId,
        amount: donationData.amount,
        currency: donationData.currency || donorData.currency || "USD",
        donated_at: donationData.donated_at,
        campaign: donationData.campaign || null,
        channel: donationData.channel || null,
        external_id:
          useMappedExternalId && donationData.external_id
            ? donationData.external_id
            : buildFallbackExternalId({ donorData, donationData, rawDate }),
        created_by: userId,
        updated_at: new Date().toISOString(),
      };

      if (payload.external_id) {
        const { data: existing } = await supabase
          .from("donations")
          .select("id")
          .eq("org_id", orgId)
          .eq("external_id", payload.external_id)
          .maybeSingle();

        const { error } = await supabase.from("donations").upsert(payload, { onConflict: "org_id,external_id" });
        if (error) throw error;
        if (existing?.id) updated++;
        else created++;
      } else {
        const { error } = await supabase.from("donations").insert(payload);
        if (error) throw error;
        created++;
      }
    } catch (error: any) {
      skipped++;
      errorCount++;
      if (errorSamples.length < 5) {
        const ref = donationData?.external_id || donorData?.email || `row ${index + 1}`;
        const message = error?.message || String(error);
        errorSamples.push(`${ref}: ${message}`.slice(0, 200));
      }
    }
  }

  return {
    jobId,
    created,
    updated,
    skipped,
    missingRequired,
    errorCount,
    errorSamples,
    externalIdUniqueness: externalIdStats.ratio,
    externalIdSampleSize: externalIdStats.total,
    externalIdMapped: useMappedExternalId,
    externalIdBlocked,
    externalIdColumn,
  };
}

export async function applyDonorMapping({
  supabase,
  orgId,
  userId,
  table,
  mapping,
  jobId,
}: {
  supabase: any;
  orgId: string;
  userId: string;
  table: { headers: string[]; rows: Record<string, any>[] };
  mapping: DonorsMapping;
  jobId: string;
}) {
  const m = donorsMappingSchema.parse(mapping);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errorCount = 0;
  const errorSamples: string[] = [];

  for (const [index, row] of table.rows.entries()) {
    let donorData: any;
    try {
      donorData = buildDonor(row, m.donor);

      const keyEmail = donorData.email?.toLowerCase();
      const incomingNotes = donorData.notes?.trim();
      if (keyEmail) {
        const { data: existing } = await supabase
          .from("donors")
          .select("id, notes")
          .eq("org_id", orgId)
          .eq("email", keyEmail)
          .maybeSingle();

        const basePayload: any = {
          org_id: orgId,
          donor_type: donorData.donor_type,
          first_name: donorData.first_name || null,
          last_name: donorData.last_name || null,
          organization_name: donorData.organization_name || null,
          email: keyEmail,
          phone: donorData.phone || null,
          currency: donorData.currency || "USD",
          updated_at: new Date().toISOString(),
        };

        if (existing?.id) {
          const notesToSet = incomingNotes && !existing?.notes?.trim() ? incomingNotes : undefined;
          const payload: any = { ...basePayload };
          if (notesToSet !== undefined) payload.notes = notesToSet;
          const { error } = await supabase.from("donors").update(payload).eq("org_id", orgId).eq("id", existing.id);
          if (error) throw error;
          updated++;
        } else {
          const payload = { ...basePayload, notes: incomingNotes || null };
          const { error } = await supabase.from("donors").insert(payload);
          if (error) throw error;
          created++;
        }
      } else {
        // No email: best-effort insert
        const payload: any = {
          org_id: orgId,
          donor_type: donorData.donor_type,
          first_name: donorData.first_name || null,
          last_name: donorData.last_name || null,
          organization_name: donorData.organization_name || null,
          email: null,
          phone: donorData.phone || null,
          currency: donorData.currency || "USD",
          notes: incomingNotes || null,
        };
        const { error } = await supabase.from("donors").insert(payload);
        if (error) throw error;
        created++;
      }
    } catch (error: any) {
      skipped++;
      errorCount++;
      if (errorSamples.length < 5) {
        const ref = donorData?.email || `row ${index + 1}`;
        const message = error?.message || String(error);
        errorSamples.push(`${ref}: ${message}`.slice(0, 200));
      }
    }
  }

  return { jobId, created, updated, skipped, errorCount, errorSamples };
}

function buildDonor(row: Record<string, any>, mapping: Record<string, any>) {
  const donor_type = getString(row, mapping["donor_type"]) || inferDonorType(row, mapping);
  const first_name = getString(row, mapping["first_name"]);
  const last_name = getString(row, mapping["last_name"]);
  const organization_name = getString(row, mapping["organization_name"]);
  const rawEmail = getString(row, mapping["email"]);
  const rawPhone = getString(row, mapping["phone"]);
  const email = extractEmail(rawEmail) || extractEmail(rawPhone);
  const phone = extractPhone(rawPhone) || extractPhone(rawEmail);
  const notes = getString(row, mapping["notes"]);
  const currency = (getString(row, mapping["currency"]) || "USD").toUpperCase();

  // If full_name provided, split
  const full_name = getString(row, mapping["full_name"]);
  let fn = first_name;
  let ln = last_name;
  let orgName = organization_name;
  if (full_name && (!fn || !ln) && !orgName && looksLikeOrganizationName(full_name)) {
    orgName = full_name;
  } else if (full_name && (!fn || !ln)) {
    if (full_name.includes(",")) {
      const [lastPart, firstPart] = full_name.split(",").map((p) => p.trim());
      fn = fn || firstPart || undefined;
      ln = ln || lastPart || undefined;
    } else {
      const parts = full_name.split(/\s+/).filter(Boolean);
      fn = fn || parts[0];
      ln = ln || parts.slice(1).join(" ");
    }
  }

  return {
    donor_type: donor_type || (orgName ? "organization" : "individual"),
    first_name: fn,
    last_name: ln,
    organization_name: orgName,
    email,
    phone,
    notes,
    currency,
  };
}

function buildDonation(row: Record<string, any>, mapping: Record<string, any>) {
  const amount = getNumber(row, mapping["amount"]);
  const donated_at = getDateISO(row, mapping["donated_at"]);
  const currency = (getString(row, mapping["currency"]) || "").toUpperCase() || undefined;
  const campaign = getString(row, mapping["campaign"]);
  const channel = getString(row, mapping["channel"]);
  const external_id = getString(row, mapping["external_id"]);
  return { amount, donated_at, currency, campaign, channel, external_id };
}

async function resolveDonor({
  supabase,
  orgId,
  donorData,
  userId,
}: {
  supabase: any;
  orgId: string;
  donorData: any;
  userId: string;
}) {
  const email = donorData.email?.toLowerCase();
  const incomingNotes = donorData.notes?.trim();
  if (email) {
    const { data: existing } = await supabase
      .from("donors")
      .select("id, notes")
      .eq("org_id", orgId)
      .eq("email", email)
      .maybeSingle();
    if (existing?.id) {
      if (incomingNotes && !existing?.notes?.trim()) {
        await supabase
          .from("donors")
          .update({ notes: incomingNotes, updated_at: new Date().toISOString() })
          .eq("org_id", orgId)
          .eq("id", existing.id);
      }
      return existing.id;
    }
  }

  const { data: donor, error } = await supabase
    .from("donors")
    .insert({
      org_id: orgId,
      donor_type: donorData.donor_type,
      first_name: donorData.first_name || null,
      last_name: donorData.last_name || null,
      organization_name: donorData.organization_name || null,
      email: email || null,
      phone: donorData.phone || null,
      currency: donorData.currency || "USD",
      notes: incomingNotes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !donor?.id) throw error || new Error("Unable to create donor");
  return donor.id;
}

function getString(row: Record<string, any>, map?: any) {
  if (!map) return map?.default ? String(map.default) : undefined;
  const col = map.column;
  if (col && col in row) {
    const v = row[col];
    if (v === null || v === undefined) return map.default ? String(map.default) : undefined;
    return String(v).trim() || (map.default ? String(map.default) : undefined);
  }
  return map.default ? String(map.default) : undefined;
}

function getNumber(row: Record<string, any>, map?: any) {
  const s = getString(row, map);
  if (!s) return undefined;
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return undefined;
  if (map?.transform === "cents") return n / 100;
  return n;
}

function getDateISO(row: Record<string, any>, map?: any) {
  const v = map?.column ? row[map.column] : undefined;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") {
    // Excel serial date
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + v * 24 * 60 * 60 * 1000);
    return d.toISOString();
  }
  const s = getString(row, map);
  if (!s) return undefined;

  if (map?.transform === "utc") {
    const utc = parseUtcDate(s);
    if (utc) return utc;
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();

  return undefined;
}

function parseUtcDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const withZone = /Z$|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
  const d = new Date(withZone);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function inferDonorType(row: Record<string, any>, mapping: Record<string, any>) {
  const orgName = getString(row, mapping["organization_name"]);
  if (orgName) return "organization";
  return "individual";
}

function computeExternalIdUniqueness(rows: Record<string, any>[], column?: string) {
  if (!column) return { ratio: 0, total: 0, unique: 0 };
  let total = 0;
  const seen = new Set<string>();
  for (const row of rows) {
    const value = getString(row, { column });
    if (!value) continue;
    total++;
    seen.add(value.trim().toLowerCase());
  }
  const unique = seen.size;
  const ratio = total > 0 ? unique / total : 0;
  return { ratio, total, unique };
}

function buildFallbackExternalId({
  donorData,
  donationData,
  rawDate,
}: {
  donorData: any;
  donationData: any;
  rawDate?: string;
}) {
  const datePart = donationData.donated_at
    ? rawDate && !hasTime(rawDate)
      ? donationData.donated_at.slice(0, 10)
      : donationData.donated_at
    : "";
  const amountPart =
    donationData.amount === undefined || donationData.amount === null
      ? ""
      : Number(donationData.amount).toFixed(2);
  const namePart =
    donorData.organization_name ||
    [donorData.first_name, donorData.last_name].filter(Boolean).join(" ").trim();
  const emailPart = donorData.email?.toLowerCase() || "";
  const base = `${datePart}|${amountPart}|${namePart.toLowerCase()}|${emailPart}`;
  const hash = createHash("sha256").update(base).digest("hex");
  return `hash_${hash}`;
}

function hasTime(value: string) {
  return /\d{1,2}:\d{2}/.test(value);
}

function isRowNumberColumn(header: string) {
  const normalized = header.trim().toLowerCase();
  if (normalized === "#" || normalized === "no" || normalized === "row") return true;
  if (normalized.includes("row") && normalized.includes("number")) return true;
  if (normalized.includes("row") && normalized.includes("#")) return true;
  if (normalized.includes("row")) return true;
  if (normalized.includes("line") && normalized.includes("number")) return true;
  if (normalized.includes("line")) return true;
  if (normalized.includes("index")) return true;
  return false;
}

function extractEmail(value?: string) {
  if (!value) return undefined;
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].trim() : undefined;
}

function extractPhone(value?: string) {
  if (!value) return undefined;
  const matches = value.match(/[+()0-9][0-9().\-\s]{6,}/g);
  if (!matches || matches.length === 0) return undefined;
  let best = "";
  let bestDigits = 0;
  for (const m of matches) {
    const digits = m.replace(/[^0-9]/g, "");
    if (digits.length >= 7 && digits.length > bestDigits) {
      bestDigits = digits.length;
      best = m;
    }
  }
  if (!best) return undefined;
  const normalized = best.replace(/[^\d+]/g, "");
  return normalized || undefined;
}

function looksLikeOrganizationName(value: string) {
  const v = value.toLowerCase();
  const tokens = v.replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/);
  const has = (token: string) => tokens.includes(token);
  return (
    has("llc") ||
    has("inc") ||
    has("foundation") ||
    has("partners") ||
    has("company") ||
    has("corp") ||
    has("association") ||
    has("committee") ||
    has("council") ||
    has("society") ||
    has("trust") ||
    has("fund") ||
    has("ministries") ||
    has("church") ||
    has("school") ||
    has("university")
  );
}

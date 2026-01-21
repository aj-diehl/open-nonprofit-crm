import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/auth/getViewer";
import { audit } from "@/lib/audit/audit";
import { buildDonationReceiptPdf } from "@/lib/receipts/donationReceipt";
import {
  donorHasReceiptContact,
  getDonorAddressLines,
  getDonorDisplayName,
  type DonorRecord,
} from "@/lib/receipts/donor";

export const runtime = "nodejs";

const LOGO_BUCKET = process.env.SUPABASE_ORG_LOGOS_BUCKET || "org-logos";

type ReceiptDonor = DonorRecord & { id: string };

type DonationReceiptRow = {
  id: string;
  amount: number | string;
  currency: string | null;
  donated_at: string;
  external_id: string | null;
  goods_or_services_provided: boolean | null;
  goods_or_services_description: string | null;
  goods_or_services_value: number | string | null;
  donor: ReceiptDonor | null;
};

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const viewer = await getViewer();
    const orgId = viewer?.profile?.org_id;
    if (!orgId || !viewer.user) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const donationId = params.id;
    if (!donationId) {
      return NextResponse.json({ ok: false, error: "Donation id missing" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    const { data: donation, error } = await supabase
      .from("donations")
      .select(
        "id, amount, currency, donated_at, external_id, goods_or_services_provided, goods_or_services_description, goods_or_services_value, donor:donor_id(id, donor_type, first_name, last_name, organization_name, email, address)"
      )
      .eq("org_id", orgId)
      .eq("id", donationId)
      .single()
      .overrideTypes<DonationReceiptRow, { merge: false }>();

    if (error || !donation) {
      return NextResponse.json({ ok: false, error: "Donation not found" }, { status: 404 });
    }

    const donor = donation.donor;
    const donorName = getDonorDisplayName(donor);
    const donorAddressLines = getDonorAddressLines(donor?.address);
    const hasContact = donorHasReceiptContact(donor);

    if (!donorName || !hasContact) {
      return NextResponse.json({ ok: false, error: "Donor record is missing receipt details" }, { status: 400 });
    }

    const [{ data: orgProfile }, { data: organization }] = await Promise.all([
      supabase
        .from("org_profiles")
        .select("logo_url, logo_path, receipt_address, receipt_ein, receipt_signer_name, receipt_signer_title")
        .eq("org_id", orgId)
        .single(),
      supabase.from("organizations").select("name").eq("id", orgId).single(),
    ]);

    if (!organization?.name) {
      return NextResponse.json({ ok: false, error: "Organization profile is missing a name" }, { status: 400 });
    }

    const amount = Number(donation.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "Donation amount is invalid" }, { status: 400 });
    }

    const goodsProvided = Boolean(donation.goods_or_services_provided);
    const goodsValue =
      donation.goods_or_services_value === null || donation.goods_or_services_value === undefined
        ? undefined
        : Number(donation.goods_or_services_value);

    if (goodsProvided) {
      if (!donation.goods_or_services_description?.trim()) {
        return NextResponse.json(
          { ok: false, error: "Goods/services description required to generate receipt" },
          { status: 400 }
        );
      }
      if (!Number.isFinite(goodsValue ?? NaN)) {
        return NextResponse.json(
          { ok: false, error: "Goods/services value required to generate receipt" },
          { status: 400 }
        );
      }
      if ((goodsValue ?? 0) < 0) {
        return NextResponse.json(
          { ok: false, error: "Goods/services value must be 0 or more" },
          { status: 400 }
        );
      }
    }

    let logoBytes: Uint8Array | undefined;
    let logoContentType: string | undefined;

    if (orgProfile?.logo_path && orgProfile.logo_path.startsWith(`${orgId}/`)) {
      const admin = createSupabaseAdminClient();
      const { data: file, error: logoErr } = await admin.storage.from(LOGO_BUCKET).download(orgProfile.logo_path);
      if (!logoErr && file) {
        logoContentType = file.type || undefined;
        logoBytes = new Uint8Array(await file.arrayBuffer());
      }
    }

    const pdfBytes = await buildDonationReceiptPdf({
      orgName: organization.name,
      orgAddressLine: orgProfile?.receipt_address || undefined,
      orgEIN: orgProfile?.receipt_ein || undefined,
      logoBytes,
      logoContentType,
      logoUrl: !logoBytes ? orgProfile?.logo_url || undefined : undefined,
      donorName,
      donorEmail: donor?.email || undefined,
      donorAddressLines,
      donationDate: donation.donated_at,
      amount,
      currency: donation.currency || "USD",
      goodsOrServicesProvided: goodsProvided,
      goodsOrServicesDescription: donation.goods_or_services_description || undefined,
      goodsOrServicesValue: goodsValue,
      receiptId: donation.external_id || donation.id,
      issuedDate: new Date().toISOString().slice(0, 10),
      authorizedSignerName: orgProfile?.receipt_signer_name || undefined,
      authorizedSignerTitle: orgProfile?.receipt_signer_title || undefined,
    });

    await audit(supabase, {
      orgId,
      actorId: viewer.user.id,
      action: "donation.receipt_generated",
      entityType: "donation",
      entityId: donation.id,
      metadata: { donorId: donor?.id || null },
    });

    const filename = `donation-receipt-${sanitizeFilename(donation.external_id || donation.id)}.pdf`;
    const pdfBody = new Uint8Array(pdfBytes);
    return new NextResponse(pdfBody, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? "Failed to generate receipt" }, { status: 400 });
  }
}

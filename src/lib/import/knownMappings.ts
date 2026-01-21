import type { DonationsMapping, DonorsMapping } from "./applyMapping";

type ImportType = "donations" | "donors";
type KnownMapping = DonationsMapping | DonorsMapping;

type HeaderIndex = Map<string, string>;

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function buildHeaderIndex(headers: string[]): HeaderIndex {
  const index: HeaderIndex = new Map();
  for (const header of headers) {
    index.set(normalizeHeader(header), header.trim());
  }
  return index;
}

function hasHeader(index: HeaderIndex, name: string) {
  return index.has(normalizeHeader(name));
}

function pickHeader(index: HeaderIndex, candidates: string[]) {
  for (const name of candidates) {
    const found = index.get(normalizeHeader(name));
    if (found) return found;
  }
  return undefined;
}

function buildZeffyDonorMap(index: HeaderIndex) {
  const donor: Record<string, any> = {};

  const firstName = pickHeader(index, ["Supporter First name"]);
  const lastName = pickHeader(index, ["Supporter Last name"]);
  const fullName = pickHeader(index, ["Supporter full name"]);
  const email = pickHeader(index, ["Supporter email"]);
  const phone = pickHeader(index, ["Supporter phone"]);
  const notes = pickHeader(index, ["Custom Q: How did you hear about us?"]);

  if (firstName) donor.first_name = { column: firstName };
  if (lastName) donor.last_name = { column: lastName };
  if (fullName) donor.full_name = { column: fullName };
  if (email) donor.email = { column: email };
  if (phone) donor.phone = { column: phone };
  if (notes) donor.notes = { column: notes };

  if (Object.keys(donor).length === 0) return null;
  donor.currency = { default: "USD" };
  return donor;
}

function buildZeffyDonationMap(index: HeaderIndex) {
  const amount = pickHeader(index, ["Donation $", "Total charged"]);
  const donatedAt = pickHeader(index, ["Order date"]);
  if (!amount || !donatedAt) return null;

  const donation: Record<string, any> = {
    amount: { column: amount },
    donated_at: { column: donatedAt },
  };

  const campaign = pickHeader(index, ["Campaign / Event"]);
  const channel = pickHeader(index, ["Payment method", "Contribution type"]);
  const externalId = pickHeader(index, ["Transaction #"]);

  if (campaign) donation.campaign = { column: campaign };
  if (channel) donation.channel = { column: channel };
  if (externalId) donation.external_id = { column: externalId };
  donation.currency = { default: "USD" };

  return donation;
}

function buildStripeDonorMap(index: HeaderIndex) {
  const donor: Record<string, any> = {};

  const fullName = pickHeader(index, ["Customer Name"]);
  const email = pickHeader(index, ["Customer Email"]);
  const phone = pickHeader(index, ["Customer Phone"]);
  const currency = pickHeader(index, ["Currency"]);

  if (fullName) donor.full_name = { column: fullName };
  if (email) donor.email = { column: email };
  if (phone) donor.phone = { column: phone };
  if (currency) donor.currency = { column: currency };

  if (Object.keys(donor).length === 0) return null;
  return donor;
}

function buildStripeDonationMap(index: HeaderIndex) {
  const amount = pickHeader(index, ["Amount"]);
  const donatedAt = pickHeader(index, ["Created (UTC)", "Created"]);
  if (!amount || !donatedAt) return null;

  const donation: Record<string, any> = {
    amount: { column: amount, transform: "cents" },
    donated_at: { column: donatedAt, transform: "utc" },
  };

  const currency = pickHeader(index, ["Currency"]);
  const campaign = pickHeader(index, ["Metadata[campaign]", "Description"]);
  const channel = pickHeader(index, ["Payment Method Type"]);
  const externalId = pickHeader(index, ["id", "Balance Transaction", "Receipt Number"]);

  if (currency) donation.currency = { column: currency };
  if (campaign) donation.campaign = { column: campaign };
  if (channel) donation.channel = { column: channel };
  if (externalId) donation.external_id = { column: externalId };

  return donation;
}

function isZeffyExport(index: HeaderIndex) {
  return hasHeader(index, "Transaction #") && hasHeader(index, "Order date") && (hasHeader(index, "Donation $") || hasHeader(index, "Total charged"));
}

function isStripeExport(index: HeaderIndex) {
  return (
    hasHeader(index, "id") &&
    hasHeader(index, "Created (UTC)") &&
    hasHeader(index, "Amount") &&
    hasHeader(index, "Currency") &&
    hasHeader(index, "Customer Name")
  );
}

export function getKnownMapping(importType: ImportType, headers: string[]): KnownMapping | null {
  const index = buildHeaderIndex(headers);

  if (isZeffyExport(index)) {
    if (importType === "donations") {
      const donor = buildZeffyDonorMap(index);
      const donation = buildZeffyDonationMap(index);
      if (!donor || !donation) return null;
      return { kind: "donations", donor, donation };
    }
    const donor = buildZeffyDonorMap(index);
    if (!donor) return null;
    return { kind: "donors", donor };
  }

  if (isStripeExport(index)) {
    if (importType === "donations") {
      const donor = buildStripeDonorMap(index);
      const donation = buildStripeDonationMap(index);
      if (!donor || !donation) return null;
      return { kind: "donations", donor, donation };
    }
    const donor = buildStripeDonorMap(index);
    if (!donor) return null;
    return { kind: "donors", donor };
  }

  return null;
}

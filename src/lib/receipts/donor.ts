export type DonorRecord = {
  donor_type?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  organization_name?: string | null;
  email?: string | null;
  address?: any;
};

export function getDonorDisplayName(donor?: DonorRecord | null): string | null {
  if (!donor) return null;
  if (donor.donor_type === "organization") {
    return donor.organization_name?.trim() || null;
  }
  const name = `${donor.first_name || ""} ${donor.last_name || ""}`.trim();
  if (name) return name;
  return donor.organization_name?.trim() || null;
}

export function getDonorAddressLines(address: any): string[] {
  if (!address) return [];
  if (typeof address === "string") {
    return address
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }
  if (typeof address !== "object") return [];

  const line1 = pickFirstString(address, ["line1", "address1", "street", "street1"]);
  const line2 = pickFirstString(address, ["line2", "address2", "street2"]);
  const city = pickFirstString(address, ["city", "town", "locality"]);
  const state = pickFirstString(address, ["state", "region", "province"]);
  const postal = pickFirstString(address, ["postal_code", "postalCode", "zip", "zipcode"]);
  const country = pickFirstString(address, ["country"]);

  const lines: string[] = [];
  if (line1) lines.push(line1);
  if (line2) lines.push(line2);

  const cityLine = [city, state].filter(Boolean).join(", ");
  const postalSuffix = postal ? (cityLine ? ` ${postal}` : postal) : "";
  const combinedCity = `${cityLine}${postalSuffix}`.trim();
  if (combinedCity) lines.push(combinedCity);
  if (country) lines.push(country);

  return lines.filter(Boolean);
}

export function donorHasReceiptContact(donor?: DonorRecord | null): boolean {
  if (!donor) return false;
  if (donor.email && donor.email.trim()) return true;
  return getDonorAddressLines(donor.address).length > 0;
}

export function isReceiptEligibleForDonor(donor?: DonorRecord | null): boolean {
  return !!getDonorDisplayName(donor) && donorHasReceiptContact(donor);
}

function pickFirstString(obj: Record<string, any>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

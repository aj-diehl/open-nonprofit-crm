# Donation receipts (cash-only)

This app now generates IRS-compliant donation receipts as PDFs from CRM donations. The generator enforces the minimum required fields for $250+ cash gifts:

- Organization name
- Date received
- Amount (cash)
- Statement about whether any goods/services were provided in exchange

Optional fields (logo, EIN, address, signer) are included when present.

## Data requirements (when receipts are enabled)

Receipt generation succeeds only when all required donor/donation details are present.

- Donation must have: amount, donated date
- Donor must have: a name (individual first/last or organization name) and a contact method (email or address)
- Goods/services:
  - If goods/services provided = yes, a description + value are required
  - If no, the receipt prints the standard "no goods/services" statement

## Where to configure

- Org profile: **Receipts & branding** card
  - Upload a logo (PNG/JPG)
  - Set EIN, address, authorized signer name/title
- CRM donation forms:
  - Set goods/services provided (and description/value if applicable)

## API route (used by the CRM buttons)

A PDF is generated on-demand per donation:

```
GET /api/receipts/donations/:id
```

Responses:
- `200` returns `application/pdf` with a download filename
- `400` if donor/contact or goods/services details are missing
- `401` if not authenticated

## Logo storage

Logos are stored in Supabase Storage.

- Bucket: `org-logos` (override with `SUPABASE_ORG_LOGOS_BUCKET`)
- The upload action stores both `logo_path` and `logo_url` on `org_profiles`
- If you want logo previews to work in the UI, set the bucket to public

## Notes

- Receipts are cash-only (no non-cash in-kind logic).
- The PDF is generated at download time (no receipt files are persisted).

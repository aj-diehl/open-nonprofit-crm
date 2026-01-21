# NonprofitOS

A secure, multi-tenant nonprofit operations platform:
- **CRM** (donors, donations, interactions) + spreadsheet import (CSV/XLSX) with **AI column mapping**
- **Grants** pipeline + question bank + upload guidelines (PDF/DOCX/etc) + **AI grant writer**
- **Communications** drafts (email/newsletter/article) generated from your org profile + knowledge base
- **Org profile** (human-approved truth) + optional discovery run (website scrape + best-effort web search) with reviewable suggestions
- **Knowledge base** document upload + **pgvector retrieval** for context generation
- Executive-only **user approval** workflow


## Tech stack

- Next.js 15 (App Router) + Server Actions
- Supabase (Auth, Postgres, Storage, RLS)
- pgvector for embeddings search
- OpenAI (embeddings + agents / responses)

---

## 1) Create a Supabase project

1. Create a Supabase project.
2. In **SQL editor**, run the migration:
   - `supabase/migrations/20260106000000_init.sql`
3. Enable email/password auth in Supabase (Auth → Providers).
   - Email verification can be left OFF for internal deployments, but consider enabling it for production.
4. Create a Storage bucket:
   - Name: `documents` (or set `SUPABASE_DOCS_BUCKET`)
   - Private bucket recommended.

### Storage policies (recommended)

This app uploads documents server-side using the **Service Role** key, so Storage RLS is not strictly required to function.
However, you should still configure Storage policies if you plan to serve files directly to clients.

---

## 2) Configure environment variables

Copy:

```bash
cp .env.example .env
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

Optional (tracing):

- `OPENAI_TRACING_EXPORT_API_KEY`

---

## 3) Install & run

```bash
npm install
npm run dev
```

Visit:

- http://localhost:3000

---

## 4) First-time workflow

1. Go to **Sign up** and create the first user for a new org.
   - That user becomes **executive** and is **active** immediately.
2. Copy the org **Invite code** from the Org Profile page.
3. Other users can sign up using the invite code.
   - They will be **pending** until an executive approves them (Admin → Users).

---

## Key pages

- `/app/dashboard`
- `/app/crm/donors`
- `/app/crm/import` (CSV/XLSX import → AI mapping → ingestion)
- `/app/grants`
- `/app/grants/:id` (questions + AI draft)
- `/app/grants/:id/upload-guidelines` (upload funder docs)
- `/app/comms` (generate draft)
- `/app/knowledge` (upload documents + vector search)
- `/app/org-profile` (approved truth + discovery run + suggestions)

---

## Security

- **RLS** is enabled for all tenant tables.
- Access is scoped to `profiles.org_id = current_org_id()`.
- Executives can:
  - approve users
  - accept org profile updates

---

## License

MIT. See `LICENSE`.

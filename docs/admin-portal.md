# Admin portal approach (CEO platform admin)

## Goals

- Platform admin (CEO/cofounder) creates or deletes organizations, controls seat limits, and sees usage for every org.
- Platform admin issues organization signup IDs so org creation is admin-approved.
- Org admin (executive) manages members and permissions within their org.
- Keep existing org member invite flow working with minimal changes.

## Current baseline (from schema)

- `organizations` already includes `invite_code` for joining existing orgs.
- `profiles` ties users to `org_id` with `role` and `status`.
- Usage signals exist in `agent_runs`, `donations`, `donors`, etc.

## Admin roles (two-level)

Org admin (per-organization)
- Uses existing `profiles.role = 'executive'` and `profiles.status = 'active'`.
- Permissions limited to their own `org_id`.
- Can manage members, roles, and pending approvals in their org.

Platform admin (global)
- Separate from org roles to avoid accidental escalation.
- New table `platform_admins` with `user_id`, `email`, `created_at`.
- SQL helper `is_platform_admin()` for RLS checks.
- Admin-only routes under `/app/admin` using server actions + admin client.

## Making platform admins

Define how CEO/cofounder become platform admins:

Option A (recommended): table-driven
- Insert rows into `platform_admins` for existing users by `user_id` or `email`.
- Allow a "pending" platform admin entry by `email` that activates on first login.

Option B: config-driven
- List admin emails in env (ex: `PLATFORM_ADMIN_EMAILS`) and check at auth time.
- No DB table, but harder to audit or manage.

Table-driven keeps auditability and enables an admin UI to grant/revoke platform admin access.

## Organization signup IDs

Decision: pre-create orgs
- Platform admin creates the org record directly and sets values (name, slug, seat_limit, plan, status).
- Platform admin shares the org’s `invite_code` with the first executive user.
- Registration only allows joining with invite code (no self-serve org creation).

## Seat management

Add `seat_limit` and `status` to `organizations`.

- `seat_limit` = max active users in `profiles` with `status = 'active'`.
- Enforce in new-user creation and activation flows.
- Platform admin can update `seat_limit` at any time.
- Org admin can invite/manage members within the current `seat_limit`.

## Usage definition (MVP)

Show a usage snapshot per org:

- Seats used = count of active profiles.
- Data usage = counts for donors, donations, grants.
- AI usage = aggregate of `agent_runs` (runs, tokens if present).
- Last activity = latest timestamp across core tables.

Optionally materialize into a view `org_usage` for fast admin queries.

## Platform admin portal UI (MVP)

Platform admins see an extra sidebar section in the existing app shell (hidden for non-admins).

### Org creation flow
- Create org with name, slug, seat_limit, plan, status.
- Show generated `invite_code` with copy action.

### Org list
- Search by name/slug, filter by status.
- Columns: seat_limit, seats_used, plan, last_activity, created_at.

### Org detail
- Overview cards: seats, data usage, AI usage.
- Actions: update seat_limit, disable/enable, delete.
- Members list with roles/status.

## Org admin view (MVP)

### Members
- List members in the org with role/status.
- Approve pending members, change role (executive/member), disable/remove.
- Invite new members (blocked if `seat_limit` reached).

### Org settings
- View current seat usage and limits.
- Update org profile fields as needed (already exists).

## Delete behavior

Prefer soft-delete first:

- `organizations.status = 'disabled'` (blocks access).
- Later: hard delete with cascade when safe.

## Security + audit

- RLS: platform admin can read/write global admin tables; org admin limited to their org.
- Log admin actions to `admin_audit_logs` (who, what, when, target org).

## Additional admin capabilities (SaaS standards)

- User management: reset passwords, approve/disable users, role changes.
- Billing: plan changes, invoices, payment status, usage caps.
- Support tools: impersonate org admin, view support history.
- Compliance: data export, deletion requests, retention windows.
- Security: enforce MFA, IP allowlist, session revocation.
- Ops: feature flags, maintenance announcements, API keys/limits.
- Monitoring: error rates, performance, background job health.

## Implementation phases

1. Schema + RLS updates (admin tables, seat_limit, precreated org flow, audit logs).
2. Admin server actions + UI (`/app/admin`).
3. Usage view/materialization and dashboards.
4. Billing/support/security enhancements.

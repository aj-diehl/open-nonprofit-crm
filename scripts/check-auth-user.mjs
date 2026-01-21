#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const emailArg = process.argv[2];

if (!emailArg) {
  console.error("Usage: node scripts/check-auth-user.mjs <email>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});

const normalizedEmail = emailArg.trim().toLowerCase();
const perPage = 200;

async function main() {
  let page = 1;
  let found = null;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("Failed to list users:", error.message || error);
      process.exit(1);
    }

    const users = data?.users ?? [];
    found = users.find((user) => (user.email || "").toLowerCase() === normalizedEmail) || null;
    if (found) break;

    const nextPage = data?.nextPage;
    if (!nextPage || users.length === 0) break;
    page = nextPage;
  }

  if (!found) {
    console.log(`No auth user found for ${normalizedEmail}.`);
    return;
  }

  console.log(`Found auth user for ${normalizedEmail}.`);
  console.log(`id: ${found.id}`);
  console.log(`email: ${found.email ?? "unknown"}`);
  console.log(`confirmed_at: ${found.confirmed_at ?? "null"}`);
  console.log(`last_sign_in_at: ${found.last_sign_in_at ?? "null"}`);
  console.log(`created_at: ${found.created_at ?? "unknown"}`);
}

main().catch((err) => {
  console.error("Check failed:", err);
  process.exit(1);
});

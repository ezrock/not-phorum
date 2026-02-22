#!/usr/bin/env node

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : null;

if (limitArg && (!Number.isFinite(limit) || limit <= 0)) {
  console.error("Invalid --limit value. Use a positive integer.");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env vars. Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function normalizeUsername(value) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeNonEmpty(value) {
  const next = (value ?? "").trim();
  return next.length > 0 ? next : null;
}

function normalizeHttpUrl(value) {
  const next = normalizeNonEmpty(value);
  if (!next) return null;
  if (/^https?:\/\//i.test(next)) return next;
  return null;
}

function normalizeEmail(value) {
  const next = normalizeNonEmpty(value)?.toLowerCase();
  if (!next) return null;
  if (["---------", "-", "n/a", "none"].includes(next)) return null;
  if (!next.includes("@")) return null;
  return next;
}

function fallbackEmail(legacyUserId) {
  return `legacy_${legacyUserId}@example.invalid`;
}

function randomPassword() {
  return `Legacy!${crypto.randomBytes(12).toString("base64url")}`;
}

async function getAllRows(table, columns) {
  const pageSize = 1000;
  let from = 0;
  const out = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return out;
}

async function ensureProfile(userId) {
  for (let i = 0; i < 20; i += 1) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Profile row not created for user ${userId}`);
}

async function main() {
  const [legacyRows, profileRows] = await Promise.all([
    getAllRows(
      "legacy_forum_auth_import",
      "id,name,username,email,webpage,image,signature,hide_email,mood_updated_at"
    ),
    getAllRows("profiles", "id,username"),
  ]);

  const existingUsernames = new Set(
    profileRows.map((row) => normalizeUsername(row.username)).filter(Boolean)
  );

  const unmatched = legacyRows
    .filter((row) => !existingUsernames.has(normalizeUsername(row.username)))
    .filter((row) => normalizeNonEmpty(row.username));

  const selected = limit ? unmatched.slice(0, limit) : unmatched;

  console.log(`Legacy rows: ${legacyRows.length}`);
  console.log(`Current profiles: ${profileRows.length}`);
  console.log(`Unmatched legacy users: ${unmatched.length}`);
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}${limit ? ` (limit=${limit})` : ""}`);

  if (selected.length === 0) {
    console.log("Nothing to import.");
    return;
  }

  let created = 0;
  let failed = 0;

  for (const row of selected) {
    const legacyUserId = row.id;
    const username = normalizeNonEmpty(row.username);
    const displayName = normalizeNonEmpty(row.name);
    const legacyEmail = normalizeEmail(row.email);
    const initialEmail = legacyEmail ?? fallbackEmail(legacyUserId);
    const linkUrl = normalizeHttpUrl(row.webpage);
    const profileImageUrl = normalizeHttpUrl(row.image);
    const signature = normalizeNonEmpty(row.signature);
    const hideEmail = row.hide_email === true;
    const createdAt = row.mood_updated_at ?? null;

    if (!APPLY) {
      console.log(
        `[DRY] id=${legacyUserId} username=${username} email=${initialEmail} ` +
          `hide_email=${hideEmail} created_at=${createdAt ?? "NULL"}`
      );
      continue;
    }

    try {
      let emailForCreate = initialEmail;

      const createPayload = () => ({
        email: emailForCreate,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: {
          username,
          legacy_forum_user_id: legacyUserId,
          legacy_import: true,
        },
      });

      let createdUserId = null;
      {
        const { data, error } = await supabase.auth.admin.createUser(createPayload());
        if (!error && data.user?.id) {
          createdUserId = data.user.id;
        } else if (error && /already been registered|already exists|duplicate/i.test(error.message)) {
          emailForCreate = `${fallbackEmail(legacyUserId).replace("@", `_${Date.now()}@`)}`;
          const retry = await supabase.auth.admin.createUser(createPayload());
          if (retry.error || !retry.data.user?.id) throw retry.error ?? new Error("Create user failed");
          createdUserId = retry.data.user.id;
        } else {
          throw error ?? new Error("Create user failed");
        }
      }

      await ensureProfile(createdUserId);

      const updates = {
        legacy_forum_user_id: legacyUserId,
        display_name: displayName,
        profile_image_url: profileImageUrl,
        signature,
        link_url: linkUrl,
        hide_email: hideEmail,
        approval_status: "approved",
      };
      if (signature) {
        updates.show_signature = true;
      }
      if (createdAt) {
        updates.created_at = createdAt;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", createdUserId);
      if (updateError) throw updateError;

      created += 1;
      console.log(`[OK] id=${legacyUserId} username=${username} user_id=${createdUserId}`);
    } catch (error) {
      failed += 1;
      console.error(
        `[FAIL] id=${legacyUserId} username=${row.username} reason=${error?.message ?? String(error)}`
      );
    }
  }

  console.log(`Done. created=${created} failed=${failed}`);
  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to write changes.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

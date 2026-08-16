import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development.local" });

import { publishSeasonRun, validateSeasonRun } from "../lib/fantasy-projections/admin";
import { getServiceRoleClient } from "../lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function argument(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length).trim();
  if (!value) throw new Error(`Pass ${prefix}<value>.`);
  return value;
}

function localEditorUserId(): string {
  const ids = Array.from(new Set(
    (process.env.PLAYER_FORECAST_EDITOR_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => UUID_PATTERN.test(value)),
  ));
  if (ids.length !== 1) {
    throw new Error("PLAYER_FORECAST_EDITOR_USER_IDS must contain exactly one local editor UUID.");
  }
  return ids[0];
}

function assertLocalOnly(): void {
  if (process.env.PLAYER_FORECAST_SEASON_IMPORT_CONFIRM !== "local-only") {
    throw new Error("PLAYER_FORECAST_SEASON_IMPORT_CONFIRM must equal local-only.");
  }
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(apiUrl)) {
    throw new Error("Season publication script is restricted to local Supabase.");
  }
}

async function main(): Promise<void> {
  assertLocalOnly();
  const runId = argument("run-id");
  const label = argument("label");
  const reason = argument("reason");
  const editorUserId = localEditorUserId();
  const client = getServiceRoleClient() as any;

  const { data: editor, error: editorError } = await client
    .from("users")
    .select("role")
    .eq("user_id", editorUserId)
    .maybeSingle();
  if (editorError) throw editorError;
  if (editor?.role !== "admin") {
    throw new Error("The configured local projection editor does not have the admin role.");
  }

  const { data: existing, error: existingError } = await client
    .from("player_forecast_season_releases")
    .select("*")
    .eq("run_id", runId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    process.stdout.write(`${JSON.stringify({ idempotent: true, release: existing }, null, 2)}\n`);
    return;
  }

  const validation = await validateSeasonRun(client, runId);
  if (!validation.valid) {
    process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
    throw new Error("Season run failed publication validation.");
  }
  const release = await publishSeasonRun({
    supabase: client,
    editorUserId,
    runId,
    label,
    reason,
  });
  process.stdout.write(`${JSON.stringify({
    idempotent: false,
    validation: validation.receipt,
    release,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

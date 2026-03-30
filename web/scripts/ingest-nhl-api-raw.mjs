import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { ingestNhlApiRawGames } from "../lib/supabase/Upserts/nhlRawGamecenter.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const webRoot = path.resolve(__dirname, "..");

function parseEnvFile(text) {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function loadEnv() {
  for (const envPath of [
    path.join(webRoot, ".env.local"),
    path.join(repoRoot, ".env.local"),
  ]) {
    try {
      parseEnvFile(await fs.readFile(envPath, "utf8"));
    } catch {
      // Ignore missing env files.
    }
  }
}

async function main() {
  await loadEnv();

  const gameIds = process.argv
    .slice(2)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));

  if (gameIds.length === 0) {
    throw new Error(
      "Pass one or more NHL game IDs. Example: node web/scripts/ingest-nhl-api-raw.mjs 2025021103"
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials in environment.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const results = await ingestNhlApiRawGames(supabase, gameIds);

  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

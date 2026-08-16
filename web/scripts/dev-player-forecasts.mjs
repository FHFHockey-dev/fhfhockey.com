import { spawn, spawnSync } from "node:child_process";

const status = spawnSync("supabase", ["status", "-o", "json"], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: {
    ...process.env,
    SUPABASE_TELEMETRY_DISABLED: "1",
  },
});

if (status.status !== 0) {
  process.stderr.write(status.stderr || status.stdout);
  process.stderr.write(
    "\nLocal Supabase is not ready. Start Colima, then run `npm run supabase:safe -- start`.\n",
  );
  process.exit(status.status || 1);
}

let local;
try {
  local = JSON.parse(status.stdout);
} catch {
  process.stderr.write("Supabase returned an unreadable local status response.\n");
  process.exit(1);
}

const apiUrl = String(local.API_URL || "");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(apiUrl)) {
  process.stderr.write("Refusing to start Player Forecasts against a non-local Supabase URL.\n");
  process.exit(1);
}

for (const key of ["ANON_KEY", "DB_URL", "SERVICE_ROLE_KEY"]) {
  if (!local[key]) {
    process.stderr.write(`Local Supabase status is missing ${key}.\n`);
    process.exit(1);
  }
}

let editorUserIds = process.env.PLAYER_FORECAST_EDITOR_USER_IDS?.trim() || "";
if (!editorUserIds) {
  const { createClient } = await import("@supabase/supabase-js");
  const service = createClient(apiUrl, local.SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: admins, error } = await service
    .from("users")
    .select("user_id")
    .eq("role", "admin");
  if (error) {
    process.stderr.write(
      "Local projection editor discovery failed; viewing remains available but editing will be disabled.\n",
    );
  } else if (admins?.length === 1) {
    editorUserIds = String(admins[0].user_id);
  } else {
    process.stderr.write(
      "Local projection editing requires exactly one admin profile or an explicit PLAYER_FORECAST_EDITOR_USER_IDS value.\n",
    );
  }
}

const next = spawn("next", ["dev", "-H", "0.0.0.0", "-p", "3101"], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: apiUrl,
    NEXT_PUBLIC_SUPABASE_PUBLIC_KEY: local.ANON_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
    SUPABASE_URL: apiUrl,
    SUPABASE_DB_URL: local.DB_URL,
    PLAYER_FORECAST_DATABASE_URL: local.DB_URL,
    SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
    NEXT_SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
    PLAYER_FORECAST_EDITOR_USER_IDS: editorUserIds,
    PLAYER_FORECAST_ISOLATED_NEXT: "1",
    PLAYER_FORECAST_ENABLE_INFERENCE: "false",
  },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => next.kill(signal));
}

next.on("exit", (code) => {
  process.exitCode = code ?? 1;
});

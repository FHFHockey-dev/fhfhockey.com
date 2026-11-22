// Supabase Edge Function `blsh-signer` (Deno). PROPOSAL ONLY; not executed by the local proof (no Deno here).
// Deploy with JWT verification OFF for this function (the bearer from Vault is checked in code).
// Function secret (TJ sets in the dashboard before ARM): BLSH_SIGNER_MANDATE (non-secret JSON mandate).
// Uses the database URL Supabase injects into Edge Functions (SUPABASE_DB_URL) to pull evidence, read the two keys and the
// bearer from the postgres-owned table fhfh_internal.blsh_signer_secrets (not Vault: service_role reads Vault), and write the ledger. Logs decision codes and hashes only.
import postgres from "npm:postgres@3.4.5";
import { createSupabaseSigner } from "./supabaseSigner.mjs";

const SLATE = "20261122"; // re-dated per candidate, like every other pilot literal
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 1, prepare: false, idle_timeout: 5 });
const signer = createSupabaseSigner({
  mandate: () => JSON.parse(Deno.env.get("BLSH_SIGNER_MANDATE") ?? "null"),
  now: () => Date.now(),
  db: {
    evidence: async (kind: string) =>
      (await sql.unsafe(`select fhfh_internal.blsh_signer_evidence_${SLATE}($1)::text as e`, [kind]))[0].e,
    readSecret: async (name: string) =>
      (await sql`select secret from fhfh_internal.blsh_signer_secrets where name = ${name}`)[0]?.secret ?? null,
    reserve: async (slot: string, attrs: unknown) =>
      (await sql.unsafe(`insert into fhfh_internal.blsh_signer_issuance_${SLATE}(slot, record) values ($1, $2::jsonb)
        on conflict do nothing returning slot`, [slot, JSON.stringify(attrs)])).length === 1,
    complete: async (slot: string, attrs: unknown) => {
      const r = await sql.unsafe(`update fhfh_internal.blsh_signer_issuance_${SLATE} set record = $2::jsonb where slot = $1 returning slot`,
        [slot, JSON.stringify(attrs)]);
      if (r.length !== 1) throw new Error("ledger_complete");
    },
    get: async (slot: string) => {
      const r = await sql.unsafe(`select record::text as r from fhfh_internal.blsh_signer_issuance_${SLATE} where slot = $1`, [slot]);
      return r[0] ? JSON.parse(r[0].r) : null;
    },
    // Privilege probe for /selfcheck: the ledger insert is rolled back, so nothing is reserved.
    selfcheck: async () => {
      const currentUser = (await sql`select current_user as u`)[0].u;
      let ledgerWritable = false;
      try {
        await sql.begin(async (tx) => {
          await tx.unsafe(`insert into fhfh_internal.blsh_signer_issuance_${SLATE}(slot, record) values ('request-context#' || $1, '{}'::jsonb)`,
            [`${SLATE.slice(0, 4)}-${SLATE.slice(4, 6)}-${SLATE.slice(6)}`]);
          ledgerWritable = true;
          throw new Error("rollback_probe");
        });
      } catch { /* rolled back */ }
      return { currentUser, ledgerWritable };
    },
  },
  nhlSchedule: async (date: string) => {
    const res = await fetch(`https://api-web.nhle.com/v1/schedule/${date}`, { redirect: "error", signal: AbortSignal.timeout(5000) });
    if (res.status !== 200) throw new Error("schedule_status");
    return res.json();
  },
  log: (event: unknown) => console.log(JSON.stringify(event)),
});

Deno.serve(async (request) => {
  const url = new URL(request.url);
  // Supabase routes /functions/v1/blsh-signer/<path> to this function; keep only the sub-path.
  const path = url.pathname.replace(/^.*\/blsh-signer/, "") || "/";
  const out = await signer.handle({ method: request.method, path, rawQuery: url.search.slice(1),
    headers: Object.fromEntries(request.headers), body: await request.text() });
  return new Response(JSON.stringify(out.body), { status: out.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
});

// One-shot Supabase Edge Function `blsh-signer-keygen` (Deno). PROPOSAL ONLY; not executed locally (no Deno here).
// Deploy, invoke ONCE with the trigger bearer (POST, body {}), record the output, then DELETE the function (line S2).
// Generates the two Ed25519 keys inside Supabase and stores PKCS#8 in fhfh_internal.blsh_signer_secrets over the injected
// SUPABASE_DB_URL. Returns public PEMs, fingerprints and current_user only; refuses if either key already exists.
import postgres from "npm:postgres@3.4.5";
import { timingSafeEqual } from "node:crypto";
import { generateVaultKeys } from "./supabaseSigner.mjs";

const SLATE = "20261122"; // re-dated per candidate
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 1, prepare: false, idle_timeout: 5 });
Deno.serve(async (request) => {
  const secret = (await sql`select secret from fhfh_internal.blsh_signer_secrets where name = 'blsh_signer_trigger_secret'`)[0]?.secret ?? "";
  const a = new TextEncoder().encode(request.headers.get("authorization") ?? ""), b = new TextEncoder().encode("Bearer " + secret);
  if (request.method !== "POST" || secret.length < 32 || a.length !== b.length || !timingSafeEqual(a, b) || !["", "{}"].includes(await request.text())) {
    return new Response('{"state":"refused"}', { status: 403 });
  }
  const currentUser = (await sql`select current_user as u`)[0].u;
  const out = await generateVaultKeys({
    names: { requestContext: `blsh_signer_rc_key_${SLATE}`, official: `blsh_signer_official_key_${SLATE}` },
    secretExists: async (n: string) => (await sql`select 1 from fhfh_internal.blsh_signer_secrets where name = ${n}`).length > 0,
    createSecret: async (n: string, v: string) => { await sql`insert into fhfh_internal.blsh_signer_secrets(name, secret) values (${n}, ${v})`; },
  });
  return new Response(JSON.stringify({ state: "generated", currentUser, keys: out }), { headers: { "content-type": "application/json" } });
});

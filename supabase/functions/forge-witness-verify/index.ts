// The independent FORGE witness (Supabase Edge Function forge-witness-verify). Everything it does is in core.bundle.js,
// built reproducibly from web/lib/projections/pregameCapture/witnessEdgeCore.ts (see bundle-manifest.json). It reads
// armed games' committed claims through forge_witness_api with this project's service role, checks the start against
// the NHL's public schedule, verifies the packet bytes, bindings, cutoff and the DigiCert token, and records a verdict
// signed with FORGE_WITNESS_SIGNING_KEY, an Edge secret that exists nowhere else (not Vercel, the database or Vault).
// Signing gives tamper evidence: the publication gate and the audit verify against the key pinned in the release.
import { handleWitnessEdgeRequest } from "./core.bundle.js";

Deno.serve((req: Request) => handleWitnessEdgeRequest(req, (name: string) => Deno.env.get(name)));

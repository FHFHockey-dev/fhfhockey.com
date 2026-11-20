/**
 * Offline acceptance audit for one live FORGE game (operator, read-only):
 *   claim → signed verdict (pinned public key, official T−60) → exactly one publication → both RSO readers.
 * It reads the rows in a READ ONLY transaction over the operator's database URL and never trusts the database's own
 * gates: the verdict counts only if its signature verifies against the pinned key in this release.
 *
 *   SUPABASE_DB_URL=... NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
 *     scripts/forge-live-acceptance-audit.ts <gameId>
 * Prints the checks as JSON; exits 0 only when every check passes.
 */
import { Client } from "pg";
import { assessLiveAcceptance, type AcceptanceEvidence } from "lib/projections/pregameCapture/liveAcceptance";

async function main() {
  const gameId = Number(process.argv[2]);
  if (!Number.isSafeInteger(gameId) || gameId <= 0) throw new Error("usage: forge-live-acceptance-audit.ts <gameId>");
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL is required (operator machine only)");
  const db = new Client({ connectionString: url, application_name: "forge-live-acceptance-audit" });
  await db.connect();
  try {
    await db.query("begin transaction read only");
    const one = async <T>(text: string, args: unknown[]) => ((await db.query(text, args)).rows[0] ?? null) as T | null;
    const run = await one<Record<string, any>>(`select outcome, claim_id, revision_id, scheduled_start, publish_finished_at, readers, expected_code_version
      from forge_pregame_capture.live_runs where game_id = $1`, [gameId]);
    const game = await one<{ start_time: Date }>(`select "startTime" as start_time from public.games where id = $1`, [gameId]);
    const claimId = run?.claim_id ?? null;
    const claim = claimId ? await one<Record<string, any>>(`select id, game_id, scheduled_start from forge_pregame_capture.claims where id = $1`, [claimId]) : null;
    const outcome = claimId ? await one<{ outcome: string }>(`select outcome from forge_pregame_capture.outcomes where claim_id = $1`, [claimId]) : null;
    const artifact = claimId ? await one<Record<string, any>>(`select raw_sha256, canonical_sha256 from forge_pregame_capture.artifacts where claim_id = $1`, [claimId]) : null;
    const witness = claimId ? await one<Record<string, any>>(`select tsa_token_sha256 from forge_pregame_capture.witnesses where claim_id = $1`, [claimId]) : null;
    const publications = (await db.query(`select p.claim_id, p.revision_id, p.raw_sha256, p.canonical_sha256
      from forge_pregame_capture.publications p join forge_pregame_capture.claims c on c.id = p.claim_id where c.game_id = $1`, [gameId])).rows;
    const signed = claimId ? await one<{ v: Record<string, unknown> | null }>("select public.forge_live_signed_verdict_v1($1) as v", [claimId]) : null;
    const signedVerdict = signed?.v?.signedVerdict ?? null;
    await db.query("rollback");

    const iso = (v: Date | string | null | undefined) => (v == null ? null : new Date(v).toISOString());
    const evidence: AcceptanceEvidence = {
      gameId,
      release: run?.expected_code_version ?? null,
      game: game ? { startTime: iso(game.start_time)! } : null,
      run: run ? { outcome: run.outcome, claimId: run.claim_id, revisionId: run.revision_id, scheduledStart: iso(run.scheduled_start)!,
        publishFinishedAt: iso(run.publish_finished_at), readers: run.readers } : null,
      claim: claim ? { id: claim.id, gameId: Number(claim.game_id), scheduledStart: iso(claim.scheduled_start)! } : null,
      outcome: outcome?.outcome ?? null,
      artifact: artifact ? { rawSha256: artifact.raw_sha256, canonicalSha256: artifact.canonical_sha256 } : null,
      witness: witness ? { tsaTokenSha256: witness.tsa_token_sha256 } : null,
      signedVerdict,
      publications: publications.map(p => ({ claimId: p.claim_id, revisionId: p.revision_id, rawSha256: p.raw_sha256, canonicalSha256: p.canonical_sha256 })),
    };
    const result = await assessLiveAcceptance(evidence);
    console.log(JSON.stringify(result, null, 1));
    process.exitCode = result.accepted ? 0 : 1;
  } finally {
    await db.end();
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 2; });

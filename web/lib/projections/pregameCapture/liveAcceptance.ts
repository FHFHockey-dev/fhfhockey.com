// Offline acceptance audit for one live, game-scoped FORGE run: claim → signed verdict (pinned key, official T−60) →
// exactly one publication → both RSO readers. Pure: the caller loads the rows read-only; the verdict decision is the same
// checkSignedVerdict the publish route and readers use (pinned keys), so the database's own gates are never trusted here.

import { checkSignedVerdict, verifySignedVerdict, type SignedVerdictVerify } from "./signedVerdictGate";

type Reader = { selectedRun?: string | null; revisionId?: string | null; points?: number | null; reason?: string | null } | null;
export type AcceptanceEvidence = {
  gameId: number;
  /** The release the live run was armed for (reported; the signed verdict carries the verifier bundle's own release). */
  release: string | null;
  game: { startTime: string } | null;
  run: { outcome: string | null; claimId: string | null; revisionId: string | null; scheduledStart: string;
    publishFinishedAt: string | null; readers: { daily?: Reader; detailed?: Reader } | null } | null;
  claim: { id: string; gameId: number; scheduledStart: string } | null;
  outcome: string | null;
  artifact: { rawSha256: string; canonicalSha256: string } | null;
  witness: { tsaTokenSha256: string } | null;
  signedVerdict: unknown;
  /** Every publication row whose claim belongs to this game. */
  publications: { claimId: string; revisionId: string; rawSha256: string; canonicalSha256: string }[];
};
export type AcceptanceCheck = { name: string; ok: boolean; detail: string };

export async function assessLiveAcceptance(e: AcceptanceEvidence, verify: SignedVerdictVerify = verifySignedVerdict) {
  const checks: AcceptanceCheck[] = [];
  const add = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); return ok; };
  const run = e.run, claim = e.claim;

  add("run_succeeded", run?.outcome === "succeeded" && !!run.claimId, `outcome=${run?.outcome ?? "none"}`);
  const custody = add("custody_qualified", !!claim && claim.id === run?.claimId && claim.gameId === e.gameId && e.outcome === "qualified"
    && !!e.artifact && !!e.witness, `claim=${claim?.id ?? "none"} outcome=${e.outcome ?? "none"}`);

  if (custody && claim && e.artifact && e.witness) {
    const decision = checkSignedVerdict(e.signedVerdict, { claimId: claim.id, gameId: e.gameId, raw: e.artifact.rawSha256,
      canonical: e.artifact.canonicalSha256, tsaTokenSha256: e.witness.tsaTokenSha256 }, claim.scheduledStart, verify);
    add("signed_verdict", decision.ok, decision.ok
      ? `valid; officialStart=${decision.officialStart} deadline=${decision.deadline} verifiedAt=${decision.verifiedAt}`
      : `rejected:${decision.reason}`);
  } else add("signed_verdict", false, "no qualified custody to bind a verdict to");

  const pubs = e.publications;
  const pub = pubs.length === 1 ? pubs[0] : null;
  add("exactly_one_publication", !!pub && pub.claimId === run?.claimId && pub.revisionId === run?.revisionId
    && pub.rawSha256 === e.artifact?.rawSha256 && pub.canonicalSha256 === e.artifact?.canonicalSha256,
    `publications=${pubs.length} revision=${pub?.revisionId ?? "none"}`);
  add("published_before_puck_drop", !!run?.publishFinishedAt && !!e.game
    && Date.parse(run.publishFinishedAt) < Math.min(Date.parse(run.scheduledStart), Date.parse(e.game.startTime)),
    `publishFinishedAt=${run?.publishFinishedAt ?? "none"}`);

  const daily = run?.readers?.daily ?? null, detailed = run?.readers?.detailed ?? null;
  add("daily_reader_on_claim", !!daily && !!run?.claimId && daily.selectedRun === run.claimId
    && daily.revisionId === `forge-daily-bridge-v1:${run.claimId}`, `selectedRun=${daily?.selectedRun ?? "none"}`);
  add("detailed_reader_on_revision", !!detailed && !!run?.claimId && detailed.selectedRun === run.claimId
    && detailed.revisionId === run.revisionId, `revisionId=${detailed?.revisionId ?? "none"}`);

  return { gameId: e.gameId, accepted: checks.every(c => c.ok), checks };
}

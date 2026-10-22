import observations from "./iftttComparisonObservations.json";
import { evaluateLocalAliasIdentityReview } from "../tweetIdentityLocalReview";
import { gradeLocalIdentityComparison, type IdentityEvaluationSample } from "../tweetIdentityEvaluation";
import { buildPlayerIdentitySnapshot, identityDigest, indexPlayerIdentitySnapshot } from "../playerIdentitySnapshot";
import { offlineIdentityIndex, offlineIdentityReply, offlineIdentitySource } from "./tweetIdentityOfflineFixture";
import type { AliasReviewName } from "../playerAliasReview";

/** Authored fixture expectations are intentionally separate from the source-only caller input. */
export async function runIdentityDevelopmentComparison() {
  const index = offlineIdentityIndex(), samples: IdentityEvaluationSample[] = [];
  const cases: Array<{ id: string; text: string; names: string[]; expected: Array<string | null>; nonPlayer?: boolean; chunk?: boolean; badOffset?: boolean; publishedAt?: string }> = [
    { id: "alias", text: "Sparky remains out.", names: ["Sparky"], expected: ["nhl:1001"] },
    { id: "typo", text: "Milo Nort could return.", names: ["Milo Nort"], expected: ["nhl:1001"] },
    { id: "ambiguous", text: "Vale practiced today.", names: ["Vale"], expected: [null] },
    { id: "compound-row", text: "Émile St-Pierre — Luc Del Bel — Milo North", names: ["Émile St-Pierre", "Luc Del Bel", "Milo North"], expected: ["nhl:1004", "nhl:1005", "nhl:1001"], chunk: true },
    { id: "heading", text: "Blackhawks lines", names: ["Blackhawks lines"], expected: [null], nonPlayer: true },
    { id: "non-player", text: "Bluebird is a mascot.", names: ["Bluebird"], expected: [null], nonPlayer: true },
    { id: "scoped-alias", text: "Little Spark returned to practice.", names: ["Little Spark"], expected: ["nhl:1001"], publishedAt: "2026-10-01T12:00:00Z" },
    { id: "stale-alias", text: "Little Spark stayed home.", names: ["Little Spark"], expected: [null] },
    { id: "bad-extractor", text: "Sparky did not practice.", names: ["Sparky"], expected: ["nhl:1001"], badOffset: true },
  ];
  for (const entry of cases) {
    const source = offlineIdentitySource(entry.text, entry.publishedAt);
    source.id = `synthetic:${entry.id}`; source.originalPostId = source.id; source.provenance.lineageKey = source.id;
    const rows: AliasReviewName[] = (entry.chunk ? [entry.text] : entry.names).map(name => ({ raw_name: name, context_text: source.text, team_id: null,
      metadata: entry.chunk ? { reason: "invalid_extraction" } : entry.badOffset ? { evidence: { start: 500, end: 506, text: name } } : undefined }));
    const result = await evaluateLocalAliasIdentityReview({ enabled: true, index, source, rows, resolver: { enabled: true, kind: "mock", transport: async request =>
      offlineIdentityReply(request, (_, i) => {
        const text = request.content.occurrences[i]!.span.text;
        const scripted: Record<string, string> = { Sparky: "nhl:1001", "Milo Nort": "nhl:1001", "Émile St-Pierre": "nhl:1004", "Luc Del Bel": "nhl:1005", "Milo North": "nhl:1001" };
        if (text === "Little Spark" && request.content.source.publishedAt === "2026-10-01T12:00:00Z") return { status: "matched", canonicalId: "nhl:1001" };
        return scripted[text] ? { status: "matched", canonicalId: scripted[text]! } : { status: text === "Bluebird" ? "not_player" : "ambiguous", canonicalId: null };
      }) } });
    samples.push({ id: source.id, lineageKey: source.provenance.lineageKey, sourceText: source.text, sourceHash: identityDigest(source.text), directoryHash: index.snapshot.hash,
      cohort: "synthetic_development", result, heldReason: null, label: {
        provenance: "synthetic_authored", complete: true, adjudicator: "fixture author (not independent human gold)", evidence: "Synthetic intended identities and structural controls; no efficacy inference",
        sourceHash: identityDigest(source.text), directoryHash: index.snapshot.hash,
        occurrences: entry.names.map((name, i) => ({ span: { start: source.text.indexOf(name), end: source.text.indexOf(name) + name.length, text: name },
          kind: entry.expected[i] ? "player" : entry.nonPlayer ? "non_player" : "ambiguous", canonicalId: entry.expected[i]! })),
      } });
  }
  // Retained observations are approved development inputs, explicitly NOT canonical-identity gold.
  // No real directory export is available: keep that missingness instead of inventing NHL IDs/aliases.
  const realIndex = indexPlayerIdentitySnapshot(buildPlayerIdentitySnapshot({ asOf: "2026-10-20T12:00:00Z",
    provenance: "No approved real identity export supplied; empty context", records: [],
    completeness: { status: "unknown", scope: "Retained real development observations", omittedRecords: null } }));
  for (const record of observations.records) {
    const source = offlineIdentitySource(record.text, record.publishedAt);
    source.id = `retained:${record.id}`; source.originalPostId = record.sourceId; source.authorId = record.author;
    source.url = `https://x.com/${record.author.replace(/^@/, "")}/status/${record.sourceId}`;
    source.provenance = { kind: "approved_local", label: "Retained comparison observation; derived URL, not identity gold",
      lineageKey: record.id.startsWith("S10") ? "development-family:S10-unverified-relation" : `development-family:${record.id}` };
    let result = null;
    if (record.receivedAt) {
      source.receivedAt = record.receivedAt;
      const names = record.id === "S06" ? ["Podkolzin", "RNH"] : record.id === "S04" ? [record.text.split("PP1: ")[1]!.split("\n")[0]!.trim()] : ["5-on-3 drill"];
      result = await evaluateLocalAliasIdentityReview({ enabled: true, source, index: realIndex,
        rows: names.map(name => ({ raw_name: name, context_text: record.text, team_id: null,
          metadata: record.id === "S06" ? undefined : { reason: "invalid_extraction" } })) });
    }
    samples.push({ id: source.id, lineageKey: source.provenance.lineageKey, sourceText: source.text, sourceHash: identityDigest(source.text), directoryHash: realIndex.snapshot.hash,
      cohort: "real_development", label: null, result, heldReason: record.receivedAt ? null : "missing_retained_receipt_time" });
  }
  return { samples, report: gradeLocalIdentityComparison(samples) };
}

import { isDeepStrictEqual } from "node:util";
import type { LunaEvaluationExpected } from "./fixtures/tweetLunaEvaluation";
import type { runRetainedTweetLunaReview } from "./tweetLunaReview";

/** Compare with predeclared labels, never derive truth from validator acceptance.
 * Identity spans remain exact. Goalie evidence must be one of the frozen variants.
 * Array ordering is not meaningful; duplicate/missing/unexpected IDs still fail.
 */
export function scoreLunaEvaluation(expected: LunaEvaluationExpected, review: Awaited<ReturnType<typeof runRetainedTweetLunaReview>>) {
  const sameOccurrences = <T extends { occurrenceId: string }, U extends { occurrenceId: string }>(
    actual: readonly T[], labels: readonly U[], same: (actual: T, label: U) => boolean,
  ) => actual.length === labels.length && new Set(actual.map(a => a.occurrenceId)).size === actual.length
    && labels.every(label => {
      const value = actual.find(a => a.occurrenceId === label.occurrenceId);
      return value !== undefined && same(value, label);
    });
  const identities = review.identity?.occurrences ?? [];
  const identity = review.identity !== null && sameOccurrences(identities, expected.identity,
    (actual, label) => actual.canonicalId === label.canonicalId && actual.status === label.status && isDeepStrictEqual(actual.evidence, label.evidence));
  const goalie = expected.allowUnknownInsteadOfOmission
    ? new Set(review.goalieStatuses.map(g => g.occurrenceId)).size === review.goalieStatuses.length
      && review.goalieStatuses.every(g => g.status === "unknown" && expected.identity.some(i => i.occurrenceId === g.occurrenceId
        && i.status === "matched" && i.canonicalId === g.canonicalId))
    : sameOccurrences(review.goalieStatuses, expected.goalie, (actual, label) => actual.canonicalId === label.canonicalId
      && actual.status === label.status && expected.goalieEvidenceVariants.find(v => v.occurrenceId === label.occurrenceId)
        ?.allowedSpans.some(span => isDeepStrictEqual(span, actual.evidence)) === true);
  const value = review.decisionReview;
  const decisions = !expected.decisions || (value?.status === "bound_review"
    && value.post?.status === "scored" && value.post.type === "predicate" && (value.post.probability > 0.5) === expected.decisions.relevance
    && value.claims.length === 1 && value.claims.every(c => c.support?.status === "scored" && c.support.type === "choice"
      && c.support.choice === expected.decisions!.support && c.wording?.status === "scored" && c.wording.type === "choice"
      && c.wording.choice === expected.decisions!.wording));
  return { identity, goalie, decisions, labelMatch: review.status === "review_only" && identity && goalie && decisions };
}

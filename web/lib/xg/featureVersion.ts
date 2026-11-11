/**
 * xG shot-feature definition versions (rule 21: issued evidence stays as
 * issued; a changed definition is a new version). Rows of one
 * `feature_version` must all come from one set of definitions, so served
 * scores never mix old and new inputs.
 *
 * v1: event layer before the math-audit L1 fixes (cb28ffc58): strength
 *     classifier v1, substring miss-reason map, `isEmptyNetEvent` true for
 *     any EN strength state (including the shooter's own empty net),
 *     penalty shots by description text only. The served champion
 *     cfg9bac2706 (p1-st1-f1) and its candidates were built on v1.
 * v2: L1 definitions: one manpower predicate (strength classifier v2,
 *     PBP strength_version 2), exact NHL miss-reason map (v2),
 *     `isEmptyNetEvent` only when the shooter attacks the opponent's empty
 *     net (decision 84), penalty shots by situation code and `ps-` key,
 *     shootout goals not `is_goal`.
 *
 * Only the current version may be (re)built; older versions are read-only
 * history for the models scored on them.
 */
export const XG_FEATURE_VERSION_DEFINITIONS = {
  1: { strengthVersion: 1, missReasonVersion: 1, emptyNet: "any_en_strength_state" },
  2: { strengthVersion: 2, missReasonVersion: 2, emptyNet: "owner_attacks_opponent_empty_net" },
} as const;

export const CURRENT_XG_FEATURE_VERSION = 2 as const;
export const CURRENT_XG_FEATURE_STRENGTH_VERSION =
  XG_FEATURE_VERSION_DEFINITIONS[CURRENT_XG_FEATURE_VERSION].strengthVersion;

export class XgFeatureVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XgFeatureVersionError";
  }
}

/** Refuses a feature build that would write rows under a version whose definitions the code no longer produces. */
export function assertBuildableXgFeatureVersion(args: { featureVersion: number; strengthVersion: number }): void {
  if (args.featureVersion !== CURRENT_XG_FEATURE_VERSION) {
    throw new XgFeatureVersionError(
      `xG feature version ${args.featureVersion} is read-only history; the current event-layer definitions build feature version ${CURRENT_XG_FEATURE_VERSION}.`
    );
  }
  if (args.strengthVersion !== CURRENT_XG_FEATURE_STRENGTH_VERSION) {
    throw new XgFeatureVersionError(
      `xG feature version ${CURRENT_XG_FEATURE_VERSION} is built from PBP strength_version ${CURRENT_XG_FEATURE_STRENGTH_VERSION}, not ${args.strengthVersion}.`
    );
  }
}

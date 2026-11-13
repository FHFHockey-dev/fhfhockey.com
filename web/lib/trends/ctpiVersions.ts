import {
  RECENT_TEAM_FORM_APPROVED_PUBLICATION_STATUS,
  RECENT_TEAM_FORM_FORMULA_VERSION,
  RECENT_TEAM_FORM_INPUT_VERSION,
} from "./ctpi";
import {
  RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION,
  RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION,
} from "./recentTeamFormV2";
import { RECENT_TEAM_FORM_V2_CANDIDATE_PUBLICATION_STATUS } from "./recentTeamFormV2Materialization";

/**
 * CTPI version: part of the team_ctpi_daily row identity (season_id, team,
 * date, ctpi_version) from migration 20261113160000. v1 rows are frozen issued
 * history (rule 21); the daily writer issues v2 beside them.
 */
export type CtpiVersion = 1 | 2;

export type CtpiVersionContract = {
  ctpiVersion: CtpiVersion;
  formulaVersion: string;
  inputVersion: string;
  label: string;
  /** Source games a row for date D may use. */
  sourceCutoff: "games_through_date" | "games_before_date";
};

export const CTPI_VERSION_CONTRACTS: Record<CtpiVersion, CtpiVersionContract> =
  {
    1: {
      ctpiVersion: 1,
      formulaVersion: RECENT_TEAM_FORM_FORMULA_VERSION,
      inputVersion: RECENT_TEAM_FORM_INPUT_VERSION,
      label: "CTPI v1 (frozen history; unbounded 50 + 15 × raw)",
      sourceCutoff: "games_through_date",
    },
    2: {
      ctpiVersion: 2,
      formulaVersion: RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION,
      inputVersion: RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION,
      label:
        "Recent Team Form v2 (pooled PP/PK by ice time, bounded 0–100; candidate until validated)",
      sourceCutoff: "games_before_date",
    },
  };

/** The only version the daily writer issues. */
export const CTPI_WRITER_VERSION: CtpiVersion = 2;
/** The version the Recent Team Form readers (API, Start Chart) select by default. */
export const CTPI_SERVED_VERSION: CtpiVersion = 2;

export function parseCtpiVersion(value: unknown): CtpiVersion | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 1 || raw === "1") return 1;
  if (raw === 2 || raw === "2") return 2;
  return null;
}

/**
 * A stored row is served only when its payload is approved and carries the
 * exact formula and input versions of the selected CTPI version. Candidate v2
 * rows stay gated until validated (OWNER-DECISIONS, W1-4 direction).
 */
export function isTrustedCtpiPayload(
  value: unknown,
  version: CtpiVersion,
): boolean {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  const contract = CTPI_VERSION_CONTRACTS[version];
  return (
    payload.publicationStatus ===
      RECENT_TEAM_FORM_APPROVED_PUBLICATION_STATUS &&
    payload.formulaVersion === contract.formulaVersion &&
    payload.inputVersion === contract.inputVersion &&
    Number.isSafeInteger(Number(payload.sourceGameCount)) &&
    Number(payload.sourceGameCount) > 0
  );
}

/** Badge text of the team-page descriptive beta (DISPLAY-PLAN, TJ 2026-11-13). */
export const CTPI_DESCRIPTIVE_BETA_LABEL = "Descriptive beta · not a forecast";

/**
 * Descriptive beta (TJ, 2026-11-13): the team page may describe a candidate v2
 * row exactly as issued. Display only. It accepts only `ctpi_version` 2
 * candidate rows with the exact v2 formula and input versions, at least one
 * source game, and a ready or partial score. Stored payloads carry no version,
 * so callers pass the row's `ctpi_version` column as `ctpiVersion`.
 *
 * It does not loosen `isTrustedCtpiPayload`, relabels nothing, and no
 * projection, ranking, recommendation or game-model reader may import it
 * (import-boundary test in components/TeamDashboard).
 */
export function isDescriptiveBetaCtpiPayload(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  const contract = CTPI_VERSION_CONTRACTS[2];
  const sourceGameCount =
    typeof payload.sourceGameCount === "number" ||
    typeof payload.sourceGameCount === "string"
      ? Number(payload.sourceGameCount)
      : Number.NaN;
  return (
    parseCtpiVersion(payload.ctpiVersion) === 2 &&
    payload.publicationStatus ===
      RECENT_TEAM_FORM_V2_CANDIDATE_PUBLICATION_STATUS &&
    payload.formulaVersion === contract.formulaVersion &&
    payload.inputVersion === contract.inputVersion &&
    Number.isSafeInteger(sourceGameCount) &&
    sourceGameCount > 0 &&
    (payload.status === "ready" || payload.status === "partial")
  );
}

import {
  RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION,
  RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION,
  type RecentTeamFormCandidateScore,
} from "./recentTeamFormV2";
import type { RecentTeamFormCandidateSnapshot } from "./recentTeamFormV2Provenance";

export const RECENT_TEAM_FORM_V2_CANDIDATE_PUBLICATION_STATUS =
  "candidate_unapproved";
export const RECENT_TEAM_FORM_V2_MATERIALIZATION_CONTRACT_VERSION =
  "recent-team-form-v2-materialization-v1";

export type RecentTeamFormCandidateMaterializedPayload =
  RecentTeamFormCandidateScore & {
    publicationStatus: typeof RECENT_TEAM_FORM_V2_CANDIDATE_PUBLICATION_STATUS;
    materializationContractVersion: typeof RECENT_TEAM_FORM_V2_MATERIALIZATION_CONTRACT_VERSION;
    snapshotDate: string;
    computedAt: string;
    sourceCutoffExclusive: string;
    snapshotSourceThroughDate: string | null;
    sourceUpdatedThrough: string | null;
    sourceFingerprint: string;
    sourceGameRows: number;
    snapshotRejectedSourceRows: number;
    snapshotTeamCount: number;
  };

export type RecentTeamFormCandidateMaterializedRow = {
  season_id: number;
  team: string;
  date: string;
  computed_at: string;
  ctpi_raw: number;
  ctpi_0_to_100: number;
  offense: number | null;
  defense: number | null;
  goaltending: number | null;
  special_teams: number | null;
  /** PDO is retained in payload.pdoContext and is not a v2 score component. */
  luck: null;
  payload: RecentTeamFormCandidateMaterializedPayload;
};

export type RecentTeamFormCandidateMaterialization = {
  rows: RecentTeamFormCandidateMaterializedRow[];
  omitted: Array<{
    team: string;
    status: "unavailable";
    reasonCodes: string[];
  }>;
  coverage: {
    snapshotTeams: number;
    materializedRows: number;
    omittedRows: number;
    readyRows: number;
    partialRows: number;
    rowsWithPdoContext: number;
    nullComponents: {
      offense: number;
      defense: number;
      goaltending: number;
      specialTeams: number;
      luck: number;
    };
  };
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function finiteOrNull(value: unknown, label: string): number | null {
  if (value == null) return null;
  if (!isFiniteNumber(value)) {
    throw new Error(`Recent Team Form ${label} is not finite.`);
  }
  return value;
}

function assertFiniteJsonNumbers(value: unknown, path: string): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Recent Team Form payload ${path} is not finite.`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertFiniteJsonNumbers(item, `${path}[${index}]`),
    );
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) =>
      assertFiniteJsonNumbers(item, `${path}.${key}`),
    );
  }
}

function normalizeTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Recent Team Form computedAt is invalid: ${value}`);
  }
  return parsed.toISOString();
}

function validateSnapshot(snapshot: RecentTeamFormCandidateSnapshot): void {
  if (!DATE_PATTERN.test(snapshot.date)) {
    throw new Error(
      `Recent Team Form snapshot date is invalid: ${snapshot.date}`,
    );
  }
  if (
    snapshot.formulaVersion !== RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION ||
    snapshot.inputVersion !== RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION
  ) {
    throw new Error(
      "Recent Team Form snapshot is not the v2 candidate contract.",
    );
  }
  if (snapshot.provenance.sourceCutoffExclusive !== snapshot.date) {
    throw new Error(
      "Recent Team Form snapshot cutoff must equal its consumer date.",
    );
  }
  if (snapshot.provenance.teamCount !== snapshot.scores.length) {
    throw new Error(
      "Recent Team Form snapshot team coverage is internally inconsistent.",
    );
  }
  if (!/^[0-9a-f]{64}$/.test(snapshot.provenance.sourceFingerprint)) {
    throw new Error("Recent Team Form snapshot fingerprint is invalid.");
  }
}

export function materializeRecentTeamFormCandidateSnapshot(args: {
  snapshot: RecentTeamFormCandidateSnapshot;
  seasonId: number;
  computedAt: string;
}): RecentTeamFormCandidateMaterialization {
  const { snapshot, seasonId } = args;
  validateSnapshot(snapshot);
  if (!Number.isSafeInteger(seasonId) || seasonId <= 0) {
    throw new Error(`Recent Team Form season id is invalid: ${seasonId}`);
  }
  const computedAt = normalizeTimestamp(args.computedAt);
  const rows: RecentTeamFormCandidateMaterializedRow[] = [];
  const omitted: RecentTeamFormCandidateMaterialization["omitted"] = [];
  const seenTeams = new Set<string>();

  for (const score of [...snapshot.scores].sort((left, right) =>
    left.team
      .trim()
      .toUpperCase()
      .localeCompare(right.team.trim().toUpperCase()),
  )) {
    const team = score.team.trim().toUpperCase();
    if (!team) {
      throw new Error("Recent Team Form materialization has an empty team.");
    }
    if (seenTeams.has(team)) {
      throw new Error(
        `Recent Team Form materialization has duplicate team ${team}.`,
      );
    }
    seenTeams.add(team);

    const rawScore = finiteOrNull(score.ctpi_raw, `${team} raw score`);
    const displayScore = finiteOrNull(
      score.ctpi_0_to_100,
      `${team} display score`,
    );
    if ((rawScore == null) !== (displayScore == null)) {
      throw new Error(
        `Recent Team Form score fields disagree for team ${team}.`,
      );
    }
    if (score.status === "unavailable") {
      if (rawScore != null || displayScore != null) {
        throw new Error(
          `Unavailable Recent Team Form score is numeric for team ${team}.`,
        );
      }
      omitted.push({
        team,
        status: "unavailable",
        reasonCodes: Array.from(
          new Set([...score.warnings, "score_unavailable"]),
        ),
      });
      continue;
    }
    if (rawScore == null || displayScore == null) {
      throw new Error(
        `Available Recent Team Form score is missing for team ${team}.`,
      );
    }
    if (displayScore <= 0 || displayScore >= 100) {
      throw new Error(
        `Recent Team Form display score is outside the open 0-100 range for team ${team}.`,
      );
    }

    const components = {
      offense: finiteOrNull(score.components.offense, `${team} offense`),
      defense: finiteOrNull(score.components.defense, `${team} defense`),
      goaltending: finiteOrNull(
        score.components.goaltending,
        `${team} goaltending`,
      ),
      specialTeams: finiteOrNull(
        score.components.specialTeams,
        `${team} special teams`,
      ),
    };
    const payload: RecentTeamFormCandidateMaterializedPayload = {
      ...score,
      team,
      ctpi_raw: rawScore,
      ctpi_0_to_100: displayScore,
      components,
      publicationStatus: RECENT_TEAM_FORM_V2_CANDIDATE_PUBLICATION_STATUS,
      materializationContractVersion:
        RECENT_TEAM_FORM_V2_MATERIALIZATION_CONTRACT_VERSION,
      snapshotDate: snapshot.date,
      computedAt,
      sourceCutoffExclusive: snapshot.provenance.sourceCutoffExclusive,
      snapshotSourceThroughDate: snapshot.provenance.sourceThroughDate,
      sourceUpdatedThrough: snapshot.provenance.sourceUpdatedThrough,
      sourceFingerprint: snapshot.provenance.sourceFingerprint,
      sourceGameRows: snapshot.provenance.sourceGameRows,
      snapshotRejectedSourceRows: snapshot.provenance.rejectedSourceRows,
      snapshotTeamCount: snapshot.provenance.teamCount,
    };
    assertFiniteJsonNumbers(payload, team);

    rows.push({
      season_id: seasonId,
      team,
      date: snapshot.date,
      computed_at: computedAt,
      ctpi_raw: rawScore,
      ctpi_0_to_100: displayScore,
      offense: components.offense,
      defense: components.defense,
      goaltending: components.goaltending,
      special_teams: components.specialTeams,
      luck: null,
      payload,
    });
  }

  return {
    rows,
    omitted,
    coverage: {
      snapshotTeams: snapshot.scores.length,
      materializedRows: rows.length,
      omittedRows: omitted.length,
      readyRows: rows.filter((row) => row.payload.status === "ready").length,
      partialRows: rows.filter((row) => row.payload.status === "partial")
        .length,
      rowsWithPdoContext: rows.filter((row) =>
        isFiniteNumber(row.payload.pdoContext.value),
      ).length,
      nullComponents: {
        offense: rows.filter((row) => row.offense == null).length,
        defense: rows.filter((row) => row.defense == null).length,
        goaltending: rows.filter((row) => row.goaltending == null).length,
        specialTeams: rows.filter((row) => row.special_teams == null).length,
        luck: rows.length,
      },
    },
  };
}

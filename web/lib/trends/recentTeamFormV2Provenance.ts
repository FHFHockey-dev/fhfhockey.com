import {
  sha256CanonicalJson,
  stableJsonStringify,
} from "lib/projections/materializationFingerprint";

import { isOneGameTeamRow, type TeamGameRow } from "./ctpi";
import {
  computeRecentTeamFormCandidateMetrics,
  computeRecentTeamFormCandidateV2,
  RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION,
  RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION,
  type RecentTeamFormCandidateScore,
} from "./recentTeamFormV2";

export type RecentTeamFormSourceRow = TeamGameRow & {
  /** Latest update timestamp across the source records joined into this row. */
  sourceUpdatedAt?: string | null;
};

export type RecentTeamFormCandidateSnapshotProvenance = {
  sourceCutoffExclusive: string;
  sourceThroughDate: string | null;
  sourceUpdatedThrough: string | null;
  sourceFingerprint: string;
  sourceGameRows: number;
  rejectedSourceRows: number;
  teamCount: number;
};

export type RecentTeamFormCandidateSnapshot = {
  date: string;
  formulaVersion: typeof RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION;
  inputVersion: typeof RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION;
  provenance: RecentTeamFormCandidateSnapshotProvenance;
  scores: RecentTeamFormCandidateScore[];
};

export type PersistedRecentTeamFormSnapshotProvenance = {
  date: string;
  formulaVersion: string | null;
  inputVersion: string | null;
  sourceCutoffExclusive: string | null;
  sourceFingerprint: string | null;
  sourceUpdatedThrough: string | null;
};

export type RecentTeamFormReplayReason =
  | "missing_persisted_snapshot"
  | "inconsistent_persisted_provenance"
  | "formula_version_changed"
  | "input_version_changed"
  | "source_cutoff_changed"
  | "source_fingerprint_missing"
  | "source_fingerprint_changed"
  | "source_watermark_missing"
  | "source_watermark_advanced"
  | "source_watermark_changed";

export type RecentTeamFormReplayDecision = {
  date: string;
  reasons: RecentTeamFormReplayReason[];
  snapshot: RecentTeamFormCandidateSnapshot;
};

const SOURCE_VALUE_KEYS = [
  "gp",
  "xgf_per_60",
  "hdcf_per_60",
  "gf_per_60",
  "xga_per_60",
  "hdca_per_60",
  "ca_per_60",
  "goals_against",
  "xga",
  "powerPlayToi",
  "pp_xgf",
  "toi_shorthanded",
  "pk_xga",
  "pdo",
  "toi_all_seconds",
] as const satisfies ReadonlyArray<keyof TeamGameRow>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function assertCalendarDate(value: string): void {
  if (!isCalendarDate(value)) {
    throw new Error(`Recent Team Form snapshot date is invalid: ${value}`);
  }
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizedTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function canonicalSourceRow(row: RecentTeamFormSourceRow) {
  return {
    team: row.team.trim().toUpperCase(),
    date: row.date,
    values: Object.fromEntries(
      SOURCE_VALUE_KEYS.map((key) => [key, finiteOrNull(row[key])]),
    ),
  };
}

function buildSnapshotProvenance(
  rows: RecentTeamFormSourceRow[],
  consumerDate: string,
): RecentTeamFormCandidateSnapshotProvenance {
  const eligibleRows = rows.filter(
    (row) =>
      isCalendarDate(row.date) &&
      row.date < consumerDate &&
      row.team.trim().length > 0 &&
      isOneGameTeamRow(row),
  );
  const canonicalRows = eligibleRows
    .map(canonicalSourceRow)
    .sort((left, right) => {
      return (
        left.team.localeCompare(right.team) ||
        left.date.localeCompare(right.date) ||
        stableJsonStringify(left).localeCompare(stableJsonStringify(right))
      );
    });
  const sourceDates = eligibleRows.map((row) => row.date).sort();
  const sourceTimestamps = eligibleRows
    .flatMap((row) => {
      const timestamp = normalizedTimestamp(row.sourceUpdatedAt);
      return timestamp ? [timestamp] : [];
    })
    .sort();
  const teams = new Set(canonicalRows.map((row) => row.team));
  const rejectedSourceRows = rows.filter(
    (row) =>
      !isCalendarDate(row.date) ||
      (row.date < consumerDate &&
        (row.team.trim().length === 0 || !isOneGameTeamRow(row))),
  ).length;

  return {
    sourceCutoffExclusive: consumerDate,
    sourceThroughDate: sourceDates.at(-1) ?? null,
    sourceUpdatedThrough: sourceTimestamps.at(-1) ?? null,
    sourceFingerprint: sha256CanonicalJson({
      contractVersion: 1,
      inputVersion: RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION,
      sourceCutoffExclusive: consumerDate,
      rows: canonicalRows,
    }),
    sourceGameRows: canonicalRows.length,
    rejectedSourceRows,
    teamCount: teams.size,
  };
}

export function buildRecentTeamFormCandidateSnapshot(
  rows: RecentTeamFormSourceRow[],
  consumerDate: string,
): RecentTeamFormCandidateSnapshot {
  assertCalendarDate(consumerDate);
  const priorRows = rows.filter(
    (row) => isCalendarDate(row.date) && row.date < consumerDate,
  );
  const validTeams = new Set(
    priorRows
      .filter((row) => row.team.trim().length > 0 && isOneGameTeamRow(row))
      .map((row) => row.team.trim().toUpperCase()),
  );
  const metrics = Array.from(validTeams)
    .sort()
    .map((team) =>
      computeRecentTeamFormCandidateMetrics(
        priorRows
          .filter((row) => row.team.trim().toUpperCase() === team)
          .map((row) => ({ ...row, team })),
      ),
    );

  return {
    date: consumerDate,
    formulaVersion: RECENT_TEAM_FORM_V2_CANDIDATE_FORMULA_VERSION,
    inputVersion: RECENT_TEAM_FORM_V2_CANDIDATE_INPUT_VERSION,
    provenance: buildSnapshotProvenance(rows, consumerDate),
    scores: computeRecentTeamFormCandidateV2(metrics),
  };
}

function persistedRowsAgree(
  rows: PersistedRecentTeamFormSnapshotProvenance[],
): boolean {
  if (rows.length < 2) return true;
  const first = stableJsonStringify(rows[0]);
  return rows.every((row) => stableJsonStringify(row) === first);
}

export function planRecentTeamFormCandidateReplay(args: {
  sourceRows: RecentTeamFormSourceRow[];
  consumerDates: string[];
  persisted: PersistedRecentTeamFormSnapshotProvenance[];
}): {
  replay: RecentTeamFormReplayDecision[];
  unchangedDates: string[];
} {
  const dates = Array.from(new Set(args.consumerDates)).sort();
  dates.forEach(assertCalendarDate);
  const persistedByDate = new Map<
    string,
    PersistedRecentTeamFormSnapshotProvenance[]
  >();
  for (const row of args.persisted) {
    const existing = persistedByDate.get(row.date) ?? [];
    existing.push(row);
    persistedByDate.set(row.date, existing);
  }

  const replay: RecentTeamFormReplayDecision[] = [];
  const unchangedDates: string[] = [];
  for (const date of dates) {
    const snapshot = buildRecentTeamFormCandidateSnapshot(
      args.sourceRows,
      date,
    );
    const persistedRows = persistedByDate.get(date) ?? [];
    const reasons: RecentTeamFormReplayReason[] = [];
    if (persistedRows.length === 0) {
      reasons.push("missing_persisted_snapshot");
    } else if (!persistedRowsAgree(persistedRows)) {
      reasons.push("inconsistent_persisted_provenance");
    } else {
      const persisted = persistedRows[0];
      if (persisted.formulaVersion !== snapshot.formulaVersion) {
        reasons.push("formula_version_changed");
      }
      if (persisted.inputVersion !== snapshot.inputVersion) {
        reasons.push("input_version_changed");
      }
      if (
        persisted.sourceCutoffExclusive !==
        snapshot.provenance.sourceCutoffExclusive
      ) {
        reasons.push("source_cutoff_changed");
      }
      if (!persisted.sourceFingerprint) {
        reasons.push("source_fingerprint_missing");
      } else if (
        persisted.sourceFingerprint !== snapshot.provenance.sourceFingerprint
      ) {
        reasons.push("source_fingerprint_changed");
      }
      if (
        snapshot.provenance.sourceUpdatedThrough &&
        !persisted.sourceUpdatedThrough
      ) {
        reasons.push("source_watermark_missing");
      } else if (
        snapshot.provenance.sourceUpdatedThrough &&
        persisted.sourceUpdatedThrough &&
        snapshot.provenance.sourceUpdatedThrough !==
          persisted.sourceUpdatedThrough
      ) {
        reasons.push(
          snapshot.provenance.sourceUpdatedThrough >
            persisted.sourceUpdatedThrough
            ? "source_watermark_advanced"
            : "source_watermark_changed",
        );
      }
    }

    if (reasons.length > 0) {
      replay.push({ date, reasons, snapshot });
    } else {
      unchangedDates.push(date);
    }
  }

  return { replay, unchangedDates };
}

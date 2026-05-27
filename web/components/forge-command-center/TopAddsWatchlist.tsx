import Link from "next/link";
import { useMemo } from "react";

import {
  DenseList,
  DenseListRow,
  ModuleState,
  StatusChip,
  TrendSparkline
} from "components/forge-command-center/CommandCenterShell";
import type { CommandCenterData } from "lib/dashboard/commandCenterData";
import {
  rankTopAddsCandidates,
  type TopAddsCandidateInput,
  type TopAddsMode
} from "lib/dashboard/topAddsRanking";
import { teamsInfo } from "lib/teamsInfo";
import styles from "styles/ForgeCommandCenter.module.scss";

type TopAddsWatchlistProps = {
  module: CommandCenterData["modules"]["topAdds"];
  position: "all" | "f" | "d" | "g";
  addMode: TopAddsMode;
  playerHref: (playerId: number | string) => string;
};

type ProjectionRow = {
  player_id: number;
  player_name: string | null;
  team_name: string | null;
  position: string | null;
  pts: number;
  ppp: number;
  sog: number;
  hit: number;
  blk: number;
  uncertainty?: unknown;
};

type ProjectionResponse = {
  data?: ProjectionRow[];
};

type OwnershipPoint = {
  date: string;
  value: number;
};

type OwnershipTrendRow = {
  playerId?: number | null;
  name: string;
  headshot?: string | null;
  displayPosition?: string | null;
  teamFullName?: string | null;
  teamAbbrev?: string | null;
  latest: number;
  delta: number;
  sparkline?: OwnershipPoint[];
};

type OwnershipResponse = {
  selectedPlayers?: OwnershipTrendRow[];
  risers?: OwnershipTrendRow[];
  fallers?: OwnershipTrendRow[];
};

const MIN_OWNERSHIP = 25;
const MAX_OWNERSHIP = 75;
const MAX_ROWS = 5;

const normalizeName = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const formatMetric = (value: number | null | undefined, digits = 1) =>
  value == null || Number.isNaN(value) ? "--" : value.toFixed(digits);

const formatSigned = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "--";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
};

function getOwnershipRows(response: OwnershipResponse | null): OwnershipTrendRow[] {
  if (!response) return [];
  if (Array.isArray(response.selectedPlayers) && response.selectedPlayers.length > 0) {
    return response.selectedPlayers;
  }
  return [...(response.risers ?? []), ...(response.fallers ?? [])];
}

function resolveTeamAbbr(teamAbbrev: string | null | undefined, teamName: string | null | undefined) {
  if (teamAbbrev) return teamAbbrev.toUpperCase();
  const normalizedName = (teamName ?? "").trim().toLowerCase();
  if (!normalizedName) return null;
  return (
    Object.values(teamsInfo).find((team) => team.name.toLowerCase() === normalizedName)
      ?.abbrev ?? null
  );
}

function matchesPosition(position: string | null | undefined, filter: TopAddsWatchlistProps["position"]) {
  const normalized = (position ?? "").toUpperCase();
  if (filter === "all") return true;
  if (filter === "f") return !normalized.includes("D") && !normalized.includes("G");
  if (filter === "d") return normalized.includes("D");
  if (filter === "g") return normalized.includes("G");
  return true;
}

function extractUncertaintyPenalty(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value || typeof value !== "object") return null;
  const model = (value as Record<string, unknown>).model;
  if (!model || typeof model !== "object") return null;
  const skaterSelection = (model as Record<string, unknown>).skater_selection;
  if (!skaterSelection || typeof skaterSelection !== "object") return null;
  const roleContinuity = (skaterSelection as Record<string, unknown>).role_continuity;
  if (!roleContinuity || typeof roleContinuity !== "object") return null;
  const volatility = (roleContinuity as Record<string, unknown>).volatility_index;
  return typeof volatility === "number" && Number.isFinite(volatility) ? volatility : null;
}

export default function TopAddsWatchlist({
  module,
  position,
  addMode,
  playerHref
}: TopAddsWatchlistProps) {
  const candidates = useMemo(() => {
    const projections =
      ((module.data.forgePlayers as ProjectionResponse | null)?.data ?? []).filter(
        (row) => Number.isFinite(row.player_id)
      );
    const ownershipRows = getOwnershipRows(
      module.data.ownershipTrends as OwnershipResponse | null
    );
    const ownershipById = new Map<number, OwnershipTrendRow>();
    const ownershipByName = new Map<string, OwnershipTrendRow>();

    ownershipRows.forEach((row) => {
      if (row.playerId != null) ownershipById.set(row.playerId, row);
      ownershipByName.set(normalizeName(row.name), row);
    });

    const inputs = projections.flatMap<TopAddsCandidateInput>((row) => {
      if (!matchesPosition(row.position, position)) return [];
      const ownershipRow =
        ownershipById.get(row.player_id) ??
        ownershipByName.get(normalizeName(row.player_name));
      const ownership = ownershipRow?.latest ?? null;
      if (ownership == null || ownership < MIN_OWNERSHIP || ownership > MAX_OWNERSHIP) {
        return [];
      }

      return [
        {
          playerId: row.player_id,
          name: row.player_name ?? ownershipRow?.name ?? `Player ${row.player_id}`,
          team: ownershipRow?.teamAbbrev ?? ownershipRow?.teamFullName ?? row.team_name,
          teamAbbr: resolveTeamAbbr(ownershipRow?.teamAbbrev, row.team_name),
          position: row.position ?? ownershipRow?.displayPosition ?? null,
          headshot: ownershipRow?.headshot ?? null,
          ownership,
          ownershipTimeline: ownershipRow?.sparkline ?? [],
          delta: ownershipRow?.delta ?? 0,
          projectionPts: row.pts ?? 0,
          ppp: row.ppp ?? 0,
          sog: row.sog ?? 0,
          hit: row.hit ?? 0,
          blk: row.blk ?? 0,
          uncertainty: extractUncertaintyPenalty(row.uncertainty),
          scheduleGamesRemaining: null,
          scheduleOffNightsRemaining: null,
          scheduleLabel: null
        }
      ];
    });

    return rankTopAddsCandidates(inputs, addMode).slice(0, MAX_ROWS);
  }, [addMode, module.data.forgePlayers, module.data.ownershipTrends, position]);

  const renderedModule = candidates.length > 0 ? module : { ...module, status: "empty" as const };

  return (
    <ModuleState module={renderedModule}>
      <div className={styles.topAddsHeaderRow}>
        <StatusChip tone="good">Own {MIN_OWNERSHIP}-{MAX_OWNERSHIP}%</StatusChip>
        <StatusChip tone="live">{addMode === "tonight" ? "Adds 1D" : "Adds 5D"}</StatusChip>
      </div>
      <DenseList
        columns="34px minmax(0, 1.2fr) 52px 74px 70px 56px"
        aria-label="Top adds watchlist"
      >
        {candidates.map((candidate, index) => (
          <DenseListRow key={candidate.playerId}>
            <span>{index + 1}</span>
            <Link href={playerHref(candidate.playerId)} className={styles.playerListLink}>
              {candidate.headshot ? <img src={candidate.headshot} alt="" /> : null}
              <span>
                <strong>{candidate.name}</strong>
                <small>{candidate.teamAbbr ?? candidate.team ?? "--"} · {candidate.position ?? "--"}</small>
              </span>
            </Link>
            <span>{formatMetric(candidate.ownership, 0)}%</span>
            <TrendSparkline
              values={candidate.ownershipTimeline.map((point) => point.value)}
              tone={candidate.delta >= 0 ? "up" : "down"}
              label={`${candidate.name} ownership trend`}
            />
            <strong>{formatMetric(candidate.projectionPts, 1)}</strong>
            <StatusChip tone={candidate.delta >= 0 ? "good" : "danger"}>
              {formatSigned(candidate.score.total)}
            </StatusChip>
          </DenseListRow>
        ))}
      </DenseList>
    </ModuleState>
  );
}

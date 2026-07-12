import Link from "next/link";
import { useMemo, type CSSProperties } from "react";

import {
  DenseList,
  DenseListRow,
  ModuleState,
  StatusChip,
  TrendSparkline
} from "components/forge-command-center/CommandCenterShell";
import type { CommandCenterData } from "lib/dashboard/commandCenterData";
import type { NormalizedSustainabilityRow } from "lib/dashboard/normalizers";
import styles from "styles/ForgeCommandCenter.module.scss";

type PlayerInsightCoreProps = {
  module: CommandCenterData["modules"]["playerInsight"];
  playerHref: (playerId: number | string) => string;
};

type OwnershipTrendRow = {
  playerId?: number | null;
  name: string;
  latest: number;
  delta: number;
  sparkline?: Array<{ date: string; value: number }>;
};

type OwnershipResponse = {
  selectedPlayers?: OwnershipTrendRow[];
  risers?: OwnershipTrendRow[];
  fallers?: OwnershipTrendRow[];
};

type MomentumRow = {
  playerId: number;
  name: string;
  teamAbbr: string | null;
  position: string | null;
  trust: number;
  momentum: number;
  status: "hot" | "cold" | "warm" | "sliding";
  series: number[];
};

const MIN_OWNERSHIP = 25;
const MAX_OWNERSHIP = 50;

const formatScore = (value: number | null | undefined, digits = 0) =>
  value == null || Number.isNaN(value) ? "--" : value.toFixed(digits);

const formatSigned = (value: number | null | undefined, digits = 1) => {
  if (value == null || Number.isNaN(value)) return "--";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
};

function getOwnershipRows(response: OwnershipResponse | null): OwnershipTrendRow[] {
  if (!response) return [];
  if (Array.isArray(response.selectedPlayers) && response.selectedPlayers.length > 0) {
    return response.selectedPlayers;
  }
  return [...(response.risers ?? []), ...(response.fallers ?? [])];
}

function getOwnershipMap(response: OwnershipResponse | null) {
  const byId = new Map<number, OwnershipTrendRow>();
  getOwnershipRows(response).forEach((row) => {
    if (row.playerId != null) byId.set(row.playerId, row);
  });
  return byId;
}

function filterByOwnership<T extends { player_id: number }>(
  rows: T[],
  ownershipById: Map<number, OwnershipTrendRow>
) {
  return rows.filter((row) => {
    const ownership = ownershipById.get(row.player_id)?.latest;
    if (ownership == null) return true;
    return ownership >= MIN_OWNERSHIP && ownership <= MAX_OWNERSHIP;
  });
}

function positionLabel(row: NormalizedSustainabilityRow) {
  return row.position_code ?? row.position_group?.toUpperCase() ?? "--";
}

export default function PlayerInsightCore({
  module,
  playerHref
}: PlayerInsightCoreProps) {
  const ownershipById = useMemo(
    () => getOwnershipMap(module.data.ownershipTrends as OwnershipResponse | null),
    [module.data.ownershipTrends]
  );

  const trustRows = useMemo(
    () =>
      filterByOwnership(
        module.data.sustainable.rows.filter((row) => row.player_name),
        ownershipById
      ).slice(0, 4),
    [module.data.sustainable.rows, ownershipById]
  );
  const fadeRows = useMemo(
    () =>
      filterByOwnership(
        module.data.unsustainable.rows.filter((row) => row.player_name),
        ownershipById
      ).slice(0, 4),
    [module.data.unsustainable.rows, ownershipById]
  );

  const momentumRows = useMemo<MomentumRow[]>(() => {
    const aggregate = new Map<
      number,
      {
        percentileTotal: number;
        percentileCount: number;
        deltaTotal: number;
        deltaCount: number;
        series: number[];
      }
    >();

    Object.values(module.data.skaterTrends.categories).forEach((category) => {
      category.rankings.forEach((ranking) => {
        const current = aggregate.get(ranking.playerId) ?? {
          percentileTotal: 0,
          percentileCount: 0,
          deltaTotal: 0,
          deltaCount: 0,
          series: []
        };
        current.percentileTotal += ranking.percentile;
        current.percentileCount += 1;
        current.deltaTotal += ranking.delta;
        current.deltaCount += 1;
        current.series =
          category.series[String(ranking.playerId)]?.map((point) => point.percentile) ??
          current.series;
        aggregate.set(ranking.playerId, current);
      });
    });

    return Array.from(aggregate.entries())
      .map(([playerId, row]) => {
        const metadata = module.data.skaterTrends.playerMetadata[String(playerId)];
        if (!metadata) return null;
        const trust = row.percentileTotal / Math.max(1, row.percentileCount);
        const momentum = row.deltaTotal / Math.max(1, row.deltaCount);
        const ownership = ownershipById.get(playerId)?.latest;
        if (ownership != null && (ownership < MIN_OWNERSHIP || ownership > MAX_OWNERSHIP)) {
          return null;
        }
        return {
          playerId,
          name: metadata.fullName,
          teamAbbr: metadata.teamAbbrev,
          position: metadata.position,
          trust,
          momentum,
          status:
            momentum >= 1.5
              ? "hot"
              : momentum <= -1.5
                ? "cold"
                : trust >= 60
                  ? "warm"
                  : "sliding",
          series: row.series
        } satisfies MomentumRow;
      })
      .filter((row): row is MomentumRow => Boolean(row))
      .sort((a, b) => Math.abs(b.momentum) - Math.abs(a.momentum))
      .slice(0, 7);
  }, [module.data.skaterTrends.categories, module.data.skaterTrends.playerMetadata, ownershipById]);

  const quadrantRows = momentumRows.slice(0, 6);
  const renderedModule =
    module.status === "ready" &&
    trustRows.length + fadeRows.length + momentumRows.length === 0
      ? { ...module, status: "empty" as const }
      : module;

  return (
    <ModuleState module={renderedModule}>
      <div className={styles.playerInsightCore}>
        <div className={styles.topAddsHeaderRow}>
          <StatusChip tone="good">Own {MIN_OWNERSHIP}-{MAX_OWNERSHIP}%</StatusChip>
          <StatusChip tone="muted">Skaters</StatusChip>
        </div>

        <div className={styles.quadrantPlot} aria-label="Trust versus momentum quadrant">
          <span className={styles.quadrantAxisX} />
          <span className={styles.quadrantAxisY} />
          <span className={styles.quadrantLabelTrust}>Trustworthy Risers</span>
          <span className={styles.quadrantLabelFade}>Cold Fades</span>
          {quadrantRows.map((row) => {
            const left = Math.max(4, Math.min(96, 50 + row.momentum * 14));
            const top = Math.max(8, Math.min(88, 100 - row.trust));
            return (
              <Link
                key={`quadrant-${row.playerId}`}
                href={playerHref(row.playerId)}
                className={styles.quadrantPoint}
                style={{ left: `${left}%`, top: `${top}%` } as CSSProperties}
                title={row.name}
              >
                {row.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
              </Link>
            );
          })}
        </div>

        <div className={styles.insightTables}>
          <DenseList columns="minmax(0, 1.1fr) 52px 64px 62px" aria-label="Top sustainable plays">
            {trustRows.map((row) => (
              <DenseListRow key={`trust-${row.player_id}`}>
                <Link href={playerHref(row.player_id)} className={styles.playerListLink}>
                  <span>
                    <strong>{row.player_name}</strong>
                    <small>{positionLabel(row)}</small>
                  </span>
                </Link>
                <strong>{formatScore(row.s_100)}</strong>
                <span>{formatSigned(row.luck_pressure, 2)}</span>
                <StatusChip tone="good">Trust</StatusChip>
              </DenseListRow>
            ))}
          </DenseList>

          <DenseList columns="minmax(0, 1.1fr) 52px 64px 62px" aria-label="Regression risk candidates">
            {fadeRows.map((row) => (
              <DenseListRow key={`fade-${row.player_id}`}>
                <Link href={playerHref(row.player_id)} className={styles.playerListLink}>
                  <span>
                    <strong>{row.player_name}</strong>
                    <small>{positionLabel(row)}</small>
                  </span>
                </Link>
                <strong>{formatScore(row.s_100)}</strong>
                <span>{formatSigned(row.luck_pressure, 2)}</span>
                <StatusChip tone="danger">Fade</StatusChip>
              </DenseListRow>
            ))}
          </DenseList>
        </div>

        <DenseList
          columns="minmax(0, 1fr) 52px 92px 62px"
          aria-label="Hot and cold momentum tracker"
        >
          {momentumRows.map((row) => (
            <DenseListRow key={`momentum-${row.playerId}`}>
              <Link href={playerHref(row.playerId)} className={styles.playerListLink}>
                <span>
                  <strong>{row.name}</strong>
                  <small>{row.teamAbbr ?? "--"} · {row.position ?? "--"}</small>
                </span>
              </Link>
              <span>{formatSigned(row.momentum)}</span>
              <TrendSparkline
                values={row.series}
                tone={row.momentum >= 0 ? "up" : "down"}
                label={`${row.name} momentum`}
              />
              <StatusChip tone={row.status === "hot" || row.status === "warm" ? "good" : "danger"}>
                {row.status}
              </StatusChip>
            </DenseListRow>
          ))}
        </DenseList>
      </div>
    </ModuleState>
  );
}

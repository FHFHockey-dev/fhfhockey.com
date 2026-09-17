import styles from "./PlayerStats.module.scss";

export type PlayerLineupDeploymentTally = {
  deployment_group: "forward" | "defense" | "power_play";
  deployment_code: string;
  deployment_label: string;
  games: number;
  total_games: number;
  share: number | string;
};

type PlayerLineupDeploymentGridProps = {
  rows: PlayerLineupDeploymentTally[];
  positions?: readonly string[];
  compact?: boolean;
  seasonLabel?: string;
};

const FORWARD_GRID = [
  ["F1_LW", "F1_C", "F1_RW"],
  ["F2_LW", "F2_C", "F2_RW"],
  ["F3_LW", "F3_C", "F3_RW"],
  ["F4_LW", "F4_C", "F4_RW"]
] as const;

const DEFENSE_GRID = [
  ["D1_LD", "D1_RD"],
  ["D2_LD", "D2_RD"],
  ["D3_LD", "D3_RD"]
] as const;

const POWER_PLAY_GRID = [["PP1", "PP2"]] as const;

function buildMap(rows: PlayerLineupDeploymentTally[]) {
  return new Map(rows.map((row) => [row.deployment_code, row]));
}

function formatPct(value: number | string | undefined) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return `${Math.round(numeric * 100)}%`;
}

function renderCell(
  rowByCode: Map<string, PlayerLineupDeploymentTally>,
  code: string
) {
  const row = rowByCode.get(code);
  const share = Number(row?.share ?? 0);
  const pct = formatPct(row?.share);

  return (
    <div
      key={code}
      className={`${styles.lcpgCell} ${pct ? styles.lcpgCellActive : ""}`}
      title={
        row
          ? `${row.deployment_label}: ${pct} (${row.games}/${row.total_games})`
          : code
      }
      style={{ "--lcpg-share": Math.max(0, Math.min(1, share)) } as any}
    >
      {pct && <span>{pct}</span>}
    </div>
  );
}

function renderGrid(
  rowByCode: Map<string, PlayerLineupDeploymentTally>,
  grid: readonly (readonly string[])[],
  className: string
) {
  return (
    <div className={className}>
      {grid.flatMap((line) => line.map((code) => renderCell(rowByCode, code)))}
    </div>
  );
}

export function PlayerLineupDeploymentGrid({
  rows,
  positions,
  compact = false,
  seasonLabel = "Regular season",
}: PlayerLineupDeploymentGridProps) {
  if (rows.length === 0) return null;

  const rowByCode = buildMap(rows);
  const normalizedPositions = positions?.map((position) => position.toUpperCase());
  const hasForward = normalizedPositions?.some((position) => ["F", "C", "LW", "RW", "W", "L", "R"].includes(position));
  const hasDefense = normalizedPositions?.some((position) => ["D", "LD", "RD"].includes(position));
  const knownPosition = hasForward || hasDefense;
  const showForwards = knownPosition ? hasForward : rows.some((row) => row.deployment_group === "forward" && row.games > 0);
  const showDefense = knownPosition ? hasDefense : rows.some((row) => row.deployment_group === "defense" && row.games > 0);

  return (
    <section aria-label="Lineup deployment" className={`${styles.lcpgSection} ${compact ? styles.lcpgCompact : ""}`}>
      <div className={styles.lcpgHeader}>
        <h2>Lineup Deployment</h2>
        <span>{seasonLabel}</span>
      </div>
      <div className={styles.lcpgLayout}>
        {showForwards && <div>
          <div className={styles.lcpgGroupLabel}>Forwards</div>
          {renderGrid(rowByCode, FORWARD_GRID, styles.lcpgForwardGrid)}
        </div>}
        {showDefense && <div>
          <div className={styles.lcpgGroupLabel}>Defense</div>
          {renderGrid(rowByCode, DEFENSE_GRID, styles.lcpgDefenseGrid)}
        </div>}
        <div>
          <div className={styles.lcpgGroupLabel}>Power Play</div>
          {renderGrid(rowByCode, POWER_PLAY_GRID, styles.lcpgPowerPlayGrid)}
        </div>
      </div>
    </section>
  );
}

import { useMemo } from "react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { UnderlyingStatsLandingQuadrantPoint } from "../../lib/underlying-stats/teamLandingDashboard";
import styles from "./UnderlyingStatsQuadrantMap.module.scss";

type UnderlyingStatsQuadrantMapProps = {
  activeTeamAbbr?: string | null;
  averageDefenseProcess: number;
  averageOffenseProcess: number;
  onTeamHover?: (teamAbbr: string | null) => void;
  points: UnderlyingStatsLandingQuadrantPoint[];
};

type QuadrantDotProps = {
  activeTeamAbbr: string | null;
  onTeamHover?: (teamAbbr: string | null) => void;
  payload?: UnderlyingStatsLandingQuadrantPoint;
  x?: number;
  y?: number;
};

const formatSigned = (value: number): string =>
  `${value > 0 ? "+" : ""}${value.toFixed(2)}`;

const QuadrantDot = ({
  activeTeamAbbr,
  onTeamHover,
  payload,
  x,
  y
}: QuadrantDotProps) => {
  if (!payload || typeof x !== "number" || typeof y !== "number") {
    return null;
  }

  const isActive = activeTeamAbbr === payload.teamAbbr;

  return (
    <g
      className={styles.pointGroup}
      onMouseEnter={() => onTeamHover?.(payload.teamAbbr)}
      onMouseLeave={() => onTeamHover?.(null)}
    >
      <circle
        cx={x}
        cy={y}
        r={isActive ? 19 : 15}
        className={isActive ? styles.pointActive : styles.point}
      />
      <text
        x={x}
        y={y + 0.5}
        className={isActive ? styles.pointLabelActive : styles.pointLabel}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {payload.teamAbbr}
      </text>
    </g>
  );
};

type TooltipContentProps = {
  active?: boolean;
  payload?: Array<{ payload: UnderlyingStatsLandingQuadrantPoint }>;
};

const QuadrantTooltip = ({ active, payload }: TooltipContentProps) => {
  const point = active ? payload?.[0]?.payload : null;

  if (!point) {
    return null;
  }

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipHeader}>
        <span className={styles.tooltipTeam}>{point.teamAbbr}</span>
        <span className={styles.tooltipName}>{point.teamName}</span>
      </div>
      <div className={styles.tooltipMetrics}>
        <span>Power {point.power.toFixed(1)}</span>
        <span>Trend {point.trend > 0 ? "+" : ""}{point.trend.toFixed(1)}</span>
      </div>
      <p className={styles.tooltipSummary}>{point.summary}</p>
      <ul className={styles.tooltipList}>
        <li>Offensive process {formatSigned(point.offenseProcess)}</li>
        <li>Defensive process {formatSigned(point.defenseProcess)}</li>
      </ul>
      {point.archetypes.length ? (
        <div className={styles.tooltipTags}>
          {point.archetypes.map((tag) => (
            <span key={`${point.teamAbbr}-${tag}`} className={styles.tooltipTag}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default function UnderlyingStatsQuadrantMap({
  activeTeamAbbr = null,
  averageDefenseProcess,
  averageOffenseProcess,
  onTeamHover,
  points
}: UnderlyingStatsQuadrantMapProps) {
  const domain = useMemo(() => {
    if (!points.length) {
      return { x: [-2, 2] as [number, number], y: [-2, 2] as [number, number] };
    }

    const xValues = points.map((point) => point.offenseProcess);
    const yValues = points.map((point) => point.defenseProcess);
    const xMax = Math.max(...xValues.map(Math.abs), 1.8);
    const yMax = Math.max(...yValues.map(Math.abs), 1.8);

    return {
      x: [-(xMax + 0.35), xMax + 0.35] as [number, number],
      y: [-(yMax + 0.35), yMax + 0.35] as [number, number]
    };
  }, [points]);

  return (
    <div className={styles.shell}>
      <div className={styles.quadrantLabels} aria-hidden="true">
        <span className={styles.quadrantTopLeft}>Smothering</span>
        <span className={styles.quadrantTopRight}>Contender lane</span>
        <span className={styles.quadrantBottomLeft}>Low-event drag</span>
        <span className={styles.quadrantBottomRight}>Chaotic</span>
      </div>
      <div className={styles.chartArea}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart
            margin={{ top: 24, right: 12, bottom: 28, left: 0 }}
            onMouseLeave={() => onTeamHover?.(null)}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.08)" />
            <XAxis
              type="number"
              dataKey="offenseProcess"
              domain={domain.x}
              tick={{ fill: "#a7a7ad", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
              label={{
                fill: "#a7a7ad",
                fontSize: 11,
                offset: 10,
                position: "insideBottom",
                value: "Offensive process"
              }}
            />
            <YAxis
              type="number"
              dataKey="defenseProcess"
              domain={domain.y}
              tick={{ fill: "#a7a7ad", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
              label={{
                angle: -90,
                fill: "#a7a7ad",
                fontSize: 11,
                offset: 8,
                position: "insideLeft",
                value: "Defensive process"
              }}
            />
            <ReferenceLine
              x={averageOffenseProcess}
              stroke="rgba(219,165,7,0.35)"
              strokeDasharray="5 5"
            />
            <ReferenceLine
              y={averageDefenseProcess}
              stroke="rgba(219,165,7,0.35)"
              strokeDasharray="5 5"
            />
            {activeTeamAbbr ? (
              <>
                <ReferenceLine
                  x={
                    points.find((point) => point.teamAbbr === activeTeamAbbr)
                      ?.offenseProcess
                  }
                  stroke="rgba(255,255,255,0.18)"
                />
                <ReferenceLine
                  y={
                    points.find((point) => point.teamAbbr === activeTeamAbbr)
                      ?.defenseProcess
                  }
                  stroke="rgba(255,255,255,0.18)"
                />
              </>
            ) : null}
            <Tooltip
              cursor={false}
              content={<QuadrantTooltip />}
              wrapperStyle={{ outline: "none" }}
            />
            <Scatter
              data={points}
              shape={
                <QuadrantDot
                  activeTeamAbbr={activeTeamAbbr}
                  onTeamHover={onTeamHover}
                />
              }
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

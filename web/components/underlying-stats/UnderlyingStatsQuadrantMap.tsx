import { useMemo, type KeyboardEvent } from "react";
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
import { getLocalTeamLogoPath } from "../../lib/images";
import OptimizedImage from "../common/OptimizedImage";
import styles from "./UnderlyingStatsQuadrantMap.module.scss";

type UnderlyingStatsQuadrantMapProps = {
  activeTeamAbbr?: string | null;
  averageDefenseProcess: number;
  averageOffenseProcess: number;
  onTeamPin?: (teamAbbr: string) => void;
  onTeamPreview?: (teamAbbr: string | null) => void;
  pinnedTeamAbbr?: string | null;
  points: UnderlyingStatsLandingQuadrantPoint[];
};

type QuadrantDotProps = {
  onTeamPin?: (teamAbbr: string) => void;
  onTeamPreview?: (teamAbbr: string | null) => void;
  pinnedTeamAbbr: string | null;
  payload?: UnderlyingStatsLandingQuadrantPoint;
  x?: number;
  y?: number;
};

const formatSigned = (value: number): string =>
  `${value > 0 ? "+" : ""}${value.toFixed(2)}`;

const QuadrantDot = ({
  onTeamPin,
  onTeamPreview,
  payload,
  pinnedTeamAbbr,
  x,
  y
}: QuadrantDotProps) => {
  if (!payload || typeof x !== "number" || typeof y !== "number") {
    return null;
  }

  const isPinned = pinnedTeamAbbr === payload.teamAbbr;
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onTeamPin?.(payload.teamAbbr);
  };

  return (
    <g
      className={styles.pointGroup}
      role="button"
      tabIndex={0}
      aria-label={`Pin ${payload.teamName}`}
      aria-pressed={isPinned}
      onBlur={() => onTeamPreview?.(null)}
      onClick={() => onTeamPin?.(payload.teamAbbr)}
      onFocus={() => onTeamPreview?.(payload.teamAbbr)}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => onTeamPreview?.(payload.teamAbbr)}
      onMouseLeave={() => onTeamPreview?.(null)}
    >
      <circle
        cx={x}
        cy={y}
        r={isPinned ? 16 : 13}
        className={isPinned ? styles.pointActive : styles.point}
      />
      <image
        href={getLocalTeamLogoPath(payload.teamAbbr)}
        x={x - 9}
        y={y - 9}
        width={18}
        height={18}
        preserveAspectRatio="xMidYMid meet"
        className={styles.pointLogo}
      />
      <text
        x={x + 15}
        y={y + 0.5}
        className={isPinned ? styles.pointLabelActive : styles.pointLabel}
        textAnchor="start"
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
  onTeamPin,
  onTeamPreview,
  pinnedTeamAbbr = null,
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
  const activePoint = useMemo(
    () =>
      activeTeamAbbr
        ? points.find((point) => point.teamAbbr === activeTeamAbbr) ?? null
        : null,
    [activeTeamAbbr, points]
  );
  const quadrantDot = useMemo(
    () => (
      <QuadrantDot
        onTeamPin={onTeamPin}
        onTeamPreview={onTeamPreview}
        pinnedTeamAbbr={pinnedTeamAbbr}
      />
    ),
    [onTeamPin, onTeamPreview, pinnedTeamAbbr]
  );

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
            onMouseLeave={() => onTeamPreview?.(null)}
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
              stroke="rgba(20,162,210,0.46)"
              strokeDasharray="5 5"
            />
            <ReferenceLine
              y={averageDefenseProcess}
              stroke="rgba(20,162,210,0.46)"
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
              shape={quadrantDot}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.xDirection} aria-hidden="true">
        <span>← Worse</span>
        <span>Better →</span>
      </div>
      <div className={styles.yDirection} aria-hidden="true">
        <span>Better ↑</span>
        <span>Worse ↓</span>
      </div>
      {activePoint ? (
        <aside
          className={styles.selectionCard}
          data-pinned={pinnedTeamAbbr === activePoint.teamAbbr}
          aria-label={`${activePoint.teamName} selected-team context`}
        >
          <div className={styles.selectionHeader}>
            <OptimizedImage
              src={getLocalTeamLogoPath(activePoint.teamAbbr)}
              alt=""
              width={34}
              height={34}
              className={styles.selectionLogo}
            />
            <div>
              <strong>{activePoint.teamAbbr}</strong>
              <span>{activePoint.teamName}</span>
            </div>
            <div className={styles.selectionScore}>
              {activePoint.power.toFixed(1)}
              <span>Power</span>
            </div>
          </div>
          <div className={styles.selectionMetrics}>
            <span>
              <small>Trend</small>
              <strong>{formatSigned(activePoint.trend)}</strong>
            </span>
            <span>
              <small>Off process</small>
              <strong>{formatSigned(activePoint.offenseProcess)}</strong>
            </span>
            <span>
              <small>Def process</small>
              <strong>{formatSigned(activePoint.defenseProcess)}</strong>
            </span>
          </div>
          <p>{activePoint.summary}</p>
          {activePoint.archetypes.length ? (
            <div className={styles.selectionTags}>
              {activePoint.archetypes.slice(0, 2).map((tag) => (
                <span key={`${activePoint.teamAbbr}-${tag}`}>{tag}</span>
              ))}
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}

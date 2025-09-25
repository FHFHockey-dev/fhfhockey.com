import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import * as d3 from "d3";
import supabase from "lib/supabase/client";
import type {
  PlayerMeta,
  PlayerTrendDatum,
  PlayerSearchResult
} from "lib/trends/skoTypes";
import {
  formatNumber,
  formatPercent,
  lookupTeamLabel
} from "lib/trends/skoUtils";
import styles from "./player.module.scss";

interface PredictionRow {
  as_of_date: string;
  pred_points: number | null;
  horizon_games: number;
  model_name: string | null;
  model_version: string | null;
  stability_multiplier: number | null;
}

interface GameRow {
  date: string;
  points: number | null;
}

const CANDLE_COLORS: Record<string, string> = {
  over: "#ff6b6b",
  under: "#44d07b",
  match: "rgba(255,255,255,0.6)"
};

type TrendPoint = PlayerTrendDatum & { timestamp: number; dateObj: Date };

function computePlayerMeta(
  player: PlayerSearchResult | null
): PlayerMeta | null {
  if (!player) return null;
  const teamLabel = lookupTeamLabel(player.team_id) ?? null;
  return {
    id: player.id,
    name: player.fullName,
    position: player.position ?? null,
    teamId: player.team_id ?? null,
    teamLabel
  };
}

function buildTrendData(
  predictions: PredictionRow[],
  games: GameRow[]
): TrendPoint[] {
  const sortedGames = games
    .map((row) => ({
      date: row.date,
      points: Number(row.points ?? 0)
    }))
    .filter((row) => Boolean(row.date))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return predictions
    .map((prediction) => {
      const asOf = prediction.as_of_date;
      const horizon = prediction.horizon_games || 5;
      const predicted = prediction.pred_points ?? null;
      const asOfDate = new Date(asOf);

      const futureGames = sortedGames.filter(
        (game) => new Date(game.date) > asOfDate
      );
      const horizonGames = futureGames.slice(0, horizon);
      const actual =
        horizonGames.length === horizon
          ? horizonGames.reduce((sum, game) => sum + game.points, 0)
          : null;

      const diff =
        actual !== null && predicted !== null ? actual - predicted : null;
      const direction: "over" | "under" | "match" = !diff
        ? "match"
        : diff < 0
          ? "over"
          : diff > 0
            ? "under"
            : "match";
      const low =
        actual !== null && predicted !== null
          ? Math.min(actual, predicted)
          : null;
      const high =
        actual !== null && predicted !== null
          ? Math.max(actual, predicted)
          : null;

      const dateObj = new Date(asOf);
      return {
        date: asOf,
        predicted,
        actual,
        diff,
        low,
        high,
        direction,
        timestamp: dateObj.getTime(),
        dateObj
      } as TrendPoint;
    })
    .filter((entry) => entry.predicted !== null || entry.actual !== null);
}

function computeMetrics(data: TrendPoint[]) {
  const filtered = data.filter(
    (entry) => entry.predicted !== null && entry.actual !== null
  ) as (TrendPoint & { predicted: number; actual: number })[];
  if (!filtered.length) return null;

  const residuals = filtered.map((entry) => entry.actual - entry.predicted);
  const absResiduals = residuals.map((value) => Math.abs(value));
  const mae =
    absResiduals.reduce((sum, value) => sum + value, 0) / filtered.length;
  const rmse = Math.sqrt(
    residuals.reduce((sum, value) => sum + value * value, 0) / filtered.length
  );
  const mapeValues = filtered
    .map((entry) => {
      // skip only when actual is exactly zero to avoid division by zero
      if (entry.actual === 0) return null;
      return Math.abs((entry.actual - entry.predicted) / entry.actual);
    })
    .filter(
      (entry): entry is number => entry !== null && Number.isFinite(entry)
    );
  const mape = mapeValues.length
    ? (mapeValues.reduce((sum, value) => sum + value, 0) / mapeValues.length) *
      100
    : null;

  const withinOne = filtered.filter(
    (entry) => Math.abs(entry.actual - entry.predicted) <= 1
  ).length;
  const hitRate = withinOne / filtered.length;

  return {
    mae,
    rmse,
    mape,
    hitRate,
    sampleSize: filtered.length
  };
}

interface ProjectionChartProps {
  data: TrendPoint[];
}

function ProjectionChart({ data }: ProjectionChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(960);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    setContainerWidth(element.clientWidth || 960);

    if (typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const width = entry.contentRect.width;
        setContainerWidth((prev) =>
          Math.abs(prev - width) > 1 ? width : prev
        );
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svgElement = svgRef.current;
    const tooltipEl = tooltipRef.current;
    if (!svgElement) return;

    const sortedPoints = [...data].sort(
      (a, b) => a.dateObj.getTime() - b.dateObj.getTime()
    );

    if (!sortedPoints.length) {
      d3.select(svgElement).selectAll("*").remove();
      if (tooltipEl) {
        tooltipEl.style.opacity = "0";
      }
      return;
    }

    const baseWidth = Math.max(containerWidth, 640);
    const margin = { top: 28, right: 36, bottom: 40, left: 72 };
    const focusHeight = 320;
    const contextHeight = 80;
    const gap = 32;
    const innerWidth = Math.max(360, baseWidth - margin.left - margin.right);
    const svgWidth = innerWidth + margin.left + margin.right;
    const svgHeight =
      margin.top + focusHeight + gap + contextHeight + margin.bottom;

    const svg = d3
      .select(svgElement)
      .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    svg.selectAll("*").remove();

    const clipId = `projection-clip-${Math.random().toString(36).slice(2, 9)}`;
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("width", innerWidth)
      .attr("height", focusHeight);

    const focus = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const context = svg
      .append("g")
      .attr(
        "transform",
        `translate(${margin.left},${margin.top + focusHeight + gap})`
      );

    const focusContent = focus.append("g").attr("clip-path", `url(#${clipId})`);

    const x = d3.scaleTime().range([0, innerWidth]);
    const x2 = d3.scaleTime().range([0, innerWidth]);
    const y = d3.scaleLinear().range([focusHeight, 0]);
    const y2 = d3.scaleLinear().range([contextHeight, 0]);

    const extent = d3.extent(sortedPoints, (point) => point.dateObj) as [
      Date | undefined,
      Date | undefined
    ];
    if (!extent[0] || !extent[1]) return;

    let [minDate, maxDate] = extent;
    if (minDate.getTime() === maxDate.getTime()) {
      const padding = 48 * 60 * 60 * 1000;
      minDate = new Date(minDate.getTime() - padding);
      maxDate = new Date(maxDate.getTime() + padding);
    }

    x.domain([minDate, maxDate]);
    x2.domain([minDate, maxDate]);

    const valueCandidates = sortedPoints
      .flatMap((point) => [point.predicted, point.actual])
      .filter(
        (value): value is number => value !== null && Number.isFinite(value)
      );

    let minValue = valueCandidates.length ? d3.min(valueCandidates)! : 0;
    let maxValue = valueCandidates.length ? d3.max(valueCandidates)! : 1;
    if (minValue === maxValue) {
      const delta = Math.abs(minValue) < 1 ? 1 : Math.abs(minValue) * 0.25;
      minValue -= delta;
      maxValue += delta;
    }
    const padding = (maxValue - minValue) * 0.15 || 1;
    y.domain([minValue - padding, maxValue + padding]);
    y2.domain(y.domain() as [number, number]);

    const predictedLine = d3
      .line<TrendPoint>()
      .defined((d) => d.predicted !== null)
      .x((d) => x(d.dateObj))
      .y((d) => y(d.predicted as number));

    const actualLine = d3
      .line<TrendPoint>()
      .defined((d) => d.actual !== null)
      .x((d) => x(d.dateObj))
      .y((d) => y(d.actual as number));

    const areaContext = d3
      .area<TrendPoint>()
      .defined((d) => d.predicted !== null)
      .x((d) => x2(d.dateObj))
      .y0(contextHeight)
      .y1((d) => y2(d.predicted as number));

    context
      .append("path")
      .attr("fill", "rgba(79, 195, 247, 0.2)")
      .attr("stroke", "#4fc3f7")
      .attr("stroke-width", 1.2)
      .attr("d", areaContext(sortedPoints));

    const xAxis = focus
      .append("g")
      .attr("transform", `translate(0,${focusHeight})`)
      .attr("class", "axis axis--x");
    const yAxis = focus.append("g").attr("class", "axis axis--y");
    context
      .append("g")
      .attr("transform", `translate(0,${contextHeight})`)
      .attr("class", "axis axis--x2")
      .call(
        d3
          .axisBottom<Date>(x2)
          .ticks(6)
          .tickFormat(d3.timeFormat("%b %d") as (value: Date) => string)
      );

    const focusPredicted = focusContent
      .append("path")
      .attr("fill", "none")
      .attr("stroke", "#4fc3f7")
      .attr("stroke-width", 2);

    const focusActual = focusContent
      .append("path")
      .attr("fill", "none")
      .attr("stroke", "#44d07b")
      .attr("stroke-width", 2);

    const candleGroup = focusContent.append("g").attr("class", "candles");

    const brush = d3
      .brushX()
      .extent([
        [0, 0],
        [innerWidth, contextHeight]
      ])
      .on("brush end", (event) => {
        if (event.selection) {
          const [x0, x1] = event.selection.map(x2.invert);
          x.domain([x0, x1]);
        } else {
          x.domain(x2.domain() as [Date, Date]);
        }
        updateFocus();
      });

    context
      .append("g")
      .attr("class", "brush")
      .call(brush as any)
      .call(brush.move as any, x2.range());

    const crosshair = focus
      .append("g")
      .style("display", "none")
      .attr("class", "crosshair");

    const crosshairLine = crosshair
      .append("line")
      .attr("stroke", "rgba(255,255,255,0.45)")
      .attr("stroke-dasharray", "4 4")
      .attr("y1", 0)
      .attr("y2", focusHeight);

    const crosshairHorizontal = crosshair
      .append("line")
      .attr("stroke", "rgba(255,255,255,0.25)")
      .attr("stroke-dasharray", "4 4");

    const predictedDot = crosshair
      .append("circle")
      .attr("r", 4)
      .attr("fill", "#4fc3f7")
      .attr("stroke", "#0e1c2f")
      .attr("stroke-width", 1.5);

    const actualDot = crosshair
      .append("circle")
      .attr("r", 4)
      .attr("fill", "#44d07b")
      .attr("stroke", "#0e1c2f")
      .attr("stroke-width", 1.5);

    focusContent
      .append("rect")
      .attr("class", "overlay")
      .attr("width", innerWidth)
      .attr("height", focusHeight)
      .style("fill", "transparent")
      .style("pointer-events", "all")
      .on("mousemove", pointerMoved)
      .on("mouseleave", pointerLeft);

    const bisectDate = d3.bisector<TrendPoint, number>((d) =>
      d.dateObj.getTime()
    ).left;

    function updateFocus() {
      focusPredicted.attr("d", predictedLine(sortedPoints) ?? "");
      focusActual.attr("d", actualLine(sortedPoints) ?? "");

      const candleData = sortedPoints.filter(
        (point) => point.predicted !== null && point.actual !== null
      );

      const candles = candleGroup
        .selectAll<SVGGElement, TrendPoint>("g.candle")
        .data(candleData, (d: any) => d.timestamp);

      const candlesEnter = candles.enter().append("g").attr("class", "candle");

      candlesEnter.append("line").attr("class", "wick");
      candlesEnter.append("rect").attr("class", "body");

      const merged = candlesEnter.merge(candles as any);

      merged
        .select<SVGLineElement>("line.wick")
        .attr("x1", (d) => x(d.dateObj))
        .attr("x2", (d) => x(d.dateObj))
        .attr("y1", (d) => y(Math.max(d.predicted!, d.actual!)))
        .attr("y2", (d) => y(Math.min(d.predicted!, d.actual!)))
        .attr(
          "stroke",
          (d) => CANDLE_COLORS[d.direction] ?? CANDLE_COLORS.match
        )
        .attr("stroke-width", 2)
        .attr("stroke-linecap", "round");

      merged
        .select<SVGRectElement>("rect.body")
        .attr("x", (d) => x(d.dateObj) - 6)
        .attr("y", (d) => Math.min(y(d.predicted!), y(d.actual!)))
        .attr("width", 12)
        .attr("height", (d) => {
          const diff = Math.abs(y(d.predicted!) - y(d.actual!));
          return Math.min(focusHeight, Math.max(4, diff));
        })
        .attr("fill", (d) => CANDLE_COLORS[d.direction] ?? CANDLE_COLORS.match)
        .attr("opacity", 0.35)
        .attr("rx", 3)
        .attr("ry", 3);

      candles.exit().remove();

      xAxis.call(
        d3
          .axisBottom<Date>(x)
          .ticks(6)
          .tickFormat(d3.timeFormat("%b %d") as (value: Date) => string)
      );
      yAxis.call(d3.axisLeft(y).ticks(6));
    }

    function pointerMoved(event: any) {
      const [mouseX] = d3.pointer(event);
      if (mouseX < 0 || mouseX > innerWidth) {
        pointerLeft();
        return;
      }

      const date = x.invert(mouseX);
      const index = bisectDate(sortedPoints, date.getTime());
      const pointLeft = sortedPoints[Math.max(0, index - 1)];
      const pointRight = sortedPoints[Math.min(sortedPoints.length - 1, index)];
      const datum = !pointLeft
        ? pointRight
        : !pointRight
          ? pointLeft
          : date.getTime() - pointLeft.dateObj.getTime() >
              pointRight.dateObj.getTime() - date.getTime()
            ? pointRight
            : pointLeft;

      if (!datum) {
        pointerLeft();
        return;
      }

      const cx = x(datum.dateObj);
      crosshair.style("display", null);
      crosshairLine.attr("x1", cx).attr("x2", cx);

      if (datum.predicted !== null) {
        predictedDot
          .style("display", null)
          .attr("cx", cx)
          .attr("cy", y(datum.predicted));
      } else {
        predictedDot.style("display", "none");
      }

      if (datum.actual !== null) {
        actualDot
          .style("display", null)
          .attr("cx", cx)
          .attr("cy", y(datum.actual));
      } else {
        actualDot.style("display", "none");
      }

      const crosshairValue = datum.actual ?? datum.predicted ?? 0;
      const yCoord = y(crosshairValue);
      crosshairHorizontal
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", yCoord)
        .attr("y2", yCoord);

      if (tooltipEl) {
        tooltipEl.innerHTML = `
          <div class="${styles.tooltipTitle}">${format(
            datum.dateObj,
            "MMM d, yyyy"
          )}</div>
          <div class="${styles.tooltipRow}">
            <span>Projected</span><span>${formatNumber(datum.predicted, 2)} pts</span>
          </div>
          <div class="${styles.tooltipRow}">
            <span>Actual</span><span>${formatNumber(datum.actual, 2)} pts</span>
          </div>
          <div class="${styles.tooltipRow}">
            <span>Δ</span><span>${formatNumber(datum.diff, 2)} pts</span>
          </div>
        `;

        const targetValue = datum.actual ?? datum.predicted ?? 0;
        const tooltipWidth = tooltipEl.offsetWidth || 160;
        const tooltipHeight = tooltipEl.offsetHeight || 80;
        const rawLeft = margin.left + cx + 12;
        const rawTop = margin.top + y(targetValue) - tooltipHeight - 12;
        const clampedLeft = Math.min(
          Math.max(12, rawLeft),
          svgWidth - tooltipWidth - 12
        );
        const clampedTop = Math.min(
          Math.max(12, rawTop),
          svgHeight - tooltipHeight - 12
        );

        tooltipEl.style.opacity = "1";
        tooltipEl.style.transform = `translate(${clampedLeft}px, ${clampedTop}px)`;
      }
    }

    function pointerLeft() {
      crosshair.style("display", "none");
      if (tooltipEl) {
        tooltipEl.style.opacity = "0";
      }
    }

    updateFocus();

    return () => {
      svg.selectAll("*").remove();
      if (tooltipEl) {
        tooltipEl.style.opacity = "0";
      }
    };
  }, [data, containerWidth]);

  return (
    <div ref={containerRef} className={styles.chartWrapper}>
      <svg ref={svgRef} className={styles.chartSvg} />
      <div ref={tooltipRef} className={styles.chartTooltip} />
    </div>
  );
}

export default function PlayerTrendPage() {
  const router = useRouter();
  const [meta, setMeta] = useState<PlayerMeta | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<number>(5);
  const [lastRunDate, setLastRunDate] = useState<string | null>(null);

  const playerId = useMemo(() => {
    if (!router.isReady) return null;
    const raw = router.query.playerId;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }, [router.isReady, router.query.playerId]);

  const fetchPlayerData = useCallback(async () => {
    if (!playerId) return;
    setLoading(true);
    setError(null);

    try {
      const { data: playerRows, error: playerErr } = await supabase
        .from("players")
        .select("id, fullName, position, team_id")
        .eq("id", playerId)
        .limit(1);
      if (playerErr) throw playerErr;
      const playerMetaRowRaw = (playerRows ?? [])[0] as
        | (PlayerSearchResult & { fullName?: string })
        | undefined;
      const playerMetaRow: PlayerSearchResult | null = playerMetaRowRaw
        ? {
            id: Number(playerMetaRowRaw.id),
            fullName: playerMetaRowRaw.fullName ?? `Player #${playerId}`,
            position: playerMetaRowRaw.position ?? null,
            team_id: playerMetaRowRaw.team_id ?? null
          }
        : null;
      setMeta(computePlayerMeta(playerMetaRow));

      const { data: predictionRows, error: predictionErr } = await supabase
        .from("predictions_sko")
        .select(
          "as_of_date, pred_points, horizon_games, model_name, model_version, stability_multiplier"
        )
        .eq("player_id", playerId)
        .order("as_of_date", { ascending: true });
      if (predictionErr) throw predictionErr;

      const { data: gameRows, error: gameErr } = await supabase
        .from("player_stats_unified")
        .select("date, points")
        .eq("player_id", playerId)
        .order("date", { ascending: true });
      if (gameErr) throw gameErr;

      const predictions = (predictionRows ?? []) as PredictionRow[];
      if (!predictions.length) {
        setTrendData([]);
        setLastRunDate(null);
        setHorizon(5);
        return;
      }

      const latestPrediction = predictions[predictions.length - 1];
      setLastRunDate(latestPrediction.as_of_date);
      setHorizon(latestPrediction.horizon_games || 5);

      const built = buildTrendData(predictions, (gameRows ?? []) as GameRow[]);
      setTrendData(built);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("Player trend load error", err);
      setError(err?.message ?? "Unable to load player trends");
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    if (!playerId) return;
    fetchPlayerData();
  }, [playerId, fetchPlayerData]);

  const metrics = useMemo(() => computeMetrics(trendData), [trendData]);

  const latestDirection = trendData.length
    ? trendData[trendData.length - 1].direction
    : null;
  const latestDiff = trendData.length
    ? (trendData[trendData.length - 1].diff ?? null)
    : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <span
            className={styles.backLink}
            role="link"
            tabIndex={0}
            onClick={() => router.push("/trends")}
            onKeyDown={(event) => {
              if (event.key === "Enter") router.push("/trends");
            }}
          >
            ← Back to Trends
          </span>
          <h1 className={styles.title}>
            {meta?.name ?? `Player #${playerId ?? "—"}`}
          </h1>
          <p className={styles.subtitle}>
            {meta?.teamLabel ? `${meta.teamLabel}` : ""}
            {meta?.position ? ` · ${meta.position}` : ""}
            {` — ${horizon}-game horizon projections`}
          </p>
        </div>
        <div className={styles.meta}>
          <span>
            {lastRunDate
              ? `Latest inference: ${format(new Date(lastRunDate), "MMM d, yyyy")}`
              : "No predictions yet"}
          </span>
          {latestDiff !== null ? (
            <span>
              Last diff: {formatNumber(latestDiff, 2)} pts — {latestDirection}
            </span>
          ) : null}
        </div>
      </div>

      {error ? <div className={styles.errorState}>{error}</div> : null}
      {loading ? (
        <div className={styles.loading}>Loading trend data…</div>
      ) : null}

      {!loading && !error && !trendData.length ? (
        <div className={styles.emptyState}>
          No predictions are available yet for this skater. Run the pipeline to
          populate sKO projections.
        </div>
      ) : null}

      {metrics ? (
        <div className={styles.metricGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>MAE</span>
            <span className={styles.metricValue}>
              {formatNumber(metrics.mae, 2)} pts
            </span>
            <span className={styles.metricDetail}>
              Across {metrics.sampleSize} prediction windows
            </span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>RMSE</span>
            <span className={styles.metricValue}>
              {formatNumber(metrics.rmse, 2)} pts
            </span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>MAPE</span>
            <span className={styles.metricValue}>
              {metrics.mape !== null
                ? `${formatNumber(metrics.mape, 1)}%`
                : "—"}
            </span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Hit Rate ≤1 pt</span>
            <span className={styles.metricValue}>
              {formatPercent(metrics.hitRate)}
            </span>
          </div>
        </div>
      ) : null}

      {trendData.length ? (
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitle}>Projection vs Actual</div>
            <div className={styles.chartSubtitle}>
              Brush the window below to zoom; hover to inspect. Candles glow
              green when the model undershot actual production and red when it
              overshot.
            </div>
          </div>
          <ProjectionChart data={trendData} />
        </div>
      ) : null}

      {trendData.length ? (
        <div className={styles.tableCard}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Projected</th>
                <th>Actual</th>
                <th>Δ</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {trendData.map((entry) => (
                <tr key={entry.date}>
                  <td>{format(new Date(entry.date), "MMM d, yyyy")}</td>
                  <td>{formatNumber(entry.predicted, 2)}</td>
                  <td>{formatNumber(entry.actual, 2)}</td>
                  <td>{formatNumber(entry.diff, 2)}</td>
                  <td>
                    <span
                      className={`${styles.badge} ${styles[entry.direction]}`}
                    >
                      {entry.direction}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

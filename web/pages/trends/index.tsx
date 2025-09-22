import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as d3 from "d3";

import { buildMockPlayerSeries } from "../../lib/trends/mockData";
import type {
  BaselineDensityPoint,
  PlayerSeries,
  TimeSeriesPoint,
} from "../../lib/trends/types";

type ChartPoint = Omit<TimeSeriesPoint, "date"> & { date: Date };

type StreakSegment = {
  type: "hot" | "cold";
  id: number;
  startIndex: number;
  endIndex: number;
};

type RenderBaselineConfig = {
  svgElement: SVGSVGElement;
  tooltipElement: HTMLDivElement;
  baseline: PlayerSeries["baseline"];
};

type RenderSeriesConfig = {
  svgElement: SVGSVGElement;
  tooltipElement: HTMLDivElement;
  baseline: PlayerSeries["baseline"];
  timeSeries: ChartPoint[];
  span: number;
  lambda: number;
};

type FetchPlayerSeriesParams = {
  playerId: string;
  season: string;
  span: number;
  lambda: number;
  persistence: number;
  signal?: AbortSignal;
};

const PLAYER_NAME_LOOKUP: Record<string, string> = {
  "8478402": "Connor McDavid",
  "8477934": "Nathan MacKinnon",
  "8479318": "Cale Makar",
};

const fetchPlayerSeries = async ({
  playerId,
  season,
  span,
  lambda,
  persistence,
  signal,
}: FetchPlayerSeriesParams): Promise<PlayerSeries> => {
  const params = new URLSearchParams({
    season,
    span: String(span),
    lambdaHot: String(lambda),
    lambdaCold: String(lambda),
    lHot: String(persistence),
    lCold: String(persistence),
  });

  const response = await fetch(
    `/api/trends/skaters/${playerId}?${params.toString()}`,
    { signal }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to fetch player ${playerId}: ${response.status} ${response.statusText}`
    );
  }
  return (await response.json()) as PlayerSeries;
};

const buildStreakSegments = (series: ChartPoint[]): StreakSegment[] => {
  const segments: StreakSegment[] = [];
  let current: StreakSegment | null = null;

  series.forEach((point, index) => {
    let type: "hot" | "cold" | null = null;
    let id: number | null = null;

    if (point.hotStreakId) {
      type = "hot";
      id = point.hotStreakId;
    } else if (point.coldStreakId) {
      type = "cold";
      id = point.coldStreakId;
    }

    if (type && id !== null) {
      if (!current || current.type !== type || current.id !== id) {
        if (current) {
          segments.push(current);
        }
        current = { type, id, startIndex: index, endIndex: index };
      } else {
        current.endIndex = index;
      }
    } else if (current) {
      segments.push(current);
      current = null;
    }
  });

  if (current) {
    segments.push(current);
  }

  return segments;
};

const renderBaseline = ({
  svgElement,
  tooltipElement,
  baseline
}: RenderBaselineConfig) => {
  const svg = d3.select(svgElement);
  const tooltip = d3.select(tooltipElement);
  const width = svgElement.clientWidth || 680;
  const height = 220;

  svg.attr("viewBox", `0 0 ${width} ${height}`);
  svg.selectAll("*").remove();

  const xScale = d3
    .scaleLinear()
    .domain([-1.5, 1.5])
    .range([60, width - 20]);
  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(baseline.density, (d) => d.y) ?? 1])
    .range([height - 30, 30]);

  const area = d3
    .area<BaselineDensityPoint>()
    .x((d) => xScale(d.x))
    .y0(height - 30)
    .y1((d) => yScale(d.y))
    .curve(d3.curveCatmullRom.alpha(0.8));

  svg
    .append("path")
    .datum(baseline.density)
    .attr("d", area)
    .attr("fill", "rgba(108, 193, 255, 0.35)")
    .attr("stroke", "rgba(108, 193, 255, 0.8)")
    .attr("stroke-width", 1.5)
    .attr("aria-hidden", "true");

  svg
    .append("line")
    .attr("x1", xScale(baseline.mu0))
    .attr("x2", xScale(baseline.mu0))
    .attr("y1", height - 28)
    .attr("y2", 28)
    .attr("stroke", "var(--baseline-color)")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "4,2");

  svg
    .append("g")
    .attr("transform", `translate(0, ${height - 30})`)
    .call(d3.axisBottom(xScale).ticks(6))
    .selectAll("text")
    .attr("fill", "rgba(255,255,255,0.7)");

  svg
    .append("text")
    .attr("x", xScale(baseline.mu0))
    .attr("y", 20)
    .attr("fill", "var(--baseline-color)")
    .attr("text-anchor", "middle")
    .attr("font-size", "0.8rem")
    .text(`μ₀ ${baseline.mu0.toFixed(2)}`);

  const bisectX = d3.bisector<BaselineDensityPoint, number>((d) => d.x).left;

  svg
    .on("mousemove", (event) => {
      const [mx] = d3.pointer(event);
      const xValue = xScale.invert(mx);
      const idx = Math.min(
        baseline.density.length - 1,
        Math.max(0, bisectX(baseline.density, xValue))
      );
      const point = baseline.density[idx];
      tooltip
        .style("left", `${event.offsetX + 16}px`)
        .style("top", `${event.offsetY - 12}px`)
        .style("opacity", 1)
        .html(
          `<strong>x:</strong> ${point.x.toFixed(2)}<br/><strong>density:</strong> ${point.y.toFixed(3)}`
        );
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    });
};

const renderTimeSeries = ({
  svgElement,
  tooltipElement,
  baseline,
  timeSeries,
  span,
  lambda
}: RenderSeriesConfig) => {
  const svg = d3.select(svgElement);
  const tooltip = d3.select(tooltipElement);
  const width = svgElement.clientWidth || 760;
  const height = 320;

  svg.attr("viewBox", `0 0 ${width} ${height}`);
  svg.selectAll("*").remove();

  const alpha = 2 / (span + 1);
  const seriesWithEwma: (ChartPoint & { ewma: number })[] = [];
  let rolling = baseline.mu0;
  timeSeries.forEach((point, idx) => {
    if (idx === 0) {
      rolling = point.sko;
    } else {
      rolling = alpha * point.sko + (1 - alpha) * rolling;
    }
    seriesWithEwma.push({ ...point, ewma: rolling });
  });

  const drawSeries = (seriesToDraw: (ChartPoint & { ewma: number })[]) => {
    svg.selectAll("*").remove();

    const xScale = d3
      .scaleTime()
      .domain(d3.extent(seriesToDraw, (d) => d.date) as [Date, Date])
      .range([50, width - 20]);

    const yScale = d3
      .scaleLinear()
      .domain([-1.1, 1.1])
      .range([height - 30, 30]);

    const chartTop = 30;
    const chartBottom = height - 30;
    const chartHeight = chartBottom - chartTop;
    const streakSegments = buildStreakSegments(seriesToDraw);

    const xAxis = d3
      .axisBottom<Date>(xScale)
      .ticks(width < 600 ? 6 : 10)
      .tickFormat(
        d3.timeFormat("%b %d") as (d: Date | d3.NumberValue) => string
      );

    const yAxis = d3.axisLeft(yScale).ticks(8);

    svg
      .append("g")
      .attr("transform", `translate(0, ${height - 30})`)
      .call(
        xAxis as unknown as (
          selection: d3.Selection<SVGGElement, unknown, null, undefined>
        ) => void
      )
      .selectAll("text")
      .attr("fill", "rgba(255,255,255,0.7)");

    svg
      .append("g")
      .attr("transform", "translate(50,0)")
      .call(
        yAxis as unknown as (
          selection: d3.Selection<SVGGElement, unknown, null, undefined>
      ) => void
    )
      .selectAll("text")
      .attr("fill", "rgba(255,255,255,0.7)");

    const segmentLayer = svg.append("g").attr("class", "streak-layer");
    segmentLayer
      .selectAll("rect")
      .data(streakSegments)
      .enter()
      .append("rect")
      .attr("x", (d) => {
        const startDate = seriesToDraw[d.startIndex].date;
        return xScale(startDate);
      })
      .attr("y", chartTop)
      .attr("width", (d) => {
        const endDate =
          d.endIndex + 1 < seriesToDraw.length
            ? seriesToDraw[d.endIndex + 1].date
            : d3.timeDay.offset(seriesToDraw[d.endIndex].date, 1);
        return Math.max(
          1,
          xScale(endDate) - xScale(seriesToDraw[d.startIndex].date)
        );
      })
      .attr("height", chartHeight)
      .attr("fill", (d) =>
        d.type === "hot"
          ? "rgba(255, 111, 0, 0.12)"
          : "rgba(33, 150, 243, 0.12)"
      )
      .attr("stroke", "none");

    const bandUpper = baseline.mu0 + lambda * baseline.sigma0;
    const bandLower = baseline.mu0 - lambda * baseline.sigma0;

    svg
      .append("rect")
      .attr("x", xScale.range()[0])
      .attr("y", yScale(bandUpper))
      .attr("width", xScale.range()[1] - xScale.range()[0])
      .attr("height", Math.max(0, yScale(bandLower) - yScale(bandUpper)))
      .attr("fill", "rgba(107,110,207,0.18)")
      .attr("stroke", "rgba(107,110,207,0.4)")
      .attr("stroke-dasharray", "6,4")
      .lower();

    svg
      .append("line")
      .attr("x1", xScale.range()[0])
      .attr("x2", xScale.range()[1])
      .attr("y1", yScale(baseline.mu0))
      .attr("y2", yScale(baseline.mu0))
      .attr("stroke", "var(--baseline-color)")
      .attr("stroke-width", 1.5);

    const areaHot = d3
      .area<ChartPoint & { ewma: number }>()
      .defined((d) => d.streak === "hot")
      .x((d) => xScale(d.date))
      .y0(yScale(1.1))
      .y1((d) => yScale(Math.max(baseline.mu0, d.sko)))
      .curve(d3.curveLinear);

    const areaCold = d3
      .area<ChartPoint & { ewma: number }>()
      .defined((d) => d.streak === "cold")
      .x((d) => xScale(d.date))
      .y0(yScale(-1.1))
      .y1((d) => yScale(Math.min(baseline.mu0, d.sko)))
      .curve(d3.curveLinear);

    svg
      .append("path")
      .datum(seriesToDraw)
      .attr("d", areaHot)
      .attr("fill", "rgba(44,160,44,0.25)");
    svg
      .append("path")
      .datum(seriesToDraw)
      .attr("d", areaCold)
      .attr("fill", "rgba(214,39,40,0.22)");

    const lineSko = d3
      .line<ChartPoint & { ewma: number }>()
      .defined((d) => Number.isFinite(d.sko))
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.sko))
      .curve(d3.curveCatmullRom.alpha(0.6));

    const lineEwma = d3
      .line<ChartPoint & { ewma: number }>()
      .defined((d) => Number.isFinite(d.ewma))
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.ewma))
      .curve(d3.curveCatmullRom.alpha(0.6));

    svg
      .append("path")
      .datum(seriesToDraw)
      .attr("d", lineSko)
      .attr("fill", "none")
      .attr("stroke", "var(--sko-color)")
      .attr("stroke-width", 2.2);

    svg
      .append("path")
      .datum(seriesToDraw)
      .attr("d", lineEwma)
      .attr("fill", "none")
      .attr("stroke", "var(--ewma-color)")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,3");

    const focus = svg
      .append("circle")
      .attr("r", 4)
      .attr("fill", "#fff")
      .attr("stroke", "#111")
      .attr("stroke-width", 1.5)
      .style("opacity", 0);

    const overlay = svg
      .append("rect")
      .attr("x", xScale.range()[0])
      .attr("y", 10)
      .attr("width", xScale.range()[1] - xScale.range()[0])
      .attr("height", height - 40)
      .attr("fill", "transparent");

    const bisectDate = d3.bisector<ChartPoint & { ewma: number }, Date>(
      (d) => d.date
    ).center;

    overlay
      .on("mousemove", (event) => {
        const [mx] = d3.pointer(event);
        const xValue = xScale.invert(mx);
        const idx = bisectDate(seriesToDraw, xValue);
        const point =
          seriesToDraw[Math.min(seriesToDraw.length - 1, Math.max(0, idx))];
        focus
          .style("opacity", 1)
          .attr("cx", xScale(point.date))
          .attr("cy", yScale(point.sko));
        tooltip
          .style("left", `${event.offsetX + 16}px`)
          .style("top", `${event.offsetY - 12}px`)
          .style("opacity", 1)
          .html(
            `<strong>${d3.timeFormat("%b %d")(point.date)}</strong><br/>` +
              `SKO ${point.sko.toFixed(2)}<br/>EWMA ${point.ewma.toFixed(2)}<br/>` +
              `Detection band [${(baseline.mu0 - lambda * baseline.sigma0).toFixed(2)}, ${(baseline.mu0 + lambda * baseline.sigma0).toFixed(2)}]`
          );
      })
      .on("mouseleave", () => {
        focus.style("opacity", 0);
        tooltip.style("opacity", 0);
      });

    const brush = d3
      .brushX()
      .extent([
        [xScale.range()[0], 30],
        [xScale.range()[1], height - 30]
      ])
      .on("end", (event) => {
        if (!event.selection) {
          drawSeries(seriesWithEwma);
          return;
        }
        const [x0, x1] = (event.selection as [number, number]).map(
          xScale.invert
        );
        const filtered = seriesWithEwma.filter(
          (d) => d.date >= x0 && d.date <= x1
        );
        if (filtered.length > 5) {
          drawSeries(filtered);
        }
      });

    svg.append("g").call(brush);
  };

  drawSeries(seriesWithEwma);
};

const TrendsSandboxPage = () => {
  const [span, setSpan] = useState(5);
  const [lambda, setLambda] = useState(1.8);
  const [season, setSeason] = useState("2024-25");
  const [player, setPlayer] = useState("8478402");
  const [position, setPosition] = useState<"F" | "D">("F");
  const [trainWindow, setTrainWindow] = useState<"train" | "test">("test");
  const [showDefenseWeights, setShowDefenseWeights] = useState(false);
  const [persistence, setPersistence] = useState(2);

  const mockFallback = useMemo(
    () => buildMockPlayerSeries(player, season),
    [player, season]
  );

  const playerSeriesQuery = useQuery<PlayerSeries, Error>({
    queryKey: ["trends", player, season, span, lambda, persistence],
    queryFn: ({ signal }) =>
      fetchPlayerSeries({
        playerId: player,
        season,
        span,
        lambda,
        persistence,
        signal,
      }),
    placeholderData: (previousData) => previousData ?? mockFallback,
    refetchOnWindowFocus: false,
  });

  const seriesData = (playerSeriesQuery.data ?? mockFallback) as PlayerSeries;
  const isLoading = playerSeriesQuery.isPending;
  const isFetching = playerSeriesQuery.isFetching;
  const queryError =
    playerSeriesQuery.error instanceof Error ? playerSeriesQuery.error : null;

  const playerDisplayName =
    seriesData.playerName ?? PLAYER_NAME_LOOKUP[player] ?? `Player ${player}`;

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }),
    []
  );

  useEffect(() => {
    if (seriesData.position && seriesData.position !== position) {
      setPosition(seriesData.position);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesData.position, player]);

  const baselineSvgRef = useRef<SVGSVGElement | null>(null);
  const timeSeriesSvgRef = useRef<SVGSVGElement | null>(null);
  const baselineTooltipRef = useRef<HTMLDivElement | null>(null);
  const timeSeriesTooltipRef = useRef<HTMLDivElement | null>(null);

  const chartSeries = useMemo<ChartPoint[]>(
    () =>
      seriesData.timeSeries.map((point) => ({
        ...point,
        date: new Date(point.date),
      })),
    [seriesData.timeSeries]
  );

  const streakSegments = useMemo(
    () => buildStreakSegments(chartSeries),
    [chartSeries]
  );

  const activeStreak = useMemo(() => {
    if (!chartSeries.length) {
      return null;
    }
    const lastIndex = chartSeries.length - 1;
    const latestSegment = streakSegments.find(
      (segment) => segment.endIndex === lastIndex
    );
    if (!latestSegment) {
      return null;
    }
    const startPoint = chartSeries[latestSegment.startIndex];
    const endPoint = chartSeries[latestSegment.endIndex];
    return {
      type: latestSegment.type,
      length: latestSegment.endIndex - latestSegment.startIndex + 1,
      since: startPoint.date,
      lastGame: endPoint.date,
    };
  }, [chartSeries, streakSegments]);

  const streakTotals = useMemo(() => {
    return streakSegments.reduce<{ hot: number; cold: number }>(
      (acc, segment) => {
        acc[segment.type] += 1;
        return acc;
      },
      { hot: 0, cold: 0 }
    );
  }, [streakSegments]);

  useEffect(() => {
    if (baselineSvgRef.current && baselineTooltipRef.current) {
      renderBaseline({
        svgElement: baselineSvgRef.current,
        tooltipElement: baselineTooltipRef.current,
        baseline: seriesData.baseline,
      });
    }
  }, [seriesData.baseline]);

  useEffect(() => {
    if (timeSeriesSvgRef.current && timeSeriesTooltipRef.current) {
      renderTimeSeries({
        svgElement: timeSeriesSvgRef.current,
        tooltipElement: timeSeriesTooltipRef.current,
        baseline: seriesData.baseline,
        timeSeries: chartSeries,
        span,
        lambda,
      });
    }
  }, [seriesData.baseline, chartSeries, span, lambda]);

  return (
    <>
      <Head>
        <title>Trends Sandbox Prototype</title>
      </Head>
      <div className="page">
        <header className="controls" aria-label="Trends Sandbox Controls">
          <form className="control-grid">
            <label htmlFor="seasonFilter">
              <span>Season</span>
              <select
                id="seasonFilter"
                value={season}
                onChange={(event) => setSeason(event.target.value)}
                aria-label="Season filter"
              >
                <option value="2024-25">2024-25</option>
                <option value="2023-24">2023-24</option>
                <option value="2022-23">2022-23</option>
              </select>
            </label>
            <label htmlFor="playerSelect">
              <span>Player</span>
              <select
                id="playerSelect"
                value={player}
                onChange={(event) => setPlayer(event.target.value)}
                aria-label="Player select"
              >
                <option value="8478402">Connor McDavid</option>
                <option value="8477934">Nathan MacKinnon</option>
                <option value="8479318">Cale Makar</option>
              </select>
            </label>
            <label htmlFor="positionToggle">
              <span>Position</span>
              <select
                id="positionToggle"
                value={position}
                onChange={(event) =>
                  setPosition(event.target.value as "F" | "D")
                }
                aria-label="Position toggle"
              >
                <option value="F">Forwards</option>
                <option value="D">Defense</option>
              </select>
            </label>
            <label htmlFor="spanSlider">
              <span>Smoothing window (games)</span>
              <input
                id="spanSlider"
                type="range"
                min={3}
                max={10}
                step={1}
                value={span}
                aria-valuemin={3}
                aria-valuemax={10}
                aria-valuenow={span}
                onChange={(event) => setSpan(Number(event.target.value))}
              />
            </label>
            <label htmlFor="lambdaSlider">
              <span>Detection band multiplier</span>
              <input
                id="lambdaSlider"
                type="range"
                min={1.0}
                max={3.0}
                step={0.1}
                value={lambda}
                aria-valuemin={1}
                aria-valuemax={3}
                aria-valuenow={lambda}
                onChange={(event) => setLambda(Number(event.target.value))}
              />
            </label>
            <label htmlFor="persistenceSlider">
              <span>Minimum streak length</span>
              <input
                id="persistenceSlider"
                type="range"
                min={1}
                max={5}
                step={1}
                value={persistence}
                aria-valuemin={1}
                aria-valuemax={5}
                aria-valuenow={persistence}
                onChange={(event) => setPersistence(Number(event.target.value))}
              />
            </label>
            <label htmlFor="trainToggle">
              <span>Train/Test</span>
              <select
                id="trainToggle"
                value={trainWindow}
                onChange={(event) =>
                  setTrainWindow(event.target.value as "train" | "test")
                }
                aria-label="Select train or test window"
              >
                <option value="train">Train (2021-24)</option>
                <option value="test">Test (2024-25)</option>
              </select>
            </label>
            <label className="toggle-wrapper" htmlFor="defenseWeights">
              <input
                id="defenseWeights"
                type="checkbox"
                checked={showDefenseWeights}
                onChange={(event) =>
                  setShowDefenseWeights(event.target.checked)
                }
                aria-label="Show defense-only weights"
              />
              <span>Show defense-only weights</span>
            </label>
          </form>
        </header>

        {queryError && (
          <div className="status-banner error" role="alert">
            {queryError.message}
          </div>
        )}
        {(isLoading || (isFetching && !isLoading)) && !queryError && (
          <div className="status-banner loading" role="status">
            {isLoading ? "Loading player data…" : "Updating player data…"}
          </div>
        )}
        {seriesData.isMock && !queryError && !isLoading && (
          <div className="status-banner" role="status">
            Showing mock data while live trends become available.
          </div>
        )}
        <main className="content">
          <div className="summary">
            <h1>{playerDisplayName}</h1>
            <span>
              {seriesData.season} · Position {seriesData.position}
            </span>
          </div>
          <section id="cellA" className="cell" aria-labelledby="cellA-title">
            <h2 id="cellA-title">Cell A · Baseline Explorer</h2>
            <p className="meta">
              How this player's typical SKO compares with league peers at the
              same position.
            </p>
            <div className="chart-container" aria-label="Baseline violin plot">
              <svg
                ref={baselineSvgRef}
                role="img"
                aria-describedby="cellA-desc"
              />
              <div
                ref={baselineTooltipRef}
                className="tooltip"
                role="presentation"
              />
            </div>
            <div className="cards" aria-live="polite">
              <div className="card">
                <span className="label">Baseline average</span>
                <span className="value">
                  {seriesData.baseline.mu0.toFixed(2)}
                </span>
              </div>
              <div className="card">
                <span className="label">Baseline spread</span>
                <span className="value">
                  {seriesData.baseline.sigma0.toFixed(2)}
                </span>
              </div>
              <div className="card">
                <span className="label">Train games</span>
                <span className="value">{seriesData.baseline.nTrain}</span>
              </div>
            </div>
            <p id="cellA-desc" hidden>
              Density plot compares player baseline to league position cohort;
              cards show the baseline average, spread, and training sample size.
            </p>
          </section>

          <section id="cellB" className="cell" aria-labelledby="cellB-title">
            <h2 id="cellB-title">Cell B · Time Series &amp; Streak Ribbons</h2>
            <p className="meta">
              Game-by-game SKO (orange) versus the smoothed trend (teal), with a
              neutral zone band and shaded streak windows. Brush to zoom.
            </p>
            <div className="chart-container" aria-label="SKO time series">
              <svg
                ref={timeSeriesSvgRef}
                role="img"
                aria-describedby="cellB-desc"
              />
            <div
              ref={timeSeriesTooltipRef}
              className="tooltip"
              role="presentation"
            />
          </div>
          <div
            className="chart-legend"
            aria-hidden="true"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              flexWrap: "wrap",
              marginTop: "0.75rem",
              fontSize: "0.85rem",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  background: "rgba(255, 111, 0, 0.3)",
                  borderRadius: "2px",
                  border: "1px solid rgba(255, 111, 0, 0.6)",
                }}
              />
              Hot streak window
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span
                style={{
                  width: "12px",
                  height: "12px",
                  background: "rgba(33, 150, 243, 0.3)",
                  borderRadius: "2px",
                  border: "1px solid rgba(33, 150, 243, 0.6)",
                }}
              />
              Cold streak window
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span
                style={{
                  width: "18px",
                  height: "3px",
                  background: "var(--sko-color)",
                  borderRadius: "2px",
                }}
              />
              Game SKO
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span
                style={{
                  width: "18px",
                  height: "3px",
                  background: "var(--ewma-color)",
                  borderRadius: "2px",
                }}
              />
              Smoothed trend
            </span>
          </div>
            <p id="cellB-desc" hidden>
              Lines show raw SKO and the smoothed reading; shaded bands mark the
              neutral zone and highlight hot or cold streak intervals.
            </p>
          </section>

          <section className="cell">
            <h2>Cell C · Change Points</h2>
            <div className="stub">
              TODO: Lollipop chart of detected change points with click-to-focus
              on time series.
            </div>
          </section>
          <section className="cell">
            <h2>Cell D · HOT Pre-Launch Heatmap</h2>
            <div className="stub">
              TODO: Heatmap aligning episodes at t=0 (HOT onset) with feature
              deltas.
            </div>
          </section>
          <section className="cell">
            <h2>Cell E · COLD Pre-Slide Heatmap</h2>
            <div className="stub">TODO: Heatmap aligning COLD episodes.</div>
          </section>
          <section className="cell">
            <h2>Cell F · Relationship Panel</h2>
            <div className="stub">
              TODO: Logistic coefficient bars + SHAP swarm; include confidence
              intervals and toggles.
            </div>
          </section>
          <section className="cell">
            <h2>Cell G · Validation (2024–25)</h2>
            <div className="stub">
              TODO: Precision-recall curve, confusion matrix, calibration
              staircase; train/test toggle aware.
            </div>
          </section>
          <section className="cell">
            <h2>Cell H · Streak Barometer</h2>
            <div className="stub">
              TODO: Gauges for P(HOT in 2) and P(COLD in 2) with contributor
              list.
            </div>
          </section>
        </main>
      </div>

      <style jsx global>{`
        html {
          background: #0f1115;
        }
        body {
          margin: 0;
          font-family: 'Inter', system-ui, sans-serif;
          background: #0f1115;
          color: #f5f7fb;
        }
        :root {
          --hot-color: #2ca02c;
          --cold-color: #d62728;
          --baseline-color: #6b6ecf;
          --ewma-color: #1f77b4;
          --sko-color: #ff7f0e;
          --bg-panel: rgba(255, 255, 255, 0.04);
        }
        .page {
          min-height: 100vh;
        }
        .controls {
          position: sticky;
          top: 0;
          z-index: 10;
          padding: 1rem;
          background: rgba(15, 17, 21, 0.92);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .control-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 0.75rem;
          align-items: center;
        }
        label span {
          display: block;
          font-size: 0.7rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 0.25rem;
        }
        select,
        input[type='range'],
        input[type='checkbox'] {
          width: 100%;
        }
        .toggle-wrapper {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .status-banner {
          margin: 0.5rem 1.25rem 0;
          padding: 0.65rem 0.9rem;
          border-radius: 8px;
          font-size: 0.85rem;
        }
        .status-banner.loading {
          background: rgba(107, 110, 207, 0.2);
          color: #d9dcff;
        }
        .status-banner.error {
          background: rgba(214, 39, 40, 0.18);
          color: #ffd7d8;
        }
        .content {
          padding: 1rem 1.25rem 3rem;
          display: grid;
          gap: 1.5rem;
        }
        .summary {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-bottom: 0.5rem;
        }
        .summary h1 {
          font-size: 1.35rem;
          margin: 0;
        }
        .summary span {
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.65);
        }
        .cell {
          background: var(--bg-panel);
          border-radius: 12px;
          padding: 1rem 1.25rem;
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.25);
        }
        .cell h2 {
          font-size: 1.05rem;
          margin: 0 0 0.25rem;
          display: flex;
          gap: 0.5rem;
          align-items: baseline;
        }
        .meta {
          margin: 0 0 0.75rem;
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.85rem;
        }
        .chart-container {
          position: relative;
          width: 100%;
          min-height: 260px;
        }
        svg {
          width: 100%;
          height: auto;
          display: block;
        }
        .tooltip {
          position: absolute;
          pointer-events: none;
          background: rgba(15, 17, 21, 0.94);
          color: #fff;
          padding: 0.5rem 0.65rem;
          border-radius: 6px;
          font-size: 0.75rem;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .cards {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 0.75rem;
        }
        .card {
          min-width: 120px;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          display: grid;
          gap: 0.2rem;
        }
        .label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255, 255, 255, 0.6);
        }
        .value {
          font-size: 1.15rem;
          font-weight: 600;
        }
        .stub {
          padding: 1.5rem;
          border: 1px dashed rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          margin-top: 0.75rem;
          color: rgba(255, 255, 255, 0.55);
          font-size: 0.85rem;
        }
        @media (max-width: 768px) {
          .control-grid {
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          }
        }
      `}</style>
    </>
  );
};

export default TrendsSandboxPage;

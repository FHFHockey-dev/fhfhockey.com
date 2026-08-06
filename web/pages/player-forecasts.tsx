import Head from "next/head";
import { useEffect, useMemo, useState } from "react";

import type {
  PlayerForecastAccountabilityCandle,
  PlayerForecastCandle,
  PlayerForecastDashboardPayload,
} from "lib/player-forecasts/contracts";
import supabase from "lib/supabase";
import styles from "styles/PlayerForecasts.module.scss";

async function authenticatedFetch(url: string): Promise<PlayerForecastDashboardPayload> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message ?? "Unable to load forecasts.");
  return payload;
}

function quantileValue(
  quantiles: Record<string, number> | null,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = quantiles?.[key];
    if (Number.isFinite(value)) return Number(value);
  }
  return null;
}

function PlayerCandleChart({ candles }: { candles: PlayerForecastCandle[] }) {
  if (candles.length === 0) {
    return <p className={styles.empty}>No model forecast vintages have been issued for this selection.</p>;
  }
  const width = 1040;
  const height = 390;
  const margin = { top: 30, right: 54, bottom: 70, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const values = candles.flatMap((candle) => [
    candle.low,
    candle.high,
    candle.actual,
    quantileValue(candle.finalQuantiles, ["p10", "0.1", "10"]),
    quantileValue(candle.finalQuantiles, ["p90", "0.9", "90"]),
  ]).filter((value): value is number => value != null && Number.isFinite(value));
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(1, ...values);
  const padding = Math.max((maximum - minimum) * 0.08, 0.1);
  const yMin = minimum - padding;
  const yMax = maximum + padding;
  const y = (value: number) => margin.top + ((yMax - value) / (yMax - yMin)) * plotHeight;
  const step = plotWidth / candles.length;
  const candleWidth = Math.max(8, Math.min(30, step * 0.38));

  return (
    <div className={styles.chartScroll}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.chart} role="img" aria-label="Player forecast revision candlesticks">
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const value = yMax - (yMax - yMin) * fraction;
          const lineY = y(value);
          return <g key={fraction}><line x1={margin.left} x2={width - margin.right} y1={lineY} y2={lineY} className={styles.grid} /><text x={margin.left - 8} y={lineY + 4} textAnchor="end" className={styles.axis}>{value.toFixed(1)}</text></g>;
        })}
        {candles.map((candle, index) => {
          const x = margin.left + step * index + step / 2;
          const openY = y(candle.open);
          const closeY = y(candle.close);
          const highY = y(candle.high);
          const lowY = y(candle.low);
          const bodyHeight = Math.max(5, Math.abs(closeY - openY));
          const bodyY = Math.min(openY, closeY) - (bodyHeight === 5 ? 2.5 : 0);
          const intervalLow = quantileValue(candle.finalQuantiles, ["p10", "0.1", "10"]);
          const intervalHigh = quantileValue(candle.finalQuantiles, ["p90", "0.9", "90"]);
          const pathPoints = candle.revisions.map((revision, revisionIndex) => {
            const offset = candle.revisions.length === 1
              ? 0
              : (revisionIndex / (candle.revisions.length - 1) - 0.5) * step * 0.7;
            return `${x + offset},${y(revision.value)}`;
          }).join(" ");
          return (
            <g key={`${candle.gameId}:${candle.playerId}:${candle.targetKey}:${candle.conditioning}:${candle.artifactChecksum ?? candle.modelVersion}`}>
              <title>{`${candle.playerName}, game ${candle.gameId}, model ${candle.modelVersion ?? "unversioned"}: open ${candle.open.toFixed(2)}, low ${candle.low.toFixed(2)}, high ${candle.high.toFixed(2)}, close ${candle.close.toFixed(2)}, ${candle.revisionCount} revisions${candle.actual == null ? "" : `, actual ${candle.actual.toFixed(2)}`}`}</title>
              <line x1={x} x2={x} y1={highY} y2={lowY} className={styles.wick} />
              <rect x={x - candleWidth / 2} y={bodyY} width={candleWidth} height={bodyHeight} rx="2" className={candle.close >= candle.open ? styles.up : styles.down} />
              {pathPoints ? <polyline points={pathPoints} className={styles.revisionPath} /> : null}
              {intervalLow != null && intervalHigh != null ? <line x1={x + candleWidth} x2={x + candleWidth} y1={y(intervalHigh)} y2={y(intervalLow)} className={styles.interval} /> : null}
              {candle.actual != null ? <circle cx={x} cy={y(candle.actual)} r="4" className={styles.actual} /> : null}
              <text x={x} y={height - 42} textAnchor="middle" className={styles.axis}>{new Date(candle.scheduledStartAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text>
              <text x={x} y={height - 24} textAnchor="middle" className={styles.axis}>H{candle.openingHorizon}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AccountabilityChart({ candles }: { candles: PlayerForecastAccountabilityCandle[] }) {
  if (candles.length === 0) {
    return <p className={styles.empty}>The scoring contract is approved; accountability appears after eligible model forecasts are settled.</p>;
  }
  const width = 1040;
  const height = 330;
  const margin = { top: 25, right: 42, bottom: 58, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const y = (value: number) => margin.top + ((100 - value) / 100) * plotHeight;
  const step = plotWidth / candles.length;
  return (
    <div className={styles.chartScroll}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.chart} role="img" aria-label="Aggregate model accountability candlesticks">
        {[100, 75, 50, 25, 0].map((tick) => <g key={tick}><line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} className={styles.grid} /><text x={margin.left - 8} y={y(tick) + 4} textAnchor="end" className={styles.axis}>{tick}</text></g>)}
        {candles.map((candle, index) => {
          const x = margin.left + step * index + step / 2;
          const openY = y(candle.open);
          const closeY = y(candle.close);
          const bodyHeight = Math.max(5, Math.abs(closeY - openY));
          return <g key={`${candle.slateDate}:${candle.modelArtifactId}:${candle.scoringVersion}`}><title>{`${candle.slateDate}, model ${candle.modelVersion}, score ${candle.scoringVersion}: opening ${candle.open.toFixed(1)}, low ${candle.low.toFixed(1)}, high ${candle.high.toFixed(1)}, final pregame ${candle.close.toFixed(1)}; ${candle.settlementStatus}`}</title><line x1={x} x2={x} y1={y(candle.high)} y2={y(candle.low)} className={styles.wick} /><rect x={x - 10} y={Math.min(openY, closeY) - (bodyHeight === 5 ? 2.5 : 0)} width={20} height={bodyHeight} rx="2" className={candle.close >= candle.open ? styles.up : styles.down} /><text x={x} y={height - 28} textAnchor="middle" className={styles.axis}>{candle.slateDate.slice(5)}</text></g>;
        })}
      </svg>
    </div>
  );
}

export default function PlayerForecastsPage() {
  const [payload, setPayload] = useState<PlayerForecastDashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playerId, setPlayerId] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [conditioning, setConditioning] = useState("");
  const [modelVersion, setModelVersion] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (playerId) params.set("playerId", playerId);
    if (targetKey) params.set("targetKey", targetKey);
    if (conditioning) params.set("conditioning", conditioning);
    authenticatedFetch(`/api/v1/player-forecasts/dashboard?${params}`)
      .then((next) => { if (!cancelled) { setPayload(next); setError(null); } })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [playerId, targetKey, conditioning]);

  const players = useMemo(() => Array.from(new Map((payload?.revisions ?? []).map((revision) => [revision.playerId, revision.playerName])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [payload]);
  const targets = useMemo(() => Array.from(new Set((payload?.revisions ?? []).map((revision) => revision.targetKey))).sort(), [payload]);
  const conditionings = useMemo(() => Array.from(new Set((payload?.revisions ?? []).map((revision) => revision.conditioning))).sort(), [payload]);
  const modelVersions = useMemo(() => Array.from(new Set((payload?.revisions ?? []).map((revision) => revision.modelVersion ?? "unversioned"))).sort(), [payload]);
  const playerCandles = useMemo(() => (payload?.playerCandles ?? []).filter((candle) => !modelVersion || (candle.modelVersion ?? "unversioned") === modelVersion), [payload, modelVersion]);
  const accountabilityCandles = useMemo(() => (payload?.accountabilityCandles ?? []).filter((candle) => !modelVersion || candle.modelVersion === modelVersion), [payload, modelVersion]);

  return (
    <>
      <Head><title>{`${payload?.label ?? "Player Forecasts"} | FHFH`}</title><meta name="robots" content="noindex,nofollow" /></Head>
      <main className={styles.page}>
        <header className={styles.hero}><div><p className={styles.eyebrow}>Private shadow system</p><h1>{payload?.label ?? "Player Forecasts"}</h1><p>Immutable H1–H10 forecast revisions, source provenance, and model accountability. FORGE remains separate.</p></div><span className={styles.gate}>Research gate: {payload?.researchGate ?? "pending"}</span></header>
        {error ? <div className={styles.error}>{error}</div> : null}
        {payload?.fixtureData.present ? <div className={styles.fixtureNotice} role="status">{payload.fixtureData.disclaimer}</div> : null}
        <section className={styles.health} aria-label="Forecast pipeline health">
          {(["pending", "running", "failed", "succeeded"] as const).map((key) => <div key={key}><span>{key}</span><strong>{payload?.runHealth[key] ?? 0}</strong></div>)}
          <div><span>research blocked</span><strong>{payload?.runHealth.researchBlockedRuns ?? 0}</strong></div>
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><p className={styles.eyebrow}>Player accountability</p><h2>Projection movement by target game</h2></div><div className={styles.legend}><span>Wick: revision high/low</span><span>Body: opening/final pregame</span><span>Dot: actual</span><span>Side bar: final interval</span></div></div>
          <div className={styles.filters}>
            <label>Player<select value={playerId} onChange={(event) => setPlayerId(event.target.value)}><option value="">All</option>{players.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
            <label>Target<select value={targetKey} onChange={(event) => setTargetKey(event.target.value)}><option value="">All</option>{targets.map((target) => <option key={target}>{target}</option>)}</select></label>
            <label>Semantics<select value={conditioning} onChange={(event) => setConditioning(event.target.value)}><option value="">All</option>{conditionings.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Model<select value={modelVersion} onChange={(event) => setModelVersion(event.target.value)}><option value="">All</option>{modelVersions.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
          {loading ? <p className={styles.empty}>Loading forecast ledger…</p> : <PlayerCandleChart candles={playerCandles} />}
          {playerCandles.length > 0 ? <details className={styles.tableDetails}><summary>Accessible candle data</summary><div className={styles.tableScroll}><table><thead><tr><th>Game</th><th>Player</th><th>Model</th><th>Target</th><th>Open</th><th>Low</th><th>High</th><th>Final</th><th>Actual</th><th>Status</th></tr></thead><tbody>{playerCandles.map((candle) => <tr key={`${candle.gameId}:${candle.playerId}:${candle.targetKey}:${candle.conditioning}:${candle.artifactChecksum ?? candle.modelVersion}`}><td>{candle.gameId}</td><td>{candle.playerName}</td><td>{candle.modelVersion ?? "unversioned"}</td><td>{candle.targetKey}</td><td>{candle.open.toFixed(2)}</td><td>{candle.low.toFixed(2)}</td><td>{candle.high.toFixed(2)}</td><td>{candle.close.toFixed(2)}</td><td>{candle.actual?.toFixed(2) ?? "—"}</td><td>{candle.settlementStatus}</td></tr>)}</tbody></table></div></details> : null}
        </section>
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><p className={styles.eyebrow}>Season outlook</p><h2>Rest of season and full-season total</h2></div><p>Conditional and availability-adjusted totals remain separate. Full season equals recorded actuals plus the rest-of-season distribution.</p></div>
          {(payload?.restOfSeasonForecasts.length ?? 0) === 0
            ? <p className={styles.empty}>No checksum-bound rest-of-season aggregate has been issued for this selection.</p>
            : <div className={styles.tableScroll}><table><thead><tr><th>Player</th><th>Target</th><th>Semantics</th><th>Games left</th><th>ROS mean</th><th>ROS 10–90%</th><th>Season actual</th><th>Full-season mean</th><th>Flags</th></tr></thead><tbody>{payload?.restOfSeasonForecasts.map((forecast) => <tr key={forecast.id}><td>{forecast.playerName}</td><td>{forecast.targetKey}</td><td>{forecast.conditioning}</td><td>{forecast.remainingGames}</td><td>{forecast.remainingMean.toFixed(2)}</td><td>{quantileValue(forecast.remainingQuantiles, ["p10"])?.toFixed(2) ?? "—"}–{quantileValue(forecast.remainingQuantiles, ["p90"])?.toFixed(2) ?? "—"}</td><td>{forecast.seasonToDateActual.toFixed(2)}</td><td>{forecast.fullSeasonMean.toFixed(2)}</td><td>{forecast.fallbackFlags.join(", ") || "none"}</td></tr>)}</tbody></table></div>}
        </section>
        <section className={styles.panel}><div className={styles.panelHeader}><div><p className={styles.eyebrow}>Model accountability</p><h2>Aggregate skill by completed slate</h2></div><p>Opening H10, checkpoint range, and final-pregame close. Next-morning scores remain provisional for 48 hours.</p></div><AccountabilityChart candles={accountabilityCandles} /></section>
        <section className={styles.panel}><div className={styles.panelHeader}><div><p className={styles.eyebrow}>Source integrity</p><h2>Observation conflicts</h2></div><a href="/db/player-forecast-review">Open review queue</a></div><p>{payload?.conflicts.length ?? 0} recent conflict records. Open conflicts degrade provenance but do not block provisional reforecasting.</p></section>
      </main>
    </>
  );
}

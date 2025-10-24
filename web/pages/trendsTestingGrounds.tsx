import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState } from "react";
import Head from "next/head";

import { PLAYER_TREND_METRICS } from "lib/trends/playerTrendCalculator";

interface TrendMetricRow {
  player_id: number;
  season_id: number | null;
  game_date: string;
  position_code: string | null;
  metric_type: "skater" | "goalie";
  metric_key: string;
  metric_label: string;
  raw_value: number | null;
  average_value: number | null;
  rolling_avg_3: number | null;
  rolling_avg_5: number | null;
  rolling_avg_10: number | null;
  variance_value: number | null;
  std_dev_value: number | null;
  sample_size: number;
}

type RequestState = "idle" | "loading" | "success" | "error";

const LIMIT_DEFAULT = 25;

export default function TrendsTestingGrounds() {
  const [selectedMetric, setSelectedMetric] = useState<string>(
    PLAYER_TREND_METRICS[0]?.key ?? ""
  );
  const [playerIdInput, setPlayerIdInput] = useState<string>("");
  const [limit, setLimit] = useState<number>(LIMIT_DEFAULT);
  const [trends, setTrends] = useState<TrendMetricRow[]>([]);
  const [fetchState, setFetchState] = useState<RequestState>("idle");
  const [fetchError, setFetchError] = useState<string>("");
  const [rebuildState, setRebuildState] = useState<RequestState>("idle");
  const [rebuildError, setRebuildError] = useState<string>("");
  const [startDateInput, setStartDateInput] = useState<string>("2023-01-01");

  const metricOptions = useMemo(() => {
    return [...PLAYER_TREND_METRICS].sort((a, b) =>
      a.metricType.localeCompare(b.metricType) ||
      a.label.localeCompare(b.label)
    );
  }, []);

  const selectedMetricLabel = useMemo(() => {
    return (
      metricOptions.find((metric) => metric.key === selectedMetric)?.label ??
      selectedMetric
    );
  }, [metricOptions, selectedMetric]);

  const isFetchDisabled = !playerIdInput || !selectedMetric;

  const handleFetch = async (event: FormEvent) => {
    event.preventDefault();
    if (isFetchDisabled) return;

    setFetchState("loading");
    setFetchError("");

    const params = new URLSearchParams();
    params.set("playerId", playerIdInput.trim());
    params.set("metricKey", selectedMetric);
    params.set("limit", String(limit));

    try {
      const response = await fetch(
        `/api/v1/trends/player-trends?${params.toString()}`
      );
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Failed to load trends");
      }

      setTrends(payload.data ?? []);
      setFetchState("success");
    } catch (error: any) {
      setFetchState("error");
      setFetchError(error.message ?? "Unexpected error");
    }
  };

  const handleRebuild = async () => {
    setRebuildState("loading");
    setRebuildError("");

    try {
      const response = await fetch("/api/v1/trends/player-trends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          startDate: startDateInput || "2023-01-01"
        })
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Failed to rebuild trends");
      }

      setRebuildState("success");
    } catch (error: any) {
      setRebuildError(error.message ?? "Unexpected error");
      setRebuildState("error");
    }
  };

  return (
    <>
      <Head>
        <title>Trends Testing Grounds</title>
      </Head>
      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
        <h1 style={{ marginBottom: "1.5rem" }}>Trends Testing Grounds</h1>

        <section
          style={{
            marginBottom: "2rem",
            padding: "1.5rem",
            border: "1px solid #ddd",
            borderRadius: "8px"
          }}
        >
          <h2 style={{ marginBottom: "1rem" }}>Fetch Player Trend Metrics</h2>
          <form
            onSubmit={handleFetch}
            style={{ display: "grid", gap: "1rem", maxWidth: "500px" }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Player ID
              <input
                type="text"
                value={playerIdInput}
                onChange={(event) => setPlayerIdInput(event.target.value)}
                placeholder="e.g. 8478402"
                style={{ padding: "0.5rem", fontSize: "1rem" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Metric
              <select
                value={selectedMetric}
                onChange={(event) => setSelectedMetric(event.target.value)}
                style={{ padding: "0.5rem", fontSize: "1rem" }}
              >
                {metricOptions.map((metric) => (
                  <option key={metric.key} value={metric.key}>
                    {metric.metricType.toUpperCase()} · {metric.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Rows to fetch
              <input
                type="number"
                min={1}
                max={500}
                value={limit}
                onChange={(event) =>
                  setLimit(Number(event.target.value) || LIMIT_DEFAULT)
                }
                style={{ padding: "0.5rem", fontSize: "1rem" }}
              />
            </label>

            <button
              type="submit"
              disabled={isFetchDisabled || fetchState === "loading"}
              style={{
                padding: "0.75rem 1rem",
                fontSize: "1rem",
                backgroundColor: "#0b7285",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: isFetchDisabled ? "not-allowed" : "pointer",
                opacity: fetchState === "loading" ? 0.7 : 1
              }}
            >
              {fetchState === "loading" ? "Loading..." : "Fetch Trends"}
            </button>
          </form>

          {fetchState === "error" && (
            <p style={{ color: "#c92a2a", marginTop: "1rem" }}>
              {fetchError || "Failed to fetch data"}
            </p>
          )}
        </section>

        <section
          style={{
            marginBottom: "2rem",
            padding: "1.5rem",
            border: "1px solid #ddd",
            borderRadius: "8px"
          }}
        >
          <h2 style={{ marginBottom: "1rem" }}>Rebuild Trend Metrics</h2>
          <p style={{ marginBottom: "1rem", color: "#555" }}>
            Triggers the API to recompute rolling trends from the start date you
            provide. This can take a little while for the full dataset.
          </p>
          <div
            style={{
              display: "flex",
              gap: "1rem",
              flexWrap: "wrap",
              alignItems: "center"
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Start Date (inclusive)
              <input
                type="date"
                value={startDateInput}
                onChange={(event) => setStartDateInput(event.target.value)}
                style={{ padding: "0.5rem", fontSize: "1rem" }}
              />
            </label>

            <button
              type="button"
              onClick={handleRebuild}
              disabled={rebuildState === "loading"}
              style={{
                padding: "0.75rem 1rem",
                fontSize: "1rem",
                backgroundColor: "#1864ab",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: rebuildState === "loading" ? "not-allowed" : "pointer",
                opacity: rebuildState === "loading" ? 0.7 : 1
              }}
            >
              {rebuildState === "loading" ? "Running..." : "Rebuild Trends"}
            </button>
          </div>

          {rebuildState === "success" && (
            <p style={{ marginTop: "1rem", color: "#2f9e44" }}>
              Rebuild job triggered successfully.
            </p>
          )}
          {rebuildState === "error" && (
            <p style={{ marginTop: "1rem", color: "#c92a2a" }}>
              {rebuildError || "Failed to trigger rebuild"}
            </p>
          )}
        </section>

        <section
          style={{
            padding: "1.5rem",
            border: "1px solid #ddd",
            borderRadius: "8px"
          }}
        >
          <h2 style={{ marginBottom: "1rem" }}>
            Trend Results · {selectedMetricLabel}
          </h2>
          {fetchState === "loading" && <p>Loading trend data…</p>}
          {fetchState === "success" && trends.length === 0 && (
            <p>No data available for this player/metric combination.</p>
          )}
          {trends.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.95rem"
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Raw</th>
                    <th style={thStyle}>Average</th>
                    <th style={thStyle}>L3 Avg</th>
                    <th style={thStyle}>L5 Avg</th>
                    <th style={thStyle}>L10 Avg</th>
                    <th style={thStyle}>Variance</th>
                    <th style={thStyle}>Std Dev</th>
                    <th style={thStyle}>Games</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.map((row) => (
                    <tr key={`${row.player_id}-${row.metric_key}-${row.game_date}`}>
                      <td style={tdStyle}>{row.game_date}</td>
                      <td style={tdStyle}>{formatNumber(row.raw_value)}</td>
                      <td style={tdStyle}>{formatNumber(row.average_value)}</td>
                      <td style={tdStyle}>{formatNumber(row.rolling_avg_3)}</td>
                      <td style={tdStyle}>{formatNumber(row.rolling_avg_5)}</td>
                      <td style={tdStyle}>
                        {formatNumber(row.rolling_avg_10)}
                      </td>
                      <td style={tdStyle}>{formatNumber(row.variance_value)}</td>
                      <td style={tdStyle}>{formatNumber(row.std_dev_value)}</td>
                      <td style={tdStyle}>{row.sample_size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function formatNumber(value: number | null) {
  if (value === null || value === undefined) {
    return "—";
  }
  if (Math.abs(value) >= 100 || Math.abs(value) < 0.001) {
    return value.toFixed(3);
  }
  return value.toFixed(2);
}

const thStyle: CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #ccc",
  padding: "0.5rem",
  backgroundColor: "#f8f9fa"
};

const tdStyle: CSSProperties = {
  padding: "0.5rem",
  borderBottom: "1px solid #eee",
  whiteSpace: "nowrap"
};

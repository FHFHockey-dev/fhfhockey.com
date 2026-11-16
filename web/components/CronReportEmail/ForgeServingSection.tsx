import * as React from "react";

import type { ForgeServingHealth, ForgeServingRun, ForgeServingStatus } from "lib/cron/forgeServingHealth";

const muted: React.CSSProperties = { color: "#4B5563", fontSize: 12 };
const STATUS_COLOR: Record<ForgeServingStatus, string> = { ok: "#166534", warning: "#92400E", critical: "#991B1B",
  unknown: "#4B5563", not_applicable: "#4B5563" };
const STATUS_LABEL: Record<ForgeServingStatus, string> = { ok: "OK", warning: "STALE", critical: "NOT SERVED",
  unknown: "UNKNOWN", not_applicable: "OFF SEASON" };
const local = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short",
  day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const runLine = (run: ForgeServingRun) => `${run.runId.slice(0, 8)} · created ${local(run.createdAt)} · ${run.status ?? "unknown"}`
  + ` · ${run.gitSha ? run.gitSha.slice(0, 10) : "no SHA"}${run.closureSha256 ? ` · closure ${run.closureSha256.slice(0, 8)}` : ""}`;

/** Daily report section: whether today's ET slate has a fresh FORGE run readers will serve, and why not. */
export const ForgeServingSection: React.FC<{ health: ForgeServingHealth }> = ({ health }) =>
  <div style={{ margin: "16px 0", fontSize: 13 }}>
    <h2 style={{ fontSize: 16, margin: "22px 0 6px" }}>
      FORGE projections for {health.date}: <span style={{ color: STATUS_COLOR[health.status] }}>{STATUS_LABEL[health.status]}</span>
    </h2>
    {health.status === "not_applicable" ? <div style={muted}>Off season; no slate to serve.</div> : <>
      <div style={muted}>
        {health.servedRun ? `Serving ${runLine(health.servedRun)}` : "Readers have no servable run for this date."}
        {` · pipeline ${health.pipeline.state.replace("_", " ")}`}
      </div>
      {health.problems.map((problem) => <div key={problem} style={{ color: STATUS_COLOR[health.status], marginTop: 4, overflowWrap: "anywhere" }}>{problem}</div>)}
      {health.todayRuns.filter((run) => run.runId !== health.servedRun?.runId).map((run) =>
        <div key={run.runId} style={{ ...muted, overflowWrap: "anywhere" }}>Today: {runLine(run)}{run.servable ? "" : " · withheld"}</div>)}
    </>}
    {health.notes.map((note) => <div key={note} style={muted}>{note}</div>)}
  </div>;

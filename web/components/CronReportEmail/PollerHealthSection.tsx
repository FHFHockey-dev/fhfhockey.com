import * as React from "react";

import { formatReportTime } from "lib/cron/reportSource";
import { COVERAGE_TARGET, type AccountPollerHealth, type HealthStatus, type PollerHealth } from "lib/cron/xPollerHealth";

const muted: React.CSSProperties = { color: "#4B5563", fontSize: 12 };
const STATUS_COLOR: Record<HealthStatus, string> = { healthy: "#166534", warning: "#92400E", critical: "#991B1B", unknown: "#4B5563" };
const STATUS_LABEL: Record<HealthStatus, string> = { healthy: "OK", warning: "CHECK", critical: "PROBLEM", unknown: "UNKNOWN" };
const local = (iso: string | null) => (iso ? formatReportTime(iso).split(" / ")[1] ?? iso : "never");
const percent = (rate: number | null) => (rate === null ? "n/a" : `${Math.floor(rate * 1000) / 10}%`);

function accountLine(account: AccountPollerHealth, windowStart: string): string[] {
  const parts: string[] = [];
  parts.push(account.provider === "fxtwitter" ? `scraper since ${local(account.switchedAt)}` : account.provider === "ifttt" ? "IFTTT live" : "switch unknown");
  if (account.coverage.rate !== null)
    parts.push(`coverage ${percent(account.coverage.rate)} (${account.coverage.matched}/${account.coverage.iftttRows}${account.provider === "fxtwitter" ? " before switch" : ""}`
      + `${Date.parse(account.coverage.from) > Date.parse(windowStart) ? ` since ${local(account.coverage.from)}` : ""})`);
  if (account.enqueue) parts.push(`queued once ${account.enqueue.queuedOnce}/${account.enqueue.sightings}`);
  parts.push(account.reads ? `reads ${percent(account.reads.rate)} of ${account.reads.runs} runs · longest miss streak ${account.reads.longestFailStreak}` : "reads unknown");
  if (account.reads?.mirrorReads) parts.push(`mirror served ${account.reads.mirrorReads}`);
  return parts;
}

function accountProblems(account: AccountPollerHealth): string[] {
  const problems: string[] = [];
  const { enqueue, reads } = account;
  if (account.coverage.missed > 0) problems.push(`${account.coverage.missed} IFTTT post${account.coverage.missed === 1 ? "" : "s"} the scraper did not see.`);
  if (enqueue?.missing) problems.push(`${enqueue.missing} post${enqueue.missing === 1 ? "" : "s"} seen since the switch but not queued.`);
  if (enqueue?.viaIfttt) problems.push(`${enqueue.viaIfttt} queued by IFTTT instead of the scraper.`);
  if (enqueue?.doubleQueued) problems.push(`${enqueue.doubleQueued} repost${enqueue.doubleQueued === 1 ? "" : "s"} queued by both IFTTT and the scraper.`);
  if (enqueue?.iftttAfterSwitch) problems.push(`${enqueue.iftttAfterSwitch} IFTTT row${enqueue.iftttAfterSwitch === 1 ? "" : "s"} stored after the switch.`);
  if (reads?.unrecoveredGaps) problems.push(`${reads.unrecoveredGaps} run${reads.unrecoveredGaps === 1 ? "" : "s"} with an unrecovered gap: posts beyond the last 100 were lost.`);
  // A single failed read is routine (FxTwitter 404s); three in a row is worth a line.
  if (reads && reads.currentFailStreak >= 3) problems.push(`Failing now: last ${reads.currentFailStreak} run${reads.currentFailStreak === 1 ? "" : "s"}; last good read ${local(reads.lastOkAt)}.`);
  return problems;
}

export const PollerHealthSection: React.FC<{ health: PollerHealth }> = ({ health }) => {
  const samples = health.accounts.flatMap((account) =>
    [...account.coverage.samples, ...(account.enqueue?.samples ?? [])].map((sample) => ({ ...sample, handle: account.handle })));
  return <div style={{ margin: "16px 0", fontSize: 13 }}>
    <h2 style={{ fontSize: 16, margin: "22px 0 6px" }}>
      X poller (FxTwitter): <span style={{ color: STATUS_COLOR[health.status] }}>{STATUS_LABEL[health.status]}</span>
    </h2>
    <div style={muted}>
      {health.runs
        ? `${health.runs.started === null || health.runs.missed === null ? `${health.runs.captured} runs captured`
          : `${health.runs.started - health.runs.missed} of ${health.runs.started} started runs left a result`}`
          + ` · longest gap ${health.runs.longestGapMinutes} min · last run ${local(health.runs.lastRunAt)}`
        : "Run history unavailable."}
      {` · coverage target ${percent(COVERAGE_TARGET)}`}
    </div>
    {health.incidents.map((incident) => <div key={incident.key} style={{ color: STATUS_COLOR.critical, marginTop: 4 }}>
      <strong>Open alert {incident.key}</strong> since {local(incident.since)}{incident.note ? `: ${incident.note}` : ""}
    </div>)}
    {health.accounts.map((account) => <div key={account.sourceKey} style={{ padding: "6px 0", borderBottom: "1px solid #E1E3E0", overflowWrap: "anywhere" }}>
      <strong style={{ color: STATUS_COLOR[account.status], fontSize: 12, marginRight: 6 }}>{STATUS_LABEL[account.status]}</strong>
      <strong>@{account.handle}</strong>
      <span style={muted}>{` · ${accountLine(account, health.windowStart).join(" · ")}`}</span>
      {account.incidents.map((incident) => <div key={incident.key} style={{ color: STATUS_COLOR.critical }}>Open alert {incident.key} since {local(incident.since)}</div>)}
      {accountProblems(account).map((problem) => <div key={problem} style={muted}>{problem}</div>)}
    </div>)}
    {samples.length > 0 ? <div style={{ ...muted, marginTop: 6 }}>
      <strong>Missed samples</strong>
      {samples.map((sample, index) => <div key={index}>@{sample.handle} · {local(sample.at)} · {sample.tweetId ?? "no id"} · {sample.text || "(no text)"}</div>)}
    </div> : null}
    {health.warnings.map((warning) => <div key={warning} style={muted}>{warning}</div>)}
  </div>;
};

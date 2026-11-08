import * as React from "react";

import type { TweetBacklog, TweetBacklogItem } from "lib/cron/tweetReviewBacklog";

const muted: React.CSSProperties = { color: "#4B5563", fontSize: 12 };
const number = (value: number | null) => (value === null ? "Unknown" : value.toLocaleString("en-US"));
const change = (item: TweetBacklogItem) =>
  item.delta === null ? "" : item.delta === 0 ? " (no change)" : ` (${item.delta > 0 ? "+" : "−"}${Math.abs(item.delta).toLocaleString("en-US")})`;

export const TweetBacklogSection: React.FC<{ backlog: TweetBacklog }> = ({ backlog }) => {
  const row = (item: TweetBacklogItem) => <div key={item.key} style={{ padding: "3px 0" }}>
    {item.label}: <strong>{number(item.count)}</strong><span style={muted}>{change(item)}</span>
  </div>;
  return <div style={{ margin: "16px 0", fontSize: 13 }}>
    <h2 style={{ fontSize: 16, margin: "22px 0 6px" }}>Tweet-review backlog</h2>
    <div style={muted}>{backlog.previousDate ? `Change since ${backlog.previousDate}.` : "No earlier snapshot to compare with yet."}</div>
    <div style={{ marginTop: 6 }}><strong>Swipe-trainer queue</strong></div>
    {backlog.queue.map(row)}
    <div style={{ marginTop: 6 }}><strong>Labels and names</strong></div>
    {row(backlog.answerKeyLabels)}
    {row(backlog.unresolvedRows)}
    {row(backlog.unresolvedNames)}
    {backlog.warnings.map((warning) => <div key={warning} style={muted}>{warning}</div>)}
  </div>;
};

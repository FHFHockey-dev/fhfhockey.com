import type { ContributionDay, PlayerContribution } from "lib/rosterScheduleOptimizer/contributionLedger";
import styles from "./RosterScheduleOptimizer.module.scss";

const count = (total: number | null, known: number) => total === null ? known ? `${known}+ known` : "unknown" : String(total);
// The page shows one banner when schedules are unconfirmed, so cells show the known count without "+" or "?".
const compactValue = (value: string) => value === "unknown" || value === "unavailable" ? "—"
  : value.endsWith("+ known") ? value.replace("+ known", "") : value;
const reasons: Partial<Record<NonNullable<ContributionDay["reason"]>, string>> = {
  locked_bench: "Bench lock preserved", locked_capacity: "Eligible slots locked", weekly_lock: "Weekly lock",
  lower_lineup_value: "Checked placement reduces full-lineup score", equal_lineup_value: "Checked lineup scores equal",
  category_tradeoff: "Category tradeoff", minimum_priority: "Goalie coverage priority", negative_value: "Negative scoring contribution",
};
const labels: Record<ContributionDay["state"], string> = {
  active: "Active assignment", bench: "Bench", reserve: "Reserve; outside active pool", outside_roster: "Outside roster at game time",
  ineligible: "No compatible active slot", elapsed: "Elapsed game; actual start unverified", cancelled: "Cancelled or postponed",
  no_game: "No scheduled game", unknown: "Opportunity or assignment unknown",
};

export default function RosterContribution({ name, contribution, nameOf }: {
  name: string; contribution?: PlayerContribution; nameOf: (id: string) => string;
}) {
  const row = contribution;
  const metrics = [
    ["Remaining GP", row ? count(row.scheduledGames, row.knownScheduledGames) : "unknown"],
    ["AGP", row ? count(row.activeGames, row.knownActiveGames) : "unknown"],
    ["DUST/bench", row ? count(row.benchGames, row.knownBenchGames) : "unknown"],
    ["Active points", row?.projectedPoints == null ? "unavailable" : row.projectedPoints.toLocaleString("en-US", { maximumFractionDigits: 3 })],
  ];
  return <details className={styles.rosterContribution} aria-label={`${name} range contribution`}>
    <summary aria-label={`Review ${name} daily contribution evidence`}><span className={styles.contributionMetrics}>{metrics.map(([label, value]) =>
      <span key={label} aria-label={`${label}: ${value}`}><span className={styles.contributionMetricLabel} title={label === "DUST/bench" ? "Evaluated bench games" : undefined}>{label === "DUST/bench" ? "DUST" : label}</span><strong>{compactValue(value)}</strong></span>
    )}</span></summary>
    <p>Remaining scheduled games while rostered, legal active assignments and evaluated bench games in the selected range. These do not confirm participation.</p>
    <p>Projected active points: {row?.projectedPoints == null ? "unavailable" : row.projectedPoints.toLocaleString("en-US", { maximumFractionDigits: 3 })}. Excludes banked results.</p>
    {row ? <ul>{row.days.map(day => <li key={`${day.date}:${day.gameId ?? "none"}`}>
      <time dateTime={day.date}>{new Date(`${day.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</time>
      {` · ${labels[day.state]}${day.slotId ? ` · ${day.slotId}` : ""}`}
      {day.state === "bench" && <> · {day.reason && reasons[day.reason] ? reasons[day.reason] : "Scoring or placement explanation unresolved"}
        {day.competingPlayerIds.length > 0 && <span> · Competing assigned players: {day.competingPlayerIds.map(nameOf).join(", ")}. This set does not identify a unique replacement.</span>}</>}
    </li>)}</ul> : <p>Waiting for the current planning inputs and evaluation.</p>}
  </details>;
}

import { DAYS, type GameData } from "lib/NHL/types";
import { calcTotalOffNights, getRegularGamesPerDay } from "components/GameGrid/utils/helper";
import { getTeamScheduleSummary } from "components/GameGrid/utils/scheduleSummary";
import { formatWeekScore } from "components/GameGrid/utils/calcWeekScore";
import { useCanonicalSchedule, validContextDates, type CanonicalSchedule } from "./canonicalSchedule";
import styles from "./TeamScheduleContext.module.scss";
import InfoTooltip from "./InfoTooltip";
import Image from "next/image";
import { getLocalTeamLogoPath, fallbackTeamLogo } from "lib/images";

type TeamContext = { abbreviation: string; games: Record<string, GameData>; teamId: number;
  summary: ReturnType<typeof getTeamScheduleSummary> };
const labelDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Game Grid's summary indexes by supplied keys; date keys avoid collisions in nonstandard matchups. */
export function teamScheduleContext(data: CanonicalSchedule | null, dates: string[]) {
  const unavailable = (reason: string) => ({ teams: [] as TeamContext[], days: [] as (typeof DAYS)[number][], counts: [] as number[], reason });
  if (!validContextDates(dates)) return unavailable("Choose a consecutive range of up to 28 days for team schedule context.");
  if (!data?.complete) return unavailable(data?.error ?? "Canonical NHL schedule coverage is unavailable.");
  const rows = new Map<number, Record<string, GameData>>();
  for (const game of data.games) {
    const date = game.gameDate;
    if (!date || !dates.includes(date)) continue;
    for (const id of [game.homeTeam.id, game.awayTeam.id]) {
      const row = rows.get(id) ?? {};
      if (row[date] && row[date].id !== game.id) return unavailable("Team schedule ranks are unavailable because one team has conflicting games on the same date.");
      row[date] = game; rows.set(id, row);
    }
  }
  // The shared functions use keys only for lookup, with no weekday parsing.
  const days = dates as (typeof DAYS)[number][];
  const counts = getRegularGamesPerDay([...rows.values()], days);
  if (counts.some(count => count > 16)) return unavailable("Team schedule ranks are unavailable because the league slate is inconsistent.");
  const teams = [...rows].map(([teamId, games]) => ({ abbreviation: data.teams.find(team => team.id === teamId)?.abbreviation ?? `Team ${teamId}`, games, teamId,
    summary: getTeamScheduleSummary({ ...games, teamId }, counts, [], days, days.map(() => true)) }))
    .sort((a, b) => b.summary.weekScore - a.summary.weekScore || a.abbreviation.localeCompare(b.abbreviation)).slice(0, 5);
  return { teams, days, counts, reason: teams.length ? null : "No regular-season games are scheduled in this range." };
}

export default function TeamScheduleContext({ dates, seasonId, timeZone, enabled = true, expanded = false, calendar }: { calendar?: CanonicalSchedule; dates: string[]; seasonId: number; timeZone: string; enabled?: boolean; expanded?: boolean }) {
  const read = useCanonicalSchedule(dates, seasonId, timeZone, enabled && !calendar);
  const data = calendar ?? read;
  const context = teamScheduleContext(data, dates);
  return <details className={styles.context} open={expanded}>
    <summary>Top five team schedules <span>{context.reason ? "· unavailable" : `· ${labelDate(dates[0])}–${labelDate(dates.at(-1)!)}`}</span><span> · Team context</span></summary>
    {context.reason ? <p role="status">{context.reason}</p> : <>
      <div className={styles.cards} role="group" aria-label="Top team schedule cards" tabIndex={0}>{context.teams.map(team => <article key={team.abbreviation} aria-label={`${team.abbreviation} team schedule`}>
        <Image className={styles.teamLogo} src={getLocalTeamLogoPath(team.abbreviation)} alt="" width={46} height={46} onError={event => { event.currentTarget.src = fallbackTeamLogo; }} />
        <div className={styles.cardHead}><strong>{team.abbreviation}</strong></div>
        <div className={styles.teamMetrics} aria-label={`GP ${team.summary.totalGamesPlayed} · OFF ${team.summary.totalOffNights} · Score ${formatWeekScore(team.summary.weekScore)}`}>
          <span><small>GP</small><b>{team.summary.totalGamesPlayed}</b></span>
          <span><small>OFF</small><b>{team.summary.totalOffNights}</b></span>
          <span><small>Score</small><b>{formatWeekScore(team.summary.weekScore)}</b></span>
        </div>
        <div className={styles.days} style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>{dates.map((date, index) => {
          const game = team.games[context.days[index]];
          const home = game?.homeTeam.id === team.teamId;
          const offNight = Boolean(game) && calcTotalOffNights(team.games, context.counts, context.days.filter((_, i) => i !== index), context.days) > 0;
          return <span key={date} aria-label={`${labelDate(date)}: ${game ? home ? "Home game" : "Away game" : "No game"}${offNight ? " · Off-night" : ""}`}>
            <small>{new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</small><b data-off-night={offNight}>{game ? home ? "H" : "A" : "—"}</b>
          </span>;
        })}</div>
      </article>)}</div>
      <div className={styles.contextToolbar}><InfoTooltip label="About team schedule scores">Verified schedule metadata and Game Grid schedule score for the displayed {timeZone} range. In the optimizer this is the remaining selected date range; earlier dates stay outside this context. OFF and underlined H/A mean games on league slates of eight or fewer. Missing matchup odds contribute neutrally. GP includes completed games on displayed dates; this is team schedule context, not net roster fit or confirmed participation.</InfoTooltip></div>
    </>}
  </details>;
}

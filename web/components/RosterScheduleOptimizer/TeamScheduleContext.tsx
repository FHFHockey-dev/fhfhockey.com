import { DAYS, type GameData } from "lib/NHL/types";
import { calcTotalOffNights, getRegularGamesPerDay } from "components/GameGrid/utils/helper";
import { getTeamScheduleSummary } from "components/GameGrid/utils/scheduleSummary";
import { formatWeekScore } from "components/GameGrid/utils/calcWeekScore";
import { useCanonicalSchedule, validContextDates, type CanonicalSchedule } from "./canonicalSchedule";
import styles from "./TeamScheduleContext.module.scss";
import InfoTooltip from "./InfoTooltip";
import Image from "next/image";
import { getLocalTeamLogoPath, fallbackTeamLogo } from "lib/images";
import { teamsInfo } from "lib/teamsInfo";

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
  // Nothing to act on without a verified schedule; the strip simply stays hidden.
  if (context.reason) return null;
  return <details className={styles.context} open={expanded}>
    <summary>Top five team schedules <span>{context.reason ? "· unavailable" : `· ${labelDate(dates[0])}–${labelDate(dates.at(-1)!)}`}</span><span> · Team context</span></summary>
    {context.reason ? <p role="status">{context.reason}</p> : <>
      <div className={styles.cards} role="group" aria-label="Top team schedule cards" tabIndex={0}>{context.teams.map(team => {
        const colors = teamsInfo[team.abbreviation];
        // Team band: primary colour, abbreviation in the secondary colour, inner outline in the jersey colour.
        const band = colors ? { background: colors.primaryColor, color: colors.secondaryColor, boxShadow: `inset 0 0 0 2px ${colors.jersey}` } : undefined;
        return <article key={team.abbreviation} aria-label={`${team.abbreviation} team schedule`}>
        <div className={styles.teamBand} style={band} data-team-band={team.abbreviation}><strong>{team.abbreviation}</strong></div>
        <div className={styles.days} style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(0, 1fr))` }}>{dates.map((date, index) => {
          const game = team.games[context.days[index]];
          const home = game?.homeTeam.id === team.teamId;
          const opponentId = game ? home ? game.awayTeam.id : game.homeTeam.id : null;
          const opponent = opponentId === null ? null : data?.teams.find(row => row.id === opponentId)?.abbreviation ?? null;
          const offNight = Boolean(game) && calcTotalOffNights(team.games, context.counts, context.days.filter((_, i) => i !== index), context.days) > 0;
          return <span key={date} aria-label={`${labelDate(date)}: ${game ? `${home ? "Home vs" : "Away at"} ${opponent ?? "unknown opponent"}` : "No game"}${offNight ? " · Off-night" : ""}`}>
            <small>{new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</small>
            <b data-off-night={offNight} data-game={game ? home ? "home" : "away" : undefined}>{!game ? "—" : opponent
              ? <Image className={styles.opponentLogo} src={getLocalTeamLogoPath(opponent)} alt="" width={22} height={22} onError={event => { event.currentTarget.src = fallbackTeamLogo; }} />
              : home ? "H" : "A"}</b>
          </span>;
        })}</div>
        <div className={styles.teamMetrics} aria-label={`GP ${team.summary.totalGamesPlayed} · OFF ${team.summary.totalOffNights} · Score ${formatWeekScore(team.summary.weekScore)}`}>
          <span className={styles.weekScore}><small>Score</small><b>{formatWeekScore(team.summary.weekScore)}</b></span>
          <span><small>GP</small><b>{team.summary.totalGamesPlayed}</b></span>
          <span><small>OFF</small><b>{team.summary.totalOffNights}</b></span>
        </div>
      </article>;
      })}</div>
      <div className={styles.contextToolbar}><InfoTooltip label="About team schedule scores">Verified schedule metadata and Game Grid schedule score for the displayed {timeZone} range. In the optimizer this is the remaining selected date range; earlier dates stay outside this context. OFF and underlined H/A mean games on league slates of eight or fewer. Missing matchup odds contribute neutrally. GP includes completed games on displayed dates; this is team schedule context, not net roster fit or confirmed participation.</InfoTooltip></div>
    </>}
  </details>;
}

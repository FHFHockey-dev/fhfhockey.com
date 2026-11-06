/* eslint-disable @next/next/no-img-element -- Native data URLs are embedded by html-to-image for exact PNG exports. */
import type { CSSProperties } from "react";
import type { SharePostCardProps } from "lib/socialShare/modules/contract";
import { ownershipLabel } from "lib/socialShare/modules/shared/definitions";
import { deltaText, deltaTone, metricLabel, metricText, teamStreamDelta, teamStreamPicks, teamStreamRank, teamStreamSelected, type TeamStreamCandidate, type TeamStreamCategory, type TeamStreamData, type TeamStreamSettings, type TeamStreamTeam } from "lib/socialShare/modules/teamStream";
import { teamBannerStyle } from "../TeamBanner";
import { PostEmpty, PostTeamMark } from "./kit";
import styles from "./TeamStreamCard.module.scss";

type CardProps = Pick<SharePostCardProps<TeamStreamSettings, TeamStreamData>, "data" | "settings" | "logos">;

/** The pickups cards' role tones (ticket 15): first line or pair green down to red, PP1 green and PP2 yellow. */
const ROLE_TONES: Record<string, string> = { L1: "green", L2: "yellow", L3: "orange", L4: "red", P1: "green", P2: "yellow", P3: "red", PP1: "green", PP2: "yellow" };
export function RoleChips({ role }: { role: TeamStreamCandidate["role"] }) {
  const chips = [...(role.line ? [role.line] : []), ...(role.pp ? [`PP${role.pp}`] : [])];
  return chips.length ? <span className={styles.roles}>{chips.map(chip => <i key={chip} data-tone={ROLE_TONES[chip] ?? "green"} data-testid="team-stream-role">{chip}</i>)}</span> : null;
}

const STATS: readonly { id: keyof TeamStreamCandidate["totals"]; label: string; focus?: TeamStreamCategory }[] = [
  { id: "goals", label: "G" }, { id: "assists", label: "A" }, { id: "ppPoints", label: "PPP" }, { id: "shots", label: "SOG", focus: "shots" },
  { id: "pim", label: "PIM", focus: "pim" }, { id: "hits", label: "HIT", focus: "hits" }, { id: "blocks", label: "BLK", focus: "blocks" },
];
const focused = (settings: TeamStreamSettings, focus: TeamStreamCategory | undefined) => !!focus && (settings.focus === focus || settings.focus === "peripherals");
/** Past this many characters a name drops a size so it fits beside the stat columns. */
const LONG_NAME = 20;
const dayDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;

function ScheduleRail({ data, team, logos }: { data: TeamStreamData; team: TeamStreamTeam; logos: CardProps["logos"] }) {
  const compact = data.days.length > 7;
  return <ol className={styles.rail} data-compact={compact || undefined} data-testid="team-stream-rail" style={{ gridTemplateColumns: `repeat(${data.days.length}, minmax(0, 1fr))` }}>
    {data.days.map((day, index) => {
      const games = team.schedule[index] ?? [];
      return <li key={day.date} className={styles.day} data-off={day.offNight || undefined} data-game={games.length > 0 || undefined} data-played={games.length > 0 && games.every(game => game.played) || undefined}>
        <span className={styles.dayHead}><b>{day.label.slice(0, 3).toUpperCase()}</b><small>{dayDate(day.date)}</small></span>
        {games.length ? games.map(game => <span key={game.opponent} className={styles.opponent}>
          <i>{game.home === false ? "@" : "vs"}</i>
          {logos[game.opponent] ? <img src={logos[game.opponent]!} alt={game.opponent} /> : <b>{game.opponent}</b>}
        </span>) : <span className={styles.noGame} aria-label="No game">—</span>}
      </li>;
    })}
  </ol>;
}

function TeamHero({ data, team, logos }: { data: TeamStreamData; team: TeamStreamTeam; logos: CardProps["logos"] }) {
  return <header className={styles.hero} style={teamBannerStyle(team.team) as CSSProperties} data-testid="team-stream-hero">
    <span className={styles.heroLogo}><PostTeamMark team={team.team} logo={logos[team.team]} size={112} /></span>
    <span className={styles.heroName}><strong>{team.teamName}</strong><small>{team.games} {team.games === 1 ? "game" : "games"} · {team.offNightGames} off-night</small></span>
    <span className={styles.heroScore}><small>Week Score</small><strong data-testid="team-stream-score">{team.score.toFixed(1)}</strong><em data-testid="team-stream-rank">Rank {teamStreamRank(data, team)} of {data.teamsWithGames}</em></span>
  </header>;
}

function PlayerRow({ candidate, settings }: { candidate: TeamStreamCandidate; settings: TeamStreamSettings }) {
  const value = candidate.metrics[settings.metric], delta = teamStreamDelta(value);
  return <>
    <span className={styles.who} data-testid="team-stream-player">
      <strong data-long={candidate.name.length > LONG_NAME || undefined}>{candidate.name}</strong>
      <span className={styles.meta}>
        <b data-testid="team-stream-owned">{ownershipLabel(candidate.ownership)}</b><small>Rostered</small><span className={styles.pos}>{candidate.positions}</span>
        {candidate.hot && <em className={styles.hot}>HOT</em>}<RoleChips role={candidate.role} />
      </span>
    </span>
    {STATS.map(stat => <span key={stat.id} className={styles.stat} data-focus={focused(settings, stat.focus) || undefined} data-stat={stat.id}>{candidate.totals[stat.id] ?? "—"}</span>)}
    <span className={styles.delta} data-tone={deltaTone(delta)} data-testid="team-stream-delta"><strong>{deltaText(delta)}</strong><small>{metricText(settings.metric, value.prior)} → {metricText(settings.metric, value.l5)}</small></span>
  </>;
}

export default function TeamStreamCard({ data, settings, logos }: CardProps) {
  const team = teamStreamSelected(data, settings);
  if (!team) return <PostEmpty>No team has a game in these dates</PostEmpty>;
  const picks = teamStreamPicks(team.candidates, settings.focus), { window } = data;
  return <div className={styles.body} data-testid="team-stream-card">
    <TeamHero data={data} team={team} logos={logos} />
    <ScheduleRail data={data} team={team} logos={logos} />
    {picks.length ? <div className={styles.players} style={{ gridTemplateRows: `auto repeat(${picks.length}, 1fr)` }}>
      <span className={styles.head}>Streamers · last 5 GP</span>
      {STATS.map(stat => <span key={stat.id} className={styles.head} data-numeric data-focus={focused(settings, stat.focus) || undefined}>{stat.label}</span>)}
      <span className={styles.head} data-delta>{metricLabel(settings.metric)} Δ</span>
      {picks.map(candidate => <PlayerRow key={candidate.nhlId} candidate={candidate} settings={settings} />)}
    </div> : <PostEmpty>No skater at or under {settings.ownershipCeiling}% rostered qualifies</PostEmpty>}
    <p className={styles.legend} data-testid="team-stream-legend">
      <b>{window.upcoming === "next-week" ? "Next week · " : window.upcoming ? "Upcoming · " : ""}{window.label}</b>{window.past && <> · <strong>Past dates: streamers and ownership are current</strong></>} · Δ: last 5 GP vs the 5 before · Green: 8 or fewer NHL games · At or under {settings.ownershipCeiling}% rostered
    </p>
  </div>;
}

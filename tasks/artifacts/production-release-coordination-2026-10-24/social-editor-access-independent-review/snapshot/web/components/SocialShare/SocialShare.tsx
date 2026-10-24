/* eslint-disable @next/next/no-img-element -- Native owned SVG is decoded and embedded by html-to-image for exact PNG exports. */
import { useCallback, useEffect, useRef, useState } from "react";
import { SCHEDULE_FORMATS, type SharePlayerLayer, type SocialShareFormat, type SocialShareSnapshot, type ShareTeam, type ShareTeamRow } from "lib/socialShare/types";
import { calendarWeekStart, selectScheduleDates, weekDates } from "lib/socialShare/schedule";
import { bounded, downloadSharePng, readyShareFonts, SHARE_SIZE, teamLogoDataUrl } from "lib/socialShare/export";
import { editionCountTiers, mondayGridRows, type CountTier } from "lib/socialShare/mondayGrid";
import { fetchEdition } from "lib/socialShare/editionFetch";
import { editionLabel } from "lib/socialShare/edition";
import { easiestSchedules, opponentsReady, SOFT_DEFENSE_MAX, STREAM_TEAM_RANK_MAX, streamingNights, type MatchupGame, type RankedRate, type StreamNight } from "lib/socialShare/matchups";
import { deploymentChanges, hotCold, MIN_RATE_TOI_SECONDS_LAST5, MIN_TREND_SEASON_GAMES, moversReady, ownershipMovers, rateStandouts, TREND_WINDOW_GAMES, trendsReady, type RateMetric, type TrendPick } from "lib/socialShare/trends";
import { MIN_GOALIE_STARTS, MIN_SKATER_GAMES, PICKUP_BANDS, PLAYER_TEAM_RANK_MAX, pickupTiers, playersMatchSelection, playersReady, specialists, type RankedPlayer, type SpecialistCategory } from "lib/socialShare/players";
import styles from "./SocialShare.module.scss";
import { TeamBanner } from "./TeamBanner";

const labels: Record<SocialShareFormat, string> = {
  "game-grid": "Weekly schedule", "remaining-week": "Remaining week",
  "tuesday-trends": "Tuesday trends", "player-spotlight": "Player spotlight", "category-rescue": "Category rescue",
};
const dateLabel = (date: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const yearDateLabel = (date: string) => `${dateLabel(date)}, ${date.slice(0, 4)}`;
const timeLabel = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }).format(new Date(value)) : "Not available";
const scoreLabel = (row: ShareTeamRow) => row.remainingGames ? row.score.toFixed(1) : "No games";
const titleDay = (label: string) => label.charAt(0) + label.slice(1, 3).toLowerCase();
const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
// Monday and Wednesday open on the logo grid, Tuesday on hot and cold; other formats keep the leaders summary.
const defaultGraphic = (format: SocialShareFormat) => format === "game-grid" || format === "remaining-week" ? "grid" : format === "tuesday-trends" ? "hot" : "leaders";
const editionDays: Partial<Record<SocialShareFormat, string>> = { "game-grid": "Monday", "tuesday-trends": "Tuesday", "remaining-week": "Wednesday" };
// Eyebrow label from the edition's real date context, e.g. "This week" on a Saturday (SS1-8-O3).
const editionDay = (snapshot: SocialShareSnapshot) => editionLabel(snapshot);
/** Selected days as "Thu–Sun" when contiguous, else "Mon, Wed, Fri". */
function coveredDays(snapshot: SocialShareSnapshot) {
  const indexes = snapshot.days.map((day, index) => day.selected ? index : -1).filter(index => index >= 0);
  const label = (index: number) => titleDay(snapshot.days[index].label);
  const contiguous = indexes.every((index, i) => i === 0 || index === indexes[i - 1] + 1);
  return !indexes.length ? "No days" : indexes.length === 1 ? label(indexes[0]) : contiguous ? `${label(indexes[0])}–${label(indexes[indexes.length - 1])}` : indexes.map(label).join(", ");
}
type MatchupKind = "easiest" | "stream";
const matchupTitles: Record<MatchupKind, string> = { easiest: "EASIEST SCHEDULES", stream: "STREAMING MATCHUPS" };
const softness = (def: number | null) => def === null ? null : def <= SOFT_DEFENSE_MAX ? "soft" : def >= 100 - SOFT_DEFENSE_MAX ? "strong" : "average";

function futureItinerary(snapshot: SocialShareSnapshot, row: ShareTeamRow) {
  return row.games.filter(game => snapshot.selectedDates.includes(game.date) && game.gameType === 2 && game.status === "scheduled" && game.startTimeUtc !== null && Date.parse(game.startTimeUtc) > Date.parse(snapshot.generatedAt))
    .sort((a, b) => Date.parse(a.startTimeUtc!) - Date.parse(b.startTimeUtc!));
}

function altText(snapshot: SocialShareSnapshot, rows: ShareTeamRow[], trusted: boolean, teamFocus: boolean) {
  const itinerary = teamFocus && rows[0] ? ` Selected future regular-season itinerary: ${futureItinerary(snapshot, rows[0]).map(game => {
    const home = game.homeTeam.id === rows[0].team.id;
    const day = snapshot.days.find(item => item.date === game.date)!;
    return `${yearDateLabel(game.date)}, ${home ? "home vs" : "away at"} ${home ? game.awayTeam.name : game.homeTeam.name}, ${timeLabel(game.startTimeUtc)}, ${day.offNight ? "off-night" : "busy night"} (${day.leagueGames} games on the full NHL slate)`;
  }).join("; ")}.` : "";
  return `FHFH ${labels[snapshot.format]}, ${yearDateLabel(snapshot.weekStart)} through ${yearDateLabel(snapshot.weekEnd)}. ${trusted ? "Schedule only" : "Unranked preview only; source or edition is not ready"}, remaining games after ${timeLabel(snapshot.generatedAt)}. Selected dates: ${snapshot.selectedDates.map(dateLabel).join(", ") || "none"}. ${rows.map(row => `${row.team.name}: ${row.remainingGames} ${trusted ? "remaining" : "known remaining"} games, ${row.offNightGames} ${trusted ? "" : "known "}off-night games${trusted ? `, Schedule Score ${scoreLabel(row)}` : "; ranking unavailable"}`).join("; ")}.${itinerary} NHL schedule checked ${timeLabel(snapshot.source.fetchedAt)}. Off-night density uses the full daily slate. Observed schedule only. No odds or player projections.`;
}

function gridAltText(snapshot: SocialShareSnapshot, trusted: boolean) {
  const dayLabel = (date: string) => titleDay(snapshot.days.find(day => day.date === date)!.label);
  const offNights = snapshot.days.filter(day => day.offNight).map(day => titleDay(day.label)).join(", ") || "none";
  const rows = mondayGridRows(snapshot, trusted).map(row => `${row.rank ? `${row.rank}. ` : ""}${row.team.name}: ${row.remainingGames} ${trusted ? "" : "known "}games left, ${row.offNightGames} off-night; ${row.cells.flatMap(cell => cell.games.map(game => `${dayLabel(cell.date)} ${game.home ? "vs" : "@"} ${game.opponent.abbreviation}${game.counted ? "" : " (not counted)"}`)).join(", ") || "no games"}`);
  return `FHFH Best schedules, ${editionDay(snapshot)} streamer grid, ${yearDateLabel(snapshot.weekStart)} through ${yearDateLabel(snapshot.weekEnd)}${snapshot.selectedDates.length === 7 ? "" : `, covering ${coveredDays(snapshot)}`}. ${trusted ? "Teams ranked by FHFH Game Grid Week Score, schedule only" : "Unranked preview in alphabetical order; ranking unavailable because the source or edition is not ready"}. Selected dates: ${snapshot.selectedDates.map(dateLabel).join(", ") || "none"}. Off-nights (8 or fewer NHL games): ${offNights}. ${rows.join("; ")}. NHL schedule checked ${timeLabel(snapshot.source.fetchedAt)}. No odds or player projections.`;
}

function TeamMark({ team, logo, size }: { team: ShareTeam; logo: string | null | undefined; size: number }) {
  return logo ? <img src={logo} alt="" width={size} height={size} /> : <b className={styles.logoFallback}>{team.abbreviation}</b>;
}

function CardHeader({ snapshot, brandLogo, eyebrow, title, compact }: { snapshot: SocialShareSnapshot; brandLogo: string | null; eyebrow: string; title: string; compact?: boolean }) {
  return <div className={cx(styles.gridHeader, compact && styles.compactHeader)}>
    <div className={styles.gridBrand}>{brandLogo ? <img src={brandLogo} alt="FHFH" width="135" height="40" /> : <strong>FHFH</strong>}<span>FHFHOCKEY.COM</span></div>
    <div className={styles.gridTitle}><p>{eyebrow}</p><h2>{title}</h2></div>
    {/* A full-week selection keeps the "week of" block; anything less names the covered days. */}
    {snapshot.selectedDates.length === 7 ? <div className={styles.gridWeek}><span>WEEK OF</span><strong>{dateLabel(snapshot.weekStart)} – {dateLabel(snapshot.weekEnd)}</strong><span>{snapshot.weekEnd.slice(0, 4)}</span></div>
      : <div className={styles.gridWeek} data-covered={snapshot.selectedDates.join(",")}><span>COVERS {coveredDays(snapshot).toUpperCase()}</span><strong>{snapshot.selectedDates.length ? `${dateLabel(snapshot.selectedDates[0])} – ${dateLabel(snapshot.selectedDates[snapshot.selectedDates.length - 1])}` : "No days"}</strong><span>{snapshot.weekEnd.slice(0, 4)}</span></div>}
  </div>;
}

const countClasses: Record<CountTier, string> = { high: "countHigh", second: "countSecond", between: "countBetween", low: "countLow", neutral: "countNeutral" };
/** A GP or off-night count coloured by its column tier (TJ, ticket 12); unranked editions stay neutral. */
function Count({ value, tier }: { value: number; tier: CountTier | undefined }) {
  return <b className={styles[countClasses[tier ?? "neutral"]]} data-count-tier={tier ?? "neutral"}>{value}</b>;
}
/** Per-edition GP and off-night tiers; neutral when the edition is not trusted. */
const countsFor = (snapshot: SocialShareSnapshot, trusted: boolean) => {
  const tiers = editionCountTiers(snapshot);
  return { gp: (value: number) => trusted ? tiers.gp.get(value) : "neutral" as const, off: (value: number) => trusted ? tiers.off.get(value) : "neutral" as const };
};
const CountLegend = () => <span className={styles.countLegend}><b>GP · OFF</b><i className={styles.countHigh} /><i className={styles.countSecond} /><i className={styles.countBetween} /><i className={styles.countLow} />most → least</span>;

/** Five Week Score tiers by rank among ranked teams: best (green) → worst (red). Equal scores share a tier. */
const SCORE_TIERS = ["tierBest", "tierGood", "tierAverage", "tierBelow", "tierWorst"] as const;
const tierOf = (rank: number, ranked: number) => SCORE_TIERS[Math.min(4, Math.floor(((rank - 1) * 5) / Math.max(1, ranked)))];

function MondayGrid({ snapshot, trusted, logos, brandLogo }: { snapshot: SocialShareSnapshot; trusted: boolean; logos: Record<string, string | null>; brandLogo: string | null }) {
  const rows = mondayGridRows(snapshot, trusted), ranked = rows.filter(row => row.rank !== null);
  // Competition rank (first row with the same score) so tied Week Scores get the same color.
  const scoreTier = (rank: number) => tierOf(1 + ranked.findIndex(row => row.score === ranked.find(item => item.rank === rank)!.score), ranked.length);
  // Games picked on the Streaming Matchups card get the same gentle border here.
  const cherryPicks = new Set(streamingNights(snapshot, trusted).map(night => `${night.team.id}:${night.id}`));
  const counts = countsFor(snapshot, trusted);
  return <>
    <CardHeader snapshot={snapshot} brandLogo={brandLogo} eyebrow={trusted ? `${editionDay(snapshot)} · ${snapshot.format === "remaining-week" ? "Rest of week" : "Streamer grid"}` : "Unranked preview"} title={trusted ? "BEST SCHEDULES" : "KNOWN SCHEDULES"} />
    <div className={styles.grid}>{[rows.slice(0, 16), rows.slice(16)].map((half, index) => <div key={index} className={styles.gridPanel}>
      <div className={cx(styles.gridRow, styles.gridDays)}>
        <span>{trusted ? "RK" : ""}</span><span>TEAM</span>
        {snapshot.days.map(day => <span key={day.date} className={cx(day.offNight && styles.offNightDay, !day.selected && styles.dimmed)}><strong>{titleDay(day.label)}</strong><small>{day.leagueGames}</small></span>)}
        <span>{trusted ? "SCORE" : "GP"}</span>
      </div>
      {half.map(row => <div key={row.team.id} data-team={row.team.abbreviation} data-gp-tier={counts.gp(row.remainingGames)} data-off-tier={counts.off(row.offNightGames)} data-tier={row.rank !== null ? scoreTier(row.rank) : undefined} className={cx(styles.gridRow, row.rank !== null && styles.tierRail, row.rank !== null && styles[scoreTier(row.rank)])}>
        <span className={styles.gridRank}>{row.rank ?? ""}</span>
        <span className={styles.gridTeam}><TeamMark team={row.team} logo={logos[row.team.abbreviation]} size={40} /></span>
        {row.cells.map(cell => {
          const game = cell.games[0];
          const cherry = !!game && cherryPicks.has(`${row.team.id}:${game.id}`);
          return <span key={cell.date} data-date={cell.date} data-cherry={cherry || undefined} className={cx(styles.cell, cell.offNight && styles.offNightColumn, game && (game.home ? styles.homeCell : styles.awayCell), cherry && styles.cherryPick, game && !game.counted && styles.dimmed)}>
            {game && <><TeamMark team={game.opponent} logo={logos[game.opponent.abbreviation]} size={32} />{!game.home && <i className={styles.awayMark}>@</i>}{cell.games.length > 1 && <i className={styles.doubleMark}>×{cell.games.length}</i>}</>}
          </span>;
        })}
        <span className={styles.gridGames}>{row.rank !== null && row.remainingGames > 0 ? <strong className={styles.gridScore}>{row.score.toFixed(1)}</strong> : <strong>{row.remainingGames}</strong>}<small><Count value={row.remainingGames} tier={counts.gp(row.remainingGames)} /> GP · <Count value={row.offNightGames} tier={counts.off(row.offNightGames)} /> OFF</small></span>
      </div>)}
    </div>)}</div>
    <footer className={styles.gridFooter}>
      <div className={styles.legend}><span><i className={styles.legendAway}>@</i>Away</span><span><i className={styles.legendHome} />Home</span><span><i className={styles.legendOffColumn} />Off-night (≤8 games)</span>{cherryPicks.size > 0 && <span><i className={styles.legendCherry} />Streaming pick</span>}{trusted && <CountLegend />}<span className={styles.tierLegend}><b>SCORE</b><i className={styles.tierBest} /><i className={styles.tierGood} /><i className={styles.tierAverage} /><i className={styles.tierBelow} /><i className={styles.tierWorst} />best → worst</span></div>
      <p><span>{trusted ? "Ranked by Game Grid Week Score (games, off-nights, slate density)" : "Ranking unavailable · alphabetical order"} · No odds or projections · NHL schedule checked {timeLabel(snapshot.source.fetchedAt)}</span><strong className={styles.gridWatermark}>{trusted ? "SCHEDULE ONLY" : "PREVIEW ONLY · REFRESH / CHECK SOURCE"}</strong></p>
    </footer>
  </>;
}

/**
 * Why an untrusted edition cannot rank, in the viewer's terms. On game days an edition is valid
 * for 15 minutes (never past a puck drop), so "expired" is the common case; it was previously
 * reported as a generic "not ready" (SS1-8 diagnosis).
 */
function scheduleReason(snapshot: SocialShareSnapshot) {
  const reason = [...snapshot.reasons, ...snapshot.source.reasons][0]?.replace(/\.$/, "");
  if (snapshot.state !== "ready" || snapshot.source.state !== "ready") return `the schedule edition is not ready (${snapshot.state}${reason ? `: ${reason}` : ""})`;
  if (!snapshot.expiresAt || Date.parse(snapshot.expiresAt) <= Date.now()) return `the schedule edition expired at ${timeLabel(snapshot.expiresAt)}; refresh the schedule`;
  return "the schedule edition is not ready (the last refresh failed or a different week is loaded; refresh the schedule)";
}

function unreadyReason(snapshot: SocialShareSnapshot, trusted: boolean) {
  if (!trusted) return scheduleReason(snapshot);
  const opponents = snapshot.opponents;
  return !opponents ? "opponent team ratings are unavailable" : `opponent team ratings are ${opponents.state}${opponents.reasons.length ? ` (${opponents.reasons[0].replace(/\.$/, "")})` : ""}`;
}

function matchupAltText(kind: MatchupKind, snapshot: SocialShareSnapshot, trusted: boolean) {
  const dayLabel = (date: string) => titleDay(snapshot.days.find(day => day.date === date)!.label);
  const head = `FHFH ${kind === "easiest" ? "Easiest schedules" : "Streaming matchups"}, ${yearDateLabel(snapshot.weekStart)} through ${yearDateLabel(snapshot.weekEnd)}. Selected dates: ${snapshot.selectedDates.map(dateLabel).join(", ") || "none"}.`;
  const tail = `NST team stats updated ${timeLabel(snapshot.opponents?.updatedAt ?? null)}. NHL schedule checked ${timeLabel(snapshot.source.fetchedAt)}. Schedule and team rates only; no odds or player projections.`;
  const ready = trusted && opponentsReady(snapshot);
  if (!ready) return `${head} Unranked preview; ranking unavailable because ${unreadyReason(snapshot, trusted)}. ${tail}`;
  if (kind === "easiest") {
    const { floor, rows } = easiestSchedules(snapshot, true);
    return `${head} Ranked by Game Grid opponent defense rating, 0 to 100, lower is easier, among teams with ${floor} or more games left. ${rows.map(row => `${row.rank}. ${row.team.name}: opponent defense ${Math.round(row.def)}, ${row.remainingGames} games (${row.games.map(game => `${dayLabel(game.date)} ${game.home ? "vs" : "@"} ${game.opponent.abbreviation}`).join(", ")}), number ${row.weekRank} Week Score`).join("; ") || "No qualifying teams"}. ${tail}`;
  }
  const nights = streamingNights(snapshot, true);
  return `${head} Top-${STREAM_TEAM_RANK_MAX} Week Score teams against a soft defense (opponent defense ${SOFT_DEFENSE_MAX} or lower) or a perfect-storm pairing, most signals first, one night per team. ${nights.map(night => `${dayLabel(night.date)} ${dateLabel(night.date)}: ${night.team.name} ${night.home ? "vs" : "@"} ${night.opponent.name}, tilted toward ${night.team.abbreviation}${night.evidence.flags.length ? ` (${night.evidence.flags.map(flag => flagLabels[flag].toLowerCase()).join(", ")})` : ""}, opponent defense ${night.oppDef === null ? "unknown" : Math.round(night.oppDef)}, ${night.offNight ? "off-night" : "busy night"} (${night.leagueGames} games), number ${night.weekRank} Week Score`).join("; ") || "No soft-defense nights on the selected dates"}. ${tail}`;
}

function OpponentChip({ game, logos, snapshot }: { game: MatchupGame; logos: Record<string, string | null>; snapshot: SocialShareSnapshot }) {
  const tone = softness(game.oppDef);
  return <span data-date={game.date} className={cx(styles.oppChip, tone && styles[`opp_${tone}`])}>
    <TeamMark team={game.opponent} logo={logos[game.opponent.abbreviation]} size={38} />{!game.home && <i className={styles.awayMark}>@</i>}
    <small>{titleDay(snapshot.days.find(day => day.date === game.date)!.label)}</small>
  </span>;
}

const ordinal = (value: number) => `${value}${value % 100 >= 11 && value % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][value % 10] ?? "th"}`;
const rateText = (rate: RankedRate | null, digits: number, ranking: string) => rate ? `${rate.perGame.toFixed(digits)} (${ordinal(rate.rank)} ${ranking})` : "—";
const flagLabels = { goals: "GOAL STORM", shots: "SHOT STORM", tired: "TIRED OPPONENT" } as const;

/** One cherry-picked team-night with the evidence that tilts it toward the streaming team. */
function StreamTile({ night, snapshot, logos }: { night: StreamNight; snapshot: SocialShareSnapshot; logos: Record<string, string | null> }) {
  const { goals, shots, rest, flags } = night.evidence, day = snapshot.days.find(item => item.date === night.date)!;
  const restText = rest.opponentSecondNight === null ? "Back-to-back unknown (week's first day)" : rest.opponentSecondNight && !rest.teamSecondNight ? `${night.opponent.abbreviation} on the 2nd night of a back-to-back; ${night.team.abbreviation} rested`
    : rest.opponentSecondNight && rest.teamSecondNight ? "Both teams on a back-to-back" : rest.teamSecondNight ? `${night.team.abbreviation} on a back-to-back` : "Both teams rested";
  return <div data-team={night.team.abbreviation} data-player={`${night.team.abbreviation}-${night.id}`} className={cx(styles.streamTile, styles.cherryTile)}>
    <TeamBanner team={night.team} logo={logos[night.team.abbreviation]} title={night.team.name} subtitle={`${night.home ? "vs" : "@"} ${night.opponent.name} · ${titleDay(day.label)} ${dateLabel(night.date)}`}
      right={<span className={styles.streamOpponent}><TeamMark team={night.opponent} logo={logos[night.opponent.abbreviation]} size={40} /><small>{night.home ? "VS" : "@"} {night.opponent.abbreviation}</small></span>} />
    <div className={styles.streamBody}>
      <div className={styles.streamFlags}><b>TILT → {night.team.abbreviation}</b>{flags.map(flag => <i key={flag}>{flagLabels[flag]}</i>)}{night.oppDef !== null && night.oppDef <= SOFT_DEFENSE_MAX && <i>SOFT DEFENSE</i>}<i className={cx(!night.offNight && styles.streamBusy)}>{night.offNight ? "OFF-NIGHT" : "BUSY NIGHT"} · {night.leagueGames} GMS</i></div>
      <dl className={styles.streamEvidence}>
        <dt>Goals</dt><dd className={cx(goals.storm && styles.storm)}>{night.team.abbreviation} GF/GP {rateText(goals.team, 2, "most")} vs {night.opponent.abbreviation} GA/GP {rateText(goals.opponent, 2, "most")}</dd>
        <dt>Shots</dt><dd className={cx(shots.storm && styles.storm)}>{night.team.abbreviation} SF/GP {rateText(shots.team, 1, "most")} vs {night.opponent.abbreviation} SA/GP {rateText(shots.opponent, 1, "most")}</dd>
        <dt>Rest</dt><dd className={cx(flags.includes("tired") && styles.storm)}>{restText}</dd>
        <dt>Defense</dt><dd>{night.opponent.abbreviation} OPP DEF {night.oppDef === null ? "—" : Math.round(night.oppDef)} (lower = softer) · #{night.weekRank} Week Score, <Count value={night.remainingGames} tier={countsFor(snapshot, true).gp(night.remainingGames)} /> GP</dd>
      </dl>
    </div>
  </div>;
}

function MatchupCard({ kind, snapshot, trusted, logos, brandLogo }: { kind: MatchupKind; snapshot: SocialShareSnapshot; trusted: boolean; logos: Record<string, string | null>; brandLogo: string | null }) {
  const ready = trusted && opponentsReady(snapshot);
  const easiest = kind === "easiest" ? easiestSchedules(snapshot, ready) : null;
  const nights = kind === "stream" ? streamingNights(snapshot, ready) : [];
  return <>
    <CardHeader snapshot={snapshot} brandLogo={brandLogo} eyebrow={ready ? `${editionDay(snapshot)} · ${kind === "easiest" ? "Softest opponents" : "Cherry-picked games"}` : "Unranked preview"} title={matchupTitles[kind]} compact />
    {!ready ? <div className={styles.matchupEmpty}><strong>Ranking unavailable</strong><p>Opponent ratings need a ready schedule and complete, current NST team stats; {unreadyReason(snapshot, trusted)}.</p></div>
      : easiest ? <div className={styles.easyList}>
        <div className={cx(styles.easyRow, styles.easyHead)}><span>RK</span><span>TEAM</span><span>OPPONENTS</span><span>GP</span><span>OPP DEF</span></div>
        {easiest.rows.length ? easiest.rows.map(row => <div key={row.team.id} data-team={row.team.abbreviation} className={cx(styles.easyRow, row.rank <= 3 && styles.topRow)}>
          <span className={styles.easyRank}>{row.rank}</span>
          <span className={styles.easyTeam}><TeamBanner team={row.team} logo={logos[row.team.abbreviation]} size="sm" title={row.team.name} subtitle={`#${row.weekRank} Week Score · ${row.offNightGames} off-night`} /></span>
          <span className={styles.easyOpps}>{row.games.map(game => <OpponentChip key={game.id} game={game} logos={logos} snapshot={snapshot} />)}</span>
          <span className={styles.easyGp}><Count value={row.remainingGames} tier={countsFor(snapshot, true).gp(row.remainingGames)} /></span>
          <span className={styles.defMeter}><strong>{Math.round(row.def)}</strong><i><b style={{ width: `${Math.max(4, Math.round(row.def))}%` }} /></i></span>
        </div>) : <p className={styles.matchupNone}>No teams with {easiest.floor}+ games on the selected dates</p>}
      </div>
      : <div className={styles.streamGrid}>{nights.length ? nights.map(night => <StreamTile key={night.id} night={night} snapshot={snapshot} logos={logos} />) : <p className={styles.matchupNone}>No soft-defense or perfect-storm nights on the selected dates</p>}</div>}
    <footer className={styles.gridFooter}>
      {kind === "easiest" ? <div className={styles.legend}><span><i className={styles.legendSoft} />Soft defense (≤{SOFT_DEFENSE_MAX})</span><span><i className={styles.legendAverage} />Average</span><span><i className={styles.legendStrong} />Strong (≥{100 - SOFT_DEFENSE_MAX})</span><span><i className={styles.legendAway}>@</i>Away</span>{ready && <CountLegend />}</div>
        : <div className={styles.legend}><span><b>Top-{STREAM_TEAM_RANK_MAX}</b> Week Score teams</span><span><b>Storm</b> = both sides in the league&apos;s top third</span><span><b>Tired</b> = opponent&apos;s 2nd night of a back-to-back</span><span>Most signals first · one night per team</span></div>}
      <p><span>OPP DEF = Game Grid opponent defense: 100 − percentile of opponents’ xGA/GP (NST, all situations), lower = easier{easiest ? ` · ${easiest.floor}+ games left` : ""} · NST updated {timeLabel(snapshot.opponents?.updatedAt ?? null)} · Schedule checked {timeLabel(snapshot.source.fetchedAt)}</span><strong className={styles.gridWatermark}>{ready ? "SCHEDULE + TEAM RATES" : "PREVIEW ONLY · REFRESH / CHECK SOURCE"}</strong></p>
    </footer>
  </>;
}

type PlayerCardKind = { kind: "pickups"; max: 50 | 30 | 20 } | { kind: "specialists" };
const parsePlayerCard = (graphic: string): PlayerCardKind | null => graphic === "specialists" ? { kind: "specialists" } : /^pickups-(50|30|20)$/.test(graphic) ? { kind: "pickups", max: Number(graphic.slice(8)) as 50 | 30 | 20 } : null;
const groupTitles = { F: "FORWARDS", D: "DEFENSE", G: "GOALIES" } as const;
const bandLabel = (max: number) => PICKUP_BANDS.find(band => band.max === max)!.label;
// Floor, so a 49.6% player never reads "50%" on the 30–49% card.
const rosteredLabel = (ownership: number) => `${Math.floor(ownership)}%`;
const specialistTitles: Record<SpecialistCategory, [string, string]> = { hits: ["HITS", "HIT/GP"], shots: ["SHOTS ON GOAL", "SOG/GP"], blocks: ["BLOCKS", "BLK/GP"] };
const dayDate = (iso: string | null) => iso ? dateLabel(iso.slice(0, 10)) : "not available";
const pickupStat = (player: RankedPlayer): [string, string] => player.group === "G"
  ? [player.qualityStartPct === null ? "—" : `${Math.round(player.qualityStartPct * 100)}%`, `QUALITY STARTS${player.savePct === null ? "" : ` · ${player.savePct.toFixed(3).replace(/^0/, "")} SV%`}`]
  : [player.pointsPerGame!.toFixed(2), "PTS/GP"];

function playerUnreadyReason(snapshot: SocialShareSnapshot, trusted: boolean) {
  if (!trusted) return scheduleReason(snapshot);
  const players = snapshot.players;
  if (players?.state === "ready" && !playersMatchSelection(snapshot)) return "player rows were prepared for different days; refresh the schedule for this selection";
  return !players ? "player ownership and season totals are not connected" : `player sources are ${players.state}${players.reasons.length ? ` (${players.reasons[0].replace(/\.$/, "")})` : ""}`;
}

function playerAltText(card: PlayerCardKind, snapshot: SocialShareSnapshot, trusted: boolean) {
  const head = `FHFH ${card.kind === "pickups" ? `Pickups ${bandLabel(card.max).toLowerCase()} rostered` : "Hits, shots and blocks specialists"}, ${yearDateLabel(snapshot.weekStart)} through ${yearDateLabel(snapshot.weekEnd)}.`;
  const tail = `Yahoo rostered percent as of ${dayDate(snapshot.players?.ownershipAsOf ?? null)}. NHL.com season totals updated ${timeLabel(snapshot.players?.statsUpdatedAt ?? null)}. Season rates, not projections.`;
  if (!trusted || !playersReady(snapshot)) return `${head} Unranked preview; ranking unavailable because ${playerUnreadyReason(snapshot, trusted)}. ${tail}`;
  const describe = (player: RankedPlayer, stat: string) => `${player.name} (${player.team}, ${player.positions}), ${stat}, ${rosteredLabel(player.ownership)} rostered, number ${player.weekRank} Week Score team with ${player.remainingGames} games${player.widened ? ", wider pool" : ""}`;
  const pool = `Top-${PLAYER_TEAM_RANK_MAX} Week Score teams first; a list short of three fills from teams ranked ${PLAYER_TEAM_RANK_MAX + 1} and lower, marked wider pool`;
  if (card.kind === "pickups") {
    const tier = pickupTiers(snapshot, true).find(item => item.max === card.max)!;
    return `${head} ${pool}. Players ranked by points per game for skaters and quality-start percent for goalies, then team schedule rank; separate bands of 30 to 49, 20 to 29 and under 20 percent rostered, each player in one band. ${(["F", "D", "G"] as const).map(group => `${groupTitles[group]}: ${tier.groups[group].map(player => describe(player, `${pickupStat(player)[0]} ${pickupStat(player)[1]}`)).join("; ") || "none qualify"}`).join(". ")}. ${tail}`;
  }
  const board = specialists(snapshot, true);
  return `${head} ${pool}. Skaters under 50% rostered, minimum ${MIN_SKATER_GAMES} games, by season total per game played. ${(Object.keys(specialistTitles) as SpecialistCategory[]).map(category => `${specialistTitles[category][0]}: ${board[category].map(player => describe(player, `${player.perGame.toFixed(1)} ${specialistTitles[category][1]}`)).join("; ") || "none qualify"}`).join(". ")}. ${tail}`;
}

type RecentFocus = "pickup" | SpecialistCategory;
/** The player's last five games, focused on the stat that justifies the pick. */
function recentLine(player: RankedPlayer, focus: RecentFocus, recentState: SharePlayerLayer["recentState"]) {
  const recent = player.recent;
  // Only claim "no recent game" when the recent-form source actually answered (C7 SS1-10-F1).
  if (!recent) return recentState === "ready" ? "No game in the last two weeks" : "Recent form unavailable";
  if (recent.kind === "goalie") {
    const pct = recent.shotsAgainst > 0 ? (recent.saves / recent.shotsAgainst).toFixed(3).replace(/^0/, "") : "—";
    return `${recent.wins}-${recent.games - recent.wins} · ${pct} SV% · ${recent.goalsAgainst} GA · ${recent.qualityStarts} QS`;
  }
  const n = (value: number | null, digits = 0) => value === null ? "—" : value.toFixed(digits);
  const toi = recent.toiSeconds === null ? "—" : clock(recent.toiSeconds);
  if (focus === "hits") return `${n(recent.hitsPerGame, 1)} HIT/GP · ${n(recent.points)} P · ${toi} TOI`;
  if (focus === "blocks") return `${n(recent.blocksPerGame, 1)} BLK/GP · ${n(recent.points)} P · ${toi} TOI`;
  if (focus === "shots") return `${n(recent.shots)} SOG · ${n(recent.goals)} G · ${toi} TOI`;
  return `${n(recent.goals)}G ${n(recent.assists)}A ${n(recent.points)}P · ${n(recent.shots)} SOG · ${n(recent.ppPoints)} PPP · ${toi}`;
}

function PlayerTile({ player, stat, label, focus, snapshot, logos }: { player: RankedPlayer; stat: string; label: string; focus: RecentFocus; snapshot: SocialShareSnapshot; logos: Record<string, string | null> }) {
  return <div data-player={player.nhlId} data-team={player.team} data-widened={player.widened || undefined} className={styles.playerTile}>
    <TeamBanner team={{ abbreviation: player.team }} logo={logos[player.team]} title={player.name} subtitle={`${player.team} · ${player.positions}`}
      right={<span className={styles.playerOwn}><strong>{rosteredLabel(player.ownership)}</strong><small>ROSTERED</small></span>} />
    <div className={styles.playerBody}>
      <div className={styles.playerStat}><strong>{stat}</strong><small>{label}</small></div>
      <p className={styles.playerRecent}><b>L5 GP</b><span>{recentLine(player, focus, snapshot.players?.recentState)}</span></p>
      <small className={styles.playerSchedule}>#{player.weekRank} Week Score · <Count value={player.remainingGames} tier={countsFor(snapshot, true).gp(player.remainingGames)} /> GP · <Count value={player.offNightGames} tier={countsFor(snapshot, true).off(player.offNightGames)} /> off-night{player.widened && <i className={styles.widened}>WIDER POOL</i>}</small>
    </div>
  </div>;
}

function PlayerCard({ card, snapshot, trusted, logos, brandLogo }: { card: PlayerCardKind; snapshot: SocialShareSnapshot; trusted: boolean; logos: Record<string, string | null>; brandLogo: string | null }) {
  const ready = trusted && playersReady(snapshot);
  const columns: { key: string; title: string; players: { player: RankedPlayer; stat: string; label: string; focus: RecentFocus }[] }[] = !ready ? [] : card.kind === "pickups"
    ? (["F", "D", "G"] as const).map(group => ({ key: group, title: groupTitles[group], players: pickupTiers(snapshot, true).find(tier => tier.max === card.max)!.groups[group].map(player => { const [stat, label] = pickupStat(player); return { player, stat, label, focus: "pickup" as const }; }) }))
    : (Object.entries(specialists(snapshot, true)) as [SpecialistCategory, ReturnType<typeof specialists>["hits"]][]).map(([category, list]) => ({ key: category, title: specialistTitles[category][0], players: list.map(player => ({ player, stat: player.perGame.toFixed(1), label: specialistTitles[category][1], focus: category })) }));
  return <>
    <CardHeader snapshot={snapshot} brandLogo={brandLogo} eyebrow={ready ? `${editionDay(snapshot)} · ${card.kind === "pickups" ? `Pickups · top-${PLAYER_TEAM_RANK_MAX} schedules first` : "Under 50% rostered"}` : "Unranked preview"} title={card.kind === "pickups" ? `${bandLabel(card.max).toUpperCase()} ROSTERED` : "CATEGORY SPECIALISTS"} compact />
    {!ready ? <div className={styles.matchupEmpty}><strong>Ranking unavailable</strong><p>Player cards need a ready schedule and current Yahoo ownership plus NHL.com season totals; {playerUnreadyReason(snapshot, trusted)}.</p></div>
      : <div className={styles.playerColumns}>{columns.map(column => <div key={column.key} className={styles.playerColumn}>
        <h3>{column.title}</h3>
        {column.players.map(item => <PlayerTile key={item.player.nhlId} {...item} snapshot={snapshot} logos={logos} />)}
        {column.players.length < 3 && <p className={styles.playerShort}>{column.players.length ? `Only ${column.players.length} qualif${column.players.length === 1 ? "ies" : "y"}` : "None qualify"}</p>}
      </div>)}</div>}
    <footer className={styles.gridFooter}>
      <div className={styles.legend}>{card.kind === "pickups"
        ? <><span><b>PTS/GP</b> season points per game (min {MIN_SKATER_GAMES} GP)</span><span><b>QS%</b> goalie quality starts (min {MIN_GOALIE_STARTS})</span><span><b>L5 GP</b> last 5 games played</span><span><b>Wider pool</b> = team ranked 11+ filling a short list</span></>
        : <><span><b>Per GP</b> = season total ÷ games played</span><span><b>L5 GP</b> last 5 games played</span><span>Skaters under 50% rostered · min {MIN_SKATER_GAMES} GP</span></>}</div>
      <p><span>Top-{PLAYER_TEAM_RANK_MAX} Week Score teams first, wider pool fills to three · {card.kind === "pickups" ? "bands 30–49% · 20–29% · under 20%, ranked by that rate" : "ranked by per-game rate"} · Season rates, not projections · Yahoo rostered % as of {dayDate(snapshot.players?.ownershipAsOf ?? null)} · NHL.com season totals updated {timeLabel(snapshot.players?.statsUpdatedAt ?? null)}</span><strong className={styles.gridWatermark}>{ready ? "SCHEDULE + PLAYER RATES" : "PREVIEW ONLY · REFRESH / CHECK SOURCE"}</strong></p>
    </footer>
  </>;
}

type TrendKind = "hot" | "deployment" | "rates" | "movers";
const TREND_KINDS: readonly TrendKind[] = ["hot", "deployment", "rates", "movers"];
const trendTitles: Record<TrendKind, string> = { hot: "HOT & COLD", deployment: "DEPLOYMENT CHANGES", rates: "RATE STANDOUTS", movers: "OWNERSHIP MOVERS" };
const rateTitles: Record<RateMetric, string> = { sogPer60: "SOG/60", icfPer60: "iCF/60", ixgPer60: "ixG/60" };
const signed = (value: number, digits: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}`;
const clock = (seconds: number) => `${Math.floor(Math.abs(seconds) / 60)}:${String(Math.round(Math.abs(seconds) % 60)).padStart(2, "0")}`;
const signedClock = (seconds: number) => `${seconds > 0 ? "+" : seconds < 0 ? "−" : ""}${clock(seconds)}`;
const lineName = (slot: number | null, group: string | null) => slot === null ? null : `${group === "defense" ? "D" : "L"}${slot}`;
const unitName = (unit: number | null) => unit === null ? "no PP" : `PP${unit}`;

type TrendRowData = { key: string; team: string | null; name: string; meta: string; weekGames?: number | null; detail: string; value: string; label: string; tone: "up" | "down"; badges: string[] };
type TrendColumn = { key: string; title: string; rows: TrendRowData[] };

function trendUnreadyReason(kind: TrendKind, snapshot: SocialShareSnapshot, trusted: boolean) {
  // An edition without a trend layer is "not connected" (the live API makes no read), never a schedule fault.
  const trends = snapshot.trends;
  if (!trends) return "rolling game metrics and ownership are not connected";
  if (!trusted) return scheduleReason(snapshot);
  const [state, reasons] = kind === "movers" ? [trends.moversState, trends.moversReasons] : [trends.state, trends.reasons];
  return `${kind === "movers" ? "ownership" : "rolling metrics"} are ${state}${reasons.length ? ` (${reasons[0].replace(/\.$/, "")})` : ""}`;
}
const trendReady = (kind: TrendKind, snapshot: SocialShareSnapshot, trusted: boolean) => trusted && (kind === "movers" ? moversReady(snapshot) : trendsReady(snapshot));

function trendColumns(kind: TrendKind, snapshot: SocialShareSnapshot): TrendColumn[] {
  const meta = (pick: TrendPick) => `${pick.team} · ${pick.position}`;
  if (kind === "hot") {
    const { hot, cold } = hotCold(snapshot, true);
    const row = (pick: TrendPick): TrendRowData => ({ key: String(pick.nhlId), team: pick.team, name: pick.name, meta: meta(pick), weekGames: pick.weekGames, detail: `L${TREND_WINDOW_GAMES} ${pick.last5.toFixed(2)} · season ${pick.season.toFixed(2)} P/GP`, value: signed(pick.delta, 2), label: "P/GP", tone: pick.delta > 0 ? "up" : "down", badges: [] });
    return [{ key: "hot", title: "HOT", rows: hot.map(row) }, { key: "cold", title: "COLD", rows: cold.map(row) }];
  }
  if (kind === "deployment") {
    const { up, down } = deploymentChanges(snapshot, true);
    const row = (pick: TrendPick): TrendRowData => {
      const lineNow = lineName(pick.line.now, pick.line.group), lineBefore = lineName(pick.line.before, pick.line.group);
      const badges = [
        ...(lineNow && lineBefore && lineNow !== lineBefore ? [`${pick.line.now! < pick.line.before! ? "▲" : "▼"} ${lineBefore} → ${lineNow}`] : lineNow ? [lineNow] : []),
        ...(pick.ppUnit.now !== pick.ppUnit.before && pick.ppUnit.before !== undefined ? [`${unitName(pick.ppUnit.before)} → ${unitName(pick.ppUnit.now)}`] : [unitName(pick.ppUnit.now)]),
        ...(pick.ppSharePct.last5 !== null && pick.ppSharePct.season !== null ? [`PP share ${Math.round(pick.ppSharePct.season)}% → ${Math.round(pick.ppSharePct.last5)}%`] : []),
      ];
      return { key: String(pick.nhlId), team: pick.team, name: pick.name, meta: meta(pick), weekGames: pick.weekGames, detail: `L${TREND_WINDOW_GAMES} ${clock(pick.last5)} · season ${clock(pick.season)} TOI/GP`, value: signedClock(pick.delta), label: "TOI/GP", tone: pick.delta > 0 ? "up" : "down", badges };
    };
    return [{ key: "up", title: "ICE TIME UP", rows: up.map(row) }, { key: "down", title: "ICE TIME DOWN", rows: down.map(row) }];
  }
  if (kind === "rates") {
    const board = rateStandouts(snapshot, true);
    return (Object.keys(rateTitles) as RateMetric[]).map(metric => ({ key: metric, title: rateTitles[metric], rows: board[metric].map(pick => ({
      key: String(pick.nhlId), team: pick.team, name: pick.name, meta: meta(pick), weekGames: pick.weekGames,
      detail: `L${TREND_WINDOW_GAMES} ${pick.last5.toFixed(metric === "ixgPer60" ? 2 : 1)} · season ${pick.season.toFixed(metric === "ixgPer60" ? 2 : 1)} · ${Math.round((pick.toiSecondsLast5 ?? 0) / 60)} L${TREND_WINDOW_GAMES} min`,
      value: signed(pick.delta, metric === "ixgPer60" ? 2 : 1), label: rateTitles[metric], tone: "up" as const, badges: [] })) }));
  }
  const { risers, fallers } = ownershipMovers(snapshot, true);
  const row = (mover: (typeof risers)[number]): TrendRowData => ({ key: mover.key, team: mover.team, name: mover.name, meta: `${mover.team ?? "—"} · ${mover.positions}`,
    detail: `${Math.floor(mover.previous)}% → ${Math.floor(mover.latest)}% since ${dateLabel(mover.previousDate)}`, value: signed(mover.delta, 0), label: "ROSTERED %", tone: mover.delta > 0 ? "up" : "down", badges: [] });
  return [{ key: "risers", title: "RISING", rows: risers.map(row) }, { key: "fallers", title: "FALLING", rows: fallers.map(row) }];
}

function trendAltText(kind: TrendKind, snapshot: SocialShareSnapshot, trusted: boolean) {
  const trends = snapshot.trends;
  const head = `FHFH Tuesday trends, ${trendTitles[kind].toLowerCase()}, week of ${yearDateLabel(snapshot.weekStart)}.`;
  const tail = kind === "movers" ? `Yahoo ownership as of ${dayDate(trends?.ownershipAsOf ?? null)}; add and drop counts are not in FHFH's sources.` : `FHFH rolling game metrics, all situations, through ${dayDate(trends?.metricsThrough ?? null)}, updated ${timeLabel(trends?.metricsUpdatedAt ?? null)}. Observed rates, not projections.`;
  if (!trendReady(kind, snapshot, trusted)) return `${head} Unranked preview; ranking unavailable because ${trendUnreadyReason(kind, snapshot, trusted)}. ${tail}`;
  return `${head} ${trendColumns(kind, snapshot).map(column => `${column.title}: ${column.rows.map(row => `${row.name} (${row.meta}${row.weekGames != null ? ` · ${row.weekGames} GP this week` : ""}), ${row.value} ${row.label}, ${row.detail}${row.badges.length ? `, ${row.badges.join(", ")}` : ""}`).join("; ") || "none"}`).join(". ")}. ${tail}`;
}

const trendLegends: Record<TrendKind, string[]> = {
  hot: [`Window: last ${TREND_WINDOW_GAMES} games played vs season to date`, "Points per game", `Skaters with ${MIN_TREND_SEASON_GAMES}+ season games`],
  deployment: [`TOI/GP: last ${TREND_WINDOW_GAMES} vs season`, `Line and PP unit: latest game vs ${TREND_WINDOW_GAMES} games earlier`, "PP share: season → last 5"],
  rates: [`Per-60 rates: last ${TREND_WINDOW_GAMES} vs season`, `Min ${MIN_RATE_TOI_SECONDS_LAST5 / 60} last-${TREND_WINDOW_GAMES} minutes`, "iCF = all individual shot attempts"],
  movers: ["Yahoo rostered %: latest vs on or before 5 days earlier", "Add/drop counts are not in FHFH's sources"],
};

function TrendCard({ kind, snapshot, trusted, logos, brandLogo }: { kind: TrendKind; snapshot: SocialShareSnapshot; trusted: boolean; logos: Record<string, string | null>; brandLogo: string | null }) {
  const ready = trendReady(kind, snapshot, trusted), trends = snapshot.trends;
  const columns = ready ? trendColumns(kind, snapshot) : [];
  return <>
    <CardHeader snapshot={snapshot} brandLogo={brandLogo} eyebrow={ready ? `${editionDay(snapshot)} · ${kind === "movers" ? "Rostered % movers" : "Last 5 games vs season"}` : "Unranked preview"} title={trendTitles[kind]} compact />
    {!ready ? <div className={styles.matchupEmpty}><strong>Ranking unavailable</strong><p>Trend cards need a ready schedule and current {kind === "movers" ? "Yahoo ownership" : "rolling game metrics"}; {trendUnreadyReason(kind, snapshot, trusted)}.</p></div>
      : <div className={styles.trendColumns} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>{columns.map(column => <div key={column.key} className={styles.trendColumn}>
        <h3>{column.title}</h3>
        {column.rows.map(row => {
          const team = snapshot.teams.find(item => item.abbreviation === row.team) ?? { id: 0, abbreviation: row.team ?? "—", name: row.team ?? "Unknown team" };
          return <div key={row.key} data-player={row.key} data-team={row.team ?? ""} className={cx(styles.trendRow, columns.length > 2 && styles.trendRowStacked)}>
            <TeamMark team={team} logo={row.team ? logos[row.team] : null} size={44} />
            <span className={styles.trendWho}><strong>{row.name}</strong><small>{row.meta}{row.weekGames != null && <> · <Count value={row.weekGames} tier={countsFor(snapshot, true).gp(row.weekGames)} /> GP this week</>}</small><small>{row.detail}</small>{row.badges.length > 0 && <span className={styles.trendBadges}>{row.badges.map(badge => <i key={badge}>{badge}</i>)}</span>}</span>
            <span className={cx(styles.trendValue, row.tone === "down" && styles.trendDown)}><strong>{row.value}</strong><small>{row.label}</small></span>
          </div>;
        })}
        {!column.rows.length && <p className={styles.playerShort}>None qualify</p>}
      </div>)}</div>}
    <footer className={styles.gridFooter}>
      <div className={styles.legend}>{trendLegends[kind].map(item => <span key={item}>{item}</span>)}</div>
      <p><span>{kind === "movers" ? `Source: Yahoo ownership timelines · as of ${dayDate(trends?.ownershipAsOf ?? null)} · this card shows rostered-% movers, not adds or drops` : `Source: FHFH rolling game metrics (all situations) through ${dayDate(trends?.metricsThrough ?? null)} · updated ${timeLabel(trends?.metricsUpdatedAt ?? null)} · Observed rates, not projections`}</span><strong className={styles.gridWatermark}>{ready ? (kind === "movers" ? "YAHOO OWNERSHIP" : "LAST 5 VS SEASON") : "PREVIEW ONLY · REFRESH / CHECK SOURCE"}</strong></p>
    </footer>
  </>;
}

export default function SocialShare({ format, asOf }: { format: SocialShareFormat; asOf: string }) {
  const supported = SCHEDULE_FORMATS.includes(format);
  const [weekStart, setWeekStart] = useState(() => calendarWeekStart(asOf));
  const [snapshot, setSnapshot] = useState<SocialShareSnapshot | null>(null);
  const [loading, setLoading] = useState(supported);
  const [error, setError] = useState("");
  const [assetError, setAssetError] = useState("");
  const [assetsReady, setAssetsReady] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [graphic, setGraphic] = useState(() => defaultGraphic(format));
  const [teamLogos, setTeamLogos] = useState<Record<string, string | null>>({});
  const [exporting, setExporting] = useState(false);
  const [expired, setExpired] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [scale, setScale] = useState(0);
  const preview = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const selectedRef = useRef<string[] | undefined>(undefined);
  const requestedLogos = useRef(new Set<string>());
  const focusTeam = /^\d+$/.test(graphic) ? graphic : "";
  const gridCard = graphic === "grid";
  const matchupKind: MatchupKind | null = graphic === "easiest" || graphic === "stream" ? graphic : null;
  const playerCard = parsePlayerCard(graphic);
  const trendKind = (TREND_KINDS as readonly string[]).includes(graphic) ? graphic as TrendKind : null;

  const prepareAssets = useCallback(async () => {
    setAssetsReady(false); setAssetError("");
    try {
      await readyShareFonts();
      const image = new Image(); image.src = "/pictures/logo-fhfh.svg";
      try { await bounded(image.decode(), "Logo unavailable", 5000); setLogo(image.naturalWidth ? image.src : null); }
      catch { setLogo(null); }
      setAssetsReady(true);
    } catch (cause) { setAssetError(cause instanceof Error ? cause.message : "Preview assets unavailable."); }
  }, []);

  const load = useCallback(async (week: string, dates?: string[]) => {
    const id = ++requestId.current;
    setLoading(true); setError(""); setFeedback("");
    const query = new URLSearchParams({ weekStart: week });
    if (dates !== undefined) query.set("selectedDates", dates.join(","));
    try {
      // Shared in-flight request: a strict-mode double mount or repeat click joins the pending call.
      const response = await bounded(fetchEdition(`/api/v1/social-share/${format}?${query}`), "Schedule request timed out. Retry this edition.", 20000);
      const next = response.body as unknown as SocialShareSnapshot & { error?: string };
      if (!response.ok) throw new Error(next.error || "Schedule could not be loaded.");
      if (id !== requestId.current) return;
      setSnapshot(next); selectedRef.current = next.selectedDates; setGraphic(current => /^\d+$/.test(current) ? defaultGraphic(format) : current);
    } catch (cause) { if (id === requestId.current) setError(cause instanceof Error ? cause.message : "Schedule unavailable."); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [format]);

  useEffect(() => {
    const requests = requestId;
    if (supported) { void prepareAssets(); void load(calendarWeekStart(asOf)); }
    return () => { requests.current++; };
  }, [asOf, supported, load, prepareAssets]);
  useEffect(() => {
    if (!snapshot?.expiresAt) { setExpired(true); return; }
    const remaining = Date.parse(snapshot.expiresAt) - Date.now();
    setExpired(remaining <= 0);
    const timer = window.setTimeout(() => setExpired(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [snapshot]);
  useEffect(() => {
    // Missing team logos settle to null and render as abbreviation tiles.
    const missing = snapshot?.teams.map(team => team.abbreviation).filter(abbreviation => !requestedLogos.current.has(abbreviation)) ?? [];
    if (!missing.length) return;
    for (const abbreviation of missing) requestedLogos.current.add(abbreviation);
    void Promise.all(missing.map(async abbreviation => [abbreviation, await teamLogoDataUrl(abbreviation).catch(() => null)] as const))
      .then(entries => setTeamLogos(current => ({ ...current, ...Object.fromEntries(entries) })));
  }, [snapshot]);
  useEffect(() => {
    if (!frame.current) return;
    const observer = new ResizeObserver(entries => setScale(Math.min(1, entries[0].contentRect.width / SHARE_SIZE)));
    observer.observe(frame.current); return () => observer.disconnect();
  }, [supported]);

  function select(dates: string[]) {
    if (!snapshot || snapshot.weekStart !== weekStart) return;
    selectedRef.current = dates; setSnapshot(selectScheduleDates(snapshot, dates)); setFeedback("");
  }
  const snapshotMatchesWeek = snapshot?.weekStart === weekStart;
  const trusted = !!snapshot && snapshotMatchesWeek && snapshot.state === "ready" && snapshot.source.state === "ready" && !expired && !error;
  const displayRows = snapshot ? (trusted ? snapshot.rows : [...snapshot.rows].sort((a, b) => a.team.abbreviation.localeCompare(b.team.abbreviation))) : [];
  const rows = focusTeam ? displayRows.filter(row => String(row.team.id) === focusTeam && row.remainingGames > 0) : displayRows.filter(row => row.remainingGames > 0).slice(0, 3);
  const itinerary = snapshot && focusTeam && rows[0] ? futureItinerary(snapshot, rows[0]) : [];
  const logosReady = !!snapshot && snapshot.teams.every(team => team.abbreviation in teamLogos);
  // Every card shows team logos now (the leaders card gained banners and week rows).
  const squareReady = assetsReady && logosReady;
  const squareAlt = (current: SocialShareSnapshot) => gridCard ? gridAltText(current, trusted) : matchupKind ? matchupAltText(matchupKind, current, trusted) : playerCard ? playerAltText(playerCard, current, trusted) : trendKind ? trendAltText(trendKind, current, trusted) : altText(current, rows, trusted, !!focusTeam);
  const trendHasRows = !trendKind || !snapshot ? true : trendReady(trendKind, snapshot, trusted) && trendColumns(trendKind, snapshot).some(column => column.rows.length > 0);
  const playerHasRows = !playerCard || !snapshot ? true : playerCard.kind === "pickups" ? Object.values(pickupTiers(snapshot, trusted).find(tier => tier.max === playerCard.max)?.groups ?? {}).some(list => list.length > 0) : Object.values(specialists(snapshot, trusted)).some(list => list.length > 0);
  const matchupHasRows = !matchupKind || !snapshot ? true : matchupKind === "easiest" ? easiestSchedules(snapshot, trusted).rows.length > 0 : streamingNights(snapshot, trusted).length > 0;
  const canExport = trusted && squareReady && !loading && !!snapshot?.selectedDates.length && rows.some(row => row.remainingGames > 0) && (!matchupKind || (opponentsReady(snapshot!) && matchupHasRows)) && (!playerCard || (playersReady(snapshot!) && playerHasRows)) && (!trendKind || trendHasRows);
  const changeWeek = (value: string) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const monday = calendarWeekStart(`${value}T16:00:00Z`);
    setWeekStart(monday); selectedRef.current = undefined; void load(monday);
  };

  return <div className={styles.page}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>FHFH / Share studio</p><h1>{labels[format]}</h1></div><span className={styles.scope}>{!supported ? "Source qualification pending" : format === "tuesday-trends" ? "Rolling game metrics · Yahoo ownership · NHL schedule" : "Schedule only · NHL schedule source"}</span></header>
    {!supported ? <section className={styles.panel}><h2>Source qualification required</h2><p>This format is blocked until current-season player data, dated ownership evidence, participation and provider rights qualify. No player rankings are available.</p><a href="/social-share/game-grid">Open the schedule studio</a></section> : <>
      <section className={styles.panel} aria-label="Schedule settings">
        <div className={styles.controls}>
          <label>Week of (Monday)<input type="date" value={weekStart} onChange={event => changeWeek(event.target.value)} disabled={loading || exporting} /></label>
          <button type="button" disabled={loading || exporting} onClick={() => void load(weekStart, selectedRef.current)}>Refresh schedule</button>
          <label>Graphic<select value={graphic} onChange={event => { setGraphic(event.target.value); setFeedback(""); }} disabled={!snapshot || loading || exporting}>
            {format === "tuesday-trends" ? <>
            <option value="hot">Hot &amp; cold (Tuesday default)</option>
            <option value="deployment">Deployment changes (TOI, line, PP)</option>
            <option value="rates">Rate standouts (SOG/60, iCF/60, ixG/60)</option>
            <option value="movers">Ownership movers (rostered %)</option>
            </> : <>
            <option value="grid">{trusted ? `Best schedules grid (${editionDays[format] ?? "weekly"} default)` : "Known schedules grid (unranked)"}</option>
            <option value="easiest">Easiest schedules (opponent defense)</option>
            <option value="stream">Streaming matchups (soft defenses)</option>
            <option value="pickups-50">Pickups · 30–49% rostered</option>
            <option value="pickups-30">Pickups · 20–29% rostered</option>
            <option value="pickups-20">Pickups · under 20% rostered</option>
            <option value="specialists">Specialists · hits, shots, blocks</option>
            <option value="leaders">{trusted ? "Top three schedule leaders" : "Known schedule context (unranked)"}</option>{snapshot?.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </>}
          </select></label>
        </div>
        <fieldset className={styles.days} disabled={!snapshot || !snapshotMatchesWeek || loading || exporting}><legend>Selected days · America/New_York</legend>
          {(snapshot?.days || weekDates(weekStart).map((date, index) => ({ date, label: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index], selected: false, leagueGames: 0, offNight: false }))).map(day => <button type="button" key={day.date} aria-pressed={day.selected} onClick={() => select(snapshot!.selectedDates.includes(day.date) ? snapshot!.selectedDates.filter(date => date !== day.date) : [...snapshot!.selectedDates, day.date])}>
            <strong>{day.label.slice(0, 3)}</strong><span>{dateLabel(day.date)}</span><small>{day.selected ? "ON" : "OFF"}{snapshot ? ` · ${day.leagueGames} games` : ""}</small>
          </button>)}
          <button type="button" onClick={() => select(snapshot!.days.map(day => day.date))}>All days</button><button type="button" onClick={() => select([])}>None</button>
        </fieldset>
        {format === "remaining-week" && <p>Default: Monday, Tuesday and Wednesday OFF; Thursday–Sunday ON. Remaining games use the edition’s frozen time.</p>}
      </section>
      <div className={styles.status} aria-live="polite">
        {loading && <p>Loading a new schedule edition…</p>}
        {error && <p role="alert">{error} <button type="button" disabled={loading || exporting} onClick={() => void load(weekStart, selectedRef.current)}>Retry schedule</button></p>}
        {snapshot && <><p>NHL schedule checked {timeLabel(snapshot.source.fetchedAt)} · Provider update {timeLabel(snapshot.source.updatedAt)} · Remaining after {timeLabel(snapshot.generatedAt)}</p>
          {!snapshotMatchesWeek && <p>Showing the previous week, {yearDateLabel(snapshot.weekStart)} – {yearDateLabel(snapshot.weekEnd)}, as context. Load the requested week to select its days.</p>}
          {snapshot.state !== "ready" && <p>Schedule {snapshot.state}: {[...snapshot.reasons, ...snapshot.source.reasons].join(" ")}</p>}
          {expired && <p>This edition has expired. Refresh the schedule to download.</p>}
          {!snapshot.selectedDates.length ? <p>No days selected. Choose days to compare schedule opportunities.</p> : !snapshot.rows.some(row => row.remainingGames > 0) && <p>No remaining eligible games on the selected dates.</p>}
        </>}
        {assetError && <p role="alert">{assetError} <button type="button" disabled={exporting} onClick={() => void prepareAssets()}>Retry preview preparation</button></p>}
      </div>
      <div className={styles.workspace}>
        <section className={styles.panel} aria-label="Graphic preview">
          <div className={styles.panelHeader}><h2>1080 × 1080 preview</h2><span>{!trusted ? "Unranked context" : gridCard ? "Best schedules grid" : matchupKind === "easiest" ? "Easiest schedules" : matchupKind === "stream" ? "Streaming matchups" : playerCard ? (playerCard.kind === "pickups" ? `Pickups ${bandLabel(playerCard.max).toLowerCase()}` : "Category specialists") : trendKind ? trendTitles[trendKind].toLowerCase() : focusTeam ? "Team focus" : "Schedule leaders"}</span></div>
          <div className={styles.previewFrame} ref={frame} style={{ height: scale * SHARE_SIZE }}>
            {snapshot && squareReady && <div ref={preview} className={cx(styles.square, styles.gridSquare)} style={{ transform: `scale(${scale})` }} data-testid="share-square" role="img" aria-label={squareAlt(snapshot)}>
              {gridCard ? <MondayGrid snapshot={snapshot} trusted={trusted} logos={teamLogos} brandLogo={logo} /> : matchupKind ? <MatchupCard kind={matchupKind} snapshot={snapshot} trusted={trusted} logos={teamLogos} brandLogo={logo} /> : playerCard ? <PlayerCard card={playerCard} snapshot={snapshot} trusted={trusted} logos={teamLogos} brandLogo={logo} /> : trendKind ? <TrendCard kind={trendKind} snapshot={snapshot} trusted={trusted} logos={teamLogos} brandLogo={logo} /> : <>
              <CardHeader snapshot={snapshot} brandLogo={logo} compact eyebrow={trusted ? `${editionDay(snapshot)} · ${focusTeam ? "Team schedule" : "Schedule leaders"}` : "Unranked preview · Ranking unavailable"} title={!trusted ? "KNOWN SCHEDULES" : focusTeam ? "YOUR TEAM’S WEEK" : "TOP 3 SCHEDULES"} />
              <div className={styles.leaders}>{rows.length ? rows.map(row => {
                const week = mondayGridRows(snapshot, trusted).find(item => item.team.id === row.team.id)!;
                return <div key={row.team.id} data-team={row.team.abbreviation} className={styles.leader}>
                  <TeamBanner team={row.team} logo={teamLogos[row.team.abbreviation]} title={row.team.name} subtitle={`${trusted ? `#${row.rank} / ` : "UNRANKED / "}${row.team.abbreviation}`}
                    right={<span className={styles.playerOwn}><strong>{trusted ? scoreLabel(row) : "—"}</strong><small>{trusted ? "SCHEDULE SCORE" : "SCORE UNAVAILABLE"}</small></span>} />
                  <div className={styles.leaderWeek}>{week.cells.map(cell => {
                    const game = cell.games[0], day = snapshot.days.find(item => item.date === cell.date)!;
                    return <span key={cell.date} data-date={cell.date} className={cx(styles.leaderDay, cell.offNight && styles.offNightColumn, !cell.selected && styles.dimmed)}>
                      <small>{titleDay(day.label)}</small>
                      <span className={cx(styles.cell, game && (game.home ? styles.homeCell : styles.awayCell), game && !game.counted && styles.dimmed)}>{game && <><TeamMark team={game.opponent} logo={teamLogos[game.opponent.abbreviation]} size={40} />{!game.home && <i className={styles.awayMark}>@</i>}</>}</span>
                    </span>;
                  })}</div>
                  <p className={styles.leaderMeta}><Count value={row.remainingGames} tier={countsFor(snapshot, trusted).gp(row.remainingGames)} /> {trusted ? "GAMES LEFT" : "KNOWN LEFT"} · <Count value={row.offNightGames} tier={countsFor(snapshot, trusted).off(row.offNightGames)} /> {trusted ? "OFF-NIGHTS" : "KNOWN OFF-NIGHTS"} · {trusted ? `#${row.rank} by Week Score` : "unranked"}</p>
                </div>;
              }) : <p className={styles.noGames}>{snapshot.selectedDates.length ? "No remaining games" : "No days selected"}</p>}
              {!!itinerary.length && <div className={styles.itinerary}><h3>SELECTED FUTURE GAMES</h3><div className={styles.itineraryGames}>{itinerary.slice(0, 8).map(game => {
                const home = game.homeTeam.id === rows[0].team.id;
                const day = snapshot.days.find(item => item.date === game.date)!;
                return <div key={game.id}><strong>{dateLabel(game.date)} · {home ? "HOME vs" : "AWAY @"} {home ? game.awayTeam.abbreviation : game.homeTeam.abbreviation}</strong><span>{day.offNight ? "Off-night" : "Busy night"} · {day.leagueGames} NHL games</span></div>;
              })}</div>{itinerary.length > 8 && <p>+{itinerary.length - 8} more selected games · Full itinerary on this page</p>}</div>}
              </div>
              <footer className={styles.gridFooter}>
                <div className={styles.legend}><span><i className={styles.legendAway}>@</i>Away</span><span><i className={styles.legendHome} />Home</span><span><i className={styles.legendOffColumn} />Off-night (≤8 games)</span>{trusted && <CountLegend />}<span><b>SELECTED</b> {coveredDays(snapshot)}</span></div>
                <p><span>Remaining after {timeLabel(snapshot.generatedAt)} · NHL schedule checked {timeLabel(snapshot.source.fetchedAt)} · Score uses games, off-nights and slate density. No odds or player projections.</span><strong className={styles.gridWatermark}>{!trusted ? "PREVIEW ONLY · REFRESH / CHECK SOURCE" : "SCHEDULE ONLY"}</strong></p>
              </footer>
              </>}
            </div>}
            {!assetsReady ? <p>Preparing local fonts and branding…</p> : !squareReady && snapshot && <p>Preparing team logos…</p>}
          </div>
          <div className={styles.actions}><button type="button" disabled={!canExport || exporting} onClick={async () => {
            if (!preview.current || !snapshot) return; setExporting(true); setFeedback("");
            try { await downloadSharePng(preview.current, snapshot, matchupKind ? { opponents: true, card: matchupKind } : playerCard ? { players: true, card: graphic } : trendKind ? { [trendKind === "movers" ? "movers" : "trends"]: true, card: trendKind } : {}); setFeedback("PNG downloaded: 1080 × 1080."); }
            catch (cause) { setFeedback(cause instanceof Error ? cause.message : "Download failed. Retry the same edition."); }
            finally { setExporting(false); }
          }}>{exporting ? "Creating PNG…" : "Download PNG"}</button>
          <button type="button" disabled={!snapshot || exporting} onClick={async () => {
            try { await navigator.clipboard.writeText(squareAlt(snapshot!)); setFeedback("Alt text copied."); }
            catch { setFeedback("Alt text could not be copied. Select and copy the text below."); }
          }}>Copy alt text</button></div><p role="status">{feedback}</p>
          {snapshot && <details><summary>Suggested alt text</summary><p>{squareAlt(snapshot)}</p></details>}
        </section>
        <section className={styles.panel} aria-label="Complete ranked schedule"><div className={styles.panelHeader}><h2>All teams</h2><span>{snapshot?.rows.length || 0} teams</span></div>
          <p className={styles.explanation}>Schedule Score compares remaining selected games, off-night games and full-slate density. Odds and player projections are excluded. Zero-game teams have no score to publish. Matchups below include context; elapsed, live, postponed and nonregular games do not count as opportunities.</p>
          <ol className={styles.teamList}>{displayRows.map(row => <li key={row.team.id}><div><strong>{trusted ? `#${row.rank} ` : ""}{row.team.name}</strong><span>{row.remainingGames} {trusted ? "left" : "known left"} · {row.offNightGames} {trusted ? "off-night" : "known off-night"} · {trusted ? `Score ${scoreLabel(row)}` : "Unranked; score unavailable"}</span></div><p>{row.games.filter(game => snapshot!.selectedDates.includes(game.date)).map(game => `${dateLabel(game.date)} ${game.homeTeam.id === row.team.id ? "vs" : "@"} ${game.homeTeam.id === row.team.id ? game.awayTeam.abbreviation : game.homeTeam.abbreviation} (${game.status}${game.gameType !== 2 ? ", nonregular" : ""}; ${timeLabel(game.startTimeUtc)})`).join(" · ") || "No games on selected dates"}</p></li>)}</ol>
        </section>
      </div>
    </>}
  </div>;
}

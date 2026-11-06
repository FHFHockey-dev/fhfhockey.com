/* eslint-disable @next/next/no-img-element -- Logos are the shell's prepared data URLs. */
import type { SharePostPanelProps } from "lib/socialShare/modules/contract";
import { ownershipLabel } from "lib/socialShare/modules/shared/definitions";
import { focusOf, teamStreamPicks, teamStreamSelected, type TeamStreamData, type TeamStreamSettings } from "lib/socialShare/modules/teamStream";
import styles from "./TeamStreamCard.module.scss";

type PanelProps = SharePostPanelProps<TeamStreamSettings, TeamStreamData>;

/** The top Week Score teams, each with its streamer preview. A click sets the browser-only `team` field, so nothing reloads. */
export default function TeamStreamPanel({ data, settings, logos, change, disabled }: PanelProps) {
  const selected = teamStreamSelected(data, settings), focus = focusOf(settings.focus);
  const flagged = selected ? teamStreamPicks(selected.candidates, settings.focus).filter(candidate => candidate.yahooStatus) : [];
  return <div className={styles.panel} data-testid="team-stream-panel">
    <p className={styles.panelHead}><b>Top {data.teams.length} by Week Score</b>{data.window.label} · {focus.short}</p>
    <div className={styles.panelList}>
      {data.teams.map(team => {
        const picks = teamStreamPicks(team.candidates, settings.focus), pressed = team.team === selected?.team;
        return <button key={team.team} type="button" className={styles.option} aria-pressed={pressed} disabled={disabled} data-testid="team-stream-team" data-team={team.team}
          aria-label={`${team.teamName}, rank ${team.rank}, Week Score ${team.score.toFixed(1)}`} onClick={() => change("team", team.team)}>
          <span className={styles.optionHead}>
            <b>{team.rank}</b>
            {logos[team.team] ? <img src={logos[team.team]!} alt="" /> : <i>{team.team}</i>}
            <strong>{team.team}</strong>
            <span>{team.score.toFixed(1)}<small>{team.games} GP · {team.offNightGames} off</small></span>
          </span>
          {picks.length ? <ol className={styles.optionPicks}>{picks.map(candidate => <li key={candidate.nhlId}><span>{candidate.name}</span><small>{candidate.group} · {ownershipLabel(candidate.ownership)}</small></li>)}</ol>
            : <p className={styles.panelNote}>No streamer qualifies</p>}
        </button>;
      })}
    </div>
    {data.tiedOut.length > 0 && <p className={styles.panelNote}>Also tied at rank {data.teams[data.teams.length - 1]?.rank}: {data.tiedOut.join(", ")}.</p>}
    {flagged.map(candidate => <p key={candidate.nhlId} className={styles.panelWarn} data-testid="team-stream-flagged">{candidate.name} is marked {candidate.yahooStatus} by Yahoo but played one of {selected!.team}&apos;s last games. Check he is healthy before posting.</p>)}
  </div>;
}

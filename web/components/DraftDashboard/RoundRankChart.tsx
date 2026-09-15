import { useEffect, useRef, useState } from "react";
import type { RoundRankSnapshot } from "lib/draftDashboard/roundRankHistory";
import styles from "./RoundRankChart.module.scss";

interface Props {
  history: RoundRankSnapshot[];
  teams: { teamId: string; teamName: string }[];
  myTeamId?: string;
  players: ReadonlyMap<string, { fullName: string; displayPosition?: string | null }>;
}

export default function RoundRankChart({ history, teams, myTeamId, players }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endHover = () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); setHovered(null); };
  const startHover = (id: string) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(id), 1000);
  };
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);
  const active = hovered || (teams.some((team) => team.teamId === selected) ? selected : myTeamId || teams[0]?.teamId);
  const x = (round: number) => 50 + round / Math.max(1, history.length - 1) * 690;
  const y = (rank: number) => 24 + (rank - 1) / Math.max(1, teams.length - 1) * 236;
  return <section className={styles.chart} aria-label="Round-by-round rank history">
    <h3>Round-by-round rank</h3>
    <p>Completed rounds only · lower rank is better · ties share a rank. Hover a team for one second to highlight; select its name to keep it highlighted.</p>
    {history.length < 2 ? <p>Rank history appears after the first complete round.</p> : <>
      <svg viewBox="0 0 780 300" role="img" aria-label="Team ranks at the end of each completed round">
        <line className={styles.midline} x1="50" x2="740" y1={y((teams.length + 1) / 2)} y2={y((teams.length + 1) / 2)} />
        <text x="744" y={y((teams.length + 1) / 2)} className={styles.axis}>Mid</text>
        {Array.from({ length: teams.length }, (_, index) => <text key={index} x="30" y={y(index + 1) + 4} className={styles.axis}>{index + 1}</text>)}
        {history.map((snapshot) => <text key={snapshot.round} x={x(snapshot.round)} y="286" textAnchor="middle" className={styles.axis}>{snapshot.round === 0 ? "Start" : `R${snapshot.round}`}</text>)}
        {[...teams].sort((a, b) => Number(a.teamId === active) - Number(b.teamId === active)).map((team) => <g key={team.teamId}
          className={styles.teamLine} data-active={team.teamId === active} onMouseEnter={() => startHover(team.teamId)} onMouseLeave={endHover}>
          {history.slice(1).map((snapshot, index) => {
            const before = history[index].ranks[team.teamId], after = snapshot.ranks[team.teamId];
            if (before == null || after == null) return null;
            return <line key={snapshot.round} x1={x(index)} x2={x(snapshot.round)} y1={y(before)} y2={y(after)}
              className={after < before ? styles.up : after > before ? styles.down : styles.level} />;
          })}
          {history.map((snapshot) => {
            const rank = snapshot.ranks[team.teamId];
            if (rank == null) return null;
            const descriptions = snapshot.picks.filter((pick) => pick.teamId === team.teamId).map((pick) => {
              const player = players.get(pick.playerId);
              return `${player?.fullName || pick.yahooDisplayName || pick.playerId} · ${player?.displayPosition || "Position unavailable"} · Round ${pick.round}, pick ${pick.pickInRound}, overall #${pick.pickNumber}`;
            });
            const label = `${team.teamName} · ${snapshot.round ? `Round ${snapshot.round}` : "Before draft"} · Rank ${rank}\n${descriptions.join("\n") || "No selections in this round"}`;
            return <circle key={snapshot.round} cx={x(snapshot.round)} cy={y(rank)} r="4" tabIndex={0} aria-label={label} onFocus={() => startHover(team.teamId)} onBlur={endHover}><title>{label}</title></circle>;
          })}
        </g>)}
      </svg>
      {history.some((snapshot) => Object.values(snapshot.ranks).some((rank) => rank == null)) && <p>Some rounds are unavailable because a drafted player is missing projection data.</p>}
    </>}
    <div className={styles.legend} aria-label="Select highlighted team">{teams.map((team) => <button key={team.teamId} type="button" aria-pressed={active === team.teamId}
      onMouseEnter={() => startHover(team.teamId)} onMouseLeave={endHover} onFocus={() => startHover(team.teamId)} onBlur={endHover}
      onClick={() => { endHover(); setSelected(team.teamId); }}>{team.teamName}{team.teamId === myTeamId ? " (You)" : ""}</button>)}</div>
  </section>;
}

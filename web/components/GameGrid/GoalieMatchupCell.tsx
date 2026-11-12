import React, { useLayoutEffect, useRef, useState } from "react";
import type { GameData } from "lib/NHL/types";
import { useGoaliePresentation, useTeam } from "./contexts/GameGridContext";
import { formatGoaliePercent, GOALIE_WIN_DEFINITION, resolveGoalieCell } from "./utils/goalieGameView";
import Tooltip from "./PDHC/Tooltip";
import GoalieMatchupDetails from "./GoalieMatchupDetails";
import styles from "./GameGrid.module.scss";

export default function GoalieMatchupCell({ game, teamId, excluded, fallback }: { game?: GameData; teamId: number; excluded?: boolean; fallback: React.ReactNode }) {
  const presentation = useGoaliePresentation();
  const ref = useRef<HTMLSpanElement>(null);
  const [fits, setFits] = useState(false);
  const home = game?.homeTeam.id === teamId;
  const team = useTeam(teamId);
  const opponent = useTeam((home ? game?.awayTeam.id : game?.homeTeam.id) ?? -1);
  const view = game ? resolveGoalieCell(game, teamId, presentation.snapshot, presentation.contextKey, presentation.asOf) : null;
  const surname = view?.candidate?.surname ?? "—";
  const identityLabel = view?.candidate?.name ?? (view?.phase === "final" ? "Final game" : view?.phase === "in_progress" ? "Pregame window ended" : presentation.status === "loading" ? "Loading goalie" : "Goalie unavailable");
  useLayoutEffect(() => {
    const cell = ref.current?.closest("td");
    if (!cell || !presentation.enabled) { setFits(false); return; }
    const measure = () => {
      const box = cell.getBoundingClientRect();
      setFits(box.width >= 79.9 && box.height >= 48.9);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(cell);
    window.addEventListener("resize", measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [presentation.enabled, surname]);
  const enabled = presentation.enabled && fits && !!game && !!view && !!team && !!opponent;
  return <span ref={ref} className={styles.goalieCellHost}>
    {enabled ? <Tooltip portal key={`${game.id}/${teamId}/${presentation.contextKey}`} dialogLabel="Goalie matchup details"
      label={`${identityLabel}, ${view.candidate?.status ?? view.phase}. ${team.name} ${home ? "vs" : "at"} ${opponent.name}. Win if starting ${view.win.value == null ? "unavailable" : formatGoaliePercent(view.win.value)}. Start ${view.start.value == null ? "unavailable" : formatGoaliePercent(view.start.value)}.${excluded ? " Excluded from schedule totals." : ""} Open goalie details.`}
      content={<GoalieMatchupDetails view={view} game={game} teamName={team.name} opponentName={opponent.name} home={home} />}>
      <div className={styles.goalieCell} data-goalie-cell data-goalie-id={view.candidate?.playerId ?? ""}>
        <div className={styles.goalieCellTop} aria-hidden="true">
          <span className={styles.goalieCellProbability} title={GOALIE_WIN_DEFINITION}>
            <span>Win </span><span>{formatGoaliePercent(view.win.value)}</span>
          </span>
          <span className={styles.goalieOpponentLogo}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={opponent.logo} alt="" width={16} height={16} className={excluded ? styles.excludedGrayscale : undefined} />
          </span>
          <span className={styles.goalieCellProbability}>
            <span>Start </span><span>{formatGoaliePercent(view.start.value)}</span>
          </span>
        </div>
        <span className={`${styles.goalieSurname} ${view.candidate?.status === "confirmed" ? styles.goalieConfirmed : view.candidate?.status === "projected" ? styles.goalieProjected : ""}`} title={view.candidate?.name} aria-hidden="true">{surname}</span>
      </div>
    </Tooltip> : fallback}
  </span>;
}

import Link from "next/link";
import { useMemo } from "react";

import {
  MetricPill,
  ModuleState,
  StatusChip
} from "components/forge-command-center/CommandCenterShell";
import type { CommandCenterData } from "lib/dashboard/commandCenterData";
import { getGamePowerEdge, computeTeamPowerScore } from "lib/dashboard/teamContext";
import { getTeamMetaById } from "lib/dashboard/teamMetadata";
import styles from "styles/ForgeCommandCenter.module.scss";

type FocusedSlateContextProps = {
  module: CommandCenterData["modules"]["focusedSlate"];
  selectedTeam: string;
  startChartHref: string;
};

const formatMetric = (value: number | null | undefined, digits = 1) =>
  value == null || Number.isNaN(value) ? "--" : value.toFixed(digits);

const formatSigned = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "--";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
};

const formatPct = (value: number | null | undefined) =>
  value == null || Number.isNaN(value) ? "--" : `${Math.round(value * 100)}%`;

export default function FocusedSlateContext({
  module,
  selectedTeam,
  startChartHref
}: FocusedSlateContextProps) {
  const games = module.data.games;
  const focusedGame = useMemo(() => {
    const filtered =
      selectedTeam === "all"
        ? games
        : games.filter((game) => {
            const home = getTeamMetaById(game.homeTeamId)?.abbr;
            const away = getTeamMetaById(game.awayTeamId)?.abbr;
            return home === selectedTeam || away === selectedTeam;
          });

    return [...filtered].sort((a, b) => {
      const aEnvironment =
        (a.homeRating ? computeTeamPowerScore(a.homeRating) : 0) +
        (a.awayRating ? computeTeamPowerScore(a.awayRating) : 0);
      const bEnvironment =
        (b.homeRating ? computeTeamPowerScore(b.homeRating) : 0) +
        (b.awayRating ? computeTeamPowerScore(b.awayRating) : 0);
      return bEnvironment - aEnvironment;
    })[0] ?? null;
  }, [games, selectedTeam]);

  const home = focusedGame ? getTeamMetaById(focusedGame.homeTeamId) : null;
  const away = focusedGame ? getTeamMetaById(focusedGame.awayTeamId) : null;
  const powerEdge = focusedGame ? getGamePowerEdge(focusedGame) : null;
  const environment =
    focusedGame?.homeRating && focusedGame.awayRating
      ? (computeTeamPowerScore(focusedGame.homeRating) +
          computeTeamPowerScore(focusedGame.awayRating)) /
        2
      : null;
  const pace =
    focusedGame?.homeRating && focusedGame.awayRating
      ? ((focusedGame.homeRating.paceRating ?? 0) +
          (focusedGame.awayRating.paceRating ?? 0)) /
        2
      : null;
  const allGoalies = [
    ...(focusedGame?.awayGoalies ?? []).map((goalie) => ({
      ...goalie,
      teamAbbr: away?.abbr ?? null
    })),
    ...(focusedGame?.homeGoalies ?? []).map((goalie) => ({
      ...goalie,
      teamAbbr: home?.abbr ?? null
    }))
  ].sort((a, b) => (b.start_probability ?? 0) - (a.start_probability ?? 0));
  const primaryGoalie = allGoalies[0] ?? null;

  return (
    <ModuleState module={module}>
      {focusedGame && home && away ? (
        <div className={styles.slateContext}>
          <Link href={startChartHref} className={styles.focusMatchup}>
            <div className={styles.matchupTeam}>
              <img src={away.logo} alt="" />
              <strong>{away.abbr}</strong>
              <span>{formatMetric(focusedGame.awayRating?.offRating, 0)} off</span>
            </div>
            <div className={styles.matchupEdge}>
              <span>Power Edge</span>
              <strong>{formatSigned(powerEdge)}</strong>
              <small>{powerEdge != null && powerEdge >= 0 ? home.abbr : away.abbr}</small>
            </div>
            <div className={styles.matchupTeam}>
              <img src={home.logo} alt="" />
              <strong>{home.abbr}</strong>
              <span>{formatMetric(focusedGame.homeRating?.offRating, 0)} off</span>
            </div>
          </Link>

          <div className={styles.metricStrip}>
            <MetricPill label="Pace" value={formatMetric(pace, 0)} tone="good" />
            <MetricPill label="Env" value={formatMetric(environment, 1)} tone="good" />
            <MetricPill label="Goalie" value={primaryGoalie ? formatPct(primaryGoalie.start_probability) : "--"} tone="warn" />
            <MetricPill label="Stream" value={environment != null && environment >= 70 ? "A" : "B"} />
          </div>

          <div className={styles.environmentMatrix} aria-label="Fantasy environment matrix">
            {games.slice(0, 8).map((game) => {
              const gameHome = getTeamMetaById(game.homeTeamId);
              const gameAway = getTeamMetaById(game.awayTeamId);
              const gameEnvironment =
                game.homeRating && game.awayRating
                  ? (computeTeamPowerScore(game.homeRating) +
                      computeTeamPowerScore(game.awayRating)) /
                    2
                  : null;
              return (
                <Link
                  key={game.id}
                  href={startChartHref}
                  className={styles.environmentCell}
                >
                  <span>
                    {gameAway?.abbr ?? "--"}-{gameHome?.abbr ?? "--"}
                  </span>
                  <strong>{formatMetric(gameEnvironment, 0)}</strong>
                  <StatusChip tone={gameEnvironment != null && gameEnvironment >= 70 ? "good" : "warn"}>
                    {gameEnvironment != null && gameEnvironment >= 70 ? "A" : "B"}
                  </StatusChip>
                </Link>
              );
            })}
          </div>

          <div className={styles.goalieCallStrip}>
            {allGoalies.slice(0, 3).map((goalie) => (
              <div key={goalie.player_id}>
                <span>{goalie.teamAbbr ?? "--"}</span>
                <strong>{goalie.name}</strong>
                <small>
                  {goalie.confirmed_status ? "Confirmed" : "Projected"} {formatPct(goalie.start_probability)}
                </small>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </ModuleState>
  );
}

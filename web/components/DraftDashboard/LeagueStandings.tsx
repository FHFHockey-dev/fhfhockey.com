import { useMemo, useState } from "react";
import type { TeamDraftStats } from "./DraftDashboard";
import type { PlayerVorpMetrics } from "hooks/useVORPCalculations";
import { STATS_MASTER_LIST } from "lib/projectionsConfig/statsMasterList";
import {
  categoryRankBand,
  rankTeamCategories,
} from "lib/draftDashboard/categoryStandings";
import styles from "./LeagueStandings.module.scss";

interface LeagueStandingsProps {
  teams: TeamDraftStats[];
  categories: Record<string, number>;
  leagueType: "points" | "categories";
  myTeamId: string;
  vorpMetrics: Map<string, PlayerVorpMetrics>;
  onUpdateTeamName: (teamId: string, name: string) => void;
  canEdit: boolean;
  isLoading: boolean;
  error: string | null;
}

export default function LeagueStandings({
  teams,
  categories,
  leagueType,
  myTeamId,
  vorpMetrics,
  onUpdateTeamName,
  canEdit,
  isLoading,
  error,
}: LeagueStandingsProps) {
  const [sort, setSort] = useState({ key: "value", ascending: false });
  const [editing, setEditing] = useState<string | null>(null);
  const ranks = useMemo(
    () => rankTeamCategories(teams, categories, leagueType),
    [teams, categories, leagueType],
  );
  const values = useMemo(
    () =>
      Object.fromEntries(
        teams.map((team) => {
          if (leagueType === "points")
            return [team.teamId, team.projectedPoints];
          const scores = [
            ...Object.values(team.rosterSlots).flat(),
            ...team.bench,
          ]
            .map((player) => vorpMetrics.get(player.playerId)?.value)
            .filter(
              (value): value is number =>
                typeof value === "number" && Number.isFinite(value),
            );
          return [
            team.teamId,
            scores.length
              ? scores.reduce((sum, score) => sum + score, 0) / scores.length
              : 0,
          ];
        }),
      ),
    [teams, leagueType, vorpMetrics],
  );
  const standingOrder = [...teams].sort(
    (a, b) => values[b.teamId] - values[a.teamId],
  );
  const sorted = [...teams].sort((a, b) => {
    const value = (team: TeamDraftStats) =>
      sort.key === "value"
        ? values[team.teamId]
        : sort.key === "vorp"
          ? (team.teamVorp ?? 0)
          : (team.categoryTotals[sort.key] ?? 0);
    return (sort.ascending ? 1 : -1) * (value(a) - value(b));
  });
  const changeSort = (key: string) =>
    setSort((current) => ({
      key,
      ascending: current.key === key ? !current.ascending : false,
    }));
  return (
    <section className={styles.standings} aria-label="League Standings">
      <header>
        <h2>League Standings</h2>
        <label>
          View{" "}
          <select
            aria-label="Standings summary"
            value={sort.key === "vorp" ? "vorp" : "value"}
            onChange={(event) => changeSort(event.target.value)}
          >
            <option value="value">
              {leagueType === "categories" ? "Score" : "Projected points"}
            </option>
            <option value="vorp">Team VORP</option>
          </select>
        </label>
      </header>
      <div className={styles.tableViewport}>
        <table aria-label="League scoring category standings">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Team</th>
              {Object.keys(categories).map((key) => (
                <th
                  scope="col"
                  key={key}
                  aria-sort={
                    sort.key === key
                      ? sort.ascending
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    title={key}
                    onClick={() => changeSort(key)}
                  >
                    {STATS_MASTER_LIST.find((stat) => stat.key === key)
                      ?.displayName || key}
                  </button>
                </th>
              ))}
              <th
                scope="col"
                aria-sort={
                  sort.key === "vorp"
                    ? sort.ascending
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button type="button" onClick={() => changeSort("vorp")}>
                  VORP
                </button>
              </th>
              <th
                scope="col"
                aria-sort={
                  sort.key === "value"
                    ? sort.ascending
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button type="button" onClick={() => changeSort("value")}>
                  {leagueType === "categories" ? "Score" : "Proj FP"}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((team) => (
              <tr key={team.teamId} data-my-team={team.teamId === myTeamId}>
                <td>
                  {standingOrder.findIndex(
                    (item) => item.teamId === team.teamId,
                  ) + 1}
                </td>
                <th scope="row">
                  {editing === team.teamId ? (
                    <input
                      autoFocus
                      aria-label="Team name"
                      defaultValue={team.teamName}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") setEditing(null);
                      }}
                      onBlur={(event) => {
                        const name = event.currentTarget.value.trim();
                        if (name) onUpdateTeamName(team.teamId, name);
                        setEditing(null);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setEditing(team.teamId)}
                      title={`${team.teamName}${team.teamId === myTeamId ? " (You)" : ""}`}
                    >
                      {team.teamName}
                      {team.teamId === myTeamId ? " (You)" : ""}
                    </button>
                  )}
                </th>
                {Object.keys(categories).map((key) => {
                  const rank = ranks[team.teamId][key];
                  const definition = STATS_MASTER_LIST.find(
                    (stat) => stat.key === key,
                  );
                  return (
                    <td
                      key={key}
                      data-category={key}
                      data-rank={rank}
                      data-band={categoryRankBand(rank, teams.length)}
                      title={`${definition?.displayName || key}: rank ${rank} of ${teams.length}`}
                    >
                      {(team.categoryTotals[key] ?? 0).toFixed(
                        definition?.decimalPlaces ?? 0,
                      )}
                    </td>
                  );
                })}
                <td>{(team.teamVorp ?? 0).toFixed(1)}</td>
                <td>{values[team.teamId].toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer>
        {isLoading
          ? "Updating projections…"
          : error
            ? "Projection data unavailable"
            : `${teams.length} teams · ${Object.keys(categories).length} scoring categories`}
        <span title="Category ranks: best to worst">
          {" "}
          <i data-band="green" /> Best <i data-band="yellow" />{" "}
          <i data-band="orange" /> <i data-band="red" /> Lowest
        </span>
      </footer>
    </section>
  );
}

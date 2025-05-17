import PlayerSearchBar from "components/StatsPage/PlayerSearchBar";
import { GetServerSidePropsContext } from "next";
import supabase from "lib/supabase";
import React from "react";
import styles from "styles/PlayerStats.module.scss";
import { getCurrentSeason } from "lib/NHL/server";
import {
  formatPercent,
  formatTOI,
  formatSeason,
  formatDate
} from "../../../utils/stats/formatters";
import { fetchAllGameLogRows } from "../../../utils/stats/nhlStatsFetch";
import Image from "next/image";

interface PlayerDetailsProps {
  player: {
    id: number;
    fullName: string;
    image_url: string | null;
    team_id: number | null;
    sweater_number: number | null;
    position: string;
    birthDate: string;
    birthCity: string | null;
    birthCountry: string | null;
    heightInCentimeters: number;
    weightInKilograms: number;
  } | null;
  seasonStats?: any[];
  isGoalie?: boolean;
  gameLog?: any[];
  mostRecentSeason?: string | number | null;
  usedGameLogFallback?: boolean;
}

function splitLabel(label: string) {
  const words = label.trim().split(" ");
  if (words.length === 1) return label;
  return (
    <>
      {words[0]}{" "}
      <span className={styles.spanColorBlue}>{words.slice(1).join(" ")}</span>
    </>
  );
}

export default function PlayerStatsPage({
  player,
  seasonStats = [],
  isGoalie = false,
  gameLog = [],
  mostRecentSeason,
  usedGameLogFallback = false,
  availableSeasons = []
}: PlayerDetailsProps & {
  availableSeasons?: (string | number)[];
}) {
  return (
    <div className={styles.playerStatsPageContainer}>
      <div className={styles.playerStatsSearchBar}>
        <PlayerSearchBar />
      </div>
      {player ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "2rem",
              marginBottom: "2rem"
            }}
          >
            {player.image_url && (
              <img
                src={player.image_url}
                alt={player.fullName}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  objectFit: "cover",
                  background: "#222"
                }}
              />
            )}
            <div>
              <h2 className={styles.playerName}>
                {splitLabel(player.fullName)}
              </h2>
              <div style={{ color: "#888", fontWeight: 600, marginBottom: 8 }}>
                #{player.sweater_number || "-"} | {player.position} | Team ID:{" "}
                {player.team_id ?? "-"}
              </div>
              <div style={{ fontSize: 15 }}>
                <span>Born: {player.birthDate}</span>
                {player.birthCity && ` | ${player.birthCity}`}
                {player.birthCountry && `, ${player.birthCountry}`}
                <br />
                <span>Height: {player.heightInCentimeters} cm</span> |{" "}
                <span>Weight: {player.weightInKilograms} kg</span>
              </div>
            </div>
          </div>

          <h3 className={styles.tableLabel}>
            {splitLabel(isGoalie ? "Goalie Season Stats" : "Season Stats")}
          </h3>
          <div className={styles.playerStatsTableContainer}>
            <table className={styles.playerStatsTable}>
              <thead>
                <tr>
                  <th>Season</th>
                  <th>GP</th>
                  <th>G</th>
                  <th>A</th>
                  <th>P</th>
                  <th>+/-</th>
                  <th>SOG</th>
                  <th>SH%</th>
                  <th>PP Pts</th>
                  <th>GWG</th>
                  <th>FO%</th>
                  <th>TOI/GP</th>
                  <th>Blocks</th>
                  <th>Hits</th>
                  <th>Takeaways</th>
                  <th>Giveaways</th>
                  <th>Corsi%</th>
                  <th>Zone Start%</th>
                </tr>
              </thead>
              <tbody>
                {seasonStats.map((row: any, idx: number) => (
                  <tr key={idx}>
                    <td>{formatSeason(row.season)}</td>
                    <td>{row.games_played ?? "-"}</td>
                    <td>{row.goals ?? "-"}</td>
                    <td>{row.assists ?? "-"}</td>
                    <td>{row.points ?? "-"}</td>
                    <td>{row.plus_minus ?? "-"}</td>
                    <td>{row.shots ?? "-"}</td>
                    <td>{formatPercent(row.shooting_percentage)}</td>
                    <td>{row.pp_points ?? "-"}</td>
                    <td>{row.gw_goals ?? "-"}</td>
                    <td>{formatPercent(row.fow_percentage)}</td>
                    <td>{formatTOI(row.toi_per_game)}</td>
                    <td>{row.blocked_shots ?? "-"}</td>
                    <td>{row.hits ?? "-"}</td>
                    <td>{row.takeaways ?? "-"}</td>
                    <td>{row.giveaways ?? "-"}</td>
                    <td>{formatPercent(row.sat_pct)}</td>
                    <td>{formatPercent(row.zone_start_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              margin: "1rem 0"
            }}
          >
            <label htmlFor="season-select" style={{ fontWeight: 600 }}>
              Season:
            </label>
            <select
              id="season-select"
              value={mostRecentSeason ?? ""}
              onChange={(e) => {
                const params = new URLSearchParams(window.location.search);
                params.set("season", e.target.value);
                window.location.search = params.toString();
              }}
            >
              {availableSeasons.map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              ))}
            </select>
          </div>

          <h3 className={styles.tableLabel}>
            {splitLabel("Game Log")}{" "}
            {mostRecentSeason ? (
              <span style={{ fontWeight: 400, fontSize: "1rem" }}>
                ({mostRecentSeason})
              </span>
            ) : (
              ""
            )}
          </h3>
          {usedGameLogFallback && (
            <div style={{ color: "#e6b800", marginBottom: 8 }}>
              No games found for this season. Showing most recent 10 games for
              this player instead.
            </div>
          )}

          <div className={styles.playerStatsTableContainer}>
            <table className={styles.playerStatsTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>GP</th>
                  <th>G</th>
                  <th>A</th>
                  <th>P</th>
                  <th>+/-</th>
                  <th>SOG</th>
                  <th>SH%</th>
                  <th>PP Pts</th>
                  <th>GWG</th>
                  <th>FO%</th>
                  <th>TOI</th>
                  <th>Blocks</th>
                  <th>Hits</th>
                  <th>Takeaways</th>
                  <th>Giveaways</th>
                  <th>Corsi%</th>
                  <th>Zone Start%</th>
                </tr>
              </thead>
              <tbody>
                {gameLog.length === 0 ? (
                  <tr>
                    <td colSpan={18}>No games found for this season.</td>
                  </tr>
                ) : (
                  gameLog.map((row, idx) => (
                    <tr key={idx}>
                      <td>{formatDate(row.date)}</td>
                      <td>{row.games_played ?? "-"}</td>
                      <td>{row.goals ?? "-"}</td>
                      <td>{row.assists ?? "-"}</td>
                      <td>{row.points ?? "-"}</td>
                      <td>{row.plus_minus ?? "-"}</td>
                      <td>{row.shots ?? "-"}</td>
                      <td>{formatPercent(row.shooting_percentage)}</td>
                      <td>{row.pp_points ?? "-"}</td>
                      <td>{row.gw_goals ?? "-"}</td>
                      <td>{formatPercent(row.fow_percentage)}</td>
                      <td>{formatTOI(row.toi_per_game)}</td>
                      <td>{row.blocked_shots ?? "-"}</td>
                      <td>{row.hits ?? "-"}</td>
                      <td>{row.takeaways ?? "-"}</td>
                      <td>{row.giveaways ?? "-"}</td>
                      <td>{formatPercent(row.sat_pct)}</td>
                      <td>{formatPercent(row.zone_start_pct)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {gameLog.length === 0 && (
            <div style={{ color: "#c00", marginTop: 16 }}>
              <b>DEBUG:</b> No game log rows found.
              <br />
              playerIdNum: {player ? player.id : "N/A"}
              <br />
              selectedSeason: {mostRecentSeason}
            </div>
          )}
        </>
      ) : (
        <div style={{ color: "#c00", fontWeight: 700, fontSize: 20 }}>
          Player not found.
        </div>
      )}
    </div>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { playerId, season } = context.query;
  if (!playerId || Array.isArray(playerId)) {
    return {
      props: {
        player: null,
        seasonStats: [],
        isGoalie: false,
        gameLog: [],
        mostRecentSeason: null,
        usedGameLogFallback: false,
        availableSeasons: []
      }
    };
  }
  // Convert playerId to number for Supabase query
  const playerIdNum = Number(playerId);
  if (isNaN(playerIdNum)) {
    return {
      props: {
        player: null,
        seasonStats: [],
        isGoalie: false,
        gameLog: [],
        mostRecentSeason: null,
        usedGameLogFallback: false,
        availableSeasons: []
      }
    };
  }
  // Fetch player info
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select(
      `id, fullName, image_url, team_id, sweater_number, position, birthDate, birthCity, birthCountry, heightInCentimeters, weightInKilograms`
    )
    .eq("id", playerIdNum)
    .single();

  if (playerError || !player) {
    return {
      props: {
        player: null,
        seasonStats: [],
        isGoalie: false,
        gameLog: [],
        mostRecentSeason: null,
        usedGameLogFallback: false,
        availableSeasons: []
      }
    };
  }

  // Determine if player is a goalie
  const isGoalie =
    player.position && player.position.toUpperCase().startsWith("G");

  let seasonStats: any[] = [];
  let mostRecentSeason: string | number | null = null;
  // Fetch current season info for game log
  const currentSeason = await getCurrentSeason();
  const currentSeasonString = String(currentSeason.seasonId); // e.g., "20242025"
  const currentSeasonId = currentSeason.seasonId; // number

  if (isGoalie) {
    // Goalie: fetch from wgo_goalie_stats_totals
    const { data, error } = await supabase
      .from("wgo_goalie_stats_totals")
      .select(
        `season_id, games_played, wins, losses, ot_losses, goals_against_avg, save_pct, shutouts`
      )
      .eq("goalie_id", playerIdNum)
      .order("season_id", { ascending: false });
    seasonStats = data || [];
    mostRecentSeason = seasonStats.length > 0 ? seasonStats[0].season_id : null;
  } else {
    // Skater: fetch from wgo_skater_stats_totals
    const { data, error } = await supabase
      .from("wgo_skater_stats_totals")
      .select(
        `season, games_played, goals, assists, points, plus_minus, shots, shooting_percentage, pp_points, gw_goals, fow_percentage, toi_per_game, blocked_shots, hits, takeaways, giveaways, sat_pct, zone_start_pct`
      )
      .eq("player_id", playerIdNum)
      .order("season", { ascending: false });
    seasonStats = data || [];
    mostRecentSeason = seasonStats.length > 0 ? seasonStats[0].season : null;
  }

  // Determine selected season for game log
  let selectedSeason = season
    ? String(season)
    : isGoalie
      ? seasonStats.length > 0
        ? seasonStats[0].season_id
        : null
      : seasonStats.length > 0
        ? seasonStats[0].season
        : null;
  if (!selectedSeason)
    selectedSeason = isGoalie ? currentSeasonId : currentSeasonString;

  // Ensure selectedSeason is a number for the query
  if (selectedSeason) selectedSeason = Number(selectedSeason);

  // Debug logging for types
  console.log(
    "[PlayerStatsPage][DEBUG] typeof playerIdNum:",
    typeof playerIdNum,
    "typeof selectedSeason:",
    typeof selectedSeason
  );

  // Fetch all game log rows for selected season
  let gameLog: any[] = [];
  let usedGameLogFallback = false;
  if (isGoalie) {
    gameLog = await fetchAllGameLogRows(
      supabase,
      "wgo_goalie_stats",
      "goalie_id",
      playerIdNum,
      "season_id",
      selectedSeason,
      `date, opponent_abbr, games_started, wins, losses, ot_losses, save_pct, goals_against_avg, shutouts, saves, shots_against, goals_against`
    );
    // Fallback: fetch 10 most recent games if empty
    if (!gameLog.length) {
      const { data: fallbackData } = await supabase
        .from("wgo_goalie_stats")
        .select(
          `date, opponent_abbr, games_started, wins, losses, ot_losses, save_pct, goals_against_avg, shutouts, saves, shots_against, goals_against`
        )
        .eq("goalie_id", playerIdNum)
        .order("date", { ascending: false })
        .limit(10);
      if (fallbackData && fallbackData.length) {
        gameLog = fallbackData;
        usedGameLogFallback = true;
      }
    }
  } else {
    gameLog = await fetchAllGameLogRows(
      supabase,
      "wgo_skater_stats",
      "player_id",
      playerIdNum,
      "season_id",
      selectedSeason,
      `date, games_played, goals, assists, points, plus_minus, shots, shooting_percentage, pp_points, gw_goals, fow_percentage, toi_per_game, blocked_shots, hits, takeaways, giveaways, sat_pct, zone_start_pct`
    );
    // Fallback: fetch 10 most recent games if empty
    if (!gameLog.length) {
      const { data: fallbackData } = await supabase
        .from("wgo_skater_stats")
        .select(
          `date, games_played, goals, assists, points, plus_minus, shots, shooting_percentage, pp_points, gw_goals, fow_percentage, toi_per_game, blocked_shots, hits, takeaways, giveaways, sat_pct, zone_start_pct`
        )
        .eq("player_id", playerIdNum)
        .order("date", { ascending: false })
        .limit(10);
      if (fallbackData && fallbackData.length) {
        gameLog = fallbackData;
        usedGameLogFallback = true;
      }
    }
  }

  // Debug logging
  console.log(
    "[PlayerStatsPage][DEBUG] playerIdNum:",
    playerIdNum,
    "selectedSeason:",
    selectedSeason,
    "gameLog.length:",
    gameLog.length
  );
  if (gameLog.length > 0) {
    console.log("[PlayerStatsPage][DEBUG] First row:", gameLog[0]);
  }

  return {
    props: {
      player,
      seasonStats,
      isGoalie,
      gameLog,
      mostRecentSeason: selectedSeason,
      usedGameLogFallback,
      availableSeasons: isGoalie
        ? seasonStats.map((s) => s.season_id)
        : seasonStats.map((s) => s.season)
    }
  };
}

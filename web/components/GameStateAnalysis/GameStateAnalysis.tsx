import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import supabase from "lib/supabase";
import { teamsInfo } from "lib/teamsInfo";
import { seasonDateWindow } from "components/PlayerStats/playerStatsContract";
import {
  aggregateNstTeamCounts,
  formatFractionPercent,
  type NstTeamCountRow
} from "lib/stats/percentUnits";
import styles from "./GameStateAnalysis.module.scss";

interface GameStateAnalysisProps {
  teamId: string;
  teamAbbrev: string;
  seasonId: string;
}

// Shares are fractions (0-1); null means the source has no value for it.
export interface SituationCard {
  key: string;
  title: string;
  /** Shot-attempt share: NST CF% for strengths, NHL.com SAT% for score states. */
  attemptsPct: number | null;
  secondPct: number | null;
  secondLabel: "xGF%" | "FF%";
  goalsFor: number | null;
  goalsAgainst: number | null;
  pdo: number | null;
  toiSeconds: number | null;
  games: number | null;
  note: string;
}

export interface WgoScoreStateRow {
  games_played?: number | null;
  sat_pct_ahead?: number | null;
  sat_pct_tied?: number | null;
  sat_pct_behind?: number | null;
  sat_pct_close?: number | null;
  usat_pct_ahead?: number | null;
  usat_pct_tied?: number | null;
  usat_pct_behind?: number | null;
  usat_pct_close?: number | null;
}

const gamesLabel = (games: number) => `${games} game${games === 1 ? "" : "s"}`;

const NST_SELECT = "date, gp, toi, cf, ca, xgf, xga, gf, ga, sf, sa";

export function buildStrengthCard(
  key: string,
  title: string,
  rows: readonly NstTeamCountRow[]
): SituationCard {
  const totals = aggregateNstTeamCounts(rows);
  return {
    key,
    title,
    attemptsPct: totals.cfPct,
    secondPct: totals.xgfPct,
    secondLabel: "xGF%",
    goalsFor: totals.goalsFor,
    goalsAgainst: totals.goalsAgainst,
    pdo: totals.pdo,
    toiSeconds: totals.toiSeconds,
    games: totals.games,
    note:
      totals.games === null
        ? "Incomplete game sample · Natural Stat Trick"
        : totals.games > 0
        ? `Regular season · ${gamesLabel(totals.games)} · Natural Stat Trick`
        : "No games in sample"
  };
}

/**
 * NHL.com stores score-state shot-attempt shares per game without the
 * attempt counts, so a season ratio of sums is not possible. This is an
 * unweighted average of per-game shares over games with a value, labelled
 * as such. NHL.com shares are fractions (0-1).
 */
export function buildScoreStateCard(
  key: string,
  title: string,
  rows: readonly WgoScoreStateRow[],
  satKey: keyof WgoScoreStateRow,
  usatKey: keyof WgoScoreStateRow
): SituationCard {
  const played = rows.filter(
    (row) => typeof row.games_played === "number" && row.games_played > 0
  );
  const average = (field: keyof WgoScoreStateRow) => {
    const values = played
      .map((row) => row[field])
      .filter(
        (value): value is number =>
          typeof value === "number" && Number.isFinite(value)
      );
    return {
      value:
        values.length > 0
          ? values.reduce((total, value) => total + value, 0) / values.length
          : null,
      games: values.length
    };
  };
  const sat = average(satKey);
  const usat = average(usatKey);
  return {
    key,
    title,
    attemptsPct: sat.value,
    secondPct: usat.value,
    secondLabel: "FF%",
    goalsFor: null,
    goalsAgainst: null,
    pdo: null,
    toiSeconds: null,
    games: sat.games,
    note:
      sat.games > 0
        ? `Average of per-game shares · ${gamesLabel(sat.games)} · NHL.com`
        : "No games in sample"
  };
}

const BLOWOUTS_CARD: SituationCard = {
  key: "blowouts",
  title: "Blowouts",
  attemptsPct: null,
  secondPct: null,
  secondLabel: "xGF%",
  goalsFor: null,
  goalsAgainst: null,
  pdo: null,
  toiSeconds: null,
  games: 0,
  note: "Not available: no score-differential source yet"
};

const toChartValue = (value: number | null) =>
  value === null ? undefined : Number((value * 100).toFixed(1));

export function GameStateAnalysis({
  teamId,
  teamAbbrev,
  seasonId
}: GameStateAnalysisProps) {
  const [strengthCards, setStrengthCards] = useState<SituationCard[]>([]);
  const [scoreStateCards, setScoreStateCards] = useState<SituationCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const teamInfo = teamsInfo[teamAbbrev];

  const fetchGameStateData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const window = seasonDateWindow(seasonId);
      if (!window) throw new Error(`Invalid season id: ${seasonId}`);

      // NHL.com score-state shares, one game date per row
      const { data: gameStateData, error: gameStateError } = await supabase
        .from("wgo_team_stats")
        .select(
          `
          date, games_played,
          sat_pct_ahead, sat_pct_tied, sat_pct_behind, sat_pct_close,
          usat_pct_ahead, usat_pct_tied, usat_pct_behind, usat_pct_close
        `
        )
        .eq("team_id", parseInt(teamId))
        .eq("season_id", parseInt(seasonId))
        .gt("games_played", 0)
        .order("date", { ascending: false });

      if (gameStateError) throw gameStateError;

      // NST regular-season counts by strength, one date per row
      const readStrength = (table: "nst_team_5v5" | "nst_team_pp" | "nst_team_pk") =>
        supabase
          .from(table)
          .select(NST_SELECT)
          .eq("team_abbreviation", teamAbbrev)
          .gte("date", window.start)
          .lte("date", window.end)
          .or("gp.neq.0,gp.is.null")
          .order("date", { ascending: false });

      const [evenStrength, powerPlay, penaltyKill] = await Promise.all([
        readStrength("nst_team_5v5"),
        readStrength("nst_team_pp"),
        readStrength("nst_team_pk")
      ]);
      if (evenStrength.error) throw evenStrength.error;
      if (powerPlay.error) throw powerPlay.error;
      if (penaltyKill.error) throw penaltyKill.error;

      setStrengthCards([
        buildStrengthCard("even_strength", "5v5", evenStrength.data ?? []),
        buildStrengthCard("power_play", "Power Play", powerPlay.data ?? []),
        buildStrengthCard("penalty_kill", "Penalty Kill", penaltyKill.data ?? [])
      ]);

      const scoreRows = (gameStateData ?? []) as WgoScoreStateRow[];
      setScoreStateCards([
        buildScoreStateCard("leading", "Leading", scoreRows, "sat_pct_ahead", "usat_pct_ahead"),
        buildScoreStateCard("tied", "Tied", scoreRows, "sat_pct_tied", "usat_pct_tied"),
        buildScoreStateCard("trailing", "Trailing", scoreRows, "sat_pct_behind", "usat_pct_behind"),
        buildScoreStateCard("close_games", "Close Games", scoreRows, "sat_pct_close", "usat_pct_close"),
        BLOWOUTS_CARD
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching game state data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [seasonId, teamAbbrev, teamId]);

  useEffect(() => {
    fetchGameStateData();
  }, [fetchGameStateData]);

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "—";
    const rounded = Math.round(seconds);
    const mins = Math.floor(rounded / 60);
    const secs = rounded % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Thresholds are fractions, matching the values they classify.
  const getPerformanceColor = (
    value: number | null,
    threshold: { good: number; poor: number }
  ) => {
    if (value === null) return "";
    if (value >= threshold.good) return styles.excellent;
    if (value <= threshold.poor) return styles.poor;
    return styles.average;
  };

  const renderCard = (card: SituationCard) => (
    <div key={card.key} className={styles.situationCard}>
      <div className={styles.situationHeader}>
        <h4>{card.title}</h4>
        <span className={styles.toiDisplay}>{formatTime(card.toiSeconds)}</span>
      </div>
      <div className={styles.situationStats}>
        <div className={styles.situationStat}>
          <span
            className={`${styles.statValue} ${getPerformanceColor(card.attemptsPct, { good: 0.52, poor: 0.48 })}`}
          >
            {formatFractionPercent(card.attemptsPct)}
          </span>
          <span className={styles.statLabel}>CF%</span>
        </div>
        <div className={styles.situationStat}>
          <span
            className={`${styles.statValue} ${getPerformanceColor(card.secondPct, { good: 0.52, poor: 0.48 })}`}
          >
            {formatFractionPercent(card.secondPct)}
          </span>
          <span className={styles.statLabel}>{card.secondLabel}</span>
        </div>
        <div className={styles.situationStat}>
          <span className={styles.statValue}>
            {card.goalsFor === null || card.goalsAgainst === null
              ? "—"
              : `${card.goalsFor}-${card.goalsAgainst}`}
          </span>
          <span className={styles.statLabel}>Goals</span>
        </div>
        <div className={styles.situationStat}>
          <span className={styles.statValue}>
            {card.pdo === null ? "—" : card.pdo.toFixed(3)}
          </span>
          <span className={styles.statLabel}>PDO</span>
        </div>
      </div>
      <p className={styles.cardNote}>{card.note}</p>
    </div>
  );

  const renderOverview = () => {
    const strengthChart = strengthCards.map((card) => ({
      name: card.title,
      cf_pct: toChartValue(card.attemptsPct),
      xgf_pct: toChartValue(card.secondPct)
    }));
    const scoreChart = scoreStateCards
      .filter((card) => card.key !== "blowouts" && card.key !== "close_games")
      .map((card) => ({
        name: card.title,
        sat_pct: toChartValue(card.attemptsPct),
        usat_pct: toChartValue(card.secondPct)
      }));

    return (
      <div className={styles.overviewContent}>
        <div className={styles.chartsGrid}>
          <div className={styles.chartCard}>
            <h4>Strength State Performance</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={strengthChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="name" tick={{ fill: "#ccc" }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fill: "#ccc" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px"
                  }}
                />
                <Legend />
                <Bar dataKey="cf_pct" fill="#07aae2" name="CF%" />
                <Bar dataKey="xgf_pct" fill="#00ff87" name="xGF%" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className={styles.chartCard}>
            <h4>Score State Shot Attempts</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scoreChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="name" tick={{ fill: "#ccc" }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fill: "#ccc" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px"
                  }}
                />
                <Legend />
                <Bar dataKey="sat_pct" fill="#07aae2" name="CF% (all attempts)" />
                <Bar dataKey="usat_pct" fill="#ffb347" name="FF% (unblocked)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.situationCards}>
          {strengthCards.map(renderCard)}
          {scoreStateCards.map(renderCard)}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <span>Loading game state analysis...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h3>⚠️ Error Loading Analysis</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Trends and League Comparison views return once they have supported data
  // (stats plan S13/S14).
  return (
    <div
      className={styles.container}
      style={
        {
          "--team-primary-color": teamInfo?.primaryColor || "#1976d2",
          "--team-secondary-color": teamInfo?.secondaryColor || "#424242",
          "--team-accent-color": teamInfo?.accent || "#ff9800"
        } as React.CSSProperties
      }
    >
      <div className={styles.header}>
        <h2>Game State Analysis</h2>
        <p>
          Season totals by strength (Natural Stat Trick) and shot-attempt
          shares by score state (NHL.com). Score-state cards have no goals,
          PDO or time on ice in their source.
        </p>
      </div>

      <div className={styles.tabContent}>{renderOverview()}</div>
    </div>
  );
}

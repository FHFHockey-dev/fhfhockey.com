import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import supabase from "lib/supabase/client";
import { useCurrentSeasonQuery } from "hooks/useCurrentSeason";
import type { Database } from "lib/supabase/database-generated.types";
import { getTeamAbbreviationById } from "lib/teamsInfo";
import { useTeamColor } from "contexts/TeamColorContext";
import { readableInk } from "components/LineCombinations/PlayerCard/teamInk";
import cardStyles from "components/LineCombinations/PlayerCard/PlayerCard.module.scss";
import styles from "./PowerPlayCombos.module.scss";

type RosterRow = Pick<
  Database["public"]["Tables"]["rosters"]["Row"],
  "playerId" | "sweaterNumber"
>;

type PlayerDetails = Pick<
  Database["public"]["Tables"]["players"]["Row"],
  "fullName" | "firstName" | "lastName" | "position" | "sweater_number"
>;

type PowerPlayRow = {
  playerId: number;
  unit: number;
  PPTOI: number | null;
  players: PlayerDetails | null;
};

type UnitPlayer = {
  playerId: number;
  displayName: string;
  firstName: string;
  lastName: string;
  position: string | null;
  sweaterNumber: number | null;
  ppToi: number;
  isDefense: boolean;
};

type UnitsMap = Record<number, UnitPlayer[]>;

/** Power-play totals over a player's last PP_STATS_GAMES games with this team. */
type PpStats = { games: number; goals: number; assists: number; shots: number; toiSeconds: number };

type StrengthRow = {
  player_id: number;
  game_id: number;
  shots_pp: number | null;
  toi_pp_seconds: number | null;
};

type SkaterPpRow = {
  playerId: number;
  gameId: number;
  powerPlayGoals: number | null;
  powerPlayPoints: number | null;
};

const PP_STATS_GAMES = 10;

type UnitHistoryEntry = {
  gameId: number;
  startTime?: string | null;
  opponent?: string | null;
  players: UnitPlayer[];
};

type SourceGame = { startTime: string | null; opponent: string | null };

const opponentOf = (
  game: { homeTeamId: number; awayTeamId: number },
  teamId: number
) =>
  getTeamAbbreviationById(
    game.homeTeamId === teamId ? game.awayTeamId : game.homeTeamId
  ) ?? null;

type UnitsHistoryMap = Record<number, UnitHistoryEntry[]>;

type Props = {
  teamId: number;
  gameId: number;
  seasonId?: number;
  teamAbbreviation?: string;
  /** Games to total the card stats over (the even-strength cards' window), so both agree. */
  statsGameIds?: number[];
};

type CurrentGameRow = Pick<
  Database["public"]["Tables"]["games"]["Row"],
  "id" | "startTime" | "seasonId" | "homeTeamId" | "awayTeamId"
>;

const UNIT_ORDER = [1, 2, 3] as const;

export default function PowerPlayCombos({
  teamId,
  gameId,
  seasonId: sourceSeasonId,
  teamAbbreviation,
  statsGameIds
}: Props) {
  const currentSeasonQuery = useCurrentSeasonQuery();
  const seasonId = sourceSeasonId ?? currentSeasonQuery.data?.seasonId;
  const seasonLookupIsPending =
    sourceSeasonId === undefined && currentSeasonQuery.isPending;
  const seasonLookupIsError =
    sourceSeasonId === undefined && currentSeasonQuery.isError;
  const shotShareTeamAbbreviation =
    teamAbbreviation && seasonId === currentSeasonQuery.data?.seasonId
      ? teamAbbreviation
      : undefined;
  const [units, setUnits] = useState<UnitsMap>({});
  const [history, setHistory] = useState<UnitsHistoryMap>({});
  const [ppShotShareByPlayerId, setPpShotShareByPlayerId] = useState<
    Record<number, number | null>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUnit, setExpandedUnit] = useState<number | null>(null);
  const [sourceGame, setSourceGame] = useState<SourceGame | null>(null);
  const [ppStatsByPlayerId, setPpStatsByPlayerId] = useState<
    Record<number, PpStats>
  >({});

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric"
      }),
    []
  );

  const toggleUnit = useCallback((unit: number) => {
    setExpandedUnit((prev) => (prev === unit ? null : unit));
  }, []);

  useEffect(() => {
    if (!teamId || !gameId) {
      return;
    }

    if (!seasonId) {
      setUnits({});
      setHistory({});
      setExpandedUnit(null);
      setLoading(seasonLookupIsPending);
      setError(
        seasonLookupIsPending
          ? null
          : seasonLookupIsError
            ? "Unable to determine the current NHL season."
            : "Power play data requires a season."
      );
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: currentGameInfo, error: currentGameError } =
          await supabase
            .from("games")
            .select("id, startTime, seasonId, homeTeamId, awayTeamId")
            .eq("id", gameId)
            .single();
        if (currentGameError) throw currentGameError;

        const currentGame = currentGameInfo as CurrentGameRow | null;
        if (
          !currentGame ||
          currentGame.seasonId !== seasonId ||
          (currentGame.homeTeamId !== teamId &&
            currentGame.awayTeamId !== teamId)
        ) {
          throw new Error("Power play source context does not match the game.");
        }
        if (!cancelled) {
          setSourceGame({
            startTime: currentGame.startTime ?? null,
            opponent: opponentOf(currentGame, teamId)
          });
        }

        const { data: rosterData, error: rosterError } = await supabase
          .from("rosters")
          .select("playerId, sweaterNumber")
          .eq("teamId", teamId)
          .eq("seasonId", seasonId!);
        if (rosterError) throw rosterError;

        const roster = (rosterData ?? []) as RosterRow[];
        const playerIds = roster.map((row) => row.playerId);
        if (!playerIds.length) {
          if (!cancelled) {
            setUnits({});
            setLoading(false);
          }
          return;
        }

        const rosterSweaterMap = new Map(
          roster.map((row) => [row.playerId, row.sweaterNumber])
        );

        const { data: comboData, error: comboError } = await supabase
          .from("powerPlayCombinations")
          .select(
            "playerId, unit, PPTOI, players:playerId(fullName, firstName, lastName, position, sweater_number)"
          )
          .eq("gameId", gameId)
          .in("playerId", playerIds);
        if (comboError) throw comboError;

        const combos = (comboData ?? []) as PowerPlayRow[];
        const nextUnits: UnitsMap = {};

        const orderPlayers = (list: UnitPlayer[]) => {
          const forwards = list.filter((player) => !player.isDefense);
          const defense = list.filter((player) => player.isDefense);
          return [...forwards, ...defense];
        };

        const formatPlayer = (row: PowerPlayRow): UnitPlayer => {
          const details = row.players;
          const rawFirstName =
            details?.firstName ?? details?.fullName?.split(" ").at(0) ?? "";
          const initial = rawFirstName
            ? `${rawFirstName.charAt(0).toUpperCase()}.`
            : "";
          const rawLastName =
            details?.lastName ??
            details?.fullName?.split(" ").slice(-1).at(0) ??
            `Player ${row.playerId}`;
          const lastName = rawLastName ?? "";
          const displayName = [initial, lastName]
            .filter(Boolean)
            .join(" ")
            .trim();
          const normalizedPosition = details?.position
            ? details.position.toUpperCase()
            : null;
          const isDefense =
            normalizedPosition === "D" ||
            normalizedPosition === "LD" ||
            normalizedPosition === "RD";
          const sweater =
            rosterSweaterMap.get(row.playerId) ??
            details?.sweater_number ??
            null;

          return {
            playerId: row.playerId,
            displayName: displayName || `Player ${row.playerId}`,
            firstName: rawFirstName,
            lastName: lastName || `Player ${row.playerId}`,
            position: normalizedPosition,
            sweaterNumber: sweater,
            ppToi: row.PPTOI ?? 0,
            isDefense
          };
        };

        combos.forEach((row) => {
          const list = nextUnits[row.unit] ?? [];
          list.push(formatPlayer(row));
          nextUnits[row.unit] = list;
        });

        UNIT_ORDER.forEach((unit) => {
          const players = nextUnits[unit];
          if (!players) return;
          players.sort((a, b) => b.ppToi - a.ppToi);
          nextUnits[unit] = orderPlayers(players).slice(0, 5);
        });

        let unitsHistory: UnitsHistoryMap = {};

        if (playerIds.length > 0) {
          const currentStartTime = currentGame.startTime;

          let gamesQuery = supabase
            .from("games")
            .select("id, startTime, homeTeamId, awayTeamId")
            .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`)
            .eq("seasonId", seasonId)
            .neq("id", gameId)
            .order("startTime", { ascending: false });

          gamesQuery = gamesQuery.lt(
            "startTime",
            currentStartTime ?? new Date().toISOString()
          );

          const { data: previousGamesData, error: previousGamesError } =
            await gamesQuery.limit(5);
          if (previousGamesError) throw previousGamesError;

          const previousGames = (previousGamesData ?? []) as {
            id: number;
            startTime: string;
            homeTeamId: number;
            awayTeamId: number;
          }[];
          const previousIds = previousGames.map((game) => game.id);

          if (previousIds.length) {
            const { data: historyRows, error: historyError } = await supabase
              .from("powerPlayCombinations")
              .select(
                "gameId, unit, PPTOI, playerId, players:playerId(fullName, firstName, lastName, position, sweater_number)"
              )
              .in("gameId", previousIds)
              .in("playerId", playerIds);
            if (historyError) throw historyError;

            const rowsByGame = new Map<number, PowerPlayRow[]>();
            (historyRows ?? []).forEach((row) => {
              const bucket = rowsByGame.get(row.gameId) ?? [];
              bucket.push(row as PowerPlayRow);
              rowsByGame.set(row.gameId, bucket);
            });

            const historyMap: UnitsHistoryMap = {};
            previousGames.forEach((game) => {
              const rows = rowsByGame.get(game.id) ?? [];
              if (!rows.length) return;

              const unitGroups = new Map<number, PowerPlayRow[]>();
              rows.forEach((row) => {
                const group = unitGroups.get(row.unit) ?? [];
                group.push(row);
                unitGroups.set(row.unit, group);
              });

              unitGroups.forEach((groupRows, unit) => {
                const formattedPlayers = groupRows
                  .map(formatPlayer)
                  .sort((a, b) => b.ppToi - a.ppToi);
                const ordered = orderPlayers(formattedPlayers).slice(0, 5);
                if (!ordered.length) return;

                const entry: UnitHistoryEntry = {
                  gameId: game.id,
                  startTime: game.startTime,
                  opponent: opponentOf(game, teamId),
                  players: ordered
                };

                if (!historyMap[unit]) {
                  historyMap[unit] = [];
                }
                historyMap[unit].push(entry);
              });
            });

            unitsHistory = historyMap;
          }
        }

        if (!cancelled) {
          setUnits(nextUnits);
          setHistory(unitsHistory);
          setExpandedUnit(null);
        }
      } catch (cause) {
        console.error("Failed to load power play combinations", cause);
        if (!cancelled) {
          setError("Unable to load power play data right now.");
          setUnits({});
          setHistory({});
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [gameId, seasonId, seasonLookupIsError, seasonLookupIsPending, teamId]);

  useEffect(() => {
    if (!shotShareTeamAbbreviation) {
      setPpShotShareByPlayerId({});
      return;
    }
    const activeTeamAbbreviation: string = shotShareTeamAbbreviation;

    let cancelled = false;

    async function loadShotShare() {
      try {
        const response = await fetch(
          `/api/v1/splits?team=${encodeURIComponent(activeTeamAbbreviation)}`
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as {
          ppShotShare?: Array<{ playerId: number; ppShotSharePct: number | null }>;
        };
        if (cancelled) {
          return;
        }

        const nextMap: Record<number, number | null> = {};
        (payload.ppShotShare ?? []).forEach((row) => {
          nextMap[row.playerId] = row.ppShotSharePct ?? null;
        });
        setPpShotShareByPlayerId(nextMap);
      } catch (cause) {
        console.error("Failed to load PP shot share context", cause);
        if (!cancelled) {
          setPpShotShareByPlayerId({});
        }
      }
    }

    void loadShotShare();

    return () => {
      cancelled = true;
    };
  }, [shotShareTeamAbbreviation]);

  // Card stats over the even-strength cards' games (statsGameIds), so PPP agrees with
  // those cards: PPG / PPP from the NHL game stats (skatersGameStats, the same
  // source); PP SOG and PP TOI from forge_player_game_strength (the NHL rows carry no
  // PP shots and their powerPlayToi is "00:00"). Without statsGameIds, the unit's last 10 team games up to the source game.
  const statsGameKey = statsGameIds?.join(",") ?? "";
  useEffect(() => {
    const unitPlayerIds = UNIT_ORDER.flatMap((unit) =>
      (units[unit] ?? []).map((player) => player.playerId)
    );
    if (!teamId || !gameId || unitPlayerIds.length === 0) {
      setPpStatsByPlayerId({});
      return;
    }
    let cancelled = false;
    async function loadPpStats() {
      try {
        let gameIds = statsGameKey ? statsGameKey.split(",").map(Number) : [];
        if (!gameIds.length) {
          const { data: recent, error: recentError } = await supabase
            .from("forge_player_game_strength")
            .select("game_id")
            .eq("team_id", teamId)
            .lte("game_id", gameId)
            .order("game_id", { ascending: false })
            .limit(PP_STATS_GAMES * 25);
          if (recentError) throw recentError;
          gameIds = [...new Set((recent ?? []).map((row) => row.game_id as number))].slice(
            0,
            PP_STATS_GAMES
          );
        }
        if (!gameIds.length) {
          if (!cancelled) setPpStatsByPlayerId({});
          return;
        }
        const [nhl, forge] = await Promise.all([
          supabase
            .from("skatersGameStats")
            .select("playerId, gameId, powerPlayGoals, powerPlayPoints")
            .in("playerId", unitPlayerIds)
            .in("gameId", gameIds),
          supabase
            .from("forge_player_game_strength")
            .select("player_id, game_id, shots_pp, toi_pp_seconds")
            .eq("team_id", teamId)
            .in("player_id", unitPlayerIds)
            .in("game_id", gameIds)
        ]);
        if (nhl.error) throw nhl.error;
        const next: Record<number, PpStats> = {};
        const entry = (playerId: number) =>
          (next[playerId] ??= { games: 0, goals: 0, assists: 0, shots: 0, toiSeconds: 0 });
        ((nhl.data ?? []) as SkaterPpRow[]).forEach((row) => {
          const stats = entry(row.playerId);
          const goals = row.powerPlayGoals ?? 0;
          stats.games += 1;
          stats.goals += goals;
          stats.assists += (row.powerPlayPoints ?? 0) - goals;
        });
        if (!forge.error) {
          ((forge.data ?? []) as StrengthRow[]).forEach((row) => {
            const stats = next[row.player_id];
            if (!stats) return;
            stats.shots += row.shots_pp ?? 0;
            stats.toiSeconds += row.toi_pp_seconds ?? 0;
          });
        }
        if (!cancelled) setPpStatsByPlayerId(next);
      } catch (cause) {
        console.error("Failed to load power play player stats", cause);
        if (!cancelled) setPpStatsByPlayerId({});
      }
    }
    void loadPpStats();
    return () => {
      cancelled = true;
    };
  }, [gameId, statsGameKey, teamId, units]);

  const unitNumbers = useMemo(
    () => UNIT_ORDER.filter((unit) => (units[unit] ?? []).length > 0),
    [units]
  );

  const formatShotShare = useCallback((value: number | null | undefined) => {
    if (value == null) {
      return null;
    }

    return `${(value * 100).toFixed(1)}%`;
  }, []);

  if (!teamId || !gameId) {
    return null;
  }

  const describeGame = (startTime?: string | null, opponent?: string | null) =>
    [
      startTime ? dateFormatter.format(new Date(startTime)) : null,
      opponent ? `vs ${opponent}` : null
    ]
      .filter(Boolean)
      .join(" ") || "the latest game";

  return (
    <section className={styles.wrapper}>
      <header className={styles.header}>
        <h3 className={styles.title}>Power play units</h3>
        <p className={styles.context}>
          Latest groupings from{" "}
          {describeGame(sourceGame?.startTime, sourceGame?.opponent)}. Card
          stats are power-play totals from the last {PP_STATS_GAMES} games; SH%
          is the season share of the team&apos;s power-play shots.
        </p>
      </header>

      {loading ? (
        <div className={styles.status}>Loading power play data...</div>
      ) : error ? (
        <div className={styles.statusError}>{error}</div>
      ) : unitNumbers.length === 0 ? (
        <div className={styles.status}>
          No power play units recorded for this game.
        </div>
      ) : (
        <div className={styles.units}>
          {unitNumbers.map((unit) => {
            const unitLabelText = `PP${unit}`;
            return (
              <div
                key={unit}
                className={clsx(
                  styles.unitRow,
                  expandedUnit === unit && styles.unitRowExpanded
                )}
              >
                <button
                  type="button"
                  className={styles.unitSummary}
                  onClick={() => toggleUnit(unit)}
                  aria-expanded={expandedUnit === unit}
                >
                  <span className={styles.unitTitleGroup}>
                    <span className={styles.unitLabel}>{unitLabelText}</span>
                    <span className={styles.unitMeta}>
                      · {(units[unit] ?? []).length}{" "}
                      {(units[unit] ?? []).length === 1 ? "skater" : "skaters"}
                    </span>
                  </span>
                  <span className={styles.historyToggle}>
                    Recent games
                    <span className={styles.chevron} aria-hidden>
                      ▾
                    </span>
                  </span>
                </button>
                <UnitCards
                  players={units[unit] ?? []}
                  statsFor={(playerId) => ppStatsByPlayerId[playerId]}
                  shotShareLabel={(playerId) =>
                    formatShotShare(ppShotShareByPlayerId[playerId])
                  }
                />
                {expandedUnit === unit ? (
                  <div className={styles.history}>
                    <p className={styles.legend}>
                      <span className={styles.legendSwatch} aria-hidden="true" />
                      Blue chips are defensemen.
                    </p>
                    {(history[unit] ?? []).length === 0 ? (
                      <div className={styles.historyEmpty}>
                        No recent power play units tracked.
                      </div>
                    ) : (
                      (history[unit] ?? []).map((entry) => {
                        return (
                          <div
                            key={entry.gameId}
                            className={styles.historyEntry}
                          >
                            <div className={styles.historyMeta}>
                              <span className={styles.historyDate}>
                                {describeGame(entry.startTime, entry.opponent)}
                              </span>
                            </div>
                            <div className={styles.historyPlayers}>
                              {entry.players.map((player) => (
                                <span
                                  key={`${entry.gameId}-${player.playerId}`}
                                  className={clsx(
                                    styles.playerChip,
                                    player.isDefense && styles.playerChipDefense
                                  )}
                                >
                                  <span className={styles.playerNumber}>
                                    {player.sweaterNumber
                                      ? `#${player.sweaterNumber}`
                                      : "—"}
                                  </span>
                                  <span className={styles.playerName}>
                                    <span>{player.displayName}</span>
                                    {ppShotShareByPlayerId[player.playerId] != null ? (
                                      <span className={styles.playerDetail}>
                                        {formatShotShare(
                                          ppShotShareByPlayerId[player.playerId]
                                        )}{" "}
                                        team PP shots
                                      </span>
                                    ) : null}
                                  </span>
                                  {player.position ? (
                                    <span className={styles.playerPosition}>
                                      {player.position}
                                    </span>
                                  ) : null}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const formatToi = (seconds: number) => {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/**
 * A unit as lineup cards: up to three forwards on top, defensemen (and any 4th/5th
 * forward) centred underneath, so a 4F-1D or 3F-2D unit always reads F F F / x D.
 */
function UnitCards({
  players,
  statsFor,
  shotShareLabel
}: {
  players: UnitPlayer[];
  statsFor: (playerId: number) => PpStats | undefined;
  shotShareLabel: (playerId: number) => string | null;
}) {
  const forwards = players.filter((player) => !player.isDefense);
  const defense = players.filter((player) => player.isDefense);
  const rows = [forwards.slice(0, 3), [...forwards.slice(3), ...defense]].filter(
    (row) => row.length > 0
  );
  return (
    <div className={styles.unitCards}>
      {rows.map((row, index) => (
        <div key={index} className={styles.cardRow}>
          {row.map((player) => (
            <PowerPlayCard
              key={player.playerId}
              player={player}
              stats={statsFor(player.playerId)}
              shotShare={shotShareLabel(player.playerId)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function PowerPlayCard({
  player,
  stats,
  shotShare
}: {
  player: UnitPlayer;
  stats: PpStats | undefined;
  shotShare: string | null;
}) {
  const color = useTeamColor();
  // Same per-team ink rule as the even-strength cards (WCAG 4.5:1 on the team fill).
  const numberInk = readableInk(color.primary, [color.jersey, color.secondary]);
  const accentInk = readableInk(color.primary, [color.secondary, color.jersey]);
  const count = (value: number | undefined) => (stats ? String(value ?? 0) : "—");
  const cells = [
    { label: "PPG", value: count(stats?.goals) },
    { label: "PPA", value: count(stats?.assists) },
    { label: "PPP", value: count(stats && stats.goals + stats.assists) },
    { label: "PP SOG", value: count(stats?.shots) },
    {
      label: "TOI/GP",
      value: stats?.games ? formatToi(stats.toiSeconds / stats.games) : "—"
    },
    { label: "SH%", value: shotShare ?? "—" }
  ];
  return (
    <article
      className={clsx(cardStyles.container, styles.ppCard)}
      style={{ backgroundColor: color.primary }}
    >
      <div className={cardStyles.top}>
        <p className={cardStyles.names}>
          <span className={cardStyles.firstName} style={{ color: accentInk }}>
            {player.firstName}
          </span>
          <Link href={`/stats/player/${player.playerId}`}>
            <span className={cardStyles.lastName}>{player.lastName}</span>
          </Link>
        </p>
        {player.sweaterNumber ? (
          <div className={cardStyles.sweaterNumber} style={{ color: numberInk }}>
            <span aria-hidden="true">#</span>
            <span className={cardStyles.number}>
              <span className={cardStyles.visuallyHidden}>Number </span>
              {player.sweaterNumber}
            </span>
          </div>
        ) : null}
      </div>
      <dl className={styles.ppStats}>
        {cells.map((stat) => (
          <div key={stat.label} className={styles.ppStat}>
            <dt className={styles.ppLabel}>{stat.label}</dt>
            <dd className={styles.ppValue} style={{ color: accentInk }}>
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

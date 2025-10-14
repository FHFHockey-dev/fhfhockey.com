import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import supabase from "lib/supabase/client";
import useCurrentSeason from "hooks/useCurrentSeason";
import type { Database } from "lib/supabase/database-generated.types";
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
  position: string | null;
  sweaterNumber: number | null;
  ppToi: number;
  isDefense: boolean;
};

type UnitsMap = Record<number, UnitPlayer[]>;

type UnitHistoryEntry = {
  gameId: number;
  startTime?: string | null;
  players: UnitPlayer[];
};

type UnitsHistoryMap = Record<number, UnitHistoryEntry[]>;

type Props = {
  teamId: number;
  gameId: number;
};

const UNIT_ORDER = [1, 2, 3] as const;

export default function PowerPlayCombos({ teamId, gameId }: Props) {
  const season = useCurrentSeason();
  const seasonId = season?.seasonId;
  const [units, setUnits] = useState<UnitsMap>({});
  const [history, setHistory] = useState<UnitsHistoryMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUnit, setExpandedUnit] = useState<number | null>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }),
    []
  );

  const toggleUnit = useCallback((unit: number) => {
    setExpandedUnit((prev) => (prev === unit ? null : unit));
  }, []);

  useEffect(() => {
    if (!seasonId || !teamId || !gameId) {
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
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
            details?.firstName ??
            details?.fullName?.split(" ").at(0) ??
            "";
          const initial = rawFirstName
            ? `${rawFirstName.charAt(0).toUpperCase()}.`
            : "";
          const rawLastName =
            details?.lastName ??
            details?.fullName?.split(" ").slice(-1).at(0) ??
            `Player ${row.playerId}`;
          const lastName = rawLastName ? rawLastName.toUpperCase() : "";
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
            displayName: displayName || `PLAYER ${row.playerId}`,
            position: normalizedPosition,
            sweaterNumber: sweater,
            ppToi: row.PPTOI ?? 0,
            isDefense,
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
          const { data: currentGameInfo } = await supabase
            .from("games")
            .select("id, startTime")
            .eq("id", gameId);
          const currentStartTime = currentGameInfo?.[0]?.startTime ?? null;

          let gamesQuery = supabase
            .from("games")
            .select("id, startTime")
            .or(`homeTeamId.eq.${teamId},awayTeamId.eq.${teamId}`)
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
                  players: ordered,
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
  }, [seasonId, teamId, gameId]);

  const unitNumbers = useMemo(
    () => UNIT_ORDER.filter((unit) => (units[unit] ?? []).length > 0),
    [units]
  );

  if (!teamId || !gameId) {
    return null;
  }

  return (
    <section className={styles.wrapper}>
      <header className={styles.header}>
        <h3 className={styles.title}>Power Play Units</h3>
        <p className={styles.context}>
          Latest groupings from game&nbsp;
          <span className={styles.gameId}>#{gameId}</span>
        </p>
      </header>

      {loading ? (
        <div className={styles.status}>Loading power play data...</div>
      ) : error ? (
        <div className={styles.statusError}>{error}</div>
      ) : unitNumbers.length === 0 ? (
        <div className={styles.status}>No power play units recorded for this game.</div>
      ) : (
        <div className={styles.units}>
          {unitNumbers.map((unit) => {
            const unitLabelText = unit === 3 ? "Extras" : `Unit ${unit}`;
            return (
            <button
              key={unit}
              type="button"
              className={clsx(
                styles.unitRow,
                expandedUnit === unit && styles.unitRowExpanded
              )}
              onClick={() => toggleUnit(unit)}
              aria-expanded={expandedUnit === unit}
            >
              <div className={styles.unitSummary}>
                <div className={styles.unitTitleGroup}>
                  <span className={styles.unitLabel}>{unitLabelText}</span>
                  <span className={styles.unitMeta}>
                    {(units[unit] ?? []).length} skaters
                  </span>
                </div>
                <span className={styles.chevron} aria-hidden>
                  v
                </span>
              </div>
              <div className={styles.unitPlayers}>
                {(units[unit] ?? []).map((player) => (
                  <span
                    key={player.playerId}
                    className={clsx(
                      styles.playerChip,
                      player.isDefense && styles.playerChipDefense
                    )}
                  >
                    <span className={styles.playerNumber}>
                      {player.sweaterNumber ? `#${player.sweaterNumber}` : "—"}
                    </span>
                    <span className={styles.playerName}>
                      {player.displayName}
                    </span>
                    {player.position ? (
                      <span className={styles.playerPosition}>
                        {player.position}
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
              {expandedUnit === unit ? (
                <div className={styles.history}>
                  {(history[unit] ?? []).length === 0 ? (
                    <div className={styles.historyEmpty}>
                      No recent power play units tracked.
                    </div>
                  ) : (
                    (history[unit] ?? []).map((entry) => {
                      const formattedDate = entry.startTime
                        ? dateFormatter.format(new Date(entry.startTime))
                        : null;
                      return (
                        <div key={entry.gameId} className={styles.historyEntry}>
                          <div className={styles.historyMeta}>
                            <span>Game #{entry.gameId}</span>
                            {formattedDate ? (
                              <span className={styles.historyDate}>
                                {formattedDate}
                              </span>
                            ) : null}
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
                                  {player.displayName}
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
            </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

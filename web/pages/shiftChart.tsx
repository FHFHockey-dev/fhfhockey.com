import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { queryTypes, useQueryState } from "next-usequerystate";
import Head from "next/head";
import { OPTIONS, type Mode } from "components/LinemateMatrix";
import Replay from "components/ShiftChart/Replay";
import { latestCompletedGame } from "components/ShiftChart/data";
import { useGameData, useSchedule } from "components/ShiftChart/useGameGrid";
import styles from "styles/ShiftChart.module.scss";

export default function ShiftChart() {
  const router = useRouter();
  const [queryGameId, setGameId] = useQueryState("gameId", queryTypes.integer);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const gameId = hydrated ? queryGameId : null;
  const [mode, setMode] = useQueryState(
    "linemate-matrix-mode",
    queryTypes
      .stringEnum<Mode>(OPTIONS.map((option) => option.value))
      .withDefault("line-combination"),
  );
  const [date, setDate] = useState("");
  const [retry, setRetry] = useState(0);
  const [bootstrap, setBootstrap] = useState<{
    loading: boolean;
    error: string | null;
  }>({ loading: true, error: null });
  const state = useGameData(gameId && gameId > 0 ? gameId : null, retry);
  const schedule = useSchedule(date, retry);
  useEffect(() => {
    if (!hydrated || !router.isReady || gameId || date) return;
    let current = true;
    setBootstrap({ loading: true, error: null });
    latestCompletedGame()
      .then((game) => {
        if (!current) return;
        if (game) {
          setDate(game.date);
          void setGameId(game.id, { scroll: false });
        }
        setBootstrap({
          loading: false,
          error: game
            ? null
            : "No completed games found in the past two weeks. Choose a date to browse.",
        });
      })
      .catch((error: unknown) => {
        if (current)
          setBootstrap({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Unable to find a recent game.",
          });
      });
    return () => {
      current = false;
    };
  }, [hydrated, router.isReady, gameId, date, retry, setGameId]);
  useEffect(() => {
    if (state.date) setDate(state.date);
  }, [state.date]);
  const changeMode = useCallback(
    (next: Mode) => {
      void setMode(next, { scroll: false });
    },
    [setMode],
  );
  const loading = state.loading || (!gameId && !date && bootstrap.loading);
  const error = state.error ?? (!gameId && !date ? bootstrap.error : null);
  const selection = (
    <div className={styles.selectionColumn}>
      <h1 className={styles.pageTitle}>Shift <span>Chart</span></h1>
    <section className={styles.selection} aria-label="Choose a game">
      <label htmlFor="date-selector">Select date</label>
      <input
        id="date-selector"
        type="date"
        value={date}
        onChange={(e) => {
          setDate(e.target.value);
          void setGameId(null, { scroll: false });
        }}
      />
      <label htmlFor="game-selector">Select game</label>
      <select
        id="game-selector"
        value={gameId ?? ""}
        disabled={schedule.loading || !date}
        onChange={(e) => {
          void setGameId(e.target.value ? Number(e.target.value) : null, {
            scroll: false,
          });
        }}
      >
        <option value="">
          {schedule.loading ? "Loading games…" : "Select a game"}
        </option>
        {gameId && !schedule.games.some((g) => g.id === gameId) && (
          <option value={gameId}>
            {state.game
              ? `${state.game.home.abbrev} vs ${state.game.away.abbrev}`
              : `Game ${gameId}`}
          </option>
        )}
        {schedule.games.map((g) => (
          <option key={g.id} value={g.id}>
            {g.home} vs {g.away}
          </option>
        ))}
      </select>
      {schedule.error ? (
        <div className={styles.inlineError} role="alert">
          {schedule.error}
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            Retry games
          </button>
        </div>
      ) : (
        date &&
        !schedule.loading &&
        schedule.games.length === 0 && (
          <p role="status">No games on this date.</p>
        )
      )}
    </section>
    </div>
  );
  return (
    <>
      <Head>
        <title>Shift Chart | Five Hole Fantasy Hockey</title>
        <meta
          name="description"
          content="Explore player ice time, shifts and line combinations for every game."
        />
      </Head>
      <main className={styles.page} aria-label="Shift Chart">
        <div className={styles.pageGrid}>
          {state.game ? (
            <Replay
              key={state.game.id}
              game={state.game}
              selection={selection}
              mode={mode}
              onModeChanged={changeMode}
            />
          ) : (
            <div className={styles.emptyLayout}>
              {selection}
              <section
                className={styles.emptyState}
                role={error && !state.unavailable ? "alert" : "status"}
                aria-busy={loading}
              >
                <h2>
                  {loading
                    ? "Loading game data…"
                    : state.unavailable
                      ? "Replay unavailable"
                      : error
                        ? "Unable to load game"
                        : "Choose a game"}
                </h2>
                <p>
                  {error ??
                    (loading
                      ? "Preparing shifts, events and linemate data."
                      : "Select a completed game to explore its shifts and line combinations.")}
                </p>
                {error && (
                  <button type="button" onClick={() => setRetry((n) => n + 1)}>
                    Retry
                  </button>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

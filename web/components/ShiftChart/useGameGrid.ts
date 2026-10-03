import { useEffect, useState } from "react";
import { loadGame, loadSchedule } from "./data";
import { UnavailableGameError, type Game, type ScheduleGame } from "./model";

type GameState = {
  id: number | null;
  game: Game | null;
  date: string | null;
  error: string | null;
  unavailable: boolean;
  loading: boolean;
};
export function useGameData(id: number | null, retry: number) {
  const [state, setState] = useState<GameState>({
    id: null,
    game: null,
    date: null,
    error: null,
    unavailable: false,
    loading: false,
  });
  useEffect(() => {
    let current = true;
    if (!id) return;
    setState({
      id,
      game: null,
      date: null,
      error: null,
      unavailable: false,
      loading: true,
    });
    loadGame(id)
      .then((game) => {
        if (current)
          setState({
            id,
            game,
            date: game.date,
            error: null,
            unavailable: false,
            loading: false,
          });
      })
      .catch((error: unknown) => {
        if (current)
          setState({
            id,
            game: null,
            date: error instanceof UnavailableGameError ? error.date : null,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load this game.",
            unavailable: error instanceof UnavailableGameError,
            loading: false,
          });
      });
    return () => {
      current = false;
    };
  }, [id, retry]);
  // Hide the previous game immediately, before the effect for a new ID runs.
  return state.id === id
    ? state
    : {
        id,
        game: null,
        date: null,
        error: null,
        unavailable: false,
        loading: Boolean(id),
      };
}
export function useSchedule(date: string, retry: number) {
  const [state, setState] = useState<{
    date: string;
    games: ScheduleGame[];
    error: string | null;
    loading: boolean;
  }>({ date: "", games: [], error: null, loading: false });
  useEffect(() => {
    let current = true;
    if (!date) return;
    setState({ date, games: [], error: null, loading: true });
    loadSchedule(date)
      .then((games) => {
        if (current)
          setState({
            date,
            games: games.filter((g) => g.date === date),
            error: null,
            loading: false,
          });
      })
      .catch((error: unknown) => {
        if (current)
          setState({
            date,
            games: [],
            error:
              error instanceof Error ? error.message : "Unable to load games.",
            loading: false,
          });
      });
    return () => {
      current = false;
    };
  }, [date, retry]);
  return state.date === date
    ? state
    : { date, games: [], error: null, loading: Boolean(date) };
}

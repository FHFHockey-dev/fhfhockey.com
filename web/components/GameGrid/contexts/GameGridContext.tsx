// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\GameGrid\contexts\GameGridContext.tsx

import { useTeamsMap } from "hooks/useTeams";

import React, { createContext, useContext } from "react";
import type { Team } from "lib/NHL/types";
import type { GoaliePresentation } from "../utils/useGoalieGameView";

type ContextValue = {
  teams: ReturnType<typeof useTeamsMap>;
};

const context = createContext<ContextValue>({ teams: {} });
const goalieContext = createContext<GoaliePresentation>({ enabled: false, contextKey: "", snapshot: null, asOf: "", status: "unavailable" });
export const GoaliePresentationProvider = goalieContext.Provider;
export const useGoaliePresentation = () => useContext(goalieContext);

export default function GameGridContext({
  children
}: {
  children: React.ReactNode;
}) {
  const teams = useTeamsMap();

  return <context.Provider value={{ teams }}>{children}</context.Provider>;
}

export function useTeams() {
  const { teams } = useContext(context);

  return teams;
}

export function useTeam(id: number): Team | undefined {
  const { teams } = useContext(context);
  return teams[id];
}

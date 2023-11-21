import { useTeamsMap } from "hooks/useTeams";
import React, { createContext, useContext } from "react";

type ContextValue = {
  teams: ReturnType<typeof useTeamsMap>;
};

const context = createContext<ContextValue>({ teams: {} });

export default function GameGridContext({
  children,
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

export function useTeam(id: number) {
  const { teams } = useContext(context);
  return teams[id] ?? {};
}

// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\GameGrid\contexts\GameGridContext.tsx

import { useTeamsMap, default as useTeams_ } from "hooks/useTeams";

import React, { createContext, useContext, useEffect } from "react";
import { probabilityMatrixOptions } from "../PDHC/PoissonHeatMap";
import { useQueryClient } from "@tanstack/react-query";

type ContextValue = {
  teams: ReturnType<typeof useTeamsMap>;
};

const context = createContext<ContextValue>({ teams: {} });

export default function GameGridContext({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const teams = useTeamsMap();
  const teamsArray = useTeams_();

  useEffect(() => {
    if (teamsArray.length !== 0) {
      const abbreviations = teamsArray
        .map((team) => team.abbreviation)
        .slice(10, 15);
      // the team abbreviations to prefetch
      console.log(abbreviations);
      for (let i = 0; i < abbreviations.length; i++) {
        for (let j = 0; j < abbreviations.length; j++) {
          if (i === j) continue;
          const home = abbreviations[i];
          const away = abbreviations[j];
          queryClient.prefetchQuery(probabilityMatrixOptions(home, away));
        }
      }
    }
  }, [teamsArray, queryClient]);

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

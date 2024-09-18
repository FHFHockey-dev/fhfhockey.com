// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\GameGrid\contexts\GameGridContext.tsx

// UNCOMMENT WHEN NHL API HAS 20242025 DATA
// import { useTeamsMap } from "hooks/useTeams";

import { useNextYearsTeamsMap } from "hooks/useTeams";
import React, { createContext, useContext } from "react";

type ContextValue = {
  // UNNCOMMENT WHEN NHL API HAS 20242025 DATA
  // teams: ReturnType<typeof useTeamsMap>;

  // COMMENT OUT WHEN NHL API HAS 20242025 DATA
  teams: ReturnType<typeof useNextYearsTeamsMap>;
};

const context = createContext<ContextValue>({ teams: {} });

export default function GameGridContext({
  children,
}: {
  children: React.ReactNode;
}) {
  //   const teams = useTeamsMap();
  // uncomment when NHL API has 20242025 data

  const teams = useNextYearsTeamsMap();
  return <context.Provider value={{ teams }}>{children}</context.Provider>;
}

// UNCOMMENT WHEN NHL API HAS 20242025 DATA
// export function useTeams() {
//   const { teams } = useContext(context);

//   return teams;
// }

// export function useTeam(id: number) {
//   const { teams } = useContext(context);
//   return teams[id] ?? {};
// }

// COMMENT OUT WHEN NHL API HAS 20242025 DATA
export function useNextYearsTeams() {
  const { teams } = useContext(context);

  return teams;
}

export function useTeam(id: number) {
  const { teams } = useContext(context);
  return teams[id] ?? {};
}

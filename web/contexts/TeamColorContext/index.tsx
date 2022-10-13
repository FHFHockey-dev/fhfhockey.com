import { createContext, useContext } from "react";
import TEAM_COLORS, { DEFAULT_COLOR } from "./TEAM_COLORS";

const TeamColorContext = createContext(DEFAULT_COLOR);

export const useTeamColor = () => useContext(TeamColorContext);

export default function TeamColorProvider({
  teamName,
  children,
}: {
  teamName: string;
  children: React.ReactNode;
}) {
  return (
    <TeamColorContext.Provider value={TEAM_COLORS[teamName] ?? DEFAULT_COLOR}>
      {children}
    </TeamColorContext.Provider>
  );
}

// hooks/useTeamAbbreviation.ts
import { useTeamsMap } from "hooks/useTeams";

/**
 * Custom hook to retrieve the team abbreviation given a team ID.
 * @param teamId - The unique identifier for the team.
 * @returns The team abbreviation if found, otherwise undefined.
 */
export const useTeamAbbreviation = (teamId: number): string | undefined => {
  const teamsMap = useTeamsMap();
  return teamsMap[teamId]?.abbreviation;
};

// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\hooks\useTeams.ts

import { useEffect, useMemo, useState } from "react";
// REMOVE GETNEXTSEASONSTEAMS WHEN NHL API HAS 20242025 DATA
// UNCOMMENT
import { getTeams, getNextSeasonsTeams } from "lib/NHL/client";
import { Team } from "lib/NHL/types";

export default function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    getTeams().then((res) => setTeams(res));
  }, []);

  return teams;
}

export function useTeamsMap(): { [id: number]: Team } {
  const teams = useTeams();

  const map = useMemo(() => {
    const result = {} as any;
    teams.forEach((team) => (result[team.id] = team));
    return result;
  }, [teams]);

  return map;
}

// FOR GAME GRID 20242025 OFF SEASON ONLY
// COMMENT OUT WHEN NHL API HAS 20242025 DATA
// UNCOMMENT
export function useNextYearsTeams() {
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    getNextSeasonsTeams().then((res) => setTeams(res));
  }, []);

  return teams;
}

export function useNextYearsTeamsMap(): { [id: number]: Team } {
  const teams = useNextYearsTeams();

  const map = useMemo(() => {
    const result = {} as any;
    teams.forEach((team) => (result[team.id] = team));
    return result;
  }, [teams]);

  return map;
}

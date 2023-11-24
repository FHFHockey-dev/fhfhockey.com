import { useEffect, useMemo, useState } from "react";
import { getTeams } from "lib/NHL/client";
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

// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\hooks\useTeams.ts

import { useEffect, useMemo, useState } from "react";
import { getTeams } from "lib/NHL/client";
import { Team } from "lib/NHL/types";
import { legacyTeamIdToAbbr, teamsInfo } from "lib/teamsInfo";

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
    const result: { [id: number]: Team } = {};

    teams.forEach((team) => {
      const info = teamsInfo[team.abbreviation];
      if (info) {
        const abbreviation = info.abbrev ?? team.abbreviation;
        result[team.id] = {
          id: team.id,
          name: info.name,
          abbreviation,
          logo: `/teamLogos/${abbreviation}.png`
        };
        return;
      }
      result[team.id] = team;
    });

    Object.entries(teamsInfo).forEach(([abbr, info]) => {
      const abbreviation = info.abbrev ?? abbr;
      if (!result[info.id]) {
        result[info.id] = {
          id: info.id,
          name: info.name,
          abbreviation,
          logo: `/teamLogos/${abbreviation}.png`
        };
      }
    });

    Object.entries(legacyTeamIdToAbbr).forEach(([legacyId, abbrKey]) => {
      const abbr = abbrKey as keyof typeof teamsInfo;
      const info = teamsInfo[abbr];
      if (!info) {
        return;
      }
      const abbreviation = info.abbrev ?? String(abbr);
      const canonical = result[info.id] ?? {
        id: info.id,
        name: info.name,
        abbreviation,
        logo: `/teamLogos/${abbreviation}.png`
      };
      result[Number(legacyId)] = {
        ...canonical,
        id: Number(legacyId)
      };
    });

    return result;
  }, [teams]);

  return map;
}

// FOR GAME GRID 20242025 OFF SEASON ONLY
// COMMENT OUT WHEN NHL API HAS 20242025 DATA
// UNCOMMENT
// export function useNextYearsTeams() {
//   const [teams, setTeams] = useState<Team[]>([]);

//   useEffect(() => {
//     getNextSeasonsTeams().then((res) => setTeams(res));
//   }, []);

//   return teams;
// }

// export function useNextYearsTeamsMap(): { [id: number]: Team } {
//   const teams = useNextYearsTeams();

//   const map = useMemo(() => {
//     const result = {} as any;
//     teams.forEach((team) => (result[team.id] = team));
//     return result;
//   }, [teams]);

//   return map;
// }

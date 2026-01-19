import { teamsInfo, getTeamAbbreviationById, getTeamInfoById } from "lib/teamsInfo";

export type TeamMeta = {
  id: number;
  abbr: string;
  name: string;
  shortName: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  logo: string;
};

export const getTeamMetaByAbbr = (abbr: string): TeamMeta | null => {
  const key = abbr.toUpperCase() as keyof typeof teamsInfo;
  const info = teamsInfo[key];
  if (!info) return null;
  return {
    id: info.id,
    abbr: info.abbrev ?? key,
    name: info.name,
    shortName: info.shortName,
    colors: {
      primary: info.primaryColor,
      secondary: info.secondaryColor,
      accent: info.accent
    },
    logo: `/teamLogos/${info.abbrev ?? key}.png`
  };
};

export const getTeamMetaById = (teamId: number): TeamMeta | null => {
  const info = getTeamInfoById(teamId);
  const abbr = getTeamAbbreviationById(teamId);
  if (!info || !abbr) return null;
  const entry = teamsInfo[abbr as keyof typeof teamsInfo];
  if (!entry) return null;
  return {
    id: entry.id,
    abbr: entry.abbrev ?? abbr,
    name: entry.name,
    shortName: entry.shortName,
    colors: {
      primary: entry.primaryColor,
      secondary: entry.secondaryColor,
      accent: entry.accent
    },
    logo: `/teamLogos/${entry.abbrev ?? abbr}.png`
  };
};

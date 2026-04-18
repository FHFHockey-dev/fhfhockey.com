import { get } from "lib/NHL/base";

export type PlayoffBracketTeam = {
  id: number;
  abbrev: string;
  name?: {
    default?: string;
    fr?: string;
  };
  commonName?: {
    default?: string;
    fr?: string;
  };
  logo?: string;
  darkLogo?: string;
};

export type PlayoffBracketSeries = {
  seriesUrl?: string;
  seriesLogo?: string;
  seriesLogoFr?: string;
  seriesTitle: string;
  seriesAbbrev: string;
  seriesLetter: string;
  playoffRound: number;
  topSeedRank: number;
  topSeedRankAbbrev: string;
  topSeedWins: number;
  bottomSeedRank: number;
  bottomSeedRankAbbrev: string;
  bottomSeedWins: number;
  topSeedTeam?: PlayoffBracketTeam;
  bottomSeedTeam?: PlayoffBracketTeam;
};

export type PlayoffBracketResponse = {
  bracketLogo?: string;
  bracketLogoFr?: string;
  bracketTitle?: {
    default?: string;
  };
  bracketSubTitle?: {
    default?: string;
  };
  series: PlayoffBracketSeries[];
};

export async function getPlayoffBracket(
  seasonYear: number
): Promise<PlayoffBracketResponse> {
  return get<PlayoffBracketResponse>(`/playoff-bracket/${seasonYear}`);
}

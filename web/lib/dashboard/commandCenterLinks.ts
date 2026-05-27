import { buildForgeHref } from "./forgeLinks";
import type { CommandCenterLinkContext } from "./commandCenterTypes";

export type CommandCenterDestinations = {
  commandCenter: string;
  legacyDashboard: string;
  startChart: string;
  trends: string;
  teamDetail: string | null;
  team: (teamAbbr: string) => string;
  forgePlayer: (playerId: number | string) => string;
  trendsPlayer: (playerId: number | string) => string;
};

export function buildCommandCenterDestinations(
  context: CommandCenterLinkContext
): CommandCenterDestinations {
  const sharedContext = {
    date: context.date,
    resolvedDate: context.resolvedDate,
    team: context.team,
    position: context.position,
    mode: context.addMode,
    slate: context.slateMode,
    returnTo: context.returnTo
  } as const;
  const selectedTeam =
    context.team && context.team !== "all" ? context.team : null;

  return {
    commandCenter: buildForgeHref("/forge/command-center", sharedContext),
    legacyDashboard: buildForgeHref("/forge/dashboard", sharedContext),
    startChart: buildForgeHref("/start-chart", sharedContext),
    trends: buildForgeHref("/trends", sharedContext),
    teamDetail: selectedTeam
      ? buildForgeHref(`/forge/team/${selectedTeam}`, sharedContext)
      : null,
    team: (teamAbbr) =>
      buildForgeHref(`/forge/team/${teamAbbr}`, sharedContext),
    forgePlayer: (playerId) =>
      buildForgeHref(`/forge/player/${playerId}`, sharedContext),
    trendsPlayer: (playerId) =>
      buildForgeHref(`/trends/player/${playerId}`, sharedContext)
  };
}

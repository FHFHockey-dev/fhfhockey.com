export type CommandCenterPosition = "all" | "f" | "d" | "g";

export type CommandCenterSlateMode = "main" | "all";

export type CommandCenterAddMode = "tonight" | "week";

export type CommandCenterModuleStatus =
  | "loading"
  | "ready"
  | "empty"
  | "partial"
  | "stale"
  | "error";

export type CommandCenterRouteState = {
  date: string;
  resolvedDate: string | null;
  team: string;
  position: CommandCenterPosition;
  slateMode: CommandCenterSlateMode;
  addMode: CommandCenterAddMode;
};

export type CommandCenterLinkContext = CommandCenterRouteState & {
  returnTo?: string | null;
};

export type CommandCenterModuleContract = {
  id:
    | "team_power"
    | "focused_slate"
    | "top_adds"
    | "player_insight"
    | "goalie_context"
    | "run_status";
  label: string;
  sourceApis: string[];
  sourceTables: string[];
  freshnessExpectation: string;
  fallbackStrategy: string;
  emptyStateRule: string;
  clickDestination: string;
};

export type CommandCenterModuleState<T> = {
  status: CommandCenterModuleStatus;
  data: T;
  requestedDate: string | null;
  resolvedDate: string | null;
  fallbackApplied: boolean;
  message: string | null;
  error: string | null;
  contract: CommandCenterModuleContract;
};

export type CommandCenterMixedState = {
  requestedDate: string;
  resolvedDates: string[];
  hasMixedDates: boolean;
  fallbackModuleIds: CommandCenterModuleContract["id"][];
  message: string | null;
};

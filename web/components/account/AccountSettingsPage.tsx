import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/router";

import { useAuth } from "contexts/AuthProviderContext";
import supabase from "lib/supabase/client";
import {
  createDefaultUserLeagueSettings,
  type LeagueType,
  type UserLeagueSettings,
} from "lib/user-settings/defaults";
import {
  mapLeagueSettingsToUserSettingsUpsert,
  mapUserSettingsRowToLeagueSettings,
} from "lib/user-settings/mappers";
import type { Database, Json } from "lib/supabase/database-generated.types";
import {
  YAHOO_CONNECT_DEFAULT_NEXT,
  YAHOO_PROVIDER,
} from "lib/integrations/yahoo/config";

import FantraxImportPanel from "./FantraxImportPanel";
import EspnImportPanel from "./EspnImportPanel";
import PatreonConnectionPanel from "./PatreonConnectionPanel";

import styles from "./AccountSettingsPage.module.scss";

type SavedTeamRow = Database["public"]["Tables"]["user_saved_teams"]["Row"];
type ConnectedAccountRow =
  Database["public"]["Tables"]["connected_accounts"]["Row"];
type ExternalLeagueRow =
  Database["public"]["Tables"]["external_leagues"]["Row"];
type ExternalTeamRow = Database["public"]["Tables"]["external_teams"]["Row"];
type ProviderSyncRunRow =
  Database["public"]["Tables"]["provider_sync_runs"]["Row"];
type UserProviderPreferencesRow =
  Database["public"]["Tables"]["user_provider_preferences"]["Row"];
type JsonObject = Record<string, Json | undefined>;

type AccountSection =
  | "profile"
  | "league-settings"
  | "saved-teams"
  | "connected-accounts"
  | "patreon";

type LeagueSettingsView = "scoring" | "categories" | "roster" | "context";
type ConnectedAccountsView = "yahoo" | "fantrax" | "espn";
type AccountIconName =
  | "accounts"
  | "chevron"
  | "external"
  | "leagues"
  | "link"
  | "profile"
  | "save"
  | "teams"
  | "timezone"
  | "verified";

type ProfileSummaryCounts = {
  connectedLeagues: number | null;
  savedTeams: number | null;
  connectedAccounts: number | null;
};

const EMPTY_PROFILE_SUMMARY_COUNTS: ProfileSummaryCounts = {
  connectedLeagues: null,
  savedTeams: null,
  connectedAccounts: null,
};

const LEAGUE_SETTINGS_VIEWS: Array<{
  key: LeagueSettingsView;
  label: string;
}> = [
  { key: "scoring", label: "Points scoring" },
  { key: "categories", label: "Category weights" },
  { key: "roster", label: "Roster" },
  { key: "context", label: "Yahoo context" },
];

const CONNECTED_ACCOUNT_VIEWS: Array<{
  key: ConnectedAccountsView;
  label: string;
}> = [
  { key: "yahoo", label: "Yahoo Fantasy" },
  { key: "fantrax", label: "Fantrax import" },
  { key: "espn", label: "ESPN import" },
];

const SECTION_CONFIG: Record<
  AccountSection,
  {
    label: string;
    description: string;
    title: string;
    body: string;
  }
> = {
  profile: {
    label: "Profile",
    description: "Name, avatar, and timezone",
    title: "Profile",
    body: "Manage how your account appears across FHFH.",
  },
  "league-settings": {
    label: "League Settings",
    description: "Scoring, roster, and league defaults",
    title: "League Defaults",
    body: "Set the scoring and roster defaults used by your fantasy tools.",
  },
  "saved-teams": {
    label: "Saved Teams",
    description: "Reusable teams and notes",
    title: "Saved Teams",
    body: "Create, edit, and choose a default team.",
  },
  "connected-accounts": {
    label: "Connected Accounts",
    description: "Yahoo, Fantrax, and ESPN",
    title: "Connected Accounts",
    body: "Connect Yahoo or import league data from Fantrax and ESPN.",
  },
  patreon: {
    label: "Patreon",
    description: "Membership and supporter access",
    title: "Patreon",
    body: "Link Patreon and review your supporter status.",
  },
};

const ACCOUNT_ICON_PATHS: Record<AccountIconName, ReactNode> = {
    accounts: (
      <>
        <path d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M2.5 21v-2.5A4.5 4.5 0 0 1 7 14h2a4.5 4.5 0 0 1 4.5 4.5V21" />
        <path d="M16 4.5a3.5 3.5 0 0 1 0 6.8M16 14h.5a5 5 0 0 1 5 5v2" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    external: (
      <>
        <path d="M14 4h6v6" />
        <path d="m20 4-9 9" />
        <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
      </>
    ),
    leagues: (
      <>
        <path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" />
        <path d="M9 14h6M12 11v6M8 20h8" />
        <path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 21v-2.5A6.5 6.5 0 0 1 12 12a6.5 6.5 0 0 1 6.5 6.5V21Z" />
      </>
    ),
    save: (
      <>
        <path d="M5 4h12l2 2v14H5Z" />
        <path d="M8 4v6h8V4M8 20v-6h8v6" />
      </>
    ),
    teams: (
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2M15 14h1a5 5 0 0 1 5 5v1" />
      </>
    ),
    timezone: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </>
    ),
    verified: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
};

function AccountIcon({
  name,
  className,
}: {
  name: AccountIconName;
  className?: string;
}) {

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ACCOUNT_ICON_PATHS[name]}
    </svg>
  );
}

function AccountPageHero({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className={styles.profileHero} aria-labelledby="profile-title">
      <div className={styles.profileHeroContent}>
        <div className={styles.profileHeroIcon}>
          <AccountIcon name="profile" />
        </div>
        <div>
          <h1 id="profile-title" className={styles.profileHeroTitle}>
            {title}
          </h1>
          <p className={styles.profileHeroBody}>{description}</p>
        </div>
      </div>

      <svg
        className={styles.profileHeroGraph}
        viewBox="0 0 760 150"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M8 126 C80 112 110 84 178 90 S276 116 326 74 S398 44 454 82 S537 109 596 78 S672 66 748 52"
        />
        {[178, 326, 454, 596, 748].map((cx, index) => {
          const cy = [90, 74, 82, 78, 52][index];
          return <circle key={cx} cx={cx} cy={cy} r={index === 4 ? 3 : 2} />;
        })}
      </svg>
    </section>
  );
}

function getSafeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function resolveSection(
  sectionValue: string | string[] | undefined,
): AccountSection {
  const rawSection = Array.isArray(sectionValue)
    ? sectionValue[0]
    : sectionValue;
  if (
    rawSection === "profile" ||
    rawSection === "league-settings" ||
    rawSection === "saved-teams" ||
    rawSection === "connected-accounts" ||
    rawSection === "patreon"
  ) {
    return rawSection;
  }

  return "profile";
}

function getUserInitials(label?: string | null) {
  const trimmed = (label || "").trim();
  if (!trimmed) return "U";

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function getSavedTeamNotes(rosterJson: Json) {
  if (
    !rosterJson ||
    Array.isArray(rosterJson) ||
    typeof rosterJson !== "object"
  ) {
    return "";
  }

  const manualNotes = rosterJson.manualNotes;
  return typeof manualNotes === "string" ? manualNotes : "";
}

function formatSavedTeamTimestamp(timestamp: string) {
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) {
    return "Unknown";
  }

  return value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getSavedTeamLeagueType(settingsSnapshot: Json) {
  if (
    !settingsSnapshot ||
    Array.isArray(settingsSnapshot) ||
    typeof settingsSnapshot !== "object"
  ) {
    return "points";
  }

  return settingsSnapshot.league_type === "categories"
    ? "categories"
    : "points";
}

function getYahooTeamMetadata(team: ExternalTeamRow) {
  return team.team_metadata &&
    !Array.isArray(team.team_metadata) &&
    typeof team.team_metadata === "object"
    ? team.team_metadata
    : {};
}

function isOwnedYahooTeam(team: ExternalTeamRow) {
  return getYahooTeamMetadata(team).is_owned !== false;
}

function getYahooTeamStandingRank(team: ExternalTeamRow) {
  const standings = getYahooTeamMetadata(team).standings;
  if (!standings || Array.isArray(standings) || typeof standings !== "object") {
    return null;
  }

  return typeof standings.rank === "number" ||
    typeof standings.rank === "string"
    ? String(standings.rank)
    : null;
}

function getYahooTeamRosterRows(rosterSnapshot: Json | null | undefined) {
  if (!isJsonObject(rosterSnapshot)) {
    return [];
  }

  return getJsonArray(rosterSnapshot.players).flatMap((entry, index) => {
    if (!isJsonObject(entry)) {
      return [];
    }

    const player = isJsonObject(entry.player) ? entry.player : entry;
    const name = isJsonObject(player.name) ? player.name : null;
    const selectedPosition = isJsonObject(player.selected_position)
      ? player.selected_position
      : null;
    const fullName =
      getJsonText(name?.full) ||
      [getJsonText(name?.first), getJsonText(name?.last)]
        .filter(Boolean)
        .join(" ") ||
      getJsonText(player.name) ||
      getJsonText(player.player_key) ||
      `Yahoo player ${index + 1}`;
    const position =
      getJsonText(selectedPosition?.position) ||
      getJsonText(player.display_position) ||
      getJsonText(player.primary_position) ||
      "—";

    return [
      {
        key: getJsonText(player.player_key) || `${fullName}-${index}`,
        name: fullName,
        position,
      },
    ];
  });
}

function getQueryParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isJsonObject(value: Json | null | undefined): value is JsonObject {
  return Boolean(value) && !Array.isArray(value) && typeof value === "object";
}

function getJsonArray(value: Json | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function getJsonText(value: Json | null | undefined) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return null;
}

function formatPluralSlots(count: string, label: "starting" | "bench") {
  const numericCount = Number(count);
  const slotCount = Number.isFinite(numericCount) ? numericCount : count;
  const isSingular = slotCount === 1 || slotCount === "1";
  return `${slotCount} ${label} ${isSingular ? "slot" : "slots"}`;
}

function getYahooLeagueMetadataValue(
  league: ExternalLeagueRow | null,
  key: string,
) {
  if (!league || !isJsonObject(league.league_metadata)) {
    return null;
  }

  return getJsonText(league.league_metadata[key]);
}

function getYahooLeagueScoringRows(scoringSettings: Json | null | undefined) {
  if (!isJsonObject(scoringSettings)) {
    return [];
  }

  const modifierMap = new Map<string, string>();
  const statModifiers = isJsonObject(scoringSettings.stat_modifiers)
    ? scoringSettings.stat_modifiers
    : null;

  getJsonArray(statModifiers?.stats).forEach((entry) => {
    if (!isJsonObject(entry)) {
      return;
    }

    const stat = isJsonObject(entry.stat) ? entry.stat : entry;
    const statId = getJsonText(stat.stat_id);
    const value = getJsonText(stat.value);

    if (!statId || !value) {
      return;
    }

    modifierMap.set(statId, value);
  });

  return getJsonArray(scoringSettings.stat_categories).flatMap(
    (entry, index) => {
      if (!isJsonObject(entry)) {
        return [];
      }

      const statId = getJsonText(entry.stat_id) || `category-${index}`;
      const abbreviation =
        getJsonText(entry.display_name) || getJsonText(entry.abbr);
      const name = getJsonText(entry.name) || abbreviation || `Stat ${statId}`;
      const label =
        abbreviation && abbreviation !== name
          ? `${name} (${abbreviation})`
          : name;
      const modifierValue = modifierMap.get(statId);

      return [
        {
          key: statId,
          label,
          value: modifierValue ? `${modifierValue} pts` : "Enabled",
        },
      ];
    },
  );
}

function getYahooLeagueRosterRows(rosterSettings: Json | null | undefined) {
  if (!isJsonObject(rosterSettings)) {
    return [];
  }

  return getJsonArray(rosterSettings.roster_positions).flatMap(
    (entry, index) => {
      if (!isJsonObject(entry)) {
        return [];
      }

      const position = getJsonText(entry.position) || `Slot ${index + 1}`;
      const count = getJsonText(entry.count) || "0";
      const isStarting = getJsonText(entry.is_starting_position) === "1";

      return [
        {
          key: `${position}-${index}`,
          label: position,
          value: formatPluralSlots(count, isStarting ? "starting" : "bench"),
        },
      ];
    },
  );
}

function buildManualActiveContext() {
  return {
    source_type: "manual",
    provider: null,
    external_league_id: null,
    external_team_id: null,
    external_league_key: null,
    external_team_key: null,
  };
}

const SETTING_LABELS: Record<string, string> = {
  goals: "Goals",
  assists: "Assists",
  pp_points: "Power-play points",
  shots_on_goal: "Shots on goal",
  hits: "Hits",
  blocked_shots: "Blocked shots",
  wins_goalie: "Goalie wins",
  saves_goalie: "Goalie saves",
  save_percentage: "Save percentage",
  c: "Centers",
  lw: "Left wings",
  rw: "Right wings",
  d: "Defense",
  g: "Goalies",
  bench: "Bench",
  utility: "Utility",
};

function getSettingLabel(key: string) {
  return (
    SETTING_LABELS[key.toLowerCase()] ||
    key
      .replaceAll("_", " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const userDisplayName = user?.displayName ?? "";
  const userAvatarUrl = user?.avatarUrl ?? "";
  const [leagueForm, setLeagueForm] = useState<UserLeagueSettings>(
    createDefaultUserLeagueSettings(),
  );
  const [profileForm, setProfileForm] = useState({
    displayName: "",
    avatarUrl: "",
    timezone: "",
  });
  const [profileRecordState, setProfileRecordState] = useState<
    "unknown" | "present" | "missing" | "error"
  >("unknown");
  const [leagueRecordState, setLeagueRecordState] = useState<
    "unknown" | "present" | "missing" | "error"
  >("unknown");
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileSummaryCounts, setProfileSummaryCounts] =
    useState<ProfileSummaryCounts>(EMPTY_PROFILE_SUMMARY_COUNTS);
  const [isProfileSummaryLoading, setIsProfileSummaryLoading] = useState(true);
  const [isLeagueLoading, setIsLeagueLoading] = useState(true);
  const [isLeagueSaving, setIsLeagueSaving] = useState(false);
  const [savedTeams, setSavedTeams] = useState<SavedTeamRow[]>([]);
  const [savedTeamForm, setSavedTeamForm] = useState({
    name: "",
    manualNotes: "",
    isDefault: false,
  });
  const [editingSavedTeamId, setEditingSavedTeamId] = useState<string | null>(
    null,
  );
  const [isSavedTeamsLoading, setIsSavedTeamsLoading] = useState(false);
  const [isSavedTeamSaving, setIsSavedTeamSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [leagueFeedback, setLeagueFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [savedTeamsFeedback, setSavedTeamsFeedback] = useState<{
    tone: "error" | "success";
    message: string;
  } | null>(null);
  const [yahooConnectedAccount, setYahooConnectedAccount] =
    useState<ConnectedAccountRow | null>(null);
  const [yahooLeagues, setYahooLeagues] = useState<ExternalLeagueRow[]>([]);
  const [yahooTeams, setYahooTeams] = useState<ExternalTeamRow[]>([]);
  const [yahooPreferences, setYahooPreferences] =
    useState<UserProviderPreferencesRow | null>(null);
  const [yahooLatestSyncRun, setYahooLatestSyncRun] =
    useState<ProviderSyncRunRow | null>(null);
  const [isYahooLoading, setIsYahooLoading] = useState(false);
  const [isYahooActionLoading, setIsYahooActionLoading] = useState(false);
  const [yahooRosterLoadingTeamId, setYahooRosterLoadingTeamId] = useState<
    string | null
  >(null);
  const [expandedYahooRosterTeamId, setExpandedYahooRosterTeamId] = useState<
    string | null
  >(null);
  const [yahooFeedback, setYahooFeedback] = useState<{
    tone: "error" | "success" | "info";
    message: string;
  } | null>(null);
  const [leagueSettingsView, setLeagueSettingsView] =
    useState<LeagueSettingsView>("scoring");
  const [connectedAccountsView, setConnectedAccountsView] =
    useState<ConnectedAccountsView>("yahoo");
  const timezoneInputRef = useRef<HTMLInputElement>(null);

  const activeSection = useMemo(
    () => resolveSection(router.query.section),
    [router.query.section],
  );
  const sectionConfig = SECTION_CONFIG[activeSection];
  const resolvedDisplayName =
    profileForm.displayName.trim() ||
    user?.displayName ||
    user?.email ||
    "Authenticated User";
  const resolvedAvatarUrl =
    profileForm.avatarUrl.trim() || user?.avatarUrl || "";
  const safeAvatarLink = useMemo(
    () => getSafeHttpUrl(resolvedAvatarUrl),
    [resolvedAvatarUrl],
  );
  const yahooDefaultTeam = useMemo(
    () =>
      yahooTeams.find(
        (team) => team.id === yahooPreferences?.default_external_team_id,
      ) || null,
    [yahooPreferences?.default_external_team_id, yahooTeams],
  );
  const yahooRefreshBlocked = Boolean(
    yahooLatestSyncRun &&
    (((yahooLatestSyncRun.status === "running" ||
      yahooLatestSyncRun.status === "queued") &&
      Date.now() -
        new Date(
          yahooLatestSyncRun.started_at || yahooLatestSyncRun.created_at,
        ).getTime() <
        15 * 60 * 1000) ||
      (yahooLatestSyncRun.cooldown_until &&
        new Date(yahooLatestSyncRun.cooldown_until).getTime() > Date.now())),
  );
  const yahooDefaultLeague = useMemo(
    () =>
      yahooLeagues.find(
        (league) =>
          league.id ===
          (yahooPreferences?.default_external_league_id ||
            yahooDefaultTeam?.external_league_id ||
            null),
      ) || null,
    [
      yahooDefaultTeam?.external_league_id,
      yahooLeagues,
      yahooPreferences?.default_external_league_id,
    ],
  );
  const activeYahooLeague = useMemo(() => {
    const activeYahooLeagueId =
      leagueForm.activeContext.provider === YAHOO_PROVIDER
        ? leagueForm.activeContext.external_league_id
        : null;

    return (
      yahooLeagues.find((league) => league.id === activeYahooLeagueId) ||
      yahooDefaultLeague ||
      yahooLeagues[0] ||
      null
    );
  }, [
    leagueForm.activeContext.external_league_id,
    leagueForm.activeContext.provider,
    yahooDefaultLeague,
    yahooLeagues,
  ]);
  const activeYahooTeam = useMemo(() => {
    const activeYahooTeamId =
      leagueForm.activeContext.provider === YAHOO_PROVIDER
        ? leagueForm.activeContext.external_team_id
        : null;

    return (
      yahooTeams.find(
        (team) => team.id === activeYahooTeamId && isOwnedYahooTeam(team),
      ) ||
      yahooTeams.find(
        (team) =>
          team.id === yahooPreferences?.default_external_team_id &&
          team.external_league_id === activeYahooLeague?.id &&
          isOwnedYahooTeam(team),
      ) ||
      yahooTeams.find(
        (team) =>
          team.external_league_id === activeYahooLeague?.id &&
          isOwnedYahooTeam(team),
      ) ||
      null
    );
  }, [
    activeYahooLeague?.id,
    leagueForm.activeContext.external_team_id,
    leagueForm.activeContext.provider,
    yahooPreferences?.default_external_team_id,
    yahooTeams,
  ]);
  const yahooLeagueScoringRows = useMemo(
    () => getYahooLeagueScoringRows(activeYahooLeague?.scoring_settings),
    [activeYahooLeague?.scoring_settings],
  );
  const yahooLeagueRosterRows = useMemo(
    () => getYahooLeagueRosterRows(activeYahooLeague?.roster_settings),
    [activeYahooLeague?.roster_settings],
  );
  const yahooTeamsForActiveLeague = useMemo(
    () =>
      activeYahooLeague
        ? yahooTeams.filter(
            (team) =>
              team.external_league_id === activeYahooLeague.id &&
              isOwnedYahooTeam(team),
          )
        : [],
    [activeYahooLeague, yahooTeams],
  );

  function updateSection(section: AccountSection) {
    void router.replace(
      {
        pathname: "/account",
        query: { section },
      },
      undefined,
      { shallow: true },
    );
  }

  useEffect(() => {
    if (!userId) {
      setIsProfileLoading(false);
      setProfileRecordState("missing");
      return;
    }

    const currentUserId = userId;
    let isMounted = true;

    async function loadProfile() {
      setIsProfileLoading(true);
      setProfileFeedback(null);

      const { data, error } = await supabase
        .from("user_profiles")
        .select("display_name, avatar_url, timezone")
        .eq("user_id", currentUserId)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error) {
        setProfileRecordState("error");
        setProfileFeedback({
          tone: "error",
          message: error.message,
        });
        setIsProfileLoading(false);
        return;
      }

      setProfileRecordState(data ? "present" : "missing");
      setProfileForm({
        displayName: data?.display_name || userDisplayName || "",
        avatarUrl: data?.avatar_url || userAvatarUrl || "",
        timezone: data?.timezone || "",
      });
      setIsProfileLoading(false);
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [userAvatarUrl, userDisplayName, userId]);

  useEffect(() => {
    if (!userId || activeSection !== "profile") {
      return;
    }

    const currentUserId = userId;
    let isMounted = true;

    async function loadProfileSummary() {
      setIsProfileSummaryLoading(true);

      const [leaguesResponse, teamsResponse, accountsResponse] =
        await Promise.all([
          supabase
            .from("external_leagues")
            .select("id", { count: "exact", head: true })
            .eq("user_id", currentUserId),
          supabase
            .from("user_saved_teams")
            .select("id", { count: "exact", head: true })
            .eq("user_id", currentUserId),
          supabase
            .from("connected_accounts")
            .select("id", { count: "exact", head: true })
            .eq("user_id", currentUserId),
        ]);

      if (!isMounted) {
        return;
      }

      setProfileSummaryCounts({
        connectedLeagues: leaguesResponse.error
          ? null
          : (leaguesResponse.count ?? 0),
        savedTeams: teamsResponse.error ? null : (teamsResponse.count ?? 0),
        connectedAccounts: accountsResponse.error
          ? null
          : (accountsResponse.count ?? 0),
      });
      setIsProfileSummaryLoading(false);
    }

    void loadProfileSummary();

    return () => {
      isMounted = false;
    };
  }, [activeSection, userId]);

  useEffect(() => {
    if (!userId) {
      setLeagueForm(createDefaultUserLeagueSettings());
      setIsLeagueLoading(false);
      setLeagueRecordState("missing");
      return;
    }

    const currentUserId = userId;
    let isMounted = true;

    async function loadLeagueSettings() {
      setIsLeagueLoading(true);
      setLeagueFeedback(null);

      const { data, error } = await supabase
        .from("user_settings")
        .select(
          "league_type, scoring_categories, goalie_scoring_categories, category_weights, roster_config, team_count, draft_order_type, ui_preferences, active_context",
        )
        .eq("user_id", currentUserId)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error) {
        setLeagueRecordState("error");
        setLeagueFeedback({
          tone: "error",
          message: error.message,
        });
        setLeagueForm(createDefaultUserLeagueSettings());
        setIsLeagueLoading(false);
        return;
      }

      setLeagueRecordState(data ? "present" : "missing");
      setLeagueForm(mapUserSettingsRowToLeagueSettings(data));
      setIsLeagueLoading(false);
    }

    void loadLeagueSettings();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || activeSection !== "saved-teams") {
      return;
    }

    const currentUserId = userId;
    let isMounted = true;

    async function loadSavedTeams() {
      setIsSavedTeamsLoading(true);

      const { data, error } = await supabase
        .from("user_saved_teams")
        .select("*")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });

      if (!isMounted) {
        return;
      }

      if (error) {
        setSavedTeamsFeedback({
          tone: "error",
          message: error.message,
        });
        setSavedTeams([]);
        setIsSavedTeamsLoading(false);
        return;
      }

      const nextTeams = data || [];
      setSavedTeams(nextTeams);
      if (!editingSavedTeamId) {
        setSavedTeamForm((current) => ({
          ...current,
          isDefault: nextTeams.length === 0,
        }));
      }
      setIsSavedTeamsLoading(false);
    }

    void loadSavedTeams();

    return () => {
      isMounted = false;
    };
  }, [activeSection, editingSavedTeamId, userId]);

  const reloadYahooState = useCallback(async () => {
    if (!userId) {
      setYahooConnectedAccount(null);
      setYahooLeagues([]);
      setYahooTeams([]);
      setYahooPreferences(null);
      setYahooLatestSyncRun(null);
      return;
    }

    const [
      accountResponse,
      leagueResponse,
      teamResponse,
      preferencesResponse,
      syncRunResponse,
    ] = await Promise.all([
      supabase
        .from("connected_accounts")
        .select("*")
        .eq("user_id", userId)
        .eq("provider", YAHOO_PROVIDER)
        .maybeSingle(),
      supabase
        .from("external_leagues")
        .select("*")
        .eq("user_id", userId)
        .eq("provider", YAHOO_PROVIDER)
        .order("league_name", { ascending: true }),
      supabase
        .from("external_teams")
        .select("*")
        .eq("user_id", userId)
        .eq("provider", YAHOO_PROVIDER)
        .order("team_name", { ascending: true }),
      supabase
        .from("user_provider_preferences")
        .select("*")
        .eq("user_id", userId)
        .eq("provider", YAHOO_PROVIDER)
        .maybeSingle(),
      supabase
        .from("provider_sync_runs")
        .select("*")
        .eq("user_id", userId)
        .eq("provider", YAHOO_PROVIDER)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (accountResponse.error) {
      throw accountResponse.error;
    }
    if (leagueResponse.error) {
      throw leagueResponse.error;
    }
    if (teamResponse.error) {
      throw teamResponse.error;
    }
    if (preferencesResponse.error) {
      throw preferencesResponse.error;
    }
    if (syncRunResponse.error) {
      throw syncRunResponse.error;
    }

    setYahooConnectedAccount(accountResponse.data);
    setYahooLeagues(leagueResponse.data || []);
    setYahooTeams(teamResponse.data || []);
    setYahooPreferences(preferencesResponse.data);
    setYahooLatestSyncRun(syncRunResponse.data);
  }, [userId]);

  useEffect(() => {
    if (
      !userId ||
      (activeSection !== "connected-accounts" &&
        activeSection !== "league-settings" &&
        activeSection !== "saved-teams")
    ) {
      return;
    }

    let isMounted = true;

    async function loadYahooState() {
      setIsYahooLoading(true);

      try {
        await reloadYahooState();

        if (!isMounted) {
          return;
        }

        const yahooStatus = getQueryParamValue(router.query.yahoo_status);
        const yahooMessage = getQueryParamValue(router.query.yahoo_message);

        if (yahooStatus && yahooMessage) {
          setYahooFeedback({
            tone: yahooStatus === "error" ? "error" : "success",
            message: yahooMessage,
          });
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setYahooFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load Yahoo connection state.",
        });
      } finally {
        if (isMounted) {
          setIsYahooLoading(false);
        }
      }
    }

    void loadYahooState();

    return () => {
      isMounted = false;
    };
  }, [
    activeSection,
    router.query.yahoo_message,
    router.query.yahoo_status,
    reloadYahooState,
    userId,
  ]);

  function updateProfileField(field: keyof typeof profileForm, value: string) {
    setProfileForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user?.id) {
      return;
    }

    setIsProfileSaving(true);
    setProfileFeedback(null);

    const { error } = await supabase.from("user_profiles").upsert(
      {
        user_id: user.id,
        display_name: profileForm.displayName.trim() || null,
        avatar_url: profileForm.avatarUrl.trim() || null,
        timezone: profileForm.timezone.trim() || null,
      },
      {
        onConflict: "user_id",
      },
    );

    if (error) {
      setProfileFeedback({
        tone: "error",
        message: error.message,
      });
      setIsProfileSaving(false);
      return;
    }

    setProfileFeedback({
      tone: "success",
      message: "Profile settings saved.",
    });
    setProfileRecordState("present");
    setIsProfileSaving(false);
  }

  function updateLeagueType(value: LeagueType) {
    setLeagueForm((current) => ({
      ...current,
      leagueType: value,
      uiPreferences: {
        ...current.uiPreferences,
        account_settings_section: "league-settings",
      },
    }));
  }

  function updateLeagueNumberField(
    group:
      | "scoringCategories"
      | "goalieScoringCategories"
      | "categoryWeights"
      | "rosterConfig",
    key: string,
    value: string,
  ) {
    const nextValue = value === "" ? 0 : Number(value);
    setLeagueForm((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [key]: Number.isFinite(nextValue) ? nextValue : 0,
      },
    }));
  }

  function resetLeagueDefaults() {
    setLeagueFeedback(null);
    setLeagueForm(createDefaultUserLeagueSettings());
  }

  async function handleLeagueSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user?.id) {
      return;
    }

    setIsLeagueSaving(true);
    setLeagueFeedback(null);

    const { error } = await supabase.from("user_settings").upsert(
      mapLeagueSettingsToUserSettingsUpsert(user.id, {
        ...leagueForm,
        uiPreferences: {
          ...leagueForm.uiPreferences,
          account_settings_section: "league-settings",
        },
      }),
      {
        onConflict: "user_id",
      },
    );

    if (error) {
      setLeagueFeedback({
        tone: "error",
        message: error.message,
      });
      setIsLeagueSaving(false);
      return;
    }

    setLeagueFeedback({
      tone: "success",
      message: "League defaults saved.",
    });
    setLeagueRecordState("present");
    setIsLeagueSaving(false);
  }

  function resetSavedTeamForm(nextHasTeams = savedTeams.length > 0) {
    setEditingSavedTeamId(null);
    setSavedTeamForm({
      name: "",
      manualNotes: "",
      isDefault: !nextHasTeams,
    });
  }

  function updateSavedTeamField(
    field: keyof typeof savedTeamForm,
    value: string | boolean,
  ) {
    setSavedTeamForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function reloadSavedTeams() {
    if (!user?.id) {
      return [];
    }

    const { data, error } = await supabase
      .from("user_saved_teams")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const nextTeams = data || [];
    setSavedTeams(nextTeams);
    return nextTeams;
  }

  async function clearOtherDefaultSavedTeams(nextDefaultId?: string | null) {
    if (!user?.id) {
      return;
    }

    const teamsToClear = savedTeams.filter(
      (team) => team.is_default && team.id !== nextDefaultId,
    );

    await Promise.all(
      teamsToClear.map(async (team) => {
        const { error } = await supabase
          .from("user_saved_teams")
          .update({ is_default: false })
          .eq("id", team.id);

        if (error) {
          throw error;
        }
      }),
    );
  }

  async function handleSavedTeamSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user?.id) {
      return;
    }

    const trimmedName = savedTeamForm.name.trim();
    if (!trimmedName) {
      setSavedTeamsFeedback({
        tone: "error",
        message: "Team name is required.",
      });
      return;
    }

    const shouldBeDefault =
      savedTeamForm.isDefault ||
      (editingSavedTeamId === null &&
        savedTeams.every((team) => !team.is_default));

    setIsSavedTeamSaving(true);
    setSavedTeamsFeedback(null);

    try {
      if (shouldBeDefault) {
        await clearOtherDefaultSavedTeams(editingSavedTeamId);
      }

      const { user_id: _ignoredUserId, ...settingsSnapshot } =
        mapLeagueSettingsToUserSettingsUpsert(user.id, leagueForm);

      const payload = {
        user_id: user.id,
        name: trimmedName,
        source_type: "manual",
        provider: null,
        external_team_key: null,
        external_league_key: null,
        roster_json: {
          manualNotes: savedTeamForm.manualNotes.trim(),
        },
        settings_snapshot: settingsSnapshot,
        is_default: shouldBeDefault,
      };

      if (editingSavedTeamId) {
        const { error } = await supabase
          .from("user_saved_teams")
          .update(payload)
          .eq("id", editingSavedTeamId);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("user_saved_teams")
          .insert(payload);

        if (error) {
          throw error;
        }
      }

      await reloadSavedTeams();
      resetSavedTeamForm(true);
      setSavedTeamsFeedback({
        tone: "success",
        message: editingSavedTeamId
          ? "Saved team updated."
          : "Saved team created.",
      });
    } catch (error) {
      setSavedTeamsFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Unable to save team.",
      });
    } finally {
      setIsSavedTeamSaving(false);
    }
  }

  function handleEditSavedTeam(team: SavedTeamRow) {
    setEditingSavedTeamId(team.id);
    setSavedTeamForm({
      name: team.name,
      manualNotes: getSavedTeamNotes(team.roster_json),
      isDefault: team.is_default,
    });
    setSavedTeamsFeedback(null);
  }

  async function handleSetDefaultSavedTeam(team: SavedTeamRow) {
    if (!user?.id || team.is_default) {
      return;
    }

    setSavedTeamsFeedback(null);

    try {
      await clearOtherDefaultSavedTeams(team.id);

      const { error } = await supabase
        .from("user_saved_teams")
        .update({ is_default: true })
        .eq("id", team.id);

      if (error) {
        throw error;
      }

      await reloadSavedTeams();
      if (editingSavedTeamId === team.id) {
        setSavedTeamForm((current) => ({
          ...current,
          isDefault: true,
        }));
      }
      setSavedTeamsFeedback({
        tone: "success",
        message: `"${team.name}" is now the default team.`,
      });
    } catch (error) {
      setSavedTeamsFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to change default team.",
      });
    }
  }

  async function handleDeleteSavedTeam(team: SavedTeamRow) {
    if (!user?.id) {
      return;
    }

    setSavedTeamsFeedback(null);

    try {
      const { error } = await supabase
        .from("user_saved_teams")
        .delete()
        .eq("id", team.id);

      if (error) {
        throw error;
      }

      const nextTeams = await reloadSavedTeams();
      if (editingSavedTeamId === team.id) {
        resetSavedTeamForm(nextTeams.length > 0);
      }
      setSavedTeamsFeedback({
        tone: "success",
        message: `"${team.name}" was removed.`,
      });
    } catch (error) {
      setSavedTeamsFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Unable to delete team.",
      });
    }
  }

  async function handleYahooConnect() {
    setYahooFeedback(null);
    setIsYahooActionLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("You must be signed in before connecting Yahoo.");
      }

      const response = await fetch("/api/v1/account/yahoo/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          next: YAHOO_CONNECT_DEFAULT_NEXT,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.authorizationUrl) {
        throw new Error(
          payload.error || "Unable to begin Yahoo authentication.",
        );
      }

      window.location.assign(payload.authorizationUrl);
    } catch (error) {
      setYahooFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to begin Yahoo authentication.",
      });
      setIsYahooActionLoading(false);
    }
  }

  async function handleYahooDisconnect() {
    setYahooFeedback(null);
    setIsYahooActionLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("You must be signed in before disconnecting Yahoo.");
      }

      const response = await fetch("/api/v1/account/yahoo/disconnect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to disconnect Yahoo.");
      }

      await reloadYahooState();
      setYahooFeedback({
        tone: "success",
        message: payload.message || "Yahoo Fantasy disconnected.",
      });
    } catch (error) {
      setYahooFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to disconnect Yahoo.",
      });
    } finally {
      setIsYahooActionLoading(false);
    }
  }

  async function handleYahooRefresh() {
    setYahooFeedback(null);
    setIsYahooActionLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("You must be signed in before refreshing Yahoo.");
      }

      const response = await fetch("/api/v1/account/yahoo/refresh", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to refresh Yahoo.");
      }

      await reloadYahooState();
      setYahooFeedback({
        tone: "success",
        message: payload.message || "Yahoo Fantasy refreshed.",
      });
    } catch (error) {
      setYahooFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Unable to refresh Yahoo.",
      });
    } finally {
      setIsYahooActionLoading(false);
    }
  }

  async function handleYahooTeamRoster(team: ExternalTeamRow) {
    if (expandedYahooRosterTeamId === team.id) {
      setExpandedYahooRosterTeamId(null);
      return;
    }

    setYahooFeedback(null);
    setYahooRosterLoadingTeamId(team.id);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("You must be signed in before loading a Yahoo roster.");
      }

      const response = await fetch("/api/v1/account/yahoo/team-roster", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ externalTeamId: team.id }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load the Yahoo roster.");
      }

      setYahooTeams((currentTeams) =>
        currentTeams.map((currentTeam) =>
          currentTeam.id === team.id
            ? {
                ...currentTeam,
                roster_snapshot: payload.rosterSnapshot,
                updated_at: payload.fetchedAt || currentTeam.updated_at,
              }
            : currentTeam,
        ),
      );
      setExpandedYahooRosterTeamId(team.id);
      setYahooFeedback({
        tone: "success",
        message:
          payload.message ||
          `Loaded the roster for ${team.team_name || "Yahoo team"}.`,
      });
    } catch (error) {
      setYahooFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load the Yahoo roster.",
      });
    } finally {
      setYahooRosterLoadingTeamId(null);
    }
  }

  async function handleSetYahooDefaultTeam(team: ExternalTeamRow) {
    if (!user?.id || !yahooConnectedAccount) {
      return;
    }

    const league =
      yahooLeagues.find((item) => item.id === team.external_league_id) || null;
    const activeContext = {
      provider: YAHOO_PROVIDER,
      source_type: "external-provider",
      external_league_id: league?.id || null,
      external_team_id: team.id,
      external_league_key: league?.external_league_key || null,
      external_team_key: team.external_team_key,
    };

    setYahooFeedback(null);
    setIsYahooActionLoading(true);

    try {
      const { error: preferencesError } = await supabase
        .from("user_provider_preferences")
        .upsert(
          {
            user_id: user.id,
            provider: YAHOO_PROVIDER,
            connected_account_id: yahooConnectedAccount.id,
            default_external_league_id: league?.id || null,
            default_external_team_id: team.id,
            refresh_on_login: yahooPreferences?.refresh_on_login ?? false,
            active_context: activeContext,
          },
          {
            onConflict: "user_id,provider",
          },
        );

      if (preferencesError) {
        throw preferencesError;
      }

      const { error: settingsError } = await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: user.id,
            active_context: activeContext,
          },
          {
            onConflict: "user_id",
          },
        );

      if (settingsError) {
        throw settingsError;
      }

      await reloadYahooState();
      setYahooFeedback({
        tone: "success",
        message: `"${team.team_name || "Yahoo team"}" is now your default Yahoo team.`,
      });
    } catch (error) {
      setYahooFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to update the default Yahoo team.",
      });
    } finally {
      setIsYahooActionLoading(false);
    }
  }

  async function handleSaveYahooTeam(team: ExternalTeamRow) {
    if (!user?.id) {
      return;
    }

    const league =
      yahooLeagues.find((item) => item.id === team.external_league_id) || null;
    if (!league) {
      setSavedTeamsFeedback({
        tone: "error",
        message:
          "The Yahoo league for this team is unavailable. Refresh the account state and try again.",
      });
      return;
    }

    setIsSavedTeamSaving(true);
    setSavedTeamsFeedback(null);
    setYahooFeedback(null);

    try {
      const currentSavedTeams = await reloadSavedTeams();
      const existingSavedTeam = currentSavedTeams.find(
        (savedTeam) =>
          savedTeam.provider === YAHOO_PROVIDER &&
          savedTeam.external_team_key === team.external_team_key,
      );
      const shouldBeDefault =
        existingSavedTeam?.is_default ??
        currentSavedTeams.every((savedTeam) => !savedTeam.is_default);

      if (shouldBeDefault) {
        await Promise.all(
          currentSavedTeams
            .filter(
              (savedTeam) =>
                savedTeam.is_default && savedTeam.id !== existingSavedTeam?.id,
            )
            .map(async (savedTeam) => {
              const { error } = await supabase
                .from("user_saved_teams")
                .update({ is_default: false })
                .eq("id", savedTeam.id);

              if (error) {
                throw error;
              }
            }),
        );
      }

      const payload = {
        user_id: user.id,
        name: team.team_name || league.league_name || "Yahoo Fantasy Team",
        source_type: "external-provider",
        provider: YAHOO_PROVIDER,
        external_team_key: team.external_team_key,
        external_league_key: league.external_league_key,
        roster_json: team.roster_snapshot,
        settings_snapshot: {
          provider: YAHOO_PROVIDER,
          external_league_id: league.id,
          external_team_id: team.id,
          scoring_settings: league.scoring_settings,
          roster_settings: league.roster_settings,
          league_metadata: league.league_metadata,
          imported_at: team.imported_at,
        },
        is_default: shouldBeDefault,
      };

      const { error } = existingSavedTeam
        ? await supabase
            .from("user_saved_teams")
            .update(payload)
            .eq("id", existingSavedTeam.id)
        : await supabase.from("user_saved_teams").insert(payload);

      if (error) {
        throw error;
      }

      await reloadSavedTeams();
      const message = existingSavedTeam
        ? `"${payload.name}" was updated from the latest Yahoo roster snapshot.`
        : `"${payload.name}" was saved from Yahoo.`;
      setSavedTeamsFeedback({ tone: "success", message });
      setYahooFeedback({ tone: "success", message });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save the imported Yahoo team.";
      setSavedTeamsFeedback({ tone: "error", message });
      setYahooFeedback({ tone: "error", message });
    } finally {
      setIsSavedTeamSaving(false);
    }
  }

  function getPreferredYahooTeamForLeague(
    leagueId: string,
    preferredTeamId?: string | null,
  ) {
    const teamsForLeague = yahooTeams.filter(
      (team) => team.external_league_id === leagueId,
    );

    return (
      teamsForLeague.find((team) => team.id === preferredTeamId) ||
      teamsForLeague.find(
        (team) => team.id === yahooPreferences?.default_external_team_id,
      ) ||
      teamsForLeague[0] ||
      null
    );
  }

  async function handleSetYahooActiveContext(
    nextLeagueId: string,
    nextTeamId?: string,
  ) {
    if (!user?.id || !yahooConnectedAccount) {
      return;
    }

    const trimmedLeagueId = nextLeagueId || "";
    const trimmedTeamId = nextTeamId || "";
    const nextLeague =
      yahooLeagues.find((league) => league.id === trimmedLeagueId) || null;
    const nextTeam =
      (trimmedTeamId &&
        yahooTeams.find(
          (team) =>
            team.id === trimmedTeamId &&
            (!nextLeague || team.external_league_id === nextLeague.id),
        )) ||
      (nextLeague
        ? getPreferredYahooTeamForLeague(nextLeague.id, trimmedTeamId || null)
        : null);

    const activeContext = nextLeague
      ? {
          source_type: "external-provider",
          provider: YAHOO_PROVIDER,
          external_league_id: nextLeague.id,
          external_team_id: nextTeam?.id || null,
          external_league_key: nextLeague.external_league_key,
          external_team_key: nextTeam?.external_team_key || null,
        }
      : buildManualActiveContext();

    setYahooFeedback(null);
    setSavedTeamsFeedback(null);
    setLeagueFeedback(null);
    setIsYahooActionLoading(true);

    try {
      const { error: preferencesError } = await supabase
        .from("user_provider_preferences")
        .upsert(
          {
            user_id: user.id,
            provider: YAHOO_PROVIDER,
            connected_account_id: yahooConnectedAccount.id,
            default_external_league_id:
              yahooPreferences?.default_external_league_id || null,
            default_external_team_id:
              yahooPreferences?.default_external_team_id || null,
            refresh_on_login: yahooPreferences?.refresh_on_login ?? false,
            active_context: activeContext,
          },
          {
            onConflict: "user_id,provider",
          },
        );

      if (preferencesError) {
        throw preferencesError;
      }

      const { error: settingsError } = await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: user.id,
            active_context: activeContext,
          },
          {
            onConflict: "user_id",
          },
        );

      if (settingsError) {
        throw settingsError;
      }

      setLeagueForm((current) => ({
        ...current,
        activeContext,
      }));
      await reloadYahooState();

      const successMessage = nextLeague
        ? `Active Yahoo context updated to ${nextLeague.league_name || "Yahoo league"}${nextTeam?.team_name ? ` / ${nextTeam.team_name}` : ""}.`
        : "Active context reset to manual.";

      setYahooFeedback({
        tone: "success",
        message: successMessage,
      });
      setLeagueFeedback({
        tone: "success",
        message: successMessage,
      });
      setSavedTeamsFeedback({
        tone: "success",
        message: successMessage,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update the active Yahoo context.";

      setYahooFeedback({
        tone: "error",
        message,
      });
      setLeagueFeedback({
        tone: "error",
        message,
      });
      setSavedTeamsFeedback({
        tone: "error",
        message,
      });
    } finally {
      setIsYahooActionLoading(false);
    }
  }

  const scoringEntries = useMemo(
    () => Object.entries(leagueForm.scoringCategories),
    [leagueForm.scoringCategories],
  );
  const goalieScoringEntries = useMemo(
    () => Object.entries(leagueForm.goalieScoringCategories),
    [leagueForm.goalieScoringCategories],
  );
  const categoryWeightEntries = useMemo(
    () => Object.entries(leagueForm.categoryWeights),
    [leagueForm.categoryWeights],
  );
  const rosterEntries = useMemo(
    () => Object.entries(leagueForm.rosterConfig),
    [leagueForm.rosterConfig],
  );

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.accountHeader}>
          <div className={styles.accountIdentity}>
            <div className={styles.eyebrow}>Account Settings</div>
            <div className={styles.identityRow}>
              <div className={styles.userName}>{resolvedDisplayName}</div>
              <div className={styles.userMeta}>
                {user?.email || "Signed-in account"}
              </div>
            </div>
          </div>

          <div
            className={styles.nav}
            role="tablist"
            aria-label="Account settings sections"
          >
            {(
              Object.entries(SECTION_CONFIG) as Array<
                [AccountSection, (typeof SECTION_CONFIG)[AccountSection]]
              >
            ).map(([sectionKey, config]) => (
              <button
                key={sectionKey}
                id={`account-tab-${sectionKey}`}
                type="button"
                role="tab"
                aria-selected={activeSection === sectionKey}
                aria-controls="account-section-panel"
                aria-current={
                  activeSection === sectionKey ? "page" : undefined
                }
                className={`${styles.navButton} ${activeSection === sectionKey ? styles.navButtonActive : ""}`}
                onClick={() => updateSection(sectionKey)}
                title={config.description}
              >
                <span className={styles.navLabel}>{config.label}</span>
              </button>
            ))}
          </div>
        </header>

        <section
          id="account-section-panel"
          className={`${styles.content} ${
            activeSection === "profile" ? styles.profileContent : ""
          }`}
          role="tabpanel"
          aria-labelledby={`account-tab-${activeSection}`}
        >
          {activeSection === "profile" ? null : (
            <header className={styles.header}>
              <h1 className={styles.title}>{sectionConfig.title}</h1>
              <p className={styles.body}>{sectionConfig.body}</p>
            </header>
          )}

          <div
            className={`${styles.panelGrid} ${
              activeSection === "profile" ? styles.profilePanelGrid : ""
            }`}
          >
            {activeSection === "profile" ? (
              <>
                <AccountPageHero
                  title="Profile Overview"
                  description="Manage your account details and preferences across FHFH."
                />

                <div className={styles.profileDashboard}>
                  <section
                    className={`${styles.profileCard} ${styles.accountSummaryCard}`}
                    aria-labelledby="account-summary-title"
                  >
                    <h2
                      id="account-summary-title"
                      className={styles.profileSectionTitle}
                    >
                      Account Summary
                    </h2>

                    <div className={styles.summaryIdentity}>
                      <div className={styles.summaryAvatarFrame}>
                        {resolvedAvatarUrl ? (
                          <img
                            src={resolvedAvatarUrl}
                            alt={`${resolvedDisplayName} profile avatar`}
                            className={styles.avatarImage}
                          />
                        ) : (
                          <span className={styles.avatarFallback}>
                            {getUserInitials(resolvedDisplayName)}
                          </span>
                        )}
                      </div>
                      <div className={styles.avatarMeta}>
                        <div className={styles.avatarName}>
                          {resolvedDisplayName}
                        </div>
                        <div className={styles.avatarEmail}>
                          {user?.email || "Signed-in account"}
                        </div>
                        <div className={styles.signedInBadge}>
                          <span aria-hidden="true" />
                          Signed In
                        </div>
                      </div>
                    </div>

                    <div className={styles.summaryRows}>
                      <button
                        type="button"
                        className={styles.summaryRow}
                        onClick={() => updateSection("connected-accounts")}
                      >
                        <AccountIcon name="leagues" />
                        <span>Connected Leagues</span>
                        <strong>
                          {isProfileSummaryLoading
                            ? "…"
                            : (profileSummaryCounts.connectedLeagues ?? "—")}
                        </strong>
                        <AccountIcon name="chevron" />
                      </button>
                      <button
                        type="button"
                        className={styles.summaryRow}
                        onClick={() => updateSection("saved-teams")}
                      >
                        <AccountIcon name="teams" />
                        <span>Saved Teams</span>
                        <strong>
                          {isProfileSummaryLoading
                            ? "…"
                            : (profileSummaryCounts.savedTeams ?? "—")}
                        </strong>
                        <AccountIcon name="chevron" />
                      </button>
                      <button
                        type="button"
                        className={styles.summaryRow}
                        onClick={() => updateSection("connected-accounts")}
                      >
                        <AccountIcon name="link" />
                        <span>Connected Accounts</span>
                        <strong>
                          {isProfileSummaryLoading
                            ? "…"
                            : (profileSummaryCounts.connectedAccounts ?? "—")}
                        </strong>
                        <AccountIcon name="chevron" />
                      </button>
                    </div>
                  </section>

                  <section
                    className={`${styles.profileCard} ${styles.preferencesCard}`}
                    aria-labelledby="preferences-title"
                  >
                    <h2
                      id="preferences-title"
                      className={styles.profileSectionTitle}
                    >
                      Preferences
                    </h2>
                    <button
                      type="button"
                      className={styles.preferenceRow}
                      onClick={() => timezoneInputRef.current?.focus()}
                    >
                      <AccountIcon name="timezone" />
                      <span>Timezone</span>
                      <strong>
                        {isProfileLoading
                          ? "…"
                          : profileForm.timezone || "Not set"}
                      </strong>
                      <AccountIcon name="chevron" />
                    </button>
                    <button
                      type="button"
                      className={styles.preferencesButton}
                      onClick={() => timezoneInputRef.current?.focus()}
                    >
                      Edit Preferences
                    </button>
                  </section>

                  <section
                    className={`${styles.profileCard} ${styles.profileDetailsCard}`}
                    aria-labelledby="profile-details-title"
                  >
                    <h2
                      id="profile-details-title"
                      className={styles.profileSectionTitle}
                    >
                      Profile Details
                    </h2>

                    {isProfileLoading ? (
                      <div
                        className={styles.profileDetailsLoading}
                        role="status"
                      >
                        Loading profile fields...
                      </div>
                    ) : (
                      <form
                        className={styles.profileDetailsForm}
                        onSubmit={(event) => void handleProfileSubmit(event)}
                        aria-busy={isProfileSaving}
                      >
                        <div className={styles.profileFields}>
                          {profileRecordState === "error" ? (
                            <div className={styles.errorMessage} role="alert">
                              We could not load your saved profile. Refresh the
                              page or try saving again.
                            </div>
                          ) : null}

                          <div className={styles.profileFieldGroup}>
                            <label htmlFor="profile-display-name">
                              Display Name
                            </label>
                            <p id="profile-display-name-help">
                              This is how your name will appear across FHFH.
                            </p>
                            <input
                              id="profile-display-name"
                              type="text"
                              value={profileForm.displayName}
                              onChange={(event) =>
                                updateProfileField(
                                  "displayName",
                                  event.target.value,
                                )
                              }
                              className={styles.profileInput}
                              aria-describedby="profile-display-name-help"
                              disabled={isProfileSaving}
                            />
                          </div>

                          <div className={styles.profileFieldGroup}>
                            <label htmlFor="profile-email">Email Address</label>
                            <p id="profile-email-help">
                              Used for sign in and important notifications.
                            </p>
                            <div className={styles.profileInputWithStatus}>
                              <input
                                id="profile-email"
                                type="email"
                                value={user?.email || ""}
                                className={styles.profileInput}
                                aria-describedby="profile-email-help"
                                readOnly
                              />
                              {user?.isEmailVerified ? (
                                <span className={styles.verifiedStatus}>
                                  <AccountIcon name="verified" />
                                  Verified
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className={styles.profileFieldGroup}>
                            <label htmlFor="profile-avatar-url">
                              Avatar URL
                            </label>
                            <p id="profile-avatar-url-help">
                              Link to a public image for your profile avatar.
                            </p>
                            <div className={styles.profileInputWithAction}>
                              <input
                                id="profile-avatar-url"
                                type="url"
                                value={profileForm.avatarUrl}
                                onChange={(event) =>
                                  updateProfileField(
                                    "avatarUrl",
                                    event.target.value,
                                  )
                                }
                                className={styles.profileInput}
                                aria-describedby="profile-avatar-url-help"
                                placeholder="https://..."
                                disabled={isProfileSaving}
                              />
                              {safeAvatarLink ? (
                                <a
                                  className={styles.inputAction}
                                  href={safeAvatarLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label="Open current avatar image"
                                >
                                  <AccountIcon name="external" />
                                </a>
                              ) : null}
                            </div>
                          </div>

                          <div className={styles.profileFieldGroup}>
                            <label htmlFor="profile-timezone">Timezone</label>
                            <p id="profile-timezone-help">
                              Used to display times in your local time.
                            </p>
                            <input
                              ref={timezoneInputRef}
                              id="profile-timezone"
                              type="text"
                              value={profileForm.timezone}
                              onChange={(event) =>
                                updateProfileField(
                                  "timezone",
                                  event.target.value,
                                )
                              }
                              className={styles.profileInput}
                              aria-describedby="profile-timezone-help"
                              placeholder="America/New_York"
                              autoComplete="off"
                              disabled={isProfileSaving}
                            />
                          </div>
                        </div>

                        <div className={styles.profileActionFooter}>
                          {profileFeedback ? (
                            <div
                              className={
                                profileFeedback.tone === "error"
                                  ? styles.errorMessage
                                  : styles.successMessage
                              }
                              role={
                                profileFeedback.tone === "error"
                                  ? "alert"
                                  : "status"
                              }
                            >
                              {profileFeedback.message}
                            </div>
                          ) : null}

                          <button
                            type="submit"
                            className={`${styles.saveButton} ${styles.profileSaveButton}`}
                            disabled={isProfileSaving}
                          >
                            <AccountIcon name="save" />
                            {isProfileSaving ? "Saving..." : "Save Profile"}
                          </button>
                        </div>
                      </form>
                    )}
                  </section>
                </div>
              </>
            ) : null}

            {activeSection === "league-settings" ? (
              <div className={styles.panel}>
                <h2 className={styles.panelTitle}>League Settings</h2>

                {isLeagueLoading ? (
                  <div className={styles.profileLoading}>
                    Loading league defaults...
                  </div>
                ) : (
                  <form
                    className={styles.settingsForm}
                    onSubmit={(event) => void handleLeagueSubmit(event)}
                  >
                    {leagueRecordState === "missing" ? (
                      <div className={styles.infoMessage}>
                        Site defaults are shown until you save your own league
                        settings.
                      </div>
                    ) : null}

                    {leagueRecordState === "error" ? (
                      <div className={styles.errorMessage} role="alert">
                        We could not load your league settings. Site defaults
                        are shown instead.
                      </div>
                    ) : null}

                    <div
                      className={styles.subnav}
                      role="tablist"
                      aria-label="League setting groups"
                    >
                      {LEAGUE_SETTINGS_VIEWS.map((view) => (
                        <button
                          key={view.key}
                          id={`league-settings-tab-${view.key}`}
                          type="button"
                          role="tab"
                          aria-selected={leagueSettingsView === view.key}
                          aria-controls={`league-settings-panel-${view.key}`}
                          className={`${styles.subnavButton} ${
                            leagueSettingsView === view.key
                              ? styles.subnavButtonActive
                              : ""
                          }`}
                          onClick={() => setLeagueSettingsView(view.key)}
                        >
                          {view.label}
                        </button>
                      ))}
                    </div>

                    <div
                      id="league-settings-panel-context-import"
                      className={styles.formSection}
                      role="tabpanel"
                      aria-labelledby="league-settings-tab-context"
                      hidden={leagueSettingsView !== "context"}
                    >
                      <div className={styles.formSectionHeader}>
                        <h3 className={styles.formSectionTitle}>
                          Imported Yahoo League
                        </h3>
                      </div>

                      {isYahooLoading ? (
                        <div className={styles.profileLoading}>
                          Loading imported Yahoo league settings...
                        </div>
                      ) : activeYahooLeague ? (
                        <div className={styles.yahooLeagueStack}>
                          <div className={styles.yahooLeagueSummaryGrid}>
                            <div className={styles.yahooLeagueSummaryCard}>
                              <span className={styles.yahooLeagueSummaryLabel}>
                                Selected Yahoo League
                              </span>
                              <span className={styles.yahooLeagueSummaryValue}>
                                {activeYahooLeague.league_name ||
                                  "Unnamed Yahoo league"}
                              </span>
                              <span className={styles.yahooLeagueSummaryHint}>
                                Team context:{" "}
                                {activeYahooTeam?.team_name ||
                                  yahooDefaultTeam?.team_name ||
                                  "No default Yahoo team selected"}
                              </span>
                            </div>

                            <div className={styles.yahooLeagueSummaryCard}>
                              <span className={styles.yahooLeagueSummaryLabel}>
                                Season
                              </span>
                              <span className={styles.yahooLeagueSummaryValue}>
                                {activeYahooLeague.season_key ||
                                  getYahooLeagueMetadataValue(
                                    activeYahooLeague,
                                    "season",
                                  ) ||
                                  "Unknown"}
                              </span>
                              <span className={styles.yahooLeagueSummaryHint}>
                                Game key:{" "}
                                {getYahooLeagueMetadataValue(
                                  activeYahooLeague,
                                  "game_key",
                                ) || "Unknown"}
                              </span>
                            </div>

                            <div className={styles.yahooLeagueSummaryCard}>
                              <span className={styles.yahooLeagueSummaryLabel}>
                                Scoring Type
                              </span>
                              <span className={styles.yahooLeagueSummaryValue}>
                                {getYahooLeagueMetadataValue(
                                  activeYahooLeague,
                                  "scoring_type",
                                ) || "Unknown"}
                              </span>
                              <span className={styles.yahooLeagueSummaryHint}>
                                League type:{" "}
                                {getYahooLeagueMetadataValue(
                                  activeYahooLeague,
                                  "league_type",
                                ) || "Unknown"}
                              </span>
                            </div>

                            <div className={styles.yahooLeagueSummaryCard}>
                              <span className={styles.yahooLeagueSummaryLabel}>
                                Team Count
                              </span>
                              <span className={styles.yahooLeagueSummaryValue}>
                                {getYahooLeagueMetadataValue(
                                  activeYahooLeague,
                                  "num_teams",
                                ) || "Unknown"}
                              </span>
                              <span className={styles.yahooLeagueSummaryHint}>
                                Current week:{" "}
                                {getYahooLeagueMetadataValue(
                                  activeYahooLeague,
                                  "current_week",
                                ) || "Unknown"}
                              </span>
                            </div>

                            <div className={styles.yahooLeagueSummaryCard}>
                              <span className={styles.yahooLeagueSummaryLabel}>
                                Roster Type
                              </span>
                              <span className={styles.yahooLeagueSummaryValue}>
                                {getYahooLeagueMetadataValue(
                                  activeYahooLeague,
                                  "roster_type",
                                ) || "Unknown"}
                              </span>
                              <span className={styles.yahooLeagueSummaryHint}>
                                Weekly deadline:{" "}
                                {getYahooLeagueMetadataValue(
                                  activeYahooLeague,
                                  "weekly_deadline",
                                ) || "Unknown"}
                              </span>
                            </div>
                          </div>

                          <details className={styles.detailsDisclosure}>
                            <summary>View synced scoring and roster</summary>
                            <div className={styles.yahooLeagueDetailsGrid}>
                              <div className={styles.yahooLeagueDetailCard}>
                              <h4 className={styles.yahooLeagueDetailTitle}>
                                Synced Scoring
                              </h4>
                              <div className={styles.yahooLeagueDetailRows}>
                                {yahooLeagueScoringRows.length > 0 ? (
                                  yahooLeagueScoringRows.map((row) => (
                                    <div
                                      key={row.key}
                                      className={styles.yahooLeagueDetailRow}
                                    >
                                      <span
                                        className={
                                          styles.yahooLeagueDetailLabel
                                        }
                                      >
                                        {row.label}
                                      </span>
                                      <span
                                        className={
                                          styles.yahooLeagueDetailValue
                                        }
                                      >
                                        {row.value}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className={styles.emptyState}>
                                    No scoring categories were stored for this
                                    Yahoo league yet.
                                  </div>
                                )}
                              </div>
                            </div>

                              <div className={styles.yahooLeagueDetailCard}>
                              <h4 className={styles.yahooLeagueDetailTitle}>
                                Synced Roster Slots
                              </h4>
                              <div className={styles.yahooLeagueDetailRows}>
                                {yahooLeagueRosterRows.length > 0 ? (
                                  yahooLeagueRosterRows.map((row) => (
                                    <div
                                      key={row.key}
                                      className={styles.yahooLeagueDetailRow}
                                    >
                                      <span
                                        className={
                                          styles.yahooLeagueDetailLabel
                                        }
                                      >
                                        {row.label}
                                      </span>
                                      <span
                                        className={
                                          styles.yahooLeagueDetailValue
                                        }
                                      >
                                        {row.value}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className={styles.emptyState}>
                                    No roster positions were stored for this
                                    Yahoo league yet.
                                  </div>
                                )}
                              </div>
                              </div>
                            </div>
                          </details>
                        </div>
                      ) : (
                        <div className={styles.infoMessage}>
                          No synced Yahoo NHL league is active yet. Connect
                          Yahoo and choose a default team in Connected Accounts
                          to surface imported scoring and roster settings here.
                        </div>
                      )}
                    </div>

                    <div className={styles.settingsToolbar}>
                      <div className={styles.formSectionHeader}>
                        <h3 className={styles.formSectionTitle}>League Mode</h3>
                      </div>

                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>League Type</span>
                        <select
                          value={leagueForm.leagueType}
                          onChange={(event) =>
                            updateLeagueType(event.target.value as LeagueType)
                          }
                          className={styles.select}
                          disabled={isLeagueSaving}
                        >
                          <option value="points">Points</option>
                          <option value="categories">Categories</option>
                        </select>
                      </label>

                      <div className={styles.actionRow}>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={resetLeagueDefaults}
                          disabled={isLeagueSaving}
                        >
                          Reset to Site Defaults
                        </button>
                        <button
                          type="submit"
                          className={styles.saveButton}
                          disabled={isLeagueSaving}
                        >
                          {isLeagueSaving
                            ? "Saving..."
                            : "Save League Defaults"}
                        </button>
                      </div>
                    </div>

                    <div
                      id="league-settings-panel-scoring"
                      className={styles.formSection}
                      role="tabpanel"
                      aria-labelledby="league-settings-tab-scoring"
                      hidden={leagueSettingsView !== "scoring"}
                    >
                      <div className={styles.formSectionHeader}>
                        <h3 className={styles.formSectionTitle}>
                          Points Scoring
                        </h3>
                      </div>

                      <div className={styles.numericGrid}>
                        {scoringEntries.map(([key, value]) => (
                          <label key={key} className={styles.field}>
                            <span className={styles.fieldLabel}>
                              Points · {getSettingLabel(key)}
                            </span>
                            <input
                              type="number"
                              step="0.05"
                              value={String(value)}
                              onChange={(event) =>
                                updateLeagueNumberField(
                                  "scoringCategories",
                                  key,
                                  event.target.value,
                                )
                              }
                              className={styles.input}
                              disabled={isLeagueSaving}
                            />
                          </label>
                        ))}
                      </div>

                      <div className={styles.formSectionHeader}>
                        <h3 className={styles.formSectionTitle}>
                          Goalie Points Scoring
                        </h3>
                      </div>
                      <div className={styles.numericGrid}>
                        {goalieScoringEntries.map(([key, value]) => (
                          <label key={key} className={styles.field}>
                            <span className={styles.fieldLabel}>
                              Goalie points · {getSettingLabel(key)}
                            </span>
                            <input
                              type="number"
                              step="0.05"
                              value={String(value)}
                              onChange={(event) =>
                                updateLeagueNumberField(
                                  "goalieScoringCategories",
                                  key,
                                  event.target.value,
                                )
                              }
                              className={styles.input}
                              disabled={isLeagueSaving}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div
                      id="league-settings-panel-categories"
                      className={styles.formSection}
                      role="tabpanel"
                      aria-labelledby="league-settings-tab-categories"
                      hidden={leagueSettingsView !== "categories"}
                    >
                      <div className={styles.formSectionHeader}>
                        <h3 className={styles.formSectionTitle}>
                          Category Weights
                        </h3>
                      </div>

                      <div className={styles.numericGrid}>
                        {categoryWeightEntries.map(([key, value]) => (
                          <label key={key} className={styles.field}>
                            <span className={styles.fieldLabel}>
                              Weight · {getSettingLabel(key)}
                            </span>
                            <input
                              type="number"
                              step="0.1"
                              value={String(value)}
                              onChange={(event) =>
                                updateLeagueNumberField(
                                  "categoryWeights",
                                  key,
                                  event.target.value,
                                )
                              }
                              className={styles.input}
                              disabled={isLeagueSaving}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div
                      id="league-settings-panel-roster"
                      className={styles.formSection}
                      role="tabpanel"
                      aria-labelledby="league-settings-tab-roster"
                      hidden={leagueSettingsView !== "roster"}
                    >
                      <div className={styles.formSectionHeader}>
                        <h3 className={styles.formSectionTitle}>
                          Roster Defaults
                        </h3>
                      </div>

                      <div className={styles.numericGrid}>
                        <label className={styles.field}>
                          <span className={styles.fieldLabel}>League teams</span>
                          <input
                            type="number"
                            min="2"
                            max="40"
                            step="1"
                            value={String(leagueForm.teamCount)}
                            onChange={(event) =>
                              setLeagueForm((current) => ({
                                ...current,
                                teamCount: Math.min(
                                  40,
                                  Math.max(2, Number(event.target.value) || 2),
                                ),
                              }))
                            }
                            className={styles.input}
                            disabled={isLeagueSaving}
                          />
                        </label>
                        <label className={styles.field}>
                          <span className={styles.fieldLabel}>Draft format</span>
                          <select
                            value={leagueForm.draftOrderType}
                            onChange={(event) =>
                              setLeagueForm((current) => ({
                                ...current,
                                draftOrderType:
                                  event.target.value === "straight"
                                    ? "straight"
                                    : "snake",
                              }))
                            }
                            className={styles.select}
                            disabled={isLeagueSaving}
                          >
                            <option value="snake">Snake</option>
                            <option value="straight">Straight</option>
                          </select>
                        </label>
                        {rosterEntries.map(([key, value]) => (
                          <label key={key} className={styles.field}>
                            <span className={styles.fieldLabel}>
                              Roster · {getSettingLabel(key)}
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={String(value)}
                              onChange={(event) =>
                                updateLeagueNumberField(
                                  "rosterConfig",
                                  key,
                                  event.target.value,
                                )
                              }
                              className={styles.input}
                              disabled={isLeagueSaving}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div
                      id="league-settings-panel-context"
                      className={styles.formSection}
                      role="tabpanel"
                      aria-labelledby="league-settings-tab-context"
                      hidden={leagueSettingsView !== "context"}
                    >
                      <div className={styles.formSectionHeader}>
                        <h3 className={styles.formSectionTitle}>
                          Active League Context
                        </h3>
                        <p className={styles.formSectionBody}>
                          Choose the Yahoo league and team used across your
                          account.
                        </p>
                      </div>

                      {yahooConnectedAccount && yahooLeagues.length > 0 ? (
                        <div className={styles.yahooContextSwitcher}>
                          <div className={styles.yahooContextGrid}>
                            <label className={styles.field}>
                              <span className={styles.fieldLabel}>
                                Active Yahoo League
                              </span>
                              <select
                                value={activeYahooLeague?.id || ""}
                                onChange={(event) =>
                                  void handleSetYahooActiveContext(
                                    event.target.value,
                                  )
                                }
                                className={styles.select}
                                disabled={isYahooActionLoading}
                              >
                                {yahooLeagues.map((league) => (
                                  <option key={league.id} value={league.id}>
                                    {league.league_name ||
                                      league.external_league_key}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className={styles.field}>
                              <span className={styles.fieldLabel}>
                                Active Yahoo Team
                              </span>
                              <select
                                value={activeYahooTeam?.id || ""}
                                onChange={(event) =>
                                  void handleSetYahooActiveContext(
                                    activeYahooLeague?.id || "",
                                    event.target.value,
                                  )
                                }
                                className={styles.select}
                                disabled={
                                  isYahooActionLoading || !activeYahooLeague
                                }
                              >
                                {yahooTeamsForActiveLeague.map((team) => (
                                  <option key={team.id} value={team.id}>
                                    {team.team_name || team.external_team_key}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.infoMessage}>
                          Connect Yahoo and import at least one NHL league to
                          enable the quick context switchers here.
                        </div>
                      )}

                      <div className={styles.contextSummary}>
                        <span className={styles.statusPill}>
                          Source: {leagueForm.activeContext.source_type}
                        </span>
                        <span className={styles.statusPill}>
                          Provider:{" "}
                          {leagueForm.activeContext.provider || "manual"}
                        </span>
                        <span className={styles.statusPill}>
                          League:{" "}
                          {activeYahooLeague?.league_name ||
                            leagueForm.activeContext.external_league_id ||
                            "none"}
                        </span>
                        <span className={styles.statusPill}>
                          Team:{" "}
                          {activeYahooTeam?.team_name ||
                            leagueForm.activeContext.external_team_id ||
                            "none"}
                        </span>
                      </div>
                    </div>

                    {leagueFeedback ? (
                      <div
                        className={
                          leagueFeedback.tone === "error"
                            ? styles.errorMessage
                            : styles.successMessage
                        }
                        role={
                          leagueFeedback.tone === "error" ? "alert" : undefined
                        }
                      >
                        {leagueFeedback.message}
                      </div>
                    ) : null}

                  </form>
                )}
              </div>
            ) : null}

            {activeSection === "saved-teams" ? (
              <div className={styles.panel}>
                <h2 className={styles.panelTitle}>Manual Saved Teams</h2>

                <div className={styles.savedTeamsGrid}>
                  <form
                    className={styles.savedTeamForm}
                    onSubmit={(event) => void handleSavedTeamSubmit(event)}
                  >
                    {yahooConnectedAccount && yahooLeagues.length > 0 ? (
                      <div className={styles.formSection}>
                        <div className={styles.formSectionHeader}>
                          <h3 className={styles.formSectionTitle}>
                            Active Yahoo Context
                          </h3>
                          <p className={styles.formSectionBody}>
                            Choose the Yahoo league and team you are working
                            with.
                          </p>
                        </div>

                        <div className={styles.yahooContextGrid}>
                          <label className={styles.field}>
                            <span className={styles.fieldLabel}>
                              Active Yahoo League
                            </span>
                            <select
                              value={activeYahooLeague?.id || ""}
                              onChange={(event) =>
                                void handleSetYahooActiveContext(
                                  event.target.value,
                                )
                              }
                              className={styles.select}
                              disabled={isYahooActionLoading}
                            >
                              {yahooLeagues.map((league) => (
                                <option key={league.id} value={league.id}>
                                  {league.league_name ||
                                    league.external_league_key}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className={styles.field}>
                            <span className={styles.fieldLabel}>
                              Active Yahoo Team
                            </span>
                            <select
                              value={activeYahooTeam?.id || ""}
                              onChange={(event) =>
                                void handleSetYahooActiveContext(
                                  activeYahooLeague?.id || "",
                                  event.target.value,
                                )
                              }
                              className={styles.select}
                              disabled={
                                isYahooActionLoading || !activeYahooLeague
                              }
                            >
                              {yahooTeamsForActiveLeague.map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.team_name || team.external_team_key}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div className={styles.contextSummary}>
                          <span className={styles.statusPill}>
                            League:{" "}
                            {activeYahooLeague?.league_name ||
                              activeYahooLeague?.external_league_key ||
                              "none"}
                          </span>
                          <span className={styles.statusPill}>
                            Team:{" "}
                            {activeYahooTeam?.team_name ||
                              activeYahooTeam?.external_team_key ||
                              "none"}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    <div className={styles.formSectionHeader}>
                      <h3 className={styles.formSectionTitle}>
                        {editingSavedTeamId
                          ? "Edit Saved Team"
                          : "Create Saved Team"}
                      </h3>
                      <p className={styles.formSectionBody}>
                        Add a team name and any roster notes you want to keep.
                      </p>
                    </div>

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Team Name</span>
                      <input
                        type="text"
                        value={savedTeamForm.name}
                        onChange={(event) =>
                          updateSavedTeamField("name", event.target.value)
                        }
                        className={styles.input}
                        placeholder="My Main League Team"
                        disabled={isSavedTeamSaving}
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Manual Notes</span>
                      <textarea
                        value={savedTeamForm.manualNotes}
                        onChange={(event) =>
                          updateSavedTeamField(
                            "manualNotes",
                            event.target.value,
                          )
                        }
                        className={styles.textarea}
                        placeholder="Roster reminders, keepers, trade context, or lineup notes"
                        disabled={isSavedTeamSaving}
                      />
                    </label>

                    <label className={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={savedTeamForm.isDefault}
                        onChange={(event) =>
                          updateSavedTeamField(
                            "isDefault",
                            event.target.checked,
                          )
                        }
                        disabled={isSavedTeamSaving}
                      />
                      <span>Set as default team</span>
                    </label>

                    {savedTeamsFeedback ? (
                      <div
                        className={
                          savedTeamsFeedback.tone === "error"
                            ? styles.errorMessage
                            : styles.successMessage
                        }
                        role={
                          savedTeamsFeedback.tone === "error"
                            ? "alert"
                            : undefined
                        }
                      >
                        {savedTeamsFeedback.message}
                      </div>
                    ) : null}

                    <div className={styles.actionRow}>
                      {editingSavedTeamId ? (
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => resetSavedTeamForm()}
                          disabled={isSavedTeamSaving}
                        >
                          Cancel Edit
                        </button>
                      ) : null}
                      <button
                        type="submit"
                        className={styles.saveButton}
                        disabled={isSavedTeamSaving}
                      >
                        {isSavedTeamSaving
                          ? "Saving..."
                          : editingSavedTeamId
                            ? "Update Saved Team"
                            : "Save Team"}
                      </button>
                    </div>
                  </form>

                  <div className={styles.savedTeamsList}>
                    <div className={styles.formSectionHeader}>
                      <h3 className={styles.formSectionTitle}>
                        Saved Team List
                      </h3>
                      <p className={styles.formSectionBody}>
                        Your default team is used when no team is selected.
                      </p>
                    </div>

                    {isSavedTeamsLoading ? (
                      <div className={styles.profileLoading}>
                        Loading saved teams...
                      </div>
                    ) : savedTeams.length === 0 ? (
                      <div className={styles.emptyState}>
                        No saved teams yet. Create one to get started.
                      </div>
                    ) : (
                      <div className={styles.savedTeamsStack}>
                        {savedTeams.map((team) => (
                          <div key={team.id} className={styles.savedTeamCard}>
                            <div className={styles.savedTeamHeader}>
                              <div>
                                <div className={styles.savedTeamName}>
                                  {team.name}
                                </div>
                                <div className={styles.savedTeamMeta}>
                                  Updated{" "}
                                  {formatSavedTeamTimestamp(team.updated_at)}
                                </div>
                              </div>
                              {team.is_default ? (
                                <span className={styles.defaultBadge}>
                                  Default
                                </span>
                              ) : null}
                            </div>

                            <div className={styles.savedTeamNotes}>
                              {getSavedTeamNotes(team.roster_json) ||
                                "No manual notes yet."}
                            </div>

                            <div className={styles.savedTeamMetaRow}>
                              <span className={styles.statusPill}>
                                Snapshot:{" "}
                                {getSavedTeamLeagueType(team.settings_snapshot)}
                              </span>
                              <span className={styles.statusPill}>
                                Source: manual
                              </span>
                            </div>

                            <div className={styles.cardActionRow}>
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() => handleEditSavedTeam(team)}
                              >
                                Edit
                              </button>
                              {!team.is_default ? (
                                <button
                                  type="button"
                                  className={styles.secondaryButton}
                                  onClick={() =>
                                    void handleSetDefaultSavedTeam(team)
                                  }
                                >
                                  Make Default
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className={styles.dangerButton}
                                onClick={() => void handleDeleteSavedTeam(team)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {activeSection === "connected-accounts" ? (
              <div className={styles.panel}>
                <h2 className={styles.panelTitle}>Fantasy Providers</h2>

                {yahooFeedback ? (
                  <div
                    className={
                      yahooFeedback.tone === "error"
                        ? styles.errorMessage
                        : yahooFeedback.tone === "success"
                          ? styles.successMessage
                          : styles.infoMessage
                    }
                    role={yahooFeedback.tone === "error" ? "alert" : undefined}
                  >
                    {yahooFeedback.message}
                  </div>
                ) : null}

                <div
                  className={styles.subnav}
                  role="tablist"
                  aria-label="Fantasy account providers"
                >
                  {CONNECTED_ACCOUNT_VIEWS.map((view) => (
                    <button
                      key={view.key}
                      id={`connected-account-tab-${view.key}`}
                      type="button"
                      role="tab"
                      aria-selected={connectedAccountsView === view.key}
                      aria-controls={`connected-account-panel-${view.key}`}
                      className={`${styles.subnavButton} ${
                        connectedAccountsView === view.key
                          ? styles.subnavButtonActive
                          : ""
                      }`}
                      onClick={() => setConnectedAccountsView(view.key)}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>

                <div
                  id="connected-account-panel-yahoo"
                  className={styles.providerView}
                  role="tabpanel"
                  aria-labelledby="connected-account-tab-yahoo"
                  hidden={connectedAccountsView !== "yahoo"}
                >
                  <div className={styles.providerCard}>
                    <div className={styles.providerHeader}>
                      <div>
                        <div className={styles.providerName}>Yahoo Fantasy</div>
                        <p className={styles.providerSummary}>
                          Sync leagues, teams, scoring, and rosters from Yahoo.
                        </p>
                      </div>
                      <span className={styles.providerStatus}>
                        {yahooConnectedAccount?.status === "connected"
                          ? "Connected"
                          : isYahooLoading
                            ? "Loading"
                            : "Not connected"}
                      </span>
                    </div>

                    {yahooConnectedAccount ? (
                      <div className={styles.providerMetrics}>
                        <span>
                          <strong>{yahooLeagues.length}</strong> leagues
                        </span>
                        <span>
                          <strong>{yahooTeams.length}</strong> teams
                        </span>
                        <span>
                          Last sync{" "}
                          <strong>
                            {formatSavedTeamTimestamp(
                              yahooConnectedAccount.last_synced_at ||
                                yahooConnectedAccount.updated_at,
                            )}
                          </strong>
                        </span>
                        <span>
                          Default{" "}
                          <strong>
                            {yahooDefaultTeam?.team_name || "Not selected"}
                          </strong>
                        </span>
                      </div>
                    ) : null}

                    <div className={styles.cardActionRow}>
                      {!yahooConnectedAccount ? (
                        <button
                          type="button"
                          className={styles.saveButton}
                          onClick={() => void handleYahooConnect()}
                          disabled={isYahooActionLoading}
                        >
                          Connect Yahoo Fantasy
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => void handleYahooRefresh()}
                            disabled={
                              isYahooActionLoading || yahooRefreshBlocked
                            }
                          >
                            {yahooLatestSyncRun?.status === "running"
                              ? "Refresh Running"
                              : "Refresh Yahoo Data"}
                          </button>
                          <button
                            type="button"
                            className={styles.dangerButton}
                            onClick={() => void handleYahooDisconnect()}
                            disabled={isYahooActionLoading}
                          >
                            Disconnect Yahoo
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                {yahooConnectedAccount ? (
                  <div className={styles.providerControlGrid}>
                    <div className={styles.providerControlCard}>
                      <div className={styles.formSectionHeader}>
                        <h3 className={styles.formSectionTitle}>
                          Leagues
                        </h3>
                      </div>

                      <div className={styles.providerControlRows}>
                        {yahooLeagues.length > 0 ? (
                          yahooLeagues.map((league) => (
                            <div
                              key={league.id}
                              className={styles.providerControlRow}
                            >
                              {league.league_name || league.external_league_key}
                              {yahooDefaultLeague?.id === league.id
                                ? " (default league)"
                                : ""}
                            </div>
                          ))
                        ) : (
                          <div className={styles.providerControlRow}>
                            No Yahoo NHL leagues were discovered for this
                            connected account.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.providerControlCard}>
                      <div className={styles.formSectionHeader}>
                        <h3 className={styles.formSectionTitle}>Yahoo Teams</h3>
                      </div>

                      <div className={styles.providerControlRows}>
                        {yahooTeams.length > 0 ? (
                          yahooTeams.map((team) => {
                            const league =
                              yahooLeagues.find(
                                (leagueItem) =>
                                  leagueItem.id === team.external_league_id,
                              ) || null;
                            const savedYahooTeam = savedTeams.find(
                              (savedTeam) =>
                                savedTeam.provider === YAHOO_PROVIDER &&
                                savedTeam.external_team_key ===
                                  team.external_team_key,
                            );
                            const isOwnedTeam = isOwnedYahooTeam(team);
                            const standingRank = getYahooTeamStandingRank(team);
                            const rosterRows = getYahooTeamRosterRows(
                              team.roster_snapshot,
                            );
                            const isRosterExpanded =
                              expandedYahooRosterTeamId === team.id;
                            const isRosterLoading =
                              yahooRosterLoadingTeamId === team.id;

                            return (
                              <div
                                key={team.id}
                                className={styles.providerControlRow}
                              >
                                <div>
                                  {team.team_name || team.external_team_key}
                                </div>
                                <div>
                                  League:{" "}
                                  {league?.league_name ||
                                    league?.external_league_key ||
                                    "Yahoo league"}
                                </div>
                                <div>
                                  {isOwnedTeam
                                    ? "Owned team"
                                    : "League opponent"}
                                  {standingRank
                                    ? ` · Standings rank ${standingRank}`
                                    : ""}
                                </div>
                                <div className={styles.cardActionRow}>
                                  {isOwnedTeam &&
                                  yahooDefaultTeam?.id === team.id ? (
                                    <span className={styles.defaultBadge}>
                                      Default Team
                                    </span>
                                  ) : isOwnedTeam ? (
                                    <button
                                      type="button"
                                      className={styles.secondaryButton}
                                      onClick={() =>
                                        void handleSetYahooDefaultTeam(team)
                                      }
                                      disabled={isYahooActionLoading}
                                    >
                                      Set Default Team
                                    </button>
                                  ) : null}
                                  {isOwnedTeam ? (
                                    <button
                                      type="button"
                                      className={styles.secondaryButton}
                                      onClick={() =>
                                        void handleSaveYahooTeam(team)
                                      }
                                      disabled={isSavedTeamSaving}
                                    >
                                      {savedYahooTeam
                                        ? "Update Saved Team"
                                        : "Save Imported Team"}
                                    </button>
                                  ) : null}
                                  {!isOwnedTeam ? (
                                    <button
                                      type="button"
                                      className={styles.secondaryButton}
                                      onClick={() =>
                                        void handleYahooTeamRoster(team)
                                      }
                                      disabled={
                                        isYahooActionLoading ||
                                        Boolean(yahooRosterLoadingTeamId)
                                      }
                                      aria-label={`${
                                        isRosterExpanded ? "Hide" : "View"
                                      } ${
                                        team.team_name || "Yahoo team"
                                      } roster`}
                                    >
                                      {isRosterLoading
                                        ? "Loading Roster…"
                                        : isRosterExpanded
                                          ? "Hide Roster"
                                          : "View Roster"}
                                    </button>
                                  ) : null}
                                </div>
                                {!isOwnedTeam && isRosterExpanded ? (
                                  <div className={styles.yahooRosterPanel}>
                                    <div className={styles.yahooRosterSummary}>
                                      {rosterRows.length > 0
                                        ? `${rosterRows.length} rostered player${rosterRows.length === 1 ? "" : "s"}`
                                        : "Yahoo returned an empty roster."}
                                    </div>
                                    {rosterRows.length > 0 ? (
                                      <ul className={styles.yahooRosterList}>
                                        {rosterRows.map((player) => (
                                          <li key={player.key}>
                                            <span>{player.name}</span>
                                            <span>{player.position}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                        ) : (
                          <div className={styles.providerControlRow}>
                            No Yahoo teams have been imported yet.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.providerControlCard}>
                      <div className={styles.formSectionHeader}>
                        <h3 className={styles.formSectionTitle}>
                          Sync Status
                        </h3>
                        <p className={styles.formSectionBody}>
                          Yahoo data can be refreshed every five minutes.
                        </p>
                      </div>

                      <div className={styles.providerControlRows}>
                        <div className={styles.providerControlRow}>
                          Account status: {yahooConnectedAccount.status}
                        </div>
                        <div className={styles.providerControlRow}>
                          Latest refresh:{" "}
                          {yahooLatestSyncRun?.status || "No manual run"}
                          {yahooLatestSyncRun?.cooldown_until
                            ? ` · next eligible ${formatSavedTeamTimestamp(
                                yahooLatestSyncRun.cooldown_until,
                              )}`
                            : ""}
                        </div>
                        <div className={styles.providerControlRow}>
                          Default league:{" "}
                          {yahooDefaultLeague?.league_name ||
                            yahooDefaultLeague?.external_league_key ||
                            "Not selected"}
                        </div>
                        <div className={styles.providerControlRow}>
                          Default team:{" "}
                          {yahooDefaultTeam?.team_name ||
                            yahooDefaultTeam?.external_team_key ||
                            "Not selected"}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                </div>

                <div
                  id="connected-account-panel-fantrax"
                  className={styles.providerView}
                  role="tabpanel"
                  aria-labelledby="connected-account-tab-fantrax"
                  hidden={connectedAccountsView !== "fantrax"}
                >
                  <FantraxImportPanel
                    onSettingsApplied={(settings) => {
                      setLeagueForm(settings);
                      setLeagueRecordState("present");
                    }}
                  />
                </div>

                <div
                  id="connected-account-panel-espn"
                  className={styles.providerView}
                  role="tabpanel"
                  aria-labelledby="connected-account-tab-espn"
                  hidden={connectedAccountsView !== "espn"}
                >
                  <EspnImportPanel
                    onSettingsApplied={(settings) => {
                      setLeagueForm(settings);
                      setLeagueRecordState("present");
                    }}
                  />
                </div>
              </div>
            ) : null}

            {activeSection === "patreon" ? (
              <div className={styles.panel}>
                <h2 className={styles.panelTitle}>Membership</h2>

                <PatreonConnectionPanel />
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

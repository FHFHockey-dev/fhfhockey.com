import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import { useAuth } from "contexts/AuthProviderContext";
import supabase from "lib/supabase/client";
import {
  createDefaultUserLeagueSettings,
  type LeagueType,
  type UserLeagueSettings
} from "lib/user-settings/defaults";
import {
  mapLeagueSettingsToUserSettingsUpsert,
  mapUserSettingsRowToLeagueSettings
} from "lib/user-settings/mappers";
import type { Database, Json } from "lib/supabase/database-generated.types";

import styles from "./AccountSettingsPage.module.scss";

type SavedTeamRow = Database["public"]["Tables"]["user_saved_teams"]["Row"];

const CONNECTED_ACCOUNT_PROVIDERS = [
  {
    key: "yahoo",
    name: "Yahoo Fantasy",
    status: "Planned",
    location: "Account Settings and League Settings",
    summary:
      "Per-user Yahoo OAuth stays separate from site login. Future flows will discover linked leagues and teams, support default-team selection, and throttle manual refresh runs.",
    bullets: [
      "Connection lives here, not in core sign-in.",
      "League sync imports league metadata, scoring, roster settings, teams, and team context.",
      "Refresh controls will use cooldowns and in-flight dedupe to avoid rapid rate-limit pressure."
    ]
  },
  {
    key: "fantrax",
    name: "Fantrax",
    status: "Planned",
    location: "Account Settings and League Settings",
    summary:
      "Fantrax support is intentionally staged behind a connector placeholder because public API support is less stable and likely requires a more defensive integration path than Yahoo.",
    bullets: [
      "Keep provider auth decoupled from app auth.",
      "Design assumes multiple leagues and default-team selection.",
      "Implementation risk stays higher until the supported integration path is confirmed."
    ]
  },
  {
    key: "patreon",
    name: "Patreon",
    status: "Planned",
    location: "Account Settings",
    summary:
      "Patreon remains an entitlement-linked connected account, not a primary authentication method. The linkage supports paid access checks without requiring matching emails with the site login.",
    bullets: [
      "Patreon connection belongs on the account page, not the auth modal.",
      "Entitlements remain site-owned even when Patreon identity changes.",
      "Future anti-sharing rules will prevent duplicate Patreon identity attachment."
    ]
  },
  {
    key: "espn",
    name: "ESPN",
    status: "Deferred",
    location: "Account Settings and League Settings",
    summary:
      "ESPN is reserved as a future-phase provider so the account architecture can support multiple linked leagues and active-team switching without forcing a route change.",
    bullets: [
      "Placeholder aligns with the same connected-account model as Yahoo and Fantrax.",
      "Future work can add wrapper-based import without reshaping account ownership.",
      "Default-team and active-context handling should feel identical across providers."
    ]
  }
] as const;

const FUTURE_PROVIDER_CONTROL_SURFACES = [
  {
    title: "Linked League and Team Context",
    body:
      "Future providers can expose multiple leagues and teams under one connected account. Users need a visible default team plus an in-place active league switcher that does not force a page transition.",
    rows: [
      "Linked leagues: multiple-provider league discovery placeholder",
      "Default team: explicit per-provider default target",
      "Active league switcher: in-place context change without losing draft/dashboard progress"
    ]
  },
  {
    title: "Refresh Preferences and Manual Sync",
    body:
      "Provider refresh stays user-controlled. The eventual controls belong here so refresh-on-login behavior, manual refresh, and next allowed sync time are understandable before OAuth is implemented.",
    rows: [
      "Refresh on sign-in: planned preference toggle",
      "Manual refresh: planned guarded action button",
      "Next eligible refresh: cooldown-driven availability message"
    ]
  },
  {
    title: "Cooldowns and In-Flight Dedupe",
    body:
      "Provider sync jobs need defensive UX. This placeholder makes the future safety model explicit so rapid repeat refreshes and overlapping sync runs are visibly blocked.",
    rows: [
      "Cooldown window: planned anti-throttling lockout after a sync run",
      "In-flight dedupe: planned prevention of duplicate refresh jobs",
      "Last sync state: future success, failure, and running-status summary"
    ]
  }
] as const;

type AccountSection =
  | "profile"
  | "league-settings"
  | "saved-teams"
  | "connected-accounts"
  | "patreon";

const SECTION_CONFIG: Record<
  AccountSection,
  {
    label: string;
    description: string;
    title: string;
    body: string;
    panels: Array<{ title: string; body: string }>;
  }
> = {
  profile: {
    label: "Profile",
    description: "Identity, email, avatar, and account summary",
    title: "Profile Overview",
    body:
      "This section is the home for your site identity, email-verification state, avatar display, and basic account metadata.",
    panels: [
      {
        title: "Display Profile",
        body:
          "The next slice will load and edit `user_profiles` fields like display name, avatar URL, and timezone."
      },
      {
        title: "Account Security",
        body:
          "Auth provider state is now handled through Supabase Auth. MFA and recovery-state refinements will stay separate from connected fantasy providers."
      }
    ]
  },
  "league-settings": {
    label: "League Settings",
    description: "Scoring defaults, roster shape, and active league context",
    title: "League Defaults",
    body:
      "This section will become the persisted home for fantasy scoring preferences, roster structure, active-context selection, and future refresh controls.",
    panels: [
      {
        title: "Scoring and Roster Defaults",
        body:
          "The next slices will map `user_settings` directly onto your existing fantasy scoring configuration system without touching Draft Dashboard."
      },
      {
        title: "Active League Context",
        body:
          "The shell already reserves a stable place for active league switching so users can change context later without being pushed through a separate page flow."
      }
    ]
  },
  "saved-teams": {
    label: "Saved Teams",
    description: "Manual rosters, defaults, and future synced team choices",
    title: "Saved Teams",
    body:
      "This section will hold manual saved teams first, then support default-team selection for imported Yahoo, Fantrax, or future ESPN league/team records.",
    panels: [
      {
        title: "Manual Teams",
        body:
          "Upcoming work will add list, create, edit, and default-selection behavior for `user_saved_teams`."
      },
      {
        title: "Imported Team Targets",
        body:
          "This shell also reserves room for future multi-league and multi-team account connections, including default-team selection and in-place active switching."
      }
    ]
  },
  "connected-accounts": {
    label: "Connected Accounts",
    description: "Yahoo, Fantrax, ESPN, and future provider connections",
    title: "Connected Accounts",
    body:
      "Connected fantasy accounts stay separate from core site authentication. This section will host provider connection, sync, refresh, and cooldown controls.",
    panels: [
      {
        title: "Yahoo and Fantrax",
        body:
          "Future work will expose provider status, linked leagues, default team selection, and guarded manual refresh options with cooldown messaging."
      },
      {
        title: "ESPN and Future Providers",
        body:
          "The data model already leaves room for additional provider connectors without coupling them to the primary auth system."
      }
    ]
  },
  patreon: {
    label: "Patreon",
    description: "Entitlements, perk visibility, and linked Patreon state",
    title: "Patreon Entitlements",
    body:
      "Patreon remains an optional connected account for perk access, not a primary site login method. This section will later expose membership and entitlement state.",
    panels: [
      {
        title: "Entitlement Status",
        body:
          "Upcoming work will surface site-owned entitlement records separately from the Patreon identity itself."
      },
      {
        title: "Access Boundaries",
        body:
          "The planned model keeps Patreon sharing controls and entitlement checks separate from the core user login session."
      }
    ]
  }
};

function resolveSection(sectionValue: string | string[] | undefined): AccountSection {
  const rawSection = Array.isArray(sectionValue) ? sectionValue[0] : sectionValue;
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
  if (!rosterJson || Array.isArray(rosterJson) || typeof rosterJson !== "object") {
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
    year: "numeric"
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

  return settingsSnapshot.league_type === "categories" ? "categories" : "points";
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [leagueForm, setLeagueForm] = useState<UserLeagueSettings>(
    createDefaultUserLeagueSettings()
  );
  const [profileForm, setProfileForm] = useState({
    displayName: "",
    avatarUrl: "",
    timezone: ""
  });
  const [profileRecordState, setProfileRecordState] = useState<
    "unknown" | "present" | "missing" | "error"
  >("unknown");
  const [leagueRecordState, setLeagueRecordState] = useState<
    "unknown" | "present" | "missing" | "error"
  >("unknown");
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isLeagueLoading, setIsLeagueLoading] = useState(true);
  const [isLeagueSaving, setIsLeagueSaving] = useState(false);
  const [savedTeams, setSavedTeams] = useState<SavedTeamRow[]>([]);
  const [savedTeamForm, setSavedTeamForm] = useState({
    name: "",
    manualNotes: "",
    isDefault: false
  });
  const [editingSavedTeamId, setEditingSavedTeamId] = useState<string | null>(null);
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

  const activeSection = useMemo(
    () => resolveSection(router.query.section),
    [router.query.section]
  );
  const sectionConfig = SECTION_CONFIG[activeSection];
  const resolvedDisplayName =
    profileForm.displayName.trim() ||
    user?.displayName ||
    user?.email ||
    "Authenticated User";
  const resolvedAvatarUrl = profileForm.avatarUrl.trim() || user?.avatarUrl || "";

  function updateSection(section: AccountSection) {
    void router.replace(
      {
        pathname: "/account",
        query: { section }
      },
      undefined,
      { shallow: true }
    );
  }

  useEffect(() => {
    if (!user?.id) {
      setIsProfileLoading(false);
      setProfileRecordState("missing");
      return;
    }

    let isMounted = true;

    async function loadProfile() {
      setIsProfileLoading(true);
      setProfileFeedback(null);

      const { data, error } = await supabase
        .from("user_profiles")
        .select("display_name, avatar_url, timezone")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error) {
        setProfileRecordState("error");
        setProfileFeedback({
          tone: "error",
          message: error.message
        });
        setIsProfileLoading(false);
        return;
      }

      setProfileRecordState(data ? "present" : "missing");
      setProfileForm({
        displayName: data?.display_name || user.displayName || "",
        avatarUrl: data?.avatar_url || user.avatarUrl || "",
        timezone: data?.timezone || ""
      });
      setIsProfileLoading(false);
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [user?.avatarUrl, user?.displayName, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setLeagueForm(createDefaultUserLeagueSettings());
      setIsLeagueLoading(false);
      setLeagueRecordState("missing");
      return;
    }

    let isMounted = true;

    async function loadLeagueSettings() {
      setIsLeagueLoading(true);
      setLeagueFeedback(null);

      const { data, error } = await supabase
        .from("user_settings")
        .select(
          "league_type, scoring_categories, category_weights, roster_config, ui_preferences, active_context"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error) {
        setLeagueRecordState("error");
        setLeagueFeedback({
          tone: "error",
          message: error.message
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
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || activeSection !== "saved-teams") {
      return;
    }

    let isMounted = true;

    async function loadSavedTeams() {
      setIsSavedTeamsLoading(true);

      const { data, error } = await supabase
        .from("user_saved_teams")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!isMounted) {
        return;
      }

      if (error) {
        setSavedTeamsFeedback({
          tone: "error",
          message: error.message
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
          isDefault: nextTeams.length === 0
        }));
      }
      setIsSavedTeamsLoading(false);
    }

    void loadSavedTeams();

    return () => {
      isMounted = false;
    };
  }, [activeSection, user?.id]);

  function updateProfileField(field: keyof typeof profileForm, value: string) {
    setProfileForm((current) => ({
      ...current,
      [field]: value
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
        timezone: profileForm.timezone.trim() || null
      },
      {
        onConflict: "user_id"
      }
    );

    if (error) {
      setProfileFeedback({
        tone: "error",
        message: error.message
      });
      setIsProfileSaving(false);
      return;
    }

    setProfileFeedback({
      tone: "success",
      message: "Profile settings saved."
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
        account_settings_section: "league-settings"
      }
    }));
  }

  function updateLeagueNumberField(
    group: "scoringCategories" | "categoryWeights" | "rosterConfig",
    key: string,
    value: string
  ) {
    const nextValue = value === "" ? 0 : Number(value);
    setLeagueForm((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [key]: Number.isFinite(nextValue) ? nextValue : 0
      }
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
          account_settings_section: "league-settings"
        }
      }),
      {
        onConflict: "user_id"
      }
    );

    if (error) {
      setLeagueFeedback({
        tone: "error",
        message: error.message
      });
      setIsLeagueSaving(false);
      return;
    }

    setLeagueFeedback({
      tone: "success",
      message: "League defaults saved."
    });
    setLeagueRecordState("present");
    setIsLeagueSaving(false);
  }

  function resetSavedTeamForm(nextHasTeams = savedTeams.length > 0) {
    setEditingSavedTeamId(null);
    setSavedTeamForm({
      name: "",
      manualNotes: "",
      isDefault: !nextHasTeams
    });
  }

  function updateSavedTeamField(
    field: keyof typeof savedTeamForm,
    value: string | boolean
  ) {
    setSavedTeamForm((current) => ({
      ...current,
      [field]: value
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
      (team) => team.is_default && team.id !== nextDefaultId
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
      })
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
        message: "Team name is required."
      });
      return;
    }

    const shouldBeDefault =
      savedTeamForm.isDefault ||
      (editingSavedTeamId === null && savedTeams.every((team) => !team.is_default));

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
          manualNotes: savedTeamForm.manualNotes.trim()
        },
        settings_snapshot: settingsSnapshot,
        is_default: shouldBeDefault
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
        const { error } = await supabase.from("user_saved_teams").insert(payload);

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
          : "Saved team created."
      });
    } catch (error) {
      setSavedTeamsFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to save team."
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
      isDefault: team.is_default
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
          isDefault: true
        }));
      }
      setSavedTeamsFeedback({
        tone: "success",
        message: `"${team.name}" is now the default team.`
      });
    } catch (error) {
      setSavedTeamsFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Unable to change default team."
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
        message: `"${team.name}" was removed.`
      });
    } catch (error) {
      setSavedTeamsFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Unable to delete team."
      });
    }
  }

  const scoringEntries = useMemo(
    () => Object.entries(leagueForm.scoringCategories),
    [leagueForm.scoringCategories]
  );
  const categoryWeightEntries = useMemo(
    () => Object.entries(leagueForm.categoryWeights),
    [leagueForm.categoryWeights]
  );
  const rosterEntries = useMemo(
    () => Object.entries(leagueForm.rosterConfig),
    [leagueForm.rosterConfig]
  );

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.eyebrow}>Account Settings</div>
          <div className={styles.userName}>{resolvedDisplayName}</div>
          <div className={styles.userMeta}>
            {user?.email || "Signed-in account"}
          </div>

          <div className={styles.nav}>
            {(Object.entries(SECTION_CONFIG) as Array<
              [AccountSection, (typeof SECTION_CONFIG)[AccountSection]]
            >).map(([sectionKey, config]) => (
              <button
                key={sectionKey}
                type="button"
                className={`${styles.navButton} ${activeSection === sectionKey ? styles.navButtonActive : ""}`}
                onClick={() => updateSection(sectionKey)}
              >
                <span className={styles.navLabel}>{config.label}</span>
                <span className={styles.navDescription}>{config.description}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className={styles.content}>
          <header className={styles.header}>
            <div className={styles.eyebrow}>{sectionConfig.label}</div>
            <h1 className={styles.title}>{sectionConfig.title}</h1>
            <p className={styles.body}>{sectionConfig.body}</p>
          </header>

          <div className={styles.statusRow}>
            <span className={styles.statusPill}>
              Auth: {user?.isEmailVerified ? "verified" : "signed in"}
            </span>
            <span className={styles.statusPill}>Section: {sectionConfig.label}</span>
            <span className={styles.statusPill}>Route shell active</span>
          </div>

          <div className={styles.panelGrid}>
            {activeSection === "profile" ? (
              <div className={styles.panel}>
                <h2 className={styles.panelTitle}>Display Profile</h2>
                <div className={styles.profileEditor}>
                  <div className={styles.avatarCard}>
                    <div className={styles.avatarFrame}>
                      {resolvedAvatarUrl ? (
                        <img
                          src={resolvedAvatarUrl}
                          alt={resolvedDisplayName}
                          className={styles.avatarImage}
                        />
                      ) : (
                        <span className={styles.avatarFallback}>
                          {getUserInitials(resolvedDisplayName)}
                        </span>
                      )}
                    </div>
                    <div className={styles.avatarMeta}>
                      <div className={styles.avatarName}>{resolvedDisplayName}</div>
                      <div className={styles.avatarEmail}>
                        {user?.email || "Signed-in account"}
                      </div>
                    </div>
                  </div>

                  {isProfileLoading ? (
                    <div className={styles.profileLoading}>Loading profile fields...</div>
                  ) : (
                    <form
                      className={styles.profileForm}
                      onSubmit={(event) => void handleProfileSubmit(event)}
                    >
                      {profileRecordState === "missing" ? (
                        <div className={styles.infoMessage}>
                          Your profile record is not stored yet. The form is using your
                          current auth identity as a fallback, and saving will initialize
                          the profile row.
                        </div>
                      ) : null}

                      {profileRecordState === "error" ? (
                        <div className={styles.errorMessage} role="alert">
                          We could not load your saved profile row. You can retry by
                          refreshing or save again to attempt reinitialization.
                        </div>
                      ) : null}

                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>Display Name</span>
                        <input
                          type="text"
                          value={profileForm.displayName}
                          onChange={(event) =>
                            updateProfileField("displayName", event.target.value)
                          }
                          className={styles.input}
                          placeholder="How your account should appear"
                          disabled={isProfileSaving}
                        />
                      </label>

                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>Avatar URL</span>
                        <input
                          type="url"
                          value={profileForm.avatarUrl}
                          onChange={(event) =>
                            updateProfileField("avatarUrl", event.target.value)
                          }
                          className={styles.input}
                          placeholder="https://..."
                          disabled={isProfileSaving}
                        />
                      </label>

                      <label className={styles.field}>
                        <span className={styles.fieldLabel}>Timezone</span>
                        <input
                          type="text"
                          value={profileForm.timezone}
                          onChange={(event) =>
                            updateProfileField("timezone", event.target.value)
                          }
                          className={styles.input}
                          placeholder="America/Chicago"
                          disabled={isProfileSaving}
                        />
                      </label>

                      {profileFeedback ? (
                        <div
                          className={
                            profileFeedback.tone === "error"
                              ? styles.errorMessage
                              : styles.successMessage
                          }
                          role={profileFeedback.tone === "error" ? "alert" : undefined}
                        >
                          {profileFeedback.message}
                        </div>
                      ) : null}

                      <button
                        type="submit"
                        className={styles.saveButton}
                        disabled={isProfileSaving}
                      >
                        {isProfileSaving ? "Saving..." : "Save Profile"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ) : null}

            {activeSection === "league-settings" ? (
              <div className={styles.panel}>
                <h2 className={styles.panelTitle}>Scoring and Roster Defaults</h2>

                {isLeagueLoading ? (
                  <div className={styles.profileLoading}>Loading league defaults...</div>
                ) : (
                  <form
                    className={styles.settingsForm}
                    onSubmit={(event) => void handleLeagueSubmit(event)}
                  >
                    {leagueRecordState === "missing" ? (
                      <div className={styles.infoMessage}>
                        Your league defaults have not been saved yet. Site defaults are
                        shown here until you save your first personalized settings row.
                      </div>
                    ) : null}

                    {leagueRecordState === "error" ? (
                      <div className={styles.errorMessage} role="alert">
                        We could not load your stored league settings. The form is
                        showing safe defaults until the next successful save.
                      </div>
                    ) : null}

                    <div className={styles.formSection}>
                      <div className={styles.formSectionHeader}>
                        <h3 className={styles.formSectionTitle}>League Mode</h3>
                        <p className={styles.formSectionBody}>
                          These defaults persist independently from Draft Dashboard so
                          users can update account-level scoring without losing page state
                          elsewhere.
                        </p>
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
                    </div>

                    <div className={styles.formSection}>
                      <div className={styles.formSectionHeader}>
                        <h3 className={styles.formSectionTitle}>Points Scoring</h3>
                        <p className={styles.formSectionBody}>
                          These values map to the existing `scoringCategories` shape and
                          remain the active defaults whenever league type is set to
                          points.
                        </p>
                      </div>

                      <div className={styles.numericGrid}>
                        {scoringEntries.map(([key, value]) => (
                          <label key={key} className={styles.field}>
                            <span className={styles.fieldLabel}>Points: {key}</span>
                            <input
                              type="number"
                              step="0.05"
                              value={String(value)}
                              onChange={(event) =>
                                updateLeagueNumberField(
                                  "scoringCategories",
                                  key,
                                  event.target.value
                                )
                              }
                              className={styles.input}
                              disabled={isLeagueSaving}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className={styles.formSection}>
                      <div className={styles.formSectionHeader}>
                        <h3 className={styles.formSectionTitle}>Category Weights</h3>
                        <p className={styles.formSectionBody}>
                          These values are stored separately so categories leagues can
                          reuse the same account-level defaults later without coupling to
                          the dashboard screen.
                        </p>
                      </div>

                      <div className={styles.numericGrid}>
                        {categoryWeightEntries.map(([key, value]) => (
                          <label key={key} className={styles.field}>
                            <span className={styles.fieldLabel}>Weight: {key}</span>
                            <input
                              type="number"
                              step="0.1"
                              value={String(value)}
                              onChange={(event) =>
                                updateLeagueNumberField(
                                  "categoryWeights",
                                  key,
                                  event.target.value
                                )
                              }
                              className={styles.input}
                              disabled={isLeagueSaving}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className={styles.formSection}>
                      <div className={styles.formSectionHeader}>
                        <h3 className={styles.formSectionTitle}>Roster Defaults</h3>
                        <p className={styles.formSectionBody}>
                          These values map to your existing `rosterConfig` shape and give
                          the future league-sync flow a stable manual fallback.
                        </p>
                      </div>

                      <div className={styles.numericGrid}>
                        {rosterEntries.map(([key, value]) => (
                          <label key={key} className={styles.field}>
                            <span className={styles.fieldLabel}>Roster: {key}</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={String(value)}
                              onChange={(event) =>
                                updateLeagueNumberField(
                                  "rosterConfig",
                                  key,
                                  event.target.value
                                )
                              }
                              className={styles.input}
                              disabled={isLeagueSaving}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className={styles.formSection}>
                      <div className={styles.formSectionHeader}>
                        <h3 className={styles.formSectionTitle}>Active League Context</h3>
                        <p className={styles.formSectionBody}>
                          Active provider and team switching stays here later. For MVP,
                          this shows the currently persisted context placeholder so the
                          shape is visible without routing users away.
                        </p>
                      </div>

                      <div className={styles.contextSummary}>
                        <span className={styles.statusPill}>
                          Source: {leagueForm.activeContext.source_type}
                        </span>
                        <span className={styles.statusPill}>
                          Provider: {leagueForm.activeContext.provider || "manual"}
                        </span>
                        <span className={styles.statusPill}>
                          Team: {leagueForm.activeContext.external_team_id || "none"}
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
                        role={leagueFeedback.tone === "error" ? "alert" : undefined}
                      >
                        {leagueFeedback.message}
                      </div>
                    ) : null}

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
                        {isLeagueSaving ? "Saving..." : "Save League Defaults"}
                      </button>
                    </div>
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
                    <div className={styles.formSectionHeader}>
                      <h3 className={styles.formSectionTitle}>
                        {editingSavedTeamId ? "Edit Saved Team" : "Create Saved Team"}
                      </h3>
                      <p className={styles.formSectionBody}>
                        Manual teams store a lightweight roster note plus a snapshot of
                        your current league defaults, so future provider sync can coexist
                        with account-owned teams.
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
                          updateSavedTeamField("manualNotes", event.target.value)
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
                          updateSavedTeamField("isDefault", event.target.checked)
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
                        role={savedTeamsFeedback.tone === "error" ? "alert" : undefined}
                      >
                        {savedTeamsFeedback.message}
                      </div>
                    ) : null}

                    <div className={styles.actionRow}>
                      {editingSavedTeamId ? (
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={resetSavedTeamForm}
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
                      <h3 className={styles.formSectionTitle}>Saved Team List</h3>
                      <p className={styles.formSectionBody}>
                        The default badge marks the team the app should favor when later
                        provider-linked accounts expose multiple leagues or teams.
                      </p>
                    </div>

                    {isSavedTeamsLoading ? (
                      <div className={styles.profileLoading}>Loading saved teams...</div>
                    ) : savedTeams.length === 0 ? (
                      <div className={styles.emptyState}>
                        No manual saved teams yet. Create one here to establish a default
                        team before Yahoo, Fantrax, or ESPN connections are introduced.
                      </div>
                    ) : (
                      <div className={styles.savedTeamsStack}>
                        {savedTeams.map((team) => (
                          <div key={team.id} className={styles.savedTeamCard}>
                            <div className={styles.savedTeamHeader}>
                              <div>
                                <div className={styles.savedTeamName}>{team.name}</div>
                                <div className={styles.savedTeamMeta}>
                                  Updated {formatSavedTeamTimestamp(team.updated_at)}
                                </div>
                              </div>
                              {team.is_default ? (
                                <span className={styles.defaultBadge}>Default</span>
                              ) : null}
                            </div>

                            <div className={styles.savedTeamNotes}>
                              {getSavedTeamNotes(team.roster_json) || "No manual notes yet."}
                            </div>

                            <div className={styles.savedTeamMetaRow}>
                              <span className={styles.statusPill}>
                                Snapshot: {getSavedTeamLeagueType(team.settings_snapshot)}
                              </span>
                              <span className={styles.statusPill}>Source: manual</span>
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
                                  onClick={() => void handleSetDefaultSavedTeam(team)}
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
                <h2 className={styles.panelTitle}>Provider Connection Architecture</h2>

                <div className={styles.providerCardGrid}>
                  {CONNECTED_ACCOUNT_PROVIDERS.map((provider) => (
                    <div key={provider.key} className={styles.providerCard}>
                      <div className={styles.providerHeader}>
                        <div>
                          <div className={styles.providerName}>{provider.name}</div>
                          <div className={styles.providerLocation}>
                            {provider.location}
                          </div>
                        </div>
                        <span className={styles.providerStatus}>{provider.status}</span>
                      </div>

                      <p className={styles.providerSummary}>{provider.summary}</p>

                      <div className={styles.providerPillRow}>
                        <span className={styles.statusPill}>Core auth stays separate</span>
                        <span className={styles.statusPill}>No live token flow yet</span>
                      </div>

                      <div className={styles.providerBulletList}>
                        {provider.bullets.map((bullet) => (
                          <div key={bullet} className={styles.providerBullet}>
                            {bullet}
                          </div>
                        ))}
                      </div>

                      <div className={styles.providerFooter}>
                        This card is architectural only in MVP. Real OAuth, token
                        storage, sync runs, and refresh controls remain deferred.
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.providerControlGrid}>
                  {FUTURE_PROVIDER_CONTROL_SURFACES.map((surface) => (
                    <div key={surface.title} className={styles.providerControlCard}>
                      <div className={styles.formSectionHeader}>
                        <h3 className={styles.formSectionTitle}>{surface.title}</h3>
                        <p className={styles.formSectionBody}>{surface.body}</p>
                      </div>

                      <div className={styles.providerControlRows}>
                        {surface.rows.map((row) => (
                          <div key={row} className={styles.providerControlRow}>
                            {row}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {activeSection === "patreon" ? (
              <div className={styles.panel}>
                <h2 className={styles.panelTitle}>Patreon Account Link and Entitlements</h2>

                <div className={styles.providerControlGrid}>
                  <div className={styles.providerControlCard}>
                    <div className={styles.formSectionHeader}>
                      <h3 className={styles.formSectionTitle}>Connection Intent</h3>
                      <p className={styles.formSectionBody}>
                        Patreon is linked here from account settings only. It should
                        never become the primary site login path, and it does not need
                        to share the same email address as the site auth identity.
                      </p>
                    </div>

                    <div className={styles.providerControlRows}>
                      <div className={styles.providerControlRow}>
                        Connection location: account settings, not auth modal
                      </div>
                      <div className={styles.providerControlRow}>
                        Login separation: Patreon identity stays distinct from Supabase
                        app auth
                      </div>
                      <div className={styles.providerControlRow}>
                        Future action: connect Patreon account to evaluate paid access
                      </div>
                    </div>
                  </div>

                  <div className={styles.providerControlCard}>
                    <div className={styles.formSectionHeader}>
                      <h3 className={styles.formSectionTitle}>Entitlement Model</h3>
                      <p className={styles.formSectionBody}>
                        Site access should be granted from site-owned entitlements, not
                        directly from the raw Patreon account record. This leaves room for
                        future sync reconciliation and perk history.
                      </p>
                    </div>

                    <div className={styles.providerControlRows}>
                      <div className={styles.providerControlRow}>
                        Current entitlement state: placeholder only
                      </div>
                      <div className={styles.providerControlRow}>
                        Perk mapping: future site-owned access tiers and feature flags
                      </div>
                      <div className={styles.providerControlRow}>
                        Last Patreon sync: future membership reconciliation timestamp
                      </div>
                    </div>
                  </div>

                  <div className={styles.providerControlCard}>
                    <div className={styles.formSectionHeader}>
                      <h3 className={styles.formSectionTitle}>Anti-Sharing Controls</h3>
                      <p className={styles.formSectionBody}>
                        Patreon account sharing needs explicit protection. The future
                        model will prevent one Patreon identity from being attached to
                        multiple user accounts for perk access.
                      </p>
                    </div>

                    <div className={styles.providerControlRows}>
                      <div className={styles.providerControlRow}>
                        Duplicate attachment check: planned single-account Patreon identity rule
                      </div>
                      <div className={styles.providerControlRow}>
                        Access audit trail: future entitlement-change history
                      </div>
                      <div className={styles.providerControlRow}>
                        Failure state: clear mismatch messaging without blocking core site auth
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {sectionConfig.panels.map((panel) => (
              <div key={panel.title} className={styles.panel}>
                <h2 className={styles.panelTitle}>{panel.title}</h2>
                <p className={styles.panelBody}>{panel.body}</p>
              </div>
            ))}

            <div className={styles.emptyState}>
              This authenticated shell is intentionally incremental. The next
              `5.x` slices will wire saved team records, connected-account
              placeholders, provider refresh states, and guarded missing-row
              handling into the same layout.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import supabase from "lib/supabase/client";
import type { Database } from "lib/supabase/database-generated.types";
import {
  FANTRAX_CONSENT_VERSION,
  type FantraxConnectionAccount,
  type FantraxConnectionLeague,
  type FantraxDiscoveredLeague,
  type FantraxLeagueSettingsV1,
} from "lib/integrations/fantrax/contracts";
import {
  fantraxAccountRequest,
  useFantraxConnections,
} from "hooks/useFantraxConnections";
import type { UserLeagueSettings } from "lib/user-settings/defaults";
import { mapUserSettingsRowToLeagueSettings } from "lib/user-settings/mappers";

import styles from "./FantraxImportPanel.module.scss";

type ConnectedAccountRow =
  Database["public"]["Tables"]["connected_accounts"]["Row"];
type ExternalLeagueRow =
  Database["public"]["Tables"]["external_leagues"]["Row"];
type ExternalTeamRow = Database["public"]["Tables"]["external_teams"]["Row"];
type PreferencesRow =
  Database["public"]["Tables"]["user_provider_preferences"]["Row"];
type SyncRunRow = Database["public"]["Tables"]["provider_sync_runs"]["Row"];

type ManualImportState = {
  account: ConnectedAccountRow | null;
  accounts: ConnectedAccountRow[];
  leagues: ExternalLeagueRow[];
  teams: ExternalTeamRow[];
  preferences: PreferencesRow | null;
  latestRun: SyncRunRow | null;
};

const EMPTY_STATE: ManualImportState = {
  account: null,
  accounts: [],
  leagues: [],
  teams: [],
  preferences: null,
  latestRun: null,
};

export type ManualImportPanelConfig = {
  providerName: string;
  endpoint: string;
  panelId: string;
  accountLabelExample: string;
  description: string;
};

const FANTRAX_PANEL_CONFIG: ManualImportPanelConfig = {
  providerName: "Fantrax",
  endpoint: "/api/v1/account/fantrax/import",
  panelId: "fantrax-import-title",
  accountLabelExample: "My Fantrax leagues",
  description: "Import your Fantrax leagues from a CSV or JSON file.",
};

function jsonExample(config: ManualImportPanelConfig) {
  return `{
  "accountLabel": "${config.accountLabelExample}",
  "leagues": [
    {
      "key": "league-123",
      "name": "Keeper League",
      "season": "2026",
      "teams": [
        { "key": "team-1", "name": "My Team", "isDefault": true }
      ]
    }
  ]
}`;
}

async function accessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Your session expired. Sign in again before importing.");
  }
  return session.access_token;
}

function ManualImportPanel({ config }: { config: ManualImportPanelConfig }) {
  const [state, setState] = useState<ManualImportState>(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState("");
  const [targetConnectedAccountId, setTargetConnectedAccountId] = useState("");
  const [feedback, setFeedback] = useState<{
    tone: "error" | "success" | "info";
    message: string;
  } | null>(null);

  const loadState = useCallback(async () => {
    const token = await accessToken();
    const response = await fetch(config.endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(
        body.error ||
          `${config.providerName} import state could not be loaded.`,
      );
    }
    setState({ ...EMPTY_STATE, ...body });
  }, [config.endpoint, config.providerName]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    loadState()
      .catch((error) => {
        if (active) {
          setFeedback({
            tone: "error",
            message:
              error instanceof Error
                ? error.message
                : `${config.providerName} import state could not be loaded.`,
          });
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [config.providerName, loadState]);

  const defaultTeam = useMemo(
    () =>
      state.teams.find(
        (team) => team.id === state.preferences?.default_external_team_id,
      ) || null,
    [state.preferences?.default_external_team_id, state.teams],
  );
  const activeContext = state.preferences?.active_context;
  const activeTeamValue =
    activeContext && !Array.isArray(activeContext)
      ? (activeContext as Record<string, unknown>).external_team_id
      : null;
  const activeTeamId =
    typeof activeTeamValue === "string" ? activeTeamValue : null;
  const isCoolingDown = Boolean(
    state.latestRun?.cooldown_until &&
    new Date(state.latestRun.cooldown_until).getTime() > Date.now(),
  );
  const isRunning =
    state.latestRun?.status === "running" ||
    state.latestRun?.status === "queued";

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const importContent = file ? await file.text() : content.trim();
      if (!importContent) {
        throw new Error("Choose a CSV/JSON file or paste JSON first.");
      }
      const inferredFormat = file?.name.toLowerCase().endsWith(".csv")
        ? "csv"
        : file?.name.toLowerCase().endsWith(".json")
          ? "json"
          : importContent.trimStart().startsWith("{")
            ? "json"
            : "csv";
      const token = await accessToken();
      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          format: inferredFormat,
          content: importContent,
          targetConnectedAccountId: targetConnectedAccountId || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || `${config.providerName} import failed.`);
      }
      setFeedback({ tone: "success", message: body.message });
      setFile(null);
      setContent("");
      await loadState();
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : `${config.providerName} import failed.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDefaultTeam(teamId: string) {
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const token = await accessToken();
      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "set_default_team", teamId }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(
          body.error ||
            `${config.providerName} default team could not be updated.`,
        );
      }
      setFeedback({ tone: "success", message: body.message });
      await loadState();
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : `${config.providerName} default team could not be updated.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleActiveTeam(teamId: string) {
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const token = await accessToken();
      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "set_active_team", teamId }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(
          body.error ||
            `${config.providerName} active context could not be updated.`,
        );
      }
      setFeedback({ tone: "success", message: body.message });
      await loadState();
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : `${config.providerName} active context could not be updated.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby={config.panelId}>
      <header className={styles.header}>
        <div>
          <h3 id={config.panelId}>{config.providerName} Manual Import</h3>
          <p>{config.description}</p>
        </div>
        <span className={styles.status}>
          {isLoading
            ? "Loading"
            : state.account?.status === "connected"
              ? "Imported"
              : state.account?.status === "error"
                ? "Needs attention"
                : "Ready"}
        </span>
      </header>

      {feedback ? (
        <div
          className={styles[feedback.tone]}
          role={feedback.tone === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </div>
      ) : null}

      <form className={styles.form} onSubmit={handleImport}>
        {state.accounts.length > 0 ? (
          <label className={styles.field}>
            <span>Import into account</span>
            <select
              value={targetConnectedAccountId}
              onChange={(event) => setTargetConnectedAccountId(event.target.value)}
              disabled={isSubmitting}
              required
            >
              <option value="">Choose an account</option>
              {state.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_label || config.providerName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className={styles.field}>
          <span>CSV or JSON file</span>
          <input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            disabled={isSubmitting}
          />
        </label>
        <div className={styles.or}>or paste JSON</div>
        <label className={styles.field}>
          <span>{config.providerName} import JSON</span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={jsonExample(config)}
            rows={5}
            disabled={isSubmitting || Boolean(file)}
          />
        </label>
        <details className={styles.formatHelp}>
          <summary>CSV format and limits</summary>
          <p className={styles.hint}>
            CSV requires league_name and team_name. Optional columns include
            league_id, season, team_id, is_default, player_id, player_name,
            position, status, and *_json fields. Imports are limited to 50
            leagues, 250 teams, 10,000 rows, and 512 KB.
          </p>
        </details>
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={
            isSubmitting ||
            isLoading ||
            isRunning ||
            isCoolingDown ||
            (state.accounts.length > 0 && !targetConnectedAccountId)
          }
        >
          {isSubmitting
            ? "Importing…"
            : isRunning
              ? "Import in progress"
              : isCoolingDown
                ? "Import cooling down"
                : `Import ${config.providerName} Data`}
        </button>
      </form>

      <div className={styles.summary}>
        <div>
          Latest import: {state.latestRun?.status || "No import yet"}
          {state.latestRun?.cooldown_until
            ? ` · next eligible ${new Date(state.latestRun.cooldown_until).toLocaleString()}`
            : ""}
        </div>
        <div>
          Stored: {state.leagues.length} league
          {state.leagues.length === 1 ? "" : "s"} · {state.teams.length} team
          {state.teams.length === 1 ? "" : "s"}
        </div>
        <div>Default team: {defaultTeam?.team_name || "Not selected"}</div>
        <div>
          Active team:{" "}
          {state.teams.find((team) => team.id === activeTeamId)?.team_name ||
            "Not selected"}
        </div>
      </div>

      {state.leagues.length > 0 ? (
        <div className={styles.leagueGrid}>
          {state.leagues.map((league) => {
            const teams = state.teams.filter(
              (team) => team.external_league_id === league.id,
            );
            return (
              <article key={league.id} className={styles.leagueCard}>
                <h4>{league.league_name || league.external_league_key}</h4>
                <div className={styles.leagueMeta}>
                  {league.season_key ? `Season ${league.season_key} · ` : ""}
                  {teams.length} team{teams.length === 1 ? "" : "s"}
                </div>
                <div className={styles.teamList}>
                  {teams.map((team) => (
                    <div key={team.id} className={styles.teamRow}>
                      <span>{team.team_name || team.external_team_key}</span>
                      <div className={styles.teamActions}>
                        {activeTeamId === team.id ? (
                          <span className={styles.defaultBadge}>Active</span>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Use ${team.team_name || team.external_team_key} as active context`}
                            onClick={() => void handleActiveTeam(team.id)}
                            disabled={isSubmitting}
                          >
                            Use active
                          </button>
                        )}
                        {defaultTeam?.id === team.id ? (
                          <span className={styles.defaultBadge}>Default</span>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Make ${team.team_name || team.external_team_key} the default team`}
                            onClick={() => void handleDefaultTeam(team.id)}
                            disabled={isSubmitting}
                          >
                            Make default
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          No {config.providerName} leagues have been imported yet.
        </div>
      )}
    </section>
  );
}

type DiscoveryResponse = {
  leagues: FantraxDiscoveredLeague[];
  previews: FantraxLeagueSettingsV1[];
};

type PanelFeedback = {
  tone: "error" | "success" | "info";
  message: string;
};

function formatTimestamp(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not synced yet";
}

function mapSummary(value: Record<string, number>) {
  const entries = Object.entries(value);
  return entries.length
    ? entries.map(([key, points]) => `${key}: ${points}`).join(", ")
    : "No exact mappings";
}

function warningText(settings: FantraxLeagueSettingsV1) {
  return [
    ...settings.diagnostics.unsupported.map(
      (item) => `${item.label} (${item.code}): ${item.reason}`,
    ),
    ...settings.diagnostics.warnings,
  ];
}

function LeagueMapping({ settings }: { settings: FantraxLeagueSettingsV1 }) {
  const warnings = warningText(settings);
  return (
    <details
      className={styles.mappingDetails}
      open={settings.diagnostics.status !== "supported"}
    >
      <summary>
        {settings.leagueName} · {settings.leagueType} · {settings.diagnostics.status}
      </summary>
      <dl className={styles.mappingGrid}>
        <div>
          <dt>Skater points</dt>
          <dd>{mapSummary(settings.skaterScoringCategories)}</dd>
        </div>
        <div>
          <dt>Goalie points</dt>
          <dd>{mapSummary(settings.goalieScoringCategories)}</dd>
        </div>
        <div>
          <dt>Category weights</dt>
          <dd>{mapSummary(settings.categoryWeights)}</dd>
        </div>
        <div>
          <dt>Roster</dt>
          <dd>{mapSummary(settings.rosterConfig)}</dd>
        </div>
        <div>
          <dt>League shape</dt>
          <dd>
            {settings.teamCount ?? "Unknown"} teams · {settings.draftOrderType} draft
          </dd>
        </div>
      </dl>
      {warnings.length ? (
        <div className={styles.warningList}>
          <strong>Omitted or inexact Fantrax rules</strong>
          <ul>
            {warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.mappingSuccess}>All imported settings map exactly.</p>
      )}
    </details>
  );
}

function FantraxSettingsPanel({
  onSettingsApplied,
}: {
  onSettingsApplied?: (settings: UserLeagueSettings) => void;
}) {
  const { data, isLoading, error, reload } = useFantraxConnections();
  const [secretId, setSecretId] = useState("");
  const [accountLabel, setAccountLabel] = useState("My Fantrax account");
  const [discovered, setDiscovered] = useState<FantraxDiscoveredLeague[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [previews, setPreviews] = useState<FantraxLeagueSettingsV1[]>([]);
  const [consented, setConsented] = useState(false);
  const [targetAccountId, setTargetAccountId] = useState<string | null>(null);
  const [usingStoredCredential, setUsingStoredCredential] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<PanelFeedback | null>(null);

  function resetWorkflow() {
    setSecretId("");
    setAccountLabel("My Fantrax account");
    setDiscovered([]);
    setSelectedKeys([]);
    setPreviews([]);
    setConsented(false);
    setTargetAccountId(null);
    setUsingStoredCredential(false);
  }

  function toggleLeague(key: string) {
    setSelectedKeys((current) =>
      current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key],
    );
    setPreviews([]);
  }

  async function handleDiscover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("discover");
    setFeedback(null);
    try {
      const result = await fantraxAccountRequest<DiscoveryResponse>(
        "/api/v1/account/fantrax/discover",
        {
          method: "POST",
          body: JSON.stringify({ secretId }),
        },
      );
      setDiscovered(result.leagues);
      setSelectedKeys([]);
      setPreviews([]);
      setUsingStoredCredential(false);
      setFeedback({
        tone: "info",
        message: "Choose the NHL leagues FHFH may store and refresh.",
      });
    } catch (requestError) {
      setFeedback({
        tone: "error",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Fantrax discovery failed.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePreview() {
    if (!selectedKeys.length) return;
    setBusyAction("preview");
    setFeedback(null);
    try {
      const result = await fantraxAccountRequest<DiscoveryResponse>(
        "/api/v1/account/fantrax/discover",
        {
          method: "POST",
          body: JSON.stringify({
            ...(usingStoredCredential && targetAccountId
              ? { accountId: targetAccountId }
              : { secretId }),
            selectedLeagueKeys: selectedKeys,
          }),
        },
      );
      setDiscovered(result.leagues);
      setPreviews(result.previews);
    } catch (requestError) {
      setFeedback({
        tone: "error",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Fantrax preview failed.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCommit() {
    if (previews.some((preview) => preview.diagnostics.status === "unsupported")) {
      setFeedback({
        tone: "error",
        message: "Unsupported Fantrax league settings cannot be linked.",
      });
      return;
    }
    const hasCurrentPreview =
      (usingStoredCredential && selectedKeys.length === 0) ||
      (previews.length === selectedKeys.length &&
        selectedKeys.every((key) =>
          previews.some((preview) => preview.externalLeagueKey === key),
        ));
    if (!hasCurrentPreview) {
      setFeedback({ tone: "error", message: "Preview the selected leagues first." });
      return;
    }
    if (!usingStoredCredential && !consented) {
      setFeedback({ tone: "error", message: "Consent is required before linking." });
      return;
    }
    setBusyAction("commit");
    setFeedback(null);
    try {
      if (usingStoredCredential && targetAccountId) {
        await fantraxAccountRequest(
          `/api/v1/account/fantrax/connections/${targetAccountId}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              accountLabel,
              selectedLeagueKeys: selectedKeys,
            }),
          },
        );
      } else {
        await fantraxAccountRequest("/api/v1/account/fantrax/link", {
          method: "POST",
          body: JSON.stringify({
            secretId,
            accountLabel,
            selectedLeagueKeys: selectedKeys,
            consentVersion: FANTRAX_CONSENT_VERSION,
            targetAccountId,
          }),
        });
      }
      await reload();
      resetWorkflow();
      setFeedback({
        tone: "success",
        message: "Fantrax account linked. Defaults were not changed.",
      });
    } catch (requestError) {
      setFeedback({
        tone: "error",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Fantrax account could not be saved.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function beginManage(account: FantraxConnectionAccount) {
    setBusyAction(`manage:${account.id}`);
    setFeedback(null);
    try {
      const result = await fantraxAccountRequest<DiscoveryResponse>(
        "/api/v1/account/fantrax/discover",
        {
          method: "POST",
          body: JSON.stringify({ accountId: account.id }),
        },
      );
      setTargetAccountId(account.id);
      setAccountLabel(account.label);
      setUsingStoredCredential(true);
      setDiscovered(result.leagues);
      setSelectedKeys(account.leagues.map((league) => league.externalLeagueKey));
      setPreviews(account.leagues.map((league) => league.settings));
      setConsented(true);
    } catch (requestError) {
      setFeedback({
        tone: "error",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Fantrax leagues could not be managed.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  function beginReconnect(account: FantraxConnectionAccount) {
    resetWorkflow();
    setTargetAccountId(account.id);
    setAccountLabel(account.label);
    setFeedback({
      tone: "info",
      message: "Paste the current Secret ID to reconnect this account.",
    });
  }

  async function handleRefresh(accountId: string, externalLeagueId?: string) {
    const action = `refresh:${externalLeagueId || accountId}`;
    setBusyAction(action);
    setFeedback(null);
    try {
      await fantraxAccountRequest("/api/v1/account/fantrax/refresh", {
        method: "POST",
        body: JSON.stringify({ accountId, externalLeagueId }),
      });
      await reload();
      setFeedback({ tone: "success", message: "Fantrax settings refreshed." });
    } catch (requestError) {
      setFeedback({
        tone: "error",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Fantrax refresh failed.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleApply(league: FantraxConnectionLeague) {
    const warnings = warningText(league.settings);
    if (
      league.settings.diagnostics.status === "partial" &&
      !window.confirm(
        `Apply this partial mapping? The following rules will be omitted:\n\n${warnings.join("\n")}`,
      )
    ) {
      return;
    }
    setBusyAction(`apply:${league.id}`);
    setFeedback(null);
    try {
      const ownedTeam =
        league.teams.find((team) => team.isOwned) ?? league.teams[0] ?? null;
      const result = await fantraxAccountRequest<{
        settings: Database["public"]["Tables"]["user_settings"]["Row"];
      }>("/api/v1/account/fantrax/apply-settings", {
        method: "POST",
        body: JSON.stringify({
          externalLeagueId: league.id,
          externalTeamId: ownedTeam?.id,
          settingsHash: league.settings.sourceHash,
          acknowledgeWarnings: league.settings.diagnostics.status === "partial",
        }),
      });
      onSettingsApplied?.(mapUserSettingsRowToLeagueSettings(result.settings));
      await reload();
      setFeedback({
        tone: "success",
        message: `${league.name} is now your Fantrax account default.`,
      });
    } catch (requestError) {
      setFeedback({
        tone: "error",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Fantrax settings could not be applied.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDisconnect(account: FantraxConnectionAccount) {
    if (!window.confirm(`Disconnect ${account.label}? Imported API data will be removed.`)) {
      return;
    }
    setBusyAction(`disconnect:${account.id}`);
    setFeedback(null);
    try {
      await fantraxAccountRequest(
        `/api/v1/account/fantrax/connections/${account.id}`,
        { method: "DELETE" },
      );
      await reload();
      setFeedback({ tone: "success", message: "Fantrax account disconnected." });
    } catch (requestError) {
      setFeedback({
        tone: "error",
        message:
          requestError instanceof Error
            ? requestError.message
            : "Fantrax account could not be disconnected.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="fantrax-settings-title">
      <header className={styles.header}>
        <div>
          <h3 id="fantrax-settings-title">Fantrax League Settings</h3>
          <p>
            Link Secret IDs server-side, choose NHL leagues, review exact mappings,
            and explicitly apply one league as your account default.
          </p>
        </div>
        <span className={styles.status}>
          {isLoading ? "Loading" : `${data.accounts.length} linked`}
        </span>
      </header>

      {!data.apiEnabled ? (
        <div className={styles.info}>
          Fantrax API linking is currently limited to the private beta. CSV/JSON
          import remains available under Advanced.
        </div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}
      {feedback ? (
        <div
          className={styles[feedback.tone]}
          role={feedback.tone === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </div>
      ) : null}

      {data.apiEnabled ? (
        <form className={styles.linkForm} onSubmit={handleDiscover}>
          <div className={styles.formSectionHeader}>
            <strong>
              {targetAccountId
                ? usingStoredCredential
                  ? "Manage linked account"
                  : "Reconnect Fantrax account"
                : "Add Fantrax account"}
            </strong>
            {targetAccountId ? (
              <button type="button" onClick={resetWorkflow} className={styles.textButton}>
                Cancel
              </button>
            ) : null}
          </div>
          <label className={styles.field}>
            <span>Account label</span>
            <input
              value={accountLabel}
              maxLength={80}
              onChange={(event) => setAccountLabel(event.target.value)}
              disabled={busyAction != null}
            />
          </label>
          {!usingStoredCredential ? (
            <label className={styles.field}>
              <span>Fantrax Secret ID</span>
              <input
                type="password"
                autoComplete="off"
                value={secretId}
                onChange={(event) => setSecretId(event.target.value)}
                disabled={busyAction != null}
                required
              />
              <small>
                Find this on your Fantrax User Profile. FHFH sends it only to the
                server and stores it in Supabase Vault; it is never displayed again.
              </small>
            </label>
          ) : null}
          {!usingStoredCredential ? (
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={busyAction != null}
            >
              {busyAction === "discover" ? "Discovering…" : "Discover NHL leagues"}
            </button>
          ) : null}

          {discovered.length ? (
            <fieldset className={styles.leaguePicker}>
              <legend>Leagues to sync</legend>
              {discovered.map((league) => (
                <label key={league.externalLeagueKey} className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={selectedKeys.includes(league.externalLeagueKey)}
                    onChange={() => toggleLeague(league.externalLeagueKey)}
                    disabled={busyAction != null}
                  />
                  <span>
                    <strong>{league.name}</strong>
                    <small>
                      {league.ownedTeams.length
                        ? `Owned: ${league.ownedTeams.map((team) => team.name).join(", ")}`
                        : "No owned team was identified"}
                    </small>
                  </span>
                </label>
              ))}
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => void handlePreview()}
                disabled={!selectedKeys.length || busyAction != null}
              >
                {busyAction === "preview" ? "Building preview…" : "Preview mappings"}
              </button>
            </fieldset>
          ) : null}

          {previews.map((preview) => (
            <LeagueMapping key={preview.externalLeagueKey} settings={preview} />
          ))}

          {previews.length && !usingStoredCredential ? (
            <label className={styles.consentRow}>
              <input
                type="checkbox"
                checked={consented}
                onChange={(event) => setConsented(event.target.checked)}
              />
              <span>
                I consent to FHFH storing this Secret ID in Supabase Vault and
                refreshing the selected league settings about once per day.
              </span>
            </label>
          ) : null}

          {previews.length || (usingStoredCredential && discovered.length) ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleCommit()}
              disabled={
                busyAction != null ||
                previews.some(
                  (preview) => preview.diagnostics.status === "unsupported",
                ) ||
                (!usingStoredCredential && !consented)
              }
            >
              {busyAction === "commit"
                ? "Saving…"
                : usingStoredCredential
                  ? "Save league selection"
                  : "Confirm and link"}
            </button>
          ) : null}
        </form>
      ) : null}

      <div className={styles.accountGrid}>
        {data.accounts.map((account) => (
          <article key={account.id} className={styles.accountCard}>
            <div className={styles.cardHeader}>
              <div>
                <h4>{account.label}</h4>
                <div className={styles.leagueMeta}>
                  {account.status} · last sync {formatTimestamp(account.lastSyncedAt)}
                </div>
              </div>
              <div className={styles.teamActions}>
                {data.apiEnabled && account.integrationModes.includes("api") ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void beginManage(account)}
                      disabled={busyAction != null}
                    >
                      Manage leagues
                    </button>
                    <button
                      type="button"
                      onClick={() => beginReconnect(account)}
                      disabled={busyAction != null}
                    >
                      Reconnect
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRefresh(account.id)}
                      disabled={busyAction != null}
                    >
                      Refresh
                    </button>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      onClick={() => void handleDisconnect(account)}
                      disabled={busyAction != null}
                    >
                      Disconnect
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            {account.leagues.map((league) => (
              <div key={league.id} className={styles.linkedLeague}>
                <div className={styles.cardHeader}>
                  <div>
                    <strong>{league.name}</strong>
                    <div className={styles.leagueMeta}>
                      {league.teams.map((team) => team.name).join(", ") || "No owned team"}
                    </div>
                  </div>
                  <div className={styles.badgeRow}>
                    {league.isDefault ? (
                      <span className={styles.defaultBadge}>Account default</span>
                    ) : null}
                    {league.settingsChanged ? (
                      <span className={styles.changedBadge}>Settings changed</span>
                    ) : null}
                  </div>
                </div>
                <LeagueMapping settings={league.settings} />
                <div className={styles.teamActions}>
                  <button
                    type="button"
                    onClick={() => void handleRefresh(account.id, league.id)}
                    disabled={busyAction != null}
                  >
                    Refresh league
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleApply(league)}
                    disabled={
                      busyAction != null ||
                      league.settings.diagnostics.status === "unsupported"
                    }
                  >
                    Apply as account default
                  </button>
                </div>
              </div>
            ))}
          </article>
        ))}
      </div>

      <details className={styles.advanced}>
        <summary>Advanced: CSV/JSON import</summary>
        <ManualImportPanel config={FANTRAX_PANEL_CONFIG} />
      </details>
    </section>
  );
}

export default function FantraxImportPanel({
  config = FANTRAX_PANEL_CONFIG,
  onSettingsApplied,
}: {
  config?: ManualImportPanelConfig;
  onSettingsApplied?: (settings: UserLeagueSettings) => void;
}) {
  if (config.providerName !== "Fantrax") {
    return <ManualImportPanel config={config} />;
  }
  return <FantraxSettingsPanel onSettingsApplied={onSettingsApplied} />;
}

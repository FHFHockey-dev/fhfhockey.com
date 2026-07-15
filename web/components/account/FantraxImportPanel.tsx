import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import supabase from "lib/supabase/client";
import type { Database } from "lib/supabase/database-generated.types";

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
  leagues: ExternalLeagueRow[];
  teams: ExternalTeamRow[];
  preferences: PreferencesRow | null;
  latestRun: SyncRunRow | null;
};

const EMPTY_STATE: ManualImportState = {
  account: null,
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
  description:
    "Import owner-supplied CSV or JSON without sharing Fantrax credentials. Matching league/team keys update in place; omitted records are never deleted.",
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

export default function FantraxImportPanel({
  config = FANTRAX_PANEL_CONFIG,
}: {
  config?: ManualImportPanelConfig;
}) {
  const [state, setState] = useState<ManualImportState>(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState("");
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
  }, [loadState]);

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
            rows={9}
            disabled={isSubmitting || Boolean(file)}
          />
        </label>
        <p className={styles.hint}>
          CSV requires league_name and team_name. Optional columns include
          league_id, season, team_id, is_default, player_id, player_name,
          position, status, and *_json metadata/settings fields. One import is
          limited to 50 leagues, 250 teams, 10,000 CSV rows, and 512 KB.
        </p>
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={isSubmitting || isLoading || isRunning || isCoolingDown}
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
          No {config.providerName} leagues have been imported. The first valid
          import creates the provider account and active/default context.
        </div>
      )}
    </section>
  );
}

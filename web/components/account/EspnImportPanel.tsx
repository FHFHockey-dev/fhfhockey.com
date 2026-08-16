import { type FormEvent, useState } from "react";

import {
  ESPN_CONSENT_VERSION,
  type EspnConnectionAccount,
  type EspnConnectionLeague,
  type EspnLeagueSettingsV1,
} from "lib/integrations/espn/contracts";
import {
  espnAccountRequest,
  useEspnConnections,
} from "hooks/useEspnConnections";
import type { Database } from "lib/supabase/database-generated.types";
import type { UserLeagueSettings } from "lib/user-settings/defaults";
import { mapUserSettingsRowToLeagueSettings } from "lib/user-settings/mappers";

import FantraxImportPanel, {
  type ManualImportPanelConfig,
} from "./FantraxImportPanel";
import styles from "./FantraxImportPanel.module.scss";

const ESPN_PANEL_CONFIG: ManualImportPanelConfig = {
  providerName: "ESPN",
  endpoint: "/api/v1/account/espn/import",
  panelId: "espn-import-title",
  accountLabelExample: "My ESPN leagues",
  description: "Import ESPN league and team metadata from a CSV or JSON file.",
};

type Workflow = "link" | "add-league" | "reconnect";
type Feedback = { tone: "error" | "success" | "info"; message: string };

function defaultEspnSeason() {
  const now = new Date();
  return String(now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear());
}

function formatTimestamp(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Not synced yet";
}

function mapSummary(value: Record<string, number>) {
  const entries = Object.entries(value);
  return entries.length
    ? entries.map(([key, points]) => `${key}: ${points}`).join(", ")
    : "No exact mappings";
}

function warningText(settings: EspnLeagueSettingsV1) {
  return [
    ...settings.diagnostics.unsupported.map(
      (item) => `${item.label} (${item.code}): ${item.reason}`,
    ),
    ...settings.diagnostics.warnings,
  ];
}

function LeagueMapping({ settings }: { settings: EspnLeagueSettingsV1 }) {
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
        <div>
          <dt>Live draft</dt>
          <dd>{settings.liveDraftSupported ? "Ordered draft supported" : "Manual only"}</dd>
        </div>
      </dl>
      {warnings.length ? (
        <div className={styles.warningList}>
          <strong>Omitted or unsupported ESPN rules</strong>
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

export default function EspnImportPanel({
  onSettingsApplied,
}: {
  onSettingsApplied?: (settings: UserLeagueSettings) => void;
}) {
  const { data, isLoading, error, reload } = useEspnConnections();
  const [workflow, setWorkflow] = useState<Workflow>("link");
  const [targetAccountId, setTargetAccountId] = useState<string | null>(null);
  const [accountLabel, setAccountLabel] = useState("My ESPN account");
  const [swid, setSwid] = useState("");
  const [espnS2, setEspnS2] = useState("");
  const [leagueRef, setLeagueRef] = useState("");
  const [season, setSeason] = useState(defaultEspnSeason);
  const [consented, setConsented] = useState(false);
  const [selectedTeamByLeague, setSelectedTeamByLeague] = useState<
    Record<string, string>
  >({});
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  function resetWorkflow() {
    setWorkflow("link");
    setTargetAccountId(null);
    setAccountLabel("My ESPN account");
    setSwid("");
    setEspnS2("");
    setLeagueRef("");
    setSeason(defaultEspnSeason());
    setConsented(false);
  }

  function beginWorkflow(next: Workflow, account: EspnConnectionAccount) {
    setWorkflow(next);
    setTargetAccountId(account.id);
    setAccountLabel(account.label);
    setSwid("");
    setEspnS2("");
    setLeagueRef("");
    setFeedback({
      tone: "info",
      message:
        next === "reconnect"
          ? "Paste replacement ESPN session values. Existing league data remains until validation succeeds."
          : "Enter another league ID or URL and season for this ESPN connection.",
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction(workflow);
    setFeedback(null);
    try {
      if (workflow === "reconnect") {
        if (!targetAccountId) throw new Error("Choose an ESPN account to reconnect.");
        await espnAccountRequest(
          `/api/v1/account/espn/connections/${targetAccountId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ accountLabel, swid, espnS2 }),
          },
        );
      } else if (workflow === "add-league") {
        if (!targetAccountId) throw new Error("Choose an ESPN account.");
        await espnAccountRequest(
          `/api/v1/account/espn/connections/${targetAccountId}/leagues`,
          {
            method: "POST",
            body: JSON.stringify({ leagueRef, season }),
          },
        );
      } else {
        if (!consented) throw new Error("Consent is required before linking.");
        await espnAccountRequest("/api/v1/account/espn/link", {
          method: "POST",
          body: JSON.stringify({
            accountLabel,
            swid,
            espnS2,
            leagueRef,
            season,
            consentVersion: ESPN_CONSENT_VERSION,
          }),
        });
      }
      await reload();
      const successMessage =
        workflow === "reconnect"
          ? "ESPN session credentials replaced and validated."
          : workflow === "add-league"
            ? "ESPN league season linked. Defaults were not changed."
            : "ESPN account linked. Defaults were not changed.";
      resetWorkflow();
      setFeedback({ tone: "success", message: successMessage });
    } catch (requestError) {
      setFeedback({
        tone: "error",
        message:
          requestError instanceof Error
            ? requestError.message
            : "ESPN account could not be saved.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRefresh(league: EspnConnectionLeague) {
    setBusyAction(`refresh:${league.id}`);
    setFeedback(null);
    try {
      await espnAccountRequest("/api/v1/account/espn/refresh", {
        method: "POST",
        body: JSON.stringify({ externalLeagueId: league.id }),
      });
      await reload();
      setFeedback({ tone: "success", message: `${league.name} refreshed.` });
    } catch (requestError) {
      setFeedback({
        tone: "error",
        message:
          requestError instanceof Error ? requestError.message : "ESPN refresh failed.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleApply(league: EspnConnectionLeague) {
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
      const selectedTeamId =
        selectedTeamByLeague[league.id] ||
        league.teams.find((team) => team.isOwned)?.id ||
        league.teams[0]?.id ||
        null;
      const result = await espnAccountRequest<{
        settings: Database["public"]["Tables"]["user_settings"]["Row"];
      }>("/api/v1/account/espn/apply-settings", {
        method: "POST",
        body: JSON.stringify({
          externalLeagueId: league.id,
          externalTeamId: selectedTeamId,
          settingsHash: league.settings.sourceHash,
          acknowledgeWarnings: league.settings.diagnostics.status === "partial",
        }),
      });
      onSettingsApplied?.(mapUserSettingsRowToLeagueSettings(result.settings));
      await reload();
      setFeedback({
        tone: "success",
        message: `${league.name} is now your ESPN account default.`,
      });
    } catch (requestError) {
      setFeedback({
        tone: "error",
        message:
          requestError instanceof Error
            ? requestError.message
            : "ESPN settings could not be applied.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteLeague(
    account: EspnConnectionAccount,
    league: EspnConnectionLeague,
  ) {
    if (!window.confirm(`Remove ${league.name} (${league.seasonKey}) from ESPN sync?`)) {
      return;
    }
    setBusyAction(`delete:${league.id}`);
    try {
      await espnAccountRequest(
        `/api/v1/account/espn/connections/${account.id}/leagues/${league.id}`,
        { method: "DELETE" },
      );
      await reload();
      setFeedback({ tone: "success", message: "ESPN league season removed." });
    } catch (requestError) {
      setFeedback({
        tone: "error",
        message:
          requestError instanceof Error
            ? requestError.message
            : "ESPN league could not be removed.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDisconnect(account: EspnConnectionAccount) {
    if (
      !window.confirm(
        `Disconnect ${account.label}? Credentials and synchronized ESPN data will be removed; already-applied settings remain static.`,
      )
    ) {
      return;
    }
    setBusyAction(`disconnect:${account.id}`);
    try {
      await espnAccountRequest(`/api/v1/account/espn/connections/${account.id}`, {
        method: "DELETE",
      });
      await reload();
      setFeedback({ tone: "success", message: "ESPN account disconnected." });
    } catch (requestError) {
      setFeedback({
        tone: "error",
        message:
          requestError instanceof Error
            ? requestError.message
            : "ESPN account could not be disconnected.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  const targetAccount = data.accounts.find((account) => account.id === targetAccountId);

  return (
    <section className={styles.panel} aria-labelledby="espn-settings-title">
      <header className={styles.header}>
        <div>
          <h3 id="espn-settings-title">Unofficial ESPN Beta</h3>
          <p>
            Link Fantasy Hockey league seasons read-only, review hockey-specific
            mappings, and explicitly apply one league as your account default.
          </p>
        </div>
        <span className={styles.status}>
          {isLoading ? "Loading" : `${data.accounts.length} linked`}
        </span>
      </header>

      <div className={styles.info}>
        This is an unofficial private beta, not ESPN OAuth or an ESPN-endorsed
        integration. Provide only SWID and espn_s2 session values—never your ESPN
        password. Session access can expire at any time.
      </div>
      {!data.apiEnabled ? (
        <div className={styles.info}>
          ESPN API linking is off for this account. Manual CSV/JSON import remains
          available below.
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
        <form className={styles.linkForm} onSubmit={handleSubmit}>
          <div className={styles.formSectionHeader}>
            <strong>
              {workflow === "link"
                ? "Link ESPN account"
                : workflow === "reconnect"
                  ? `Reconnect ${targetAccount?.label ?? "ESPN account"}`
                  : `Add league to ${targetAccount?.label ?? "ESPN account"}`}
            </strong>
            {workflow !== "link" ? (
              <button type="button" className={styles.textButton} onClick={resetWorkflow}>
                Cancel
              </button>
            ) : null}
          </div>
          {workflow !== "add-league" ? (
            <label className={styles.field}>
              <span>Account label</span>
              <input
                value={accountLabel}
                maxLength={80}
                onChange={(event) => setAccountLabel(event.target.value)}
                disabled={busyAction != null}
                required
              />
            </label>
          ) : null}
          {workflow !== "add-league" ? (
            <>
              <label className={styles.field}>
                <span>SWID</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={swid}
                  onChange={(event) => setSwid(event.target.value)}
                  disabled={busyAction != null}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>espn_s2</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={espnS2}
                  onChange={(event) => setEspnS2(event.target.value)}
                  disabled={busyAction != null}
                  required
                />
                <small>
                  These values are sent to the server, stored through Supabase Vault,
                  and never displayed again.
                </small>
              </label>
            </>
          ) : null}
          {workflow !== "reconnect" ? (
            <>
              <label className={styles.field}>
                <span>League ID or ESPN league URL</span>
                <input
                  value={leagueRef}
                  onChange={(event) => setLeagueRef(event.target.value)}
                  disabled={busyAction != null}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Season</span>
                <input
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  value={season}
                  onChange={(event) => setSeason(event.target.value)}
                  disabled={busyAction != null}
                  required
                />
              </label>
            </>
          ) : null}
          {workflow === "link" ? (
            <label className={styles.consentRow}>
              <input
                type="checkbox"
                checked={consented}
                onChange={(event) => setConsented(event.target.checked)}
              />
              <span>
                I consent to FHFH storing these ESPN session values in Supabase
                Vault and using them for hourly active-season read-only syncs. I
                understand this is an unofficial beta and I may disconnect at any time.
              </span>
            </label>
          ) : null}
          <button
            type="submit"
            className={styles.primaryButton}
            disabled={busyAction != null || (workflow === "link" && !consented)}
          >
            {busyAction
              ? "Validating and syncing…"
              : workflow === "link"
                ? "Validate and link"
                : workflow === "reconnect"
                  ? "Validate replacement credentials"
                  : "Validate and add league"}
          </button>
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
                <button
                  type="button"
                  onClick={() => beginWorkflow("add-league", account)}
                  disabled={
                    !data.apiEnabled || busyAction != null || account.leagues.length >= 10
                  }
                >
                  Add league season
                </button>
                <button
                  type="button"
                  onClick={() => beginWorkflow("reconnect", account)}
                  disabled={!data.apiEnabled || busyAction != null}
                >
                  Replace credentials
                </button>
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={() => void handleDisconnect(account)}
                  disabled={busyAction != null}
                >
                  Disconnect
                </button>
              </div>
            </div>
            {account.status === "reauth_required" ? (
              <div className={styles.error}>
                ESPN rejected this session. Stored league state is retained; replace
                credentials to resume sync and live draft polling.
              </div>
            ) : null}
            {account.leagues.map((league) => {
              const selectedTeam =
                selectedTeamByLeague[league.id] ||
                league.teams.find((team) => team.isOwned)?.id ||
                league.teams[0]?.id ||
                "";
              return (
                <div key={league.id} className={styles.linkedLeague}>
                  <div className={styles.cardHeader}>
                    <div>
                      <strong>{league.name}</strong>
                      <div className={styles.leagueMeta}>
                        Season {league.seasonKey} · sync {league.syncStatus ?? "not run"}
                        {league.syncErrorCode ? ` · ${league.syncErrorCode}` : ""}
                        {league.transactionBackfillComplete === false
                          ? ` · transaction history pending${
                              league.transactionBackfillErrorCode
                                ? ` (${league.transactionBackfillErrorCode})`
                                : ""
                            }`
                          : ""}
                      </div>
                    </div>
                    <div className={styles.badgeRow}>
                      {league.isDefault ? (
                        <span className={styles.defaultBadge}>Account default</span>
                      ) : null}
                      {league.settingsChanged ? (
                        <span className={styles.changedBadge}>
                          Updated league settings available
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <label className={styles.field}>
                    <span>Team identity</span>
                    <select
                      value={selectedTeam}
                      onChange={(event) =>
                        setSelectedTeamByLeague((current) => ({
                          ...current,
                          [league.id]: event.target.value,
                        }))
                      }
                      disabled={busyAction != null}
                    >
                      <option value="">No team identity</option>
                      {league.teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}{team.isOwned ? " (owned)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <LeagueMapping settings={league.settings} />
                  <div className={styles.teamActions}>
                    <button
                      type="button"
                      onClick={() => void handleRefresh(league)}
                      disabled={
                        !data.apiEnabled ||
                        busyAction != null ||
                        account.status === "reauth_required"
                      }
                    >
                      Refresh league
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleApply(league)}
                      disabled={
                        busyAction != null ||
                        !data.apiEnabled ||
                        league.settings.diagnostics.status === "unsupported"
                      }
                    >
                      Apply as account default
                    </button>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      onClick={() => void handleDeleteLeague(account, league)}
                      disabled={busyAction != null}
                    >
                      Remove league
                    </button>
                  </div>
                </div>
              );
            })}
          </article>
        ))}
      </div>

      <details className={styles.advanced}>
        <summary>Manual CSV/JSON import fallback</summary>
        <FantraxImportPanel config={ESPN_PANEL_CONFIG} />
      </details>
    </section>
  );
}

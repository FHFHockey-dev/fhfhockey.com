import React from "react";

import type {
  DraftDashboardMode,
  YahooDraftLeague,
  YahooDraftReconciliation,
  YahooDraftState,
} from "lib/draftDashboard/yahooLiveDraft";
import {
  deriveYahooDraftDashboardConfiguration,
  yahooUnsupportedLeagueMessage,
  yahooSettingsRequireScoringConfirmation,
  yahooSettingsRequireDraftOrderConfirmation,
  yahooSettingsWarnings,
} from "lib/draftDashboard/yahooLiveDraft";

import styles from "./YahooLiveDraftPanel.module.scss";

interface YahooLiveDraftPanelProps {
  mode: DraftDashboardMode;
  leagues: YahooDraftLeague[];
  selectedLeagueId: string;
  draftState: YahooDraftState | null;
  reconciliation: YahooDraftReconciliation;
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;
  hasPersonalRanking?: boolean;
  externalDraftLock?: boolean;
  onLeagueChange: (leagueId: string) => void;
  onConnect: () => void;
  onRefreshAccount: () => void;
  onRefreshDraft: () => void;
  onStart: () => void;
  onApplySettings: () => void;
  onStopAndContinueManually: () => void;
}

function statusLabel(draftState: YahooDraftState | null): string {
  if (!draftState) return "Not syncing";
  if (
    draftState.session.status === "predraft" ||
    draftState.session.providerStatus === "predraft"
  ) {
    return "Waiting for draft";
  }
  switch (draftState.session.status) {
    case "active":
      return "Live";
    case "complete":
      return "Draft complete";
    case "stopped":
      return "Stopped";
    case "reauth_required":
      return "Reconnect required";
    case "error":
      return "Needs attention";
    default:
      return draftState.session.status;
  }
}

function formatTimestamp(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const YahooLiveDraftPanel: React.FC<YahooLiveDraftPanelProps> = ({
  mode,
  leagues,
  selectedLeagueId,
  draftState,
  reconciliation,
  isLoading,
  isPolling,
  error,
  hasPersonalRanking = false,
  externalDraftLock = false,
  onLeagueChange,
  onConnect,
  onRefreshAccount,
  onRefreshDraft,
  onStart,
  onApplySettings,
  onStopAndContinueManually,
}) => {
  const activePicks = draftState?.picks.filter((pick) => pick.active) || [];
  const unresolvedCount = reconciliation.unresolved.length;
  const resolvedCount = Math.max(0, activePicks.length - unresolvedCount);
  const lastUpdated = formatTimestamp(
    draftState?.session.lastSuccessfulPollAt,
  );
  const expected = reconciliation.expectedNext;
  const yahooConfiguration = draftState
    ? deriveYahooDraftDashboardConfiguration(draftState)
    : null;
  const rosterSpots = yahooConfiguration?.rosterConfig
    ? Object.values(yahooConfiguration.rosterConfig).reduce(
        (sum, count) => sum + count,
        0,
      )
    : null;
  const scoringIsIncomplete = yahooSettingsRequireScoringConfirmation(draftState);
  const draftOrderIsInferred = yahooSettingsRequireDraftOrderConfirmation(draftState);
  const settingsWarnings = yahooSettingsWarnings(draftState);
  const selectedLeague = leagues.find(
    (league) => league.externalLeagueId === selectedLeagueId,
  );
  const canStart =
    Boolean(selectedLeagueId) &&
    mode === "manual" &&
    !externalDraftLock &&
    selectedLeague?.supported !== false;
  const canResumeExisting = Boolean(
    selectedLeague?.session &&
      ["active", "predraft", "complete"].includes(
        selectedLeague.session.status,
      ),
  );
  const yahooLeagueUrl =
    draftState?.session.yahooLeagueUrl || selectedLeague?.yahooLeagueUrl;

  return (
    <section className={styles.panel} aria-labelledby="yahoo-live-draft-title">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Live draft companion</p>
          <h2 id="yahoo-live-draft-title" className={styles.title}>
            Yahoo Fantasy Draft Sync
          </h2>
        </div>
        <div className={styles.statusCluster} aria-live="polite">
          <span
            className={`${styles.statusDot} ${draftState?.session.providerStatus === "drafting" || (draftState?.session.status === "active" && activePicks.length > 0) ? styles.statusLive : ""}`}
            aria-hidden="true"
          />
          <span>{statusLabel(draftState)}</span>
          {isPolling && <span className={styles.syncing}>Requesting update…</span>}
        </div>
      </div>

      <div className={styles.controls}>
        <label className={styles.leagueControl}>
          <span>Yahoo league</span>
          <select
            value={selectedLeagueId}
            onChange={(event) => onLeagueChange(event.target.value)}
            disabled={
              mode === "yahoo" || externalDraftLock || isLoading || leagues.length === 0
            }
          >
            {leagues.length === 0 && (
              <option value="">Connect or refresh Yahoo</option>
            )}
            {leagues.map((league) => (
              <option
                key={league.externalLeagueId}
                value={league.externalLeagueId}
              >
                {league.name}
                {league.season ? ` (${league.season})` : ""}
                {league.supported === false ? " — unavailable" : ""}
              </option>
            ))}
          </select>
          {selectedLeague?.teamName && (
            <small className={styles.teamName}>Your team: {selectedLeague.teamName}</small>
          )}
        </label>

        <div className={styles.actions}>
          <button type="button" onClick={onConnect} disabled={isLoading}>
            Connect Yahoo
          </button>
          <button type="button" onClick={onRefreshAccount} disabled={isLoading}>
            Refresh leagues
          </button>
          {mode === "manual" ? (
            <button
              type="button"
              className={styles.primaryAction}
              onClick={onStart}
              disabled={!canStart || isLoading}
            >
              {canResumeExisting ? "Resume live sync" : "Start live sync"}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onRefreshDraft}
                disabled={isPolling || isLoading}
              >
                Check for updates
              </button>
              <button
                type="button"
                onClick={onApplySettings}
                disabled={isLoading || !draftState}
              >
                Apply Yahoo settings
              </button>
              <button
                type="button"
                className={styles.stopAction}
                onClick={onStopAndContinueManually}
                disabled={isLoading}
              >
                Stop &amp; continue manually
              </button>
            </>
          )}
        </div>
      </div>

      {selectedLeague?.supported === false && (
        <div className={styles.warning} role="alert">
          <strong>This league cannot use live draft sync.</strong>{" "}
          {yahooUnsupportedLeagueMessage(selectedLeague.unsupportedReason)}
        </div>
      )}

      {draftState && (
        <>
          <div className={styles.settingsPreview}>
            <strong>Yahoo settings preview:</strong>{" "}
            {yahooConfiguration?.teamCount || "—"} teams ·{" "}
            {yahooConfiguration?.isSnakeDraft ? "snake" : "straight"} draft ·{" "}
            {rosterSpots == null ? "roster unavailable" : `${rosterSpots} roster spots`}
            {scoringIsIncomplete && (
              <span>
                {" "}· scoring values incomplete; applying requires confirmation
              </span>
            )}
            {draftOrderIsInferred && (
              <span> · snake order is assumed and requires confirmation</span>
            )}
          </div>
          <div className={styles.metrics}>
          <div>
            <span className={styles.metricLabel}>Picks synced</span>
            <strong>{activePicks.length}</strong>
            <small>{resolvedCount} mapped</small>
          </div>
          <div className={unresolvedCount ? styles.metricWarning : undefined}>
            <span className={styles.metricLabel}>Unresolved</span>
            <strong>{unresolvedCount}</strong>
            <small>exact IDs only</small>
          </div>
          <div>
            <span className={styles.metricLabel}>Expected next</span>
            <strong>Pick {expected.pickNumber}</strong>
            <small>
              {expected.teamName || expected.yahooTeamKey || "Team pending"} · R
              {expected.roundNumber}.{expected.pickInRound} (predicted)
            </small>
          </div>
          <div>
            <span className={styles.metricLabel}>Last update</span>
            <strong>{lastUpdated || "Pending"}</strong>
            <small>snapshot {draftState.session.snapshotVersion ?? "—"}</small>
          </div>
          </div>
        </>
      )}

      {unresolvedCount > 0 && (
        <div className={styles.warning} role="alert">
          <strong>
            {unresolvedCount} Yahoo pick{unresolvedCount === 1 ? "" : "s"} could
            not be mapped automatically.
          </strong>{" "}
          The picks remain visible as placeholders and no name-based match was
          applied.
          <ul>
            {reconciliation.unresolved.map((pick) => (
              <li key={pick.pickNumber}>
                Pick {pick.pickNumber}: {pick.displayName}
                {pick.yahooPlayerId ? ` (Yahoo ${pick.yahooPlayerId})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {reconciliation.warnings.map((warning) => (
        <div className={styles.warning} role="status" key={warning}>
          {warning}
        </div>
      ))}
      {settingsWarnings.map((warning) => (
        <div className={styles.warning} role="status" key={warning}>
          {warning}
        </div>
      ))}

      {draftState?.session.stale && (
        <div className={styles.staleWarning} role="alert">
          {draftState.session.staleSeverity === "critical"
            ? "Live updates are critically delayed. Verify every pick in Yahoo and continue manually if the delay persists."
            : "Live updates are delayed. Check for updates and verify Yahoo before relying on the expected-next-pick prediction."}
        </div>
      )}

      {draftState?.session.status === "reauth_required" && (
        <div className={styles.error} role="alert">
          Yahoo authorization expired. Reconnect Yahoo, or stop live sync and
          continue manually.
        </div>
      )}

      {(error || draftState?.session.lastErrorMessage) && (
        <div className={styles.error} role="alert">
          {error || draftState?.session.lastErrorMessage}
        </div>
      )}

      <div className={styles.footer}>
        <div>
          <a
            className={styles.yahooAttribution}
            href="https://www.yahoo.com/?ilc=401"
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* Yahoo requires this exact hosted attribution asset. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://poweredby.yahoo.com/poweredby_yahoo_h_white_retina.png"
              width={134}
              height={20}
              alt="Powered by Yahoo"
            />
          </a>
          {!hasPersonalRanking && (
            <a className={styles.personalBoardLink} href="/draft-rankings">
              Create a personal board
            </a>
          )}
        </div>
        {yahooLeagueUrl && (
          <a href={yahooLeagueUrl} target="_blank" rel="noopener noreferrer">
            Open Yahoo draft room ↗
          </a>
        )}
      </div>
    </section>
  );
};

export default YahooLiveDraftPanel;

import React from "react";
import { createPortal } from "react-dom";

import type {
  DraftDashboardMode,
  YahooDraftLeague,
  YahooDraftReconciliation,
  YahooDraftState,
} from "lib/draftDashboard/yahooLiveDraft";
import {
  deriveYahooDraftDashboardConfiguration,
  hasCompleteYahooDraftPositions,
  hasCompleteYahooPickOwnership,
  yahooUnsupportedLeagueMessage,
  yahooSettingsRequireScoringConfirmation,
  yahooSettingsRequireDraftOrderConfirmation,
  yahooSettingsWarnings,
} from "lib/draftDashboard/yahooLiveDraft";

import styles from "./YahooLiveDraftPanel.module.scss";

interface YahooLiveDraftPanelProps {
  mode: DraftDashboardMode;
  authenticated?: boolean;
  draftProEligible?: boolean;
  liveSyncEnabled?: boolean;
  requestState?: "idle" | "loading" | "ready" | "error";
  leagues: YahooDraftLeague[];
  selectedLeagueId: string;
  draftState: YahooDraftState | null;
  reconciliation: YahooDraftReconciliation;
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;
  hasPersonalRanking?: boolean;
  settingsNeedApplying?: boolean;
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

function setupLabel(args: {
  authenticated: boolean;
  draftProEligible: boolean;
  liveSyncEnabled: boolean;
  requestState: "idle" | "loading" | "ready" | "error";
}): string {
  if (!args.authenticated) return "Sign in required";
  if (!args.draftProEligible) return "Draft Pro required";
  if (args.liveSyncEnabled) return "Ready to connect";
  if (args.requestState === "idle" || args.requestState === "loading") {
    return "Preparing";
  }
  return "Unavailable";
}

function formatTimestamp(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function yahooDraftTimeMs(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  // Yahoo uses Unix seconds. Only accept timezone-qualified date strings otherwise.
  const time = /^\d{10}(?:\d{3})?$/.test(text)
    ? Number(text) * (text.length === 10 ? 1000 : 1)
    : /T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? Date.parse(text) : NaN;
  return Number.isFinite(time) ? time : null;
}

export function YahooDraftOrderReminder({ state, league, enabled, onReview }: {
  state: YahooDraftState | null;
  league?: YahooDraftLeague;
  enabled: boolean;
  onReview: () => void;
}) {
  const [now, setNow] = React.useState<number | null>(null);
  const [dismissed, setDismissed] = React.useState<string | null>(null);
  const normalized = state?.settings.normalized as Record<string, unknown> | undefined;
  const startsAt = yahooDraftTimeMs(league?.draftTime ?? normalized?.draftTime);
  const key = `yahoo-draft-order-reminder:${league?.externalLeagueId || state?.session.id}:${startsAt}`;
  React.useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 15_000);
    try { setDismissed(window.sessionStorage.getItem(key) === "dismissed" ? key : null); } catch { /* Storage is optional. */ }
    return () => window.clearInterval(timer);
  }, [key]);
  const dismiss = () => {
    setDismissed(key);
    try { window.sessionStorage.setItem(key, "dismissed"); } catch { /* Keep the in-memory dismissal. */ }
  };
  const predraft = state ? state.session.status === "predraft" && !state.picks.some((pick) => pick.active)
    : league?.draftStatus === "predraft";
  if (!enabled || !predraft || now === null || startsAt === null ||
      now < startsAt - 30 * 60_000 || now >= startsAt || dismissed === key ||
      hasCompleteYahooDraftPositions(state)) return null;
  return createPortal(
    <aside className={styles.orderReminder} aria-label="Yahoo draft order reminder" role="status">
      <strong>Your Yahoo draft starts within 30 minutes</strong>
      <p>Yahoo may now have your team order. Refresh leagues, then compare the order with your Yahoo draft room. Availability depends on Yahoo.</p>
      <div className={styles.actions}>
        <button type="button" onClick={() => { onReview(); dismiss(); }}>Refresh leagues &amp; review</button>
        <button type="button" onClick={dismiss}>Dismiss</button>
      </div>
    </aside>, document.body,
  );
}

function YahooDraftOrderCheck({ identity, onRefresh }: { identity: string; onRefresh: () => void }) {
  const [choice, setChoice] = React.useState<"set" | "random" | "">("");
  const [confirmed, setConfirmed] = React.useState<"set" | "random" | "">("");
  React.useEffect(() => {
    let saved: string | null = null;
    try { saved = window.sessionStorage.getItem(`yahoo-order-check:${identity}`); } catch { /* Optional storage. */ }
    const next = saved === "set" || saved === "random" ? saved : "";
    setChoice(next);
    setConfirmed(next);
  }, [identity]);
  const confirm = () => {
    if (!choice) return;
    setConfirmed(choice);
    try { window.sessionStorage.setItem(`yahoo-order-check:${identity}`, choice); } catch { /* Keep in memory. */ }
    if (choice === "set") onRefresh();
  };
  return (
    <div className={styles.infoNotice}>
      {confirmed ? <>
        <strong>{confirmed === "set" ? "Order already set in Yahoo" : "Order will be randomized before the draft"}</strong>
        <p>{confirmed === "set"
          ? "We’ve requested a league refresh. If positions are still missing, use the Yahoo draft room as your reference; FHFH’s order remains provisional."
          : "Refresh leagues once Yahoo sets the order. A reminder appears in the final 30 minutes when Yahoo supplies a draft time."}</p>
        <div className={styles.actions}><button type="button" onClick={() => setConfirmed("")}>Change answer</button></div>
      </> : <>
        <fieldset className={styles.orderChoices}>
          <legend>Is your draft order set in Yahoo?</legend>
          <p>We haven’t received every team’s position yet.</p>
          <label><input type="radio" name="yahoo-order-expectation" checked={choice === "set"} onChange={() => setChoice("set")} /> Already set</label>
          <label><input type="radio" name="yahoo-order-expectation" checked={choice === "random"} onChange={() => setChoice("random")} /> Randomized before the draft</label>
        </fieldset>
        <div className={styles.actions}><button type="button" disabled={!choice} onClick={confirm}>Confirm</button></div>
      </>}
    </div>
  );
}

const YahooLiveDraftPanel: React.FC<YahooLiveDraftPanelProps> = ({
  mode,
  authenticated = false,
  draftProEligible = false,
  liveSyncEnabled = false,
  requestState = "ready",
  leagues,
  selectedLeagueId,
  draftState,
  reconciliation,
  isLoading,
  isPolling,
  error,
  hasPersonalRanking = false,
  settingsNeedApplying = false,
  externalDraftLock = false,
  onLeagueChange,
  onConnect,
  onRefreshAccount,
  onRefreshDraft,
  onStart,
  onApplySettings,
  onStopAndContinueManually,
}) => {
  const liveSyncReady = authenticated && draftProEligible && liveSyncEnabled;
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
  const orderSuppliedByYahoo = hasCompleteYahooPickOwnership(draftState);
  const draftOrderIsInferred = !orderSuppliedByYahoo && yahooSettingsRequireDraftOrderConfirmation(draftState);
  const settingsWarnings = yahooSettingsWarnings(draftState);
  const informationalNotes = [...new Set([...reconciliation.warnings, ...settingsWarnings])]
    .filter((warning) => !(draftOrderIsInferred || orderSuppliedByYahoo) || !/snake|draft-order mode/i.test(warning))
    .filter((warning) => !warning.includes("complete, unique draft position") || (!orderSuppliedByYahoo && !hasCompleteYahooDraftPositions(draftState)));
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
          <span>
            {draftState
              ? statusLabel(draftState)
              : setupLabel({
                  authenticated,
                  draftProEligible,
                  liveSyncEnabled,
                  requestState,
                })}
          </span>
          {isPolling && <span className={styles.syncing}>Requesting update…</span>}
        </div>
      </div>

      {!authenticated && (
        <div className={styles.setupNotice} role="status">
          Sign in to connect Yahoo and use Live Sync{" "}
          <a href="/auth?mode=sign-in">Sign in</a>
        </div>
      )}
      {authenticated && !draftProEligible && (
        <div className={styles.setupNotice} role="status">
          Yahoo Live Sync is included with Draft Pro{" "}
          <a href="/account?section=draft-pro">Explore Draft Pro</a>
        </div>
      )}
      {authenticated && draftProEligible && !liveSyncEnabled && (
        <div className={error ? styles.error : styles.setupNotice} role={error ? "alert" : "status"}>
          {error
            ? "Yahoo Live Sync is unavailable right now. Try again later."
            : requestState === "idle" || requestState === "loading"
              ? "Yahoo Live Sync is preparing for this account while Yahoo access is verified."
              : "Yahoo Live Sync is unavailable for this account right now."
          }
        </div>
      )}

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
          <button type="button" onClick={onConnect} disabled={!authenticated || !draftProEligible || isLoading}>
            Connect Yahoo
          </button>
          <button type="button" onClick={onRefreshAccount} disabled={!liveSyncReady || isLoading}>
            Refresh leagues
          </button>
          {mode === "manual" ? (
            <button
              type="button"
              className={styles.primaryAction}
              onClick={onStart}
              disabled={!canStart || !liveSyncReady || isLoading}
            >
              {canResumeExisting ? "Resume live sync" : "Start live sync"}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onRefreshDraft}
                disabled={!liveSyncReady || isPolling || isLoading}
              >
                Check for updates
              </button>
              <button
                type="button"
                onClick={onApplySettings}
                className={settingsNeedApplying ? styles.applyNeeded : undefined}
                aria-describedby={settingsNeedApplying ? "yahoo-apply-hint" : undefined}
                disabled={!liveSyncReady || isLoading || !draftState}
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
              <span> · draft format requires confirmation</span>
            )}
            <span id="yahoo-apply-hint">{settingsNeedApplying
              ? " · Next step: apply Yahoo settings to update roster and scoring. No need to stop sync."
              : " · Applying updates roster and scoring."}</span>
          </div>
          <div className={styles.settingsPreview}>
            <strong>Playoff schedule:</strong>{" "}
            {yahooConfiguration?.playoffWeeks
              ? yahooConfiguration.playoffWeeks.length
                ? `Yahoo weeks ${yahooConfiguration.playoffWeeks.join(", ")} · ${mode === "yahoo" ? "synced automatically" : "syncs when live sync starts"}`
                : "Yahoo has playoffs disabled."
              : "Yahoo hasn’t provided a complete playoff range. Your existing selection is preserved."}
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
              {expected.roundNumber}.{expected.pickInRound} {expected.predicted ? "(predicted)" : "(owner supplied by Yahoo)"}
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

      {liveSyncReady && draftState?.session.status === "predraft" && !orderSuppliedByYahoo && !hasCompleteYahooDraftPositions(draftState) && (
        <YahooDraftOrderCheck
          identity={`${selectedLeagueId || draftState.session.id}:${selectedLeague?.draftTime || ""}`}
          onRefresh={onRefreshAccount}
        />
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

      {(draftOrderIsInferred || informationalNotes.length > 0) && (
        <div className={styles.infoNotice} role="status">
          <strong>Draft order &amp; settings notes</strong>
          {draftOrderIsInferred && <p>Draft format is not confirmed by Yahoo. Check your dashboard’s configured order against your Yahoo draft room; live picks still follow Yahoo’s reported selections.</p>}
          {informationalNotes.map((warning) => <p key={warning}>{warning.includes("complete, unique draft position")
              ? "Team draft positions are not fully available yet. Refresh leagues when Yahoo publishes the order; predicted turns may change."
              : warning}</p>)}
        </div>
      )}

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

import type {
  EspnConnectionLeague,
  EspnDraftState,
} from "lib/integrations/espn/contracts";
import type { EspnDraftReconciliation } from "lib/draftDashboard/espnLiveDraft";

import styles from "./YahooLiveDraftPanel.module.scss";

function statusLabel(state: EspnDraftState | null) {
  switch (state?.session.status) {
    case "predraft":
      return "Waiting for draft";
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
      return "Not syncing";
  }
}

export default function EspnLiveDraftPanel({
  enabled,
  leagues,
  selectedLeagueId,
  state,
  reconciliation,
  active,
  blocked,
  isLoading,
  isPolling,
  error,
  onLeagueChange,
  onReload,
  onStart,
  onPoll,
  onStop,
  onClear,
}: {
  enabled: boolean;
  leagues: EspnConnectionLeague[];
  selectedLeagueId: string;
  state: EspnDraftState | null;
  reconciliation: EspnDraftReconciliation;
  active: boolean;
  blocked: boolean;
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;
  onLeagueChange: (leagueId: string) => void;
  onReload: () => void;
  onStart: () => void;
  onPoll: () => void;
  onStop: () => void;
  onClear: () => void;
}) {
  if (!enabled && leagues.length === 0) return null;
  const selected = leagues.find((league) => league.id === selectedLeagueId);
  const supported = selected?.settings.liveDraftSupported === true;
  const lastUpdate = state?.session.lastSnapshotAt
    ? new Date(state.session.lastSnapshotAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "Pending";

  return (
    <section className={styles.panel} aria-labelledby="espn-live-draft-title">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Unofficial read-only companion</p>
          <h2 id="espn-live-draft-title" className={styles.title}>
            ESPN Fantasy Draft Sync
          </h2>
        </div>
        <div className={styles.statusCluster} aria-live="polite">
          <span
            className={`${styles.statusDot} ${active ? styles.statusLive : ""}`}
            aria-hidden="true"
          />
          <span>{statusLabel(state)}</span>
          {isPolling ? <span className={styles.syncing}>Syncing…</span> : null}
        </div>
      </div>

      <div className={styles.controls}>
        <label className={styles.leagueControl}>
          <span>Linked ESPN league</span>
          <select
            value={selectedLeagueId}
            onChange={(event) => onLeagueChange(event.target.value)}
            disabled={active || isLoading}
          >
            {leagues.length === 0 ? <option value="">No linked leagues</option> : null}
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name} ({league.seasonKey})
                {league.settings.liveDraftSupported ? "" : " — manual only"}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.actions}>
          <button type="button" onClick={onReload} disabled={isLoading}>
            Refresh linked leagues
          </button>
          {active ? (
            <>
              <button type="button" onClick={onPoll} disabled={isPolling || isLoading}>
                Sync now
              </button>
              <button
                type="button"
                className={styles.stopAction}
                onClick={onStop}
                disabled={isLoading}
              >
                Stop &amp; continue manually
              </button>
            </>
          ) : state?.session.status === "complete" ? (
            <button type="button" onClick={onClear} disabled={isLoading}>
              Continue manually
            </button>
          ) : (
            <button
              type="button"
              className={styles.primaryAction}
              onClick={onStart}
              disabled={!supported || blocked || isLoading}
            >
              Start live sync
            </button>
          )}
        </div>
      </div>

      {blocked ? (
        <div className={styles.warning}>
          Stop Yahoo live sync before starting the ESPN companion.
        </div>
      ) : null}
      {selected && !supported ? (
        <div className={styles.warning} role="alert">
          ESPN live sync requires a snake or straight draft with a complete pick
          order. Auction, offline, and incomplete draft formats remain manual-only.
        </div>
      ) : null}
      {state ? (
        <>
          <div className={styles.settingsPreview}>
            <strong>ESPN settings:</strong> {state.league.settings.teamCount ?? "—"}
            {" teams · "}
            {state.league.settings.draftOrderType} draft · {state.league.settings.draftOrder.length}
            {" ordered teams"}
          </div>
          <div className={styles.metrics}>
            <div>
              <span className={styles.metricLabel}>Picks synced</span>
              <strong>{state.picks.length}</strong>
              <small>snapshot {state.session.snapshotVersion}</small>
            </div>
            <div className={reconciliation.unresolved.length ? styles.metricWarning : undefined}>
              <span className={styles.metricLabel}>Unresolved</span>
              <strong>{reconciliation.unresolved.length}</strong>
              <small>preserved by ESPN name</small>
            </div>
            <div>
              <span className={styles.metricLabel}>Expected next</span>
              <strong>Pick {reconciliation.currentPick}</strong>
              <small>ESPN remains authoritative while live</small>
            </div>
            <div>
              <span className={styles.metricLabel}>Last update</span>
              <strong>{lastUpdate}</strong>
              <small>30-second polling</small>
            </div>
          </div>
        </>
      ) : null}

      {reconciliation.unresolved.length ? (
        <div className={styles.warning} role="alert">
          <strong>
            {reconciliation.unresolved.length} ESPN pick
            {reconciliation.unresolved.length === 1 ? "" : "s"} need identity review.
          </strong>
          <ul>
            {reconciliation.unresolved.map((pick) => (
              <li key={pick.pickNumber}>
                Pick {pick.pickNumber}: {pick.displayName} (ESPN {pick.espnPlayerId})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {state?.session.status === "reauth_required" ? (
        <div className={styles.error} role="alert">
          ESPN rejected the stored session. Replace SWID and espn_s2 in Account;
          the last good picks remain available for manual continuation.
        </div>
      ) : null}
      {error || state?.session.lastErrorMessage ? (
        <div className={styles.error} role="alert">
          {error || state?.session.lastErrorMessage}
        </div>
      ) : null}
    </section>
  );
}

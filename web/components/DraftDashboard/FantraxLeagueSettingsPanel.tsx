import { useEffect, useMemo, useState } from "react";

import { useFantraxConnections } from "hooks/useFantraxConnections";
import type {
  FantraxConnectionLeague,
  FantraxDraftState,
  FantraxLeagueSettingsV1,
} from "lib/integrations/fantrax/contracts";

import styles from "./FantraxLeagueSettingsPanel.module.scss";

export type DraftFantraxSelection = {
  connectedAccountId: string;
  externalLeagueId: string;
  externalTeamId: string | null;
  settingsHash: string;
};

function warnings(settings: FantraxLeagueSettingsV1) {
  return [
    ...settings.diagnostics.unsupported.map(
      (item) => `${item.label} (${item.code}): ${item.reason}`,
    ),
    ...settings.diagnostics.warnings,
  ];
}

export default function FantraxLeagueSettingsPanel({
  disabled,
  enabled,
  onApply,
  liveSync,
}: {
  disabled: boolean;
  enabled: boolean;
  onApply: (
    league: FantraxConnectionLeague,
    teamId: string | null,
    selection: DraftFantraxSelection,
  ) => void;
  liveSync?: {
    enabled: boolean;
    eligible: boolean;
    state: FantraxDraftState | null;
    error: string | null;
    isLoading: boolean;
    isPolling: boolean;
    blocked: boolean;
    unresolvedCount?: number;
    orderMatches?: boolean;
    nextPickNumber?: number;
    nextTeamLabel?: string | null;
    onStart: (league: FantraxConnectionLeague, teamId: string) => void;
    onStop: () => void;
    onPoll: () => void;
  };
}) {
  const { data, isLoading, error } = useFantraxConnections(enabled);
  const [accountId, setAccountId] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [teamId, setTeamId] = useState("");

  const account =
    data.accounts.find((candidate) => candidate.id === accountId) ?? null;
  const league =
    account?.leagues.find((candidate) => candidate.id === leagueId) ?? null;

  useEffect(() => {
    if (accountId && data.accounts.some((candidate) => candidate.id === accountId)) {
      return;
    }
    const defaultAccount =
      data.accounts.find((candidate) =>
        candidate.leagues.some((candidateLeague) => candidateLeague.isDefault),
      ) ?? data.accounts[0];
    setAccountId(defaultAccount?.id ?? "");
  }, [accountId, data.accounts]);

  useEffect(() => {
    if (leagueId && account?.leagues.some((candidate) => candidate.id === leagueId)) {
      return;
    }
    const defaultLeague =
      account?.leagues.find((candidate) => candidate.isDefault) ?? account?.leagues[0];
    setLeagueId(defaultLeague?.id ?? "");
  }, [account, leagueId]);

  useEffect(() => {
    if (teamId && league?.teams.some((candidate) => candidate.id === teamId && candidate.isOwned)) return;
    const ownedTeam = league?.teams.find((candidate) => candidate.isOwned);
    setTeamId(ownedTeam?.id ?? "");
  }, [league, teamId]);

  const mappingSummary = useMemo(() => {
    if (!league) return "";
    const settings = league.settings;
    const scoringCount =
      settings.leagueType === "points"
        ? Object.keys(settings.skaterScoringCategories).length +
          Object.keys(settings.goalieScoringCategories).length
        : Object.keys(settings.categoryWeights).length;
    return `${settings.leagueType} · ${scoringCount} scoring mappings · ${settings.teamCount ?? "unknown"} teams · ${settings.draftOrderType} draft`;
  }, [league]);

  if (!data.apiEnabled && !data.accounts.length) return null;

  const leagueWarnings = league ? warnings(league.settings) : [];
  const apply = () => {
    if (!account || !league) return;
    if (
      league.settings.diagnostics.status === "partial" &&
      !window.confirm(
        `Apply this partial Fantrax mapping? These rules will be omitted:\n\n${leagueWarnings.join("\n")}`,
      )
    ) {
      return;
    }
    onApply(league, teamId || null, {
      connectedAccountId: account.id,
      externalLeagueId: league.id,
      externalTeamId: teamId || null,
      settingsHash: league.settings.sourceHash,
    });
  };

  return (
    <section className={styles.panel} aria-labelledby="draft-fantrax-title">
      <div className={styles.header}>
        <div>
          <h2 id="draft-fantrax-title">Fantrax league settings</h2>
          <p>
            Apply a linked league to this draft session. Fantrax team identity does
            not replace your draft order or team labels.
          </p>
        </div>
        {league?.settingsChanged ? <span>Settings changed</span> : null}
      </div>
      {disabled ? (
        <div className={styles.notice}>
          Fantrax settings cannot be applied while live sync or manual draft work is active.
        </div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}
      {!isLoading && !data.accounts.length ? <div className={styles.notice} role="status">
        First, sign in to Fantrax and go to Settings → Profile → Information → Secret ID. Copy it, then <a href="/account">open Account settings</a> and choose Connected Accounts → Fantrax. FHFH will find your NHL leagues. Return here to choose your league and team.
      </div> : null}
      <div className={styles.controls}>
        <label>
          <span>Linked account</span>
          <select
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            disabled={disabled || isLoading}
          >
            <option value="">Choose account</option>
            {data.accounts.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>League</span>
          <select
            value={leagueId}
            onChange={(event) => setLeagueId(event.target.value)}
            disabled={disabled || !account}
          >
            <option value="">Choose league</option>
            {account?.leagues.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Owned team</span>
          <select
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            disabled={disabled || !league || !league.teams.some((team) => team.isOwned)}
          >
            <option value="">No team identity</option>
            {league?.teams.filter((team) => team.isOwned).map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={apply}
          disabled={
            disabled ||
            !league ||
            league.settings.diagnostics.status === "unsupported"
          }
        >
          Apply to this draft
        </button>
      </div>
      {league ? (
        <div className={styles.summary}>
          <strong>{mappingSummary}</strong>
          {leagueWarnings.length ? (
            <ul>
              {leagueWarnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          ) : (
            <span>Exact supported mapping.</span>
          )}
        </div>
      ) : null}
      {liveSync && (liveSync.enabled || liveSync.state) ? (
        <div className={styles.summary}>
          <strong>Fantrax live draft sync</strong>
          <p>Choose your league and team above, then start live sync. Fantrax teams will fill the local draft slots in Fantrax order, and the team names will update after you confirm. Your scoring and roster settings stay in place. Future pick owners come from Fantrax when available. Keeper labels are not provided; only numbered selections sync.</p>
          {!liveSync.enabled ? <p role="status">Fantrax live sync is paused. Manual drafting remains available.</p> : !liveSync.eligible ? <p role="status">Draft Pro access is required to start live sync. Manual drafting remains available.</p> : null}
          {liveSync.blocked && liveSync.state?.session.status !== "active" ? <p role="status">Finish the other live sync or preserve and reset manual picks, keepers, and trades before starting Fantrax sync.</p> : null}
          {liveSync.state?.warning ? <p role="alert">{liveSync.state.warning}</p> : null}
          {liveSync.state && liveSync.orderMatches === false ? <p role="alert">The Fantrax team order does not match this local draft. Picks are paused; stop sync and review the draft settings.</p> : null}
          {liveSync.unresolvedCount ? <p role="alert">{liveSync.unresolvedCount} Fantrax picks lack verified FHFH player identities. They remain placeholders and do not remove projection players from the available list. Stop sync, then use Quick Fix to resolve them manually.</p> : null}
          {liveSync.state?.session.lastErrorCode ? <p role="alert">Fantrax stopped updating. Compare the last synced picks with your Fantrax draft room, then continue drafting manually. You can try starting sync again after checking your connection.</p> : null}
          {liveSync.error ? <p role="alert">{liveSync.error}</p> : null}
          <p>{liveSync.state ? `${liveSync.state.picks.length} numbered picks · ${liveSync.state.session.status}` : "Not syncing"}</p>
          {liveSync.state?.session.status === "active" ? <p>{liveSync.nextTeamLabel
            ? `Next Fantrax pick #${liveSync.nextPickNumber}: ${liveSync.nextTeamLabel}`
            : "Fantrax has not supplied an owner for the next pick; future order is unavailable."}</p> : null}
          {liveSync.state?.session.status === "active" ? (
            <>
              <button type="button" onClick={liveSync.onPoll} disabled={liveSync.isPolling}>Sync now</button>{" "}
              <button type="button" onClick={liveSync.onStop}>Stop &amp; continue manually</button>
            </>
          ) : (
            <button type="button" onClick={() => league && liveSync.onStart(league, teamId)}
              disabled={!league || !teamId || !liveSync.enabled || !liveSync.eligible || liveSync.blocked || liveSync.isLoading}>
              Start live sync
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}

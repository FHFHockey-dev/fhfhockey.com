import { useEffect, useMemo, useState } from "react";

import { useFantraxConnections } from "hooks/useFantraxConnections";
import type {
  FantraxConnectionLeague,
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
}: {
  disabled: boolean;
  enabled: boolean;
  onApply: (
    league: FantraxConnectionLeague,
    teamId: string | null,
    selection: DraftFantraxSelection,
  ) => void;
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
    if (teamId && league?.teams.some((candidate) => candidate.id === teamId)) return;
    const ownedTeam = league?.teams.find((candidate) => candidate.isOwned) ?? league?.teams[0];
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
          Fantrax application is disabled while Yahoo live draft sync is authoritative.
        </div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}
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
            disabled={disabled || !league || league.teams.length === 0}
          >
            <option value="">No team identity</option>
            {league?.teams.map((team) => (
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
    </section>
  );
}

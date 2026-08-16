import { useEffect, useMemo, useState } from "react";

import {
  espnAccountRequest,
  useEspnConnections,
} from "hooks/useEspnConnections";
import type {
  EspnConnectionLeague,
  EspnLeagueSettingsV1,
} from "lib/integrations/espn/contracts";

import styles from "../DraftDashboard/FantraxLeagueSettingsPanel.module.scss";

export type EspnLeagueSelection = {
  provider: "espn";
  namespace: string;
  connectedAccountId: string;
  externalLeagueId: string;
  externalTeamId: string | null;
  settingsHash: string;
};

function warnings(settings: EspnLeagueSettingsV1) {
  return [
    ...settings.diagnostics.unsupported.map(
      (item) => `${item.label} (${item.code}): ${item.reason}`,
    ),
    ...settings.diagnostics.warnings,
  ];
}

export default function EspnLeagueSettingsPanel({
  disabled,
  enabled,
  contextLabel,
  onApply,
  onConfirmApply,
  supportsLeague,
}: {
  disabled: boolean;
  enabled: boolean;
  contextLabel: string;
  onApply: (
    league: EspnConnectionLeague,
    teamId: string | null,
    selection: EspnLeagueSelection,
  ) => void;
  onConfirmApply?: (
    league: EspnConnectionLeague,
    selection: EspnLeagueSelection,
  ) => boolean;
  supportsLeague?: (
    league: EspnConnectionLeague,
  ) => { supported: boolean; reason?: string };
}) {
  const { data, isLoading, error, reload } = useEspnConnections(enabled);
  const [accountId, setAccountId] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

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
    const ownedTeam =
      league?.teams.find((candidate) => candidate.isOwned) ?? league?.teams[0];
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

  if (!data.apiEnabled) return null;

  const leagueWarnings = league ? warnings(league.settings) : [];
  const consumerSupport = league
    ? supportsLeague?.(league) ?? { supported: true }
    : { supported: false };
  const selection =
    account && league
      ? {
          provider: "espn" as const,
          namespace: `espn:${league.id}`,
          connectedAccountId: account.id,
          externalLeagueId: league.id,
          externalTeamId: teamId || null,
          settingsHash: league.settings.sourceHash,
        }
      : null;

  function confirmPartial() {
    return (
      !league ||
      league.settings.diagnostics.status !== "partial" ||
      window.confirm(
        `Apply this partial ESPN mapping? These rules will be omitted:\n\n${leagueWarnings.join("\n")}`,
      )
    );
  }

  function applyTemporary() {
    if (
      !league ||
      !selection ||
      !confirmPartial() ||
      onConfirmApply?.(league, selection) === false
    ) {
      return;
    }
    onApply(league, teamId || null, selection);
    setFeedback(`Applied ${league.name} to this ${contextLabel}.`);
  }

  async function makeDefault() {
    if (
      !league ||
      !selection ||
      !confirmPartial() ||
      onConfirmApply?.(league, selection) === false
    ) {
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await espnAccountRequest("/api/v1/account/espn/apply-settings", {
        method: "POST",
        body: JSON.stringify({
          externalLeagueId: league.id,
          externalTeamId: teamId || null,
          settingsHash: league.settings.sourceHash,
          acknowledgeWarnings: league.settings.diagnostics.status === "partial",
        }),
      });
      onApply(league, teamId || null, selection);
      await reload();
      setFeedback(`${league.name} is now the account default.`);
    } catch (requestError) {
      setFeedback(
        requestError instanceof Error
          ? requestError.message
          : "ESPN settings could not be applied.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby={`espn-settings-${contextLabel}`}>
      <div className={styles.header}>
        <div>
          <h2 id={`espn-settings-${contextLabel}`}>ESPN league settings</h2>
          <p>
            Apply a linked league to this {contextLabel}. The override lasts only
            for this browser session unless you make it the account default.
          </p>
        </div>
        {league?.settingsChanged ? <span>Settings changed</span> : null}
      </div>
      {disabled ? (
        <div className={styles.notice}>
          ESPN settings cannot replace the active authoritative draft state.
        </div>
      ) : null}
      {error ? <div className={styles.error}>{error}</div> : null}
      {feedback ? <div className={styles.summary}>{feedback}</div> : null}
      <div className={styles.controls}>
        <label>
          <span>Linked account</span>
          <select
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            disabled={disabled || isLoading || busy}
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
          <span>League season</span>
          <select
            value={leagueId}
            onChange={(event) => setLeagueId(event.target.value)}
            disabled={disabled || !account || busy}
          >
            <option value="">Choose league</option>
            {account?.leagues.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} ({candidate.seasonKey})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Team</span>
          <select
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            disabled={disabled || !league || league.teams.length === 0 || busy}
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
          onClick={applyTemporary}
          disabled={
            disabled ||
            busy ||
            !league ||
            !consumerSupport.supported ||
            league.settings.diagnostics.status === "unsupported"
          }
        >
          Apply to this {contextLabel}
        </button>
        <button
          type="button"
          onClick={() => void makeDefault()}
          disabled={
            disabled ||
            busy ||
            !league ||
            !consumerSupport.supported ||
            league.isDefault ||
            league.settings.diagnostics.status === "unsupported"
          }
        >
          Make account default
        </button>
      </div>
      {league ? (
        <div className={styles.summary}>
          <strong>{mappingSummary}</strong>
          {!consumerSupport.supported && consumerSupport.reason ? (
            <span>{consumerSupport.reason}</span>
          ) : null}
          {leagueWarnings.length ? (
            <ul>
              {leagueWarnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          ) : (
            <span>Exact supported hockey mapping.</span>
          )}
        </div>
      ) : null}
    </section>
  );
}

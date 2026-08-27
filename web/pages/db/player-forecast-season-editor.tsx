import Head from "next/head";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import SeasonIdentityResolver from "components/PlayerForecastSeasonEditor/SeasonIdentityResolver";
import {
  FANTASY_PROJECTION_BETA_LABEL,
  FANTASY_PROJECTION_SEASON_ID,
  GOALIE_ADVANCED_V5_PRIMITIVE_TARGETS,
  GOALIE_FANTASY_V4_PRIMITIVE_TARGETS,
  GOALIE_PRIMITIVE_TARGETS,
  SKATER_ADVANCED_V5_PRIMITIVE_TARGETS,
  SKATER_FANTASY_V4_PRIMITIVE_TARGETS,
  SKATER_PRIMITIVE_TARGETS,
} from "lib/fantasy-projections/contracts";
import supabase from "lib/supabase";
import styles from "styles/PlayerForecastSeasonEditor.module.scss";

type Workspace = {
  success: boolean;
  seasonId: number;
  contract: { version: string; checksum: string };
  runs: any[];
  releases: any[];
  queue: any[];
  conflicts?: any[];
  rosterIntegrity?: {
    latestSnapshot: any | null;
    recentObservations: any[];
    openConflictCount: number;
    rosterFreshAt?: string | null;
    transactionCutoffAt?: string | null;
    transactionCoverage?: {
      windowStart?: string;
      cutoffAt?: string | null;
      normalizedObservations?: number;
      officialObservations?: number;
      complete?: boolean;
      stale?: boolean;
      status?: string;
      holdReason?: string;
    };
  };
  playerPoolReview?: any[];
  draft: {
    runId: string;
    playerCount: number;
    selectedTeamId: number | null;
    players: any[];
    teams: any[];
    overrides: any[];
  } | null;
};

const NON_STAT_OVERRIDE_TARGETS = new Set([
  "GAMES_PLAYED",
  "GAMES_STARTED",
  "TOTAL_TOI",
  "EV_TOI",
  "PP_TOI",
  "PK_TOI",
]);
const SKATER_STAT_OVERRIDE_TARGETS: string[] = Array.from(
  new Set([
    ...SKATER_PRIMITIVE_TARGETS,
    ...SKATER_FANTASY_V4_PRIMITIVE_TARGETS,
    ...SKATER_ADVANCED_V5_PRIMITIVE_TARGETS,
  ]),
).filter((target) => !NON_STAT_OVERRIDE_TARGETS.has(target));
const GOALIE_STAT_OVERRIDE_TARGETS: string[] = Array.from(
  new Set([
    ...GOALIE_PRIMITIVE_TARGETS,
    ...GOALIE_FANTASY_V4_PRIMITIVE_TARGETS,
    ...GOALIE_ADVANCED_V5_PRIMITIVE_TARGETS,
  ]),
).filter((target) => !NON_STAT_OVERRIDE_TARGETS.has(target));

function projectionTargetLabel(target: string): string {
  return target
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function editorRequest(url: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(data.session?.access_token
        ? { Authorization: `Bearer ${data.session.access_token}` }
        : {}),
      ...(options.headers ?? {}),
    },
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    const issueSummary = Array.isArray(payload.issues)
      ? payload.issues.map((issue: any) => issue.message).join(" ")
      : "";
    throw new Error([payload.message, issueSummary].filter(Boolean).join(" ") || "Editor request failed.");
  }
  return payload;
}

function changedStats(player: any): string {
  return Object.entries(player.adjustment_delta ?? {})
    .map(([target, value]) => `${target}: ${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}`)
    .join(", ");
}

function ratingSummary(ratings: Record<string, any> | null | undefined): string {
  return Object.entries(ratings ?? {})
    .map(([key, raw]) => {
      const value = typeof raw === "number" ? raw : Number(raw?.value);
      return Number.isFinite(value)
        ? `${key.replace("goaltending", "goalie")} ${value.toFixed(1)}`
        : null;
    })
    .filter(Boolean)
    .join(" · ") || "Pending";
}

function roleSummary(role: Record<string, unknown> | null | undefined): string {
  return Object.entries(role ?? {})
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key.replace(/([A-Z])/g, " $1").toLowerCase()} ${value}`)
    .join(" · ") || "Pending";
}

function PlayerModelContext({ player }: { player: any }) {
  const rookie = player.rookie_profile ?? {};
  const edge = player.provenance?.advancedV5?.edgeContext ?? {};
  const edgeMetrics = Object.entries(edge.metrics ?? {});
  return (
    <>
      {rookie.rookie ? (
        <details className={styles.rookieDetail}>
          <summary>Rookie source &amp; NHLe inputs</summary>
          <p>
            {rookie.sourceLeague ?? "Unknown league"} {rookie.sourceSeason ?? ""}
            {rookie.sourceGames == null ? "" : ` · ${rookie.sourceGames} source GP`}
            {rookie.transitionSupport == null ? "" : ` · ${rookie.transitionSupport} transitions`}
          </p>
          <p>
            Roster {(Number(rookie.rosterProbability ?? 0) * 100).toFixed(0)}%
            {rookie.conditionalNhlGames == null ? "" : ` · ${Number(rookie.conditionalNhlGames).toFixed(1)} GP if rostered`}
            {rookie.expectedNhlGames == null ? "" : ` · ${Number(rookie.expectedNhlGames).toFixed(1)} expected NHL GP`}
            {rookie.uncertaintyMultiplier == null ? "" : ` · ${Number(rookie.uncertaintyMultiplier).toFixed(2)}× uncertainty`}
          </p>
          <p>{rookie.nhleMethod ?? "Prior fallback"}</p>
          {Object.keys(rookie.translatedConditionalRates ?? {}).length ? (
            <p>
              Translated rates: {Object.entries(rookie.translatedConditionalRates)
                .map(([target, value]) => `${projectionTargetLabel(target)} ${Number(value).toFixed(3)}`)
                .join(" · ")}
            </p>
          ) : null}
          {Array.isArray(rookie.sourceCoverage) ? (
            <p>Coverage: {rookie.sourceCoverage.join(" · ")}</p>
          ) : null}
        </details>
      ) : null}
      {edgeMetrics.length ? (
        <details className={styles.rookieDetail}>
          <summary>NHL EDGE context</summary>
          <p>Observed through {edge.snapshotDate}. Context only; not projected totals.</p>
          <p>
            {edgeMetrics
              .map(([target, value]) => `${projectionTargetLabel(target)} ${Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 })}`)
              .join(" · ")}
          </p>
          {edge.sourceUrl ? <a href={edge.sourceUrl} target="_blank" rel="noreferrer">Official source</a> : null}
        </details>
      ) : null}
    </>
  );
}

export default function PlayerForecastSeasonEditorPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [teamFilter, setTeamFilter] = useState("");
  const [scope, setScope] = useState<"player" | "team">("player");
  const [playerId, setPlayerId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [fieldPath, setFieldPath] = useState("stats.GOALS");
  const [overrideValue, setOverrideValue] = useState("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [releaseLabel, setReleaseLabel] = useState(FANTASY_PROJECTION_BETA_LABEL);
  const [publishReason, setPublishReason] = useState("");
  const [draftSourceRunId, setDraftSourceRunId] = useState("");
  const [cloneStatOverrides, setCloneStatOverrides] = useState(false);

  const load = useCallback(async () => {
    try {
      const payload = await editorRequest(
        `/api/v1/player-forecasts/admin/season-editor?seasonId=${FANTASY_PROJECTION_SEASON_ID}${teamFilter ? `&teamId=${teamFilter}` : ""}`,
      );
      setWorkspace(payload);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [teamFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const releases = workspace?.releases ?? [];
    if (
      !draftSourceRunId ||
      !releases.some((release) => String(release.run_id) === draftSourceRunId)
    ) {
      const preferred =
        releases.find((release) => release.view_key === "current") ?? releases[0];
      setDraftSourceRunId(preferred?.run_id ? String(preferred.run_id) : "");
    }
  }, [draftSourceRunId, workspace?.releases]);

  const teams = useMemo(
    () => workspace?.draft?.teams ?? [],
    [workspace?.draft?.teams],
  );
  const players = useMemo(
    () => workspace?.draft?.players ?? [],
    [workspace?.draft?.players],
  );
  useEffect(() => {
    if (!teamFilter && teams.length > 0) {
      setTeamFilter(String(teams[0].team_id));
    }
  }, [teamFilter, teams]);
  const visiblePlayers = useMemo(
    () =>
      players.filter(
        (player) => !teamFilter || String(player.team_id ?? "") === teamFilter,
      ),
    [players, teamFilter],
  );
  const selectedPlayer = useMemo(
    () => players.find((player) => String(player.fhfh_player_id) === playerId),
    [playerId, players],
  );
  const selectedIsGoalie =
    selectedPlayer?.population === "goalie" || selectedPlayer?.position === "G";
  const playerStatOverrideTargets =
    selectedIsGoalie
      ? GOALIE_STAT_OVERRIDE_TARGETS
      : SKATER_STAT_OVERRIDE_TARGETS;
  useEffect(() => {
    if (
      scope === "player" &&
      fieldPath.startsWith("stats.") &&
      !playerStatOverrideTargets.includes(fieldPath.slice("stats.".length))
    ) {
      setFieldPath(`stats.${playerStatOverrideTargets[0]}`);
    } else if (scope === "team" && fieldPath.startsWith("stats.")) {
      setFieldPath("ratings.offense");
    } else if (
      scope === "player" &&
      ((selectedIsGoalie && [
        "ratings.offense",
        "ratings.defense",
        "toi.evenStrength",
        "toi.powerPlay",
        "toi.penaltyKill",
        "deployment.mostLikelyRole.forwardLine",
        "deployment.mostLikelyRole.defensePair",
        "deployment.mostLikelyRole.powerPlayUnit",
        "deployment.mostLikelyRole.penaltyKillUnit",
        "deployment.roleProbabilities.forwardLine",
        "deployment.roleProbabilities.defensePair",
        "deployment.roleProbabilities.powerPlayUnit",
        "deployment.roleProbabilities.penaltyKillUnit",
      ].includes(fieldPath)) ||
        (!selectedIsGoalie && [
          "expected.starts",
          "ratings.goaltending",
          "deployment.mostLikelyRole.goalieOrder",
          "deployment.roleProbabilities.goalieOrder",
        ].includes(fieldPath)))
    ) {
      setFieldPath("expected.games");
    }
  }, [fieldPath, playerStatOverrideTargets, scope, selectedIsGoalie]);
  const rosterWarnings = useMemo(() => {
    return teams.flatMap((team) => {
      const count = team.roster_counts ?? { forwards: 0, defensemen: 0, goalies: 0 };
      return count.forwards < 12 || count.defensemen < 6 || count.goalies < 2
        ? [`${team.abbreviation}: ${count.forwards} F, ${count.defensemen} D, ${count.goalies} G`]
        : [];
    });
  }, [teams]);

  async function runAction(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const result = await editorRequest(url, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setFeedback("Saved. The immutable ledger and effective draft have been refreshed.");
      await load();
      return result;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const structuredDeployment =
      fieldPath.startsWith("deployment.roleProbabilities.") ||
      [
        "deployment.forwardLines",
        "deployment.defensePairs",
        "deployment.powerPlayUnits",
        "deployment.penaltyKillUnits",
        "deployment.goalieOrder",
      ].includes(fieldPath);
    let value: unknown;
    if (structuredDeployment) {
      try {
        value = JSON.parse(overrideValue);
      } catch {
        setError("Deployment distributions and units must be valid JSON.");
        return;
      }
    } else if (
      fieldPath === "player.position" ||
      fieldPath === "player.poolStatus"
    ) {
      value = overrideValue;
    } else {
      value = Number(overrideValue);
    }
    const selectedTeamId =
      scope === "team"
        ? Number(teamId)
        : selectedPlayer?.team_id == null
          ? null
          : Number(selectedPlayer.team_id);
    const supersededOverride = workspace?.draft?.overrides.find(
      (override) =>
        override.scope_type === scope &&
        override.field_path === fieldPath &&
        (scope === "player"
          ? Number(override.fhfh_player_id) === Number(playerId)
          : Number(override.team_id) === selectedTeamId),
    );
    const result = await runAction(
      "/api/v1/player-forecasts/admin/season-overrides",
      {
        runId: workspace?.draft?.runId,
        scopeType: scope,
        fhfhPlayerId: scope === "player" ? Number(playerId) : null,
        teamId: selectedTeamId,
        fieldPath,
        overrideValue: value,
        reason,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        supersedesId: supersededOverride?.id ?? null,
      },
    );
    if (result) {
      setOverrideValue("");
      setReason("");
      setExpiresAt("");
    }
  }

  async function resolveRosterConflict(
    conflict: any,
    action: "select_team" | "mark_unsigned" | "retain_current" | "exclude_evidence",
  ) {
    const reason = window.prompt("What evidence supports this roster resolution?");
    if (!reason?.trim()) return;
    let organizationTeamId: number | null = null;
    let rosterStatus: string | undefined;
    if (action === "select_team") {
      const team = window.prompt(
        "Resolved NHL organization team ID",
        String(conflict.candidate_team_ids?.[0] ?? ""),
      );
      if (!team || !Number.isInteger(Number(team)) || Number(team) <= 0) {
        setError("A valid organization team ID is required.");
        return;
      }
      organizationTeamId = Number(team);
      rosterStatus =
        window.prompt(
          "Roster status: active_nhl, injured_nhl, affiliate, or prospect_reserve",
          "active_nhl",
        ) ?? "active_nhl";
    }
    await runAction(
      "/api/v1/player-forecasts/admin/season-roster-conflicts",
      {
        conflictId: conflict.id,
        action,
        organizationTeamId,
        rosterStatus,
        reason,
      },
    );
  }

  const currentRun = workspace?.runs.find(
    (run) => run.id === workspace?.draft?.runId,
  );
  return (
    <>
      <Head>
        <title>Season Projection Editor | FHFH</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <main className={styles.page}>
        <header className={styles.hero}>
          <div>
            <p>Owner-only projection operations</p>
            <h1>2026–27 Season Editor</h1>
            <span>
              Model values, editorial adjustments, validations, publications, and
              rollbacks remain separate and immutable.
            </span>
          </div>
          <code>{workspace?.contract.version ?? "Loading v3 contract…"}</code>
        </header>

        {error ? <div className={styles.error} role="alert">{error}</div> : null}
        {feedback ? <div className={styles.feedback} role="status">{feedback}</div> : null}

        <section className={styles.health}>
          <div><span>Draft</span><strong>{currentRun?.status ?? "none"}</strong></div>
          <div><span>Players</span><strong>{workspace?.draft?.playerCount ?? 0}</strong></div>
          <div><span>Teams</span><strong>{teams.length}</strong></div>
          <div><span>Dirty jobs</span><strong>{workspace?.queue.filter((job) => ["pending", "running", "failed"].includes(job.status)).length ?? 0}</strong></div>
          <div><span>Source conflicts</span><strong>{workspace?.conflicts?.length ?? 0}</strong></div>
          <div><span>Pool review</span><strong>{workspace?.playerPoolReview?.length ?? 0}</strong></div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><p>Publication gates</p><h2>Completeness and source review</h2></div>
            <button type="button" onClick={() => void load()} disabled={busy}>Refresh</button>
          </div>
          {rosterWarnings.length === 0 ? (
            <p className={styles.good}>All displayed teams meet the 12 F / 6 D / 2 G minimum.</p>
          ) : (
            <ul className={styles.warnings}>
              {rosterWarnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          )}
          <div className={styles.integritySummary}>
            <span>
              Roster snapshot: {workspace?.rosterIntegrity?.latestSnapshot?.available_at
                ? new Date(workspace.rosterIntegrity.latestSnapshot.available_at).toLocaleString()
                : "not captured"}
            </span>
            <span>
              Recent official evidence: {workspace?.rosterIntegrity?.recentObservations?.length ?? 0} rows
            </span>
            <span>
              Transaction cutoff: {workspace?.rosterIntegrity?.transactionCutoffAt
                ? new Date(workspace.rosterIntegrity.transactionCutoffAt).toLocaleString()
                : "no normalized transaction evidence"}
            </span>
            <span>
              Transaction coverage: {workspace?.rosterIntegrity?.transactionCoverage?.complete &&
                !workspace?.rosterIntegrity?.transactionCoverage?.stale
                ? "complete"
                : `${workspace?.rosterIntegrity?.transactionCoverage?.status ?? "missing"} — publication held`}
            </span>
          </div>
          {(!workspace?.rosterIntegrity?.transactionCoverage?.complete ||
            workspace?.rosterIntegrity?.transactionCoverage?.stale) && (
            <p className={styles.warnings}>
              {workspace?.rosterIntegrity?.transactionCoverage?.holdReason ??
                "A complete official transaction audit is required before publishing a new release."}
            </p>
          )}
          {(workspace?.conflicts?.length ?? 0) > 0 ? (
            <div className={styles.rosterConflicts}>
              <h3>Roster and transaction conflicts</h3>
              {workspace?.conflicts?.map((conflict) => (
                <article key={conflict.id}>
                  <div>
                    <strong>{conflict.player_name} · NHL {conflict.nhl_player_id}</strong>
                    <span>{conflict.summary}</span>
                    <small>
                      {conflict.conflict_type} · current {conflict.current_team?.abbreviation ?? "unsigned"}
                      {" · candidate "}
                      {conflict.candidate_teams?.map((team: any) => team.abbreviation).join(", ") || "none"}
                    </small>
                    {conflict.evidence?.map((evidence: any) => (
                      <small key={evidence.id}>
                        {evidence.observation_kind} → {evidence.organization?.abbreviation ?? "unsigned"}
                        {` · ${evidence.roster_status} · ${Math.round(Number(evidence.confidence) * 100)}%`}
                        {evidence.source_url ? (
                          <> · <a href={evidence.source_url} target="_blank" rel="noreferrer">source</a></>
                        ) : null}
                      </small>
                    ))}
                  </div>
                  <button type="button" disabled={busy} onClick={() => void resolveRosterConflict(conflict, "select_team")}>Select team</button>
                  <button type="button" disabled={busy} onClick={() => void resolveRosterConflict(conflict, "retain_current")}>Retain current</button>
                  <button type="button" disabled={busy} onClick={() => void resolveRosterConflict(conflict, "mark_unsigned")}>Mark unsigned</button>
                  <button type="button" disabled={busy} onClick={() => void resolveRosterConflict(conflict, "exclude_evidence")}>Exclude evidence</button>
                </article>
              ))}
            </div>
          ) : null}
          {(workspace?.playerPoolReview?.length ?? 0) > 0 ? (
            <div className={styles.poolReview}>
              <h3>Unresolved official-roster identities</h3>
              {workspace?.playerPoolReview?.map((review) => (
                <article key={review.id}>
                  <div>
                    <strong>{review.raw_player_name}</strong>
                    <span>NHL {review.nhl_player_id} · team {review.team_id} · {review.position}</span>
                  </div>
                  <SeasonIdentityResolver
                    review={review}
                    disabled={busy}
                    request={editorRequest}
                    onResolve={async (body) =>
                      Boolean(
                        await runAction(
                          "/api/v1/player-forecasts/admin/season-player-pool",
                          body,
                        ),
                      )
                    }
                  />
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div><p>Team-by-team pool</p><h2>Base model versus effective draft</h2></div>
            <label>Team
              <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
                <option value="">All</option>
                {teams.map((team) => <option key={team.team_id} value={team.team_id}>{team.abbreviation}</option>)}
              </select>
            </label>
          </div>
          <div className={styles.tableScroll}>
            {!teamFilter ? <p>Select a team to load its effective player draft.</p> : null}
            <table>
              <thead><tr><th>Player</th><th>Team</th><th>Pos</th><th>Pool</th><th>GP</th><th>Rating</th><th>Role</th><th>Editorial delta</th></tr></thead>
              <tbody>
                {visiblePlayers.map((player) => (
                  <tr key={player.fhfh_player_id}>
                    <th scope="row">{player.player_name}</th>
                    <td>{teams.find((team) => Number(team.team_id) === Number(player.team_id))?.abbreviation ?? "FA"}</td>
                    <td>{player.position}</td>
                    <td>{player.pool_status}</td>
                    <td>{Number(player.expected_games).toFixed(1)}</td>
                    <td>{ratingSummary(player.ratings)}</td>
                    <td>
                      {roleSummary(player.deployment?.mostLikelyRole)}
                      {player.rookie_profile?.rookie ? (
                        <small className={styles.rookieDetail}>
                          Rookie · roster {Math.round(Number(player.rookie_profile.rosterProbability ?? 0) * 100)}% · {player.rookie_profile.nhleMethod ?? "prior"}
                        </small>
                      ) : null}
                      <PlayerModelContext player={player} />
                    </td>
                    <td>{changedStats(player) || "Model unchanged"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><p>Immutable adjustment</p><h2>Create or supersede an assumption</h2></div></div>
          <form className={styles.form} onSubmit={createOverride}>
            <label>Scope
              <select value={scope} onChange={(event) => setScope(event.target.value as "player" | "team")}>
                <option value="player">Player</option>
                <option value="team">Team</option>
              </select>
            </label>
            {scope === "player" ? (
              <label>Player
                <select required value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
                  <option value="">Choose player</option>
                  {visiblePlayers.map((player) => <option key={player.fhfh_player_id} value={player.fhfh_player_id}>{player.player_name}</option>)}
                </select>
              </label>
            ) : (
              <label>Team
                <select required value={teamId} onChange={(event) => setTeamId(event.target.value)}>
                  <option value="">Choose team</option>
                  {teams.map((team) => <option key={team.team_id} value={team.team_id}>{team.team_name}</option>)}
                </select>
              </label>
            )}
            <label>Field
              <select value={fieldPath} onChange={(event) => setFieldPath(event.target.value)}>
                {scope === "player" ? (
                  <>
                    <optgroup label={selectedIsGoalie ? "Goalie primitive totals" : "Skater primitive totals"}>
                      {playerStatOverrideTargets.map((target) => (
                        <option key={target} value={`stats.${target}`}>
                          {projectionTargetLabel(target)}
                        </option>
                      ))}
                    </optgroup>
                    <option value="expected.games">Expected GP</option>
                    {selectedIsGoalie ? <option value="expected.starts">Expected starts</option> : null}
                    <option value="player.teamId">Projected team</option>
                    <option value="player.position">Position</option>
                    <option value="player.poolStatus">Pool status</option>
                    {selectedIsGoalie ? (
                      <option value="ratings.goaltending">Goalie rating</option>
                    ) : (
                      <>
                        <option value="ratings.offense">Offense rating</option>
                        <option value="ratings.defense">Defense rating</option>
                        <option value="toi.evenStrength">Expected EV TOI</option>
                        <option value="toi.powerPlay">Expected PP TOI</option>
                        <option value="toi.penaltyKill">Expected PK TOI</option>
                      </>
                    )}
                    <option value="toi.total">Expected total TOI</option>
                    {selectedIsGoalie ? (
                      <>
                        <option value="deployment.mostLikelyRole.goalieOrder">Most likely goalie order</option>
                        <option value="deployment.roleProbabilities.goalieOrder">Goalie-order probabilities (JSON)</option>
                      </>
                    ) : (
                      <>
                        <option value="deployment.mostLikelyRole.forwardLine">Most likely forward line</option>
                        <option value="deployment.mostLikelyRole.defensePair">Most likely defense pair</option>
                        <option value="deployment.mostLikelyRole.powerPlayUnit">Most likely PP unit</option>
                        <option value="deployment.mostLikelyRole.penaltyKillUnit">Most likely PK unit</option>
                        <option value="deployment.roleProbabilities.forwardLine">Forward-line probabilities (JSON)</option>
                        <option value="deployment.roleProbabilities.defensePair">Defense-pair probabilities (JSON)</option>
                        <option value="deployment.roleProbabilities.powerPlayUnit">Power-play probabilities (JSON)</option>
                        <option value="deployment.roleProbabilities.penaltyKillUnit">Penalty-kill probabilities (JSON)</option>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <option value="ratings.offense">Team offense</option>
                    <option value="ratings.defense">Team defense</option>
                    <option value="ratings.goaltending">Team goaltending</option>
                    <option value="ratings.powerPlay">Power play</option>
                    <option value="ratings.penaltyKill">Penalty kill</option>
                    <option value="ratings.pace">Pace</option>
                    <option value="deployment.forwardLines">Forward lines (JSON)</option>
                    <option value="deployment.defensePairs">Defense pairs (JSON)</option>
                    <option value="deployment.powerPlayUnits">Power-play units (JSON)</option>
                    <option value="deployment.penaltyKillUnits">Penalty-kill units (JSON)</option>
                    <option value="deployment.goalieOrder">Goalie order (JSON)</option>
                  </>
                )}
              </select>
            </label>
            <label>New value
              <input required value={overrideValue} onChange={(event) => setOverrideValue(event.target.value)} />
            </label>
            <label className={styles.reason}>Reason
              <input required value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
            <label>Expires (optional)
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            </label>
            <button type="submit" disabled={busy || !workspace?.draft}>Save immutable adjustment</button>
          </form>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><p>Release control</p><h2>Validate, publish, compare, or roll back</h2></div></div>
          <div className={styles.releaseActions}>
            <label>Draft source
              <select
                value={draftSourceRunId}
                onChange={(event) => setDraftSourceRunId(event.target.value)}
              >
                <option value="">Choose published release</option>
                {(workspace?.releases ?? []).map((release) => (
                  <option key={release.id} value={release.run_id}>
                    {release.view_key} #{release.release_number} · {release.release_label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={cloneStatOverrides}
                onChange={(event) => setCloneStatOverrides(event.target.checked)}
              />
              Deliberately carry direct stat overrides
            </label>
            <button
              type="button"
              disabled={busy || !draftSourceRunId}
              onClick={() => void runAction(
                "/api/v1/player-forecasts/admin/season-draft",
                {
                  sourceRunId: draftSourceRunId,
                  includeStatOverrides: cloneStatOverrides,
                },
              )}
            >
              Create editable draft
            </button>
            <button
              type="button"
              disabled={busy || !workspace?.draft}
              onClick={() => void runAction("/api/v1/player-forecasts/admin/season-validate", { runId: workspace?.draft?.runId })}
            >
              Validate complete draft
            </button>
            <button
              type="button"
              disabled={busy || !workspace?.draft}
              onClick={() => void runAction("/api/v1/player-forecasts/admin/season-rerun", {
                seasonId: FANTASY_PROJECTION_SEASON_ID,
                teamId: teamFilter ? Number(teamFilter) : null,
                reason: "Owner-requested season rerun",
              })}
            >
              Queue {teamFilter ? "team" : "league"} rerun
            </button>
          </div>
          {currentRun?.validation_receipt ? (
            <div className={styles.integritySummary}>
              <span>Validated: {new Date(currentRun.validation_receipt.checkedAt).toLocaleString()}</span>
              <span>{currentRun.validation_receipt.playerCount} players · {currentRun.validation_receipt.teamCount} teams · {currentRun.validation_receipt.scheduleGameCount} games</span>
              <span>Issues: {currentRun.validation_receipt.issueCount}</span>
              <span>Output: {String(currentRun.validation_receipt.effectiveOutputHash ?? "").slice(0, 12)}…</span>
            </div>
          ) : null}
          <form className={styles.publishForm} onSubmit={(event) => {
            event.preventDefault();
            void runAction("/api/v1/player-forecasts/admin/season-publish", {
              runId: workspace?.draft?.runId,
              label: releaseLabel,
              reason: publishReason,
            });
          }}>
            <label>Public release label<input value={releaseLabel} onChange={(event) => setReleaseLabel(event.target.value)} /></label>
            <label>Publication reason<input required value={publishReason} onChange={(event) => setPublishReason(event.target.value)} /></label>
            <button type="submit" disabled={busy || currentRun?.status !== "validated"}>Publish atomic release</button>
          </form>
          <div className={styles.releaseList}>
            {(workspace?.releases ?? []).map((release) => (
              <article key={release.id}>
                <div>
                  <strong>{release.view_key} #{release.release_number}</strong>
                  <span>{release.release_label}</span>
                  <time>{new Date(release.issued_at).toLocaleString()}</time>
                  <small>
                    {release.metric_set_version} · {release.health_status} · release {String(release.release_hash).slice(0, 12)}…
                    {release.roster_observed_at ? ` · roster ${new Date(release.roster_observed_at).toLocaleString()}` : ""}
                    {release.transaction_cutoff_at ? ` · transactions ${new Date(release.transaction_cutoff_at).toLocaleString()}` : ""}
                  </small>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const rollbackReason = window.prompt("Why are you rolling back to this release?");
                    if (rollbackReason) {
                      void runAction("/api/v1/player-forecasts/admin/season-rollback", {
                        releaseId: release.id,
                        reason: rollbackReason,
                      });
                    }
                  }}
                >
                  Roll back pointer
                </button>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

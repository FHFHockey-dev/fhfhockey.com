import Head from "next/head";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "contexts/AuthProviderContext";
import {
  FANTASY_PROJECTION_BETA_LABEL,
  FANTASY_PROJECTION_SEASON_ID,
  fantasyProjectionTotal,
  GOALIE_SCORING_TARGETS,
  SKATER_SCORING_TARGETS,
  type FantasyProjectionPlayer,
  type FantasyProjectionPlayersResponse,
  type FantasyProjectionRelease,
  type FantasyProjectionTeam,
  type FantasyProjectionTeamsResponse,
  type FantasyProjectionView,
} from "lib/fantasy-projections/contracts";
import supabase from "lib/supabase";
import { calculateCategoryScores } from "lib/scoring/categoryScores";
import {
  defaultFantasyProjectionScoringSettings,
  readFantasyProjectionScoringSettings,
  saveFantasyProjectionScoringSettings,
  type FantasyProjectionScoringSettingsV2,
} from "lib/fantasy-projections/scoringSettings";
import {
  fantraxAccountRequest,
  useFantraxConnections,
} from "hooks/useFantraxConnections";
import type { FantraxConnectionLeague } from "lib/integrations/fantrax/contracts";
import EspnLeagueSettingsPanel, {
  type EspnLeagueSelection,
} from "components/integrations/EspnLeagueSettingsPanel";
import type { EspnConnectionLeague } from "lib/integrations/espn/contracts";
import {
  loadEspnScoringOverride,
  saveEspnScoringOverride,
} from "lib/integrations/espn/sessionOverride";
import { mapUserSettingsRowToLeagueSettings } from "lib/user-settings/mappers";
import type { Database } from "lib/supabase/database-generated.types";
import styles from "styles/FantasyProjections.module.scss";

const STAT_LABELS: Record<string, string> = {
  GAMES_PLAYED: "GP",
  GAMES_STARTED: "GS",
  TOTAL_TOI: "TOI",
  EV_TOI: "EV TOI",
  PP_TOI: "PP TOI",
  PK_TOI: "PK TOI",
  GOALS: "G",
  PRIMARY_ASSISTS: "A1",
  SECONDARY_ASSISTS: "A2",
  ASSISTS: "A",
  POINTS: "P",
  PLUS_MINUS: "+/−",
  SHOTS_ON_GOAL: "SOG",
  HITS: "HIT",
  BLOCKED_SHOTS: "BLK",
  PENALTY_MINUTES: "PIM",
  PP_GOALS: "PPG",
  PP_ASSISTS: "PPA",
  PP_POINTS: "PPP",
  SH_GOALS: "SHG",
  SH_ASSISTS: "SHA",
  SH_POINTS: "SHP",
  FACEOFFS_WON: "FOW",
  FACEOFFS_LOST: "FOL",
  WINS_GOALIE: "W",
  LOSSES_GOALIE: "L",
  OTL_GOALIE: "OTL",
  SHOTS_AGAINST_GOALIE: "SA",
  SAVES_GOALIE: "SV",
  GOALS_AGAINST_GOALIE: "GA",
  SHUTOUTS_GOALIE: "SO",
  SAVE_PERCENTAGE: "SV%",
  GOALS_AGAINST_AVERAGE: "GAA",
};
const SKATER_COLUMNS = [
  "GAMES_PLAYED",
  "GOALS",
  "ASSISTS",
  "POINTS",
  "SHOTS_ON_GOAL",
  "HITS",
  "BLOCKED_SHOTS",
  "PP_POINTS",
];
const GOALIE_COLUMNS = [
  "GAMES_PLAYED",
  "GAMES_STARTED",
  "WINS_GOALIE",
  "SAVES_GOALIE",
  "GOALS_AGAINST_GOALIE",
  "SHUTOUTS_GOALIE",
  "SAVE_PERCENTAGE",
  "GOALS_AGAINST_AVERAGE",
];

type PlayerMode = "all" | "skater" | "goalie";
type ProductView = "players" | "teams";

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ratingValue(
  player: FantasyProjectionPlayer,
  key?: string,
): number {
  const preferred =
    key ??
    (player.population === "goalie"
      ? "goaltending"
      : player.population === "defense"
        ? "defense"
        : "offense");
  const value = player.ratings[preferred];
  return typeof value === "number" ? value : numberValue(value?.value);
}

function formatValue(target: string, value: number): string {
  if (target === "SAVE_PERCENTAGE") return value.toFixed(3).replace(/^0/, "");
  if (target === "GOALS_AGAINST_AVERAGE") return value.toFixed(2);
  if (target.endsWith("_TOI") || target === "TOTAL_TOI") {
    const minutes = value / 60;
    return minutes >= 100 ? minutes.toFixed(0) : minutes.toFixed(1);
  }
  return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.55) return "Medium";
  return "Low";
}

function roleLabel(player: FantasyProjectionPlayer): string {
  const role = player.deployment.mostLikelyRole;
  if (!role) return "Role pending";
  return Object.values(role)
    .filter((value) => value != null && String(value).trim())
    .map(String)
    .join(" · ") || "Role pending";
}

function ProjectionInterval({
  player,
  target,
}: {
  player: FantasyProjectionPlayer;
  target: string;
}) {
  const mean = numberValue(player.publishedValues[target]);
  const low = numberValue(player.p10[target]);
  const high = numberValue(player.p90[target]);
  const label = `${STAT_LABELS[target] ?? target}: ${formatValue(target, mean)}; 10th to 90th percentile ${formatValue(target, low)} to ${formatValue(target, high)}`;
  return (
    <span className={styles.interval} title={label} aria-label={label}>
      {formatValue(target, mean)}
      <small>{formatValue(target, low)}–{formatValue(target, high)}</small>
    </span>
  );
}

function ScoringEditor({
  settings,
  onChange,
  onReset,
  onSaveBrowser,
  onSaveAccount,
  canSave,
  feedback,
}: {
  settings: FantasyProjectionScoringSettingsV2;
  onChange: (next: FantasyProjectionScoringSettingsV2) => void;
  onReset: () => void;
  onSaveBrowser: () => void;
  onSaveAccount: () => void;
  canSave: boolean;
  feedback: string | null;
}) {
  const pointTargets = [
    { label: "Skater points", key: "skaterPoints" as const, targets: SKATER_SCORING_TARGETS },
    { label: "Goalie points", key: "goaliePoints" as const, targets: GOALIE_SCORING_TARGETS },
  ];
  const categoryTargets = Array.from(
    new Set([
      ...Object.keys(settings.categoryWeights),
      ...SKATER_SCORING_TARGETS,
      ...GOALIE_SCORING_TARGETS,
    ]),
  );
  const doubleCounting =
    settings.leagueType === "points" &&
    ((numberValue(settings.skaterPoints.ASSISTS) !== 0 &&
      (numberValue(settings.skaterPoints.PRIMARY_ASSISTS) !== 0 ||
        numberValue(settings.skaterPoints.SECONDARY_ASSISTS) !== 0)) ||
      (numberValue(settings.skaterPoints.POINTS) !== 0 &&
        (numberValue(settings.skaterPoints.GOALS) !== 0 ||
          numberValue(settings.skaterPoints.ASSISTS) !== 0)) ||
      numberValue(settings.goaliePoints.SAVE_PERCENTAGE) !== 0 ||
      numberValue(settings.goaliePoints.GOALS_AGAINST_AVERAGE) !== 0);
  const updateMap = (
    key: "skaterPoints" | "goaliePoints" | "categoryWeights",
    target: string,
    rawValue: number,
  ) =>
    onChange({
      ...settings,
      [key]: {
        ...settings[key],
        [target]: Number.isFinite(rawValue) ? rawValue : 0,
      },
    });
  return (
    <details className={styles.scoring}>
      <summary>Customize fantasy scoring</summary>
      <p>
        Points mode uses separate role-specific maps. Categories mode shows FHFH&apos;s
        projected category-value composite: full-pool, role-specific weighted z-scores.
      </p>
      <div className={styles.modeToggle}>
        <button
          type="button"
          aria-pressed={settings.leagueType === "points"}
          onClick={() => onChange({ ...settings, leagueType: "points" })}
        >
          Points
        </button>
        <button
          type="button"
          aria-pressed={settings.leagueType === "categories"}
          onClick={() => onChange({ ...settings, leagueType: "categories" })}
        >
          Categories
        </button>
      </div>
      {doubleCounting ? (
        <p className={styles.warning} role="status">
          Your map scores a ratio or overlapping categories. FHFH honors it, but the
          same underlying event may be counted more than once.
        </p>
      ) : null}
      {settings.leagueType === "points"
        ? pointTargets.map((group) => (
            <section key={group.key} className={styles.scoringGroup}>
              <h3>{group.label}</h3>
              <div className={styles.scoringGrid}>
                {group.targets.map((target) => (
                  <label key={target}>
                    <span>{STAT_LABELS[target] ?? target}</span>
                    <input
                      type="number"
                      step="0.05"
                      value={settings[group.key][target] ?? 0}
                      onChange={(event) =>
                        updateMap(group.key, target, Number(event.target.value))
                      }
                    />
                  </label>
                ))}
              </div>
            </section>
          ))
        : (
          <section className={styles.scoringGroup}>
            <h3>Category weights</h3>
            <div className={styles.scoringGrid}>
              {categoryTargets.map((target) => (
                <label key={target}>
                  <span>{STAT_LABELS[target] ?? target}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.categoryWeights[target] ?? 0}
                    onChange={(event) =>
                      updateMap("categoryWeights", target, Number(event.target.value))
                    }
                  />
                </label>
              ))}
            </div>
          </section>
        )}
      <div className={styles.actions}>
        <button type="button" onClick={onReset}>Reset to FHFH defaults</button>
        <button type="button" onClick={onSaveBrowser}>Save in this browser</button>
        <button type="button" onClick={onSaveAccount} disabled={!canSave}>
          Save as account default
        </button>
        {feedback ? <span role="status">{feedback}</span> : null}
      </div>
    </details>
  );
}

function fantraxWarnings(league: FantraxConnectionLeague) {
  return [
    ...league.settings.diagnostics.unsupported.map(
      (item) => `${item.label} (${item.code}): ${item.reason}`,
    ),
    ...league.settings.diagnostics.warnings,
  ];
}

function confirmFantraxMapping(league: FantraxConnectionLeague) {
  if (league.settings.diagnostics.status !== "partial") return true;
  return window.confirm(
    `Apply this partial Fantrax mapping? These rules will be omitted:\n\n${fantraxWarnings(league).join("\n")}`,
  );
}

function FantraxProjectionLeaguePicker({
  enabled,
  onApply,
  onMakeDefault,
}: {
  enabled: boolean;
  onApply: (league: FantraxConnectionLeague) => void;
  onMakeDefault: (league: FantraxConnectionLeague, teamId: string | null) => void;
}) {
  const { data, isLoading, error } = useFantraxConnections(enabled);
  const [accountId, setAccountId] = useState("");
  const [leagueId, setLeagueId] = useState("");
  const [teamId, setTeamId] = useState("");
  const account = data.accounts.find((candidate) => candidate.id === accountId) ?? null;
  const league = account?.leagues.find((candidate) => candidate.id === leagueId) ?? null;

  useEffect(() => {
    if (accountId && data.accounts.some((candidate) => candidate.id === accountId)) return;
    const next =
      data.accounts.find((candidate) =>
        candidate.leagues.some((candidateLeague) => candidateLeague.isDefault),
      ) ?? data.accounts[0];
    setAccountId(next?.id ?? "");
  }, [accountId, data.accounts]);
  useEffect(() => {
    if (leagueId && account?.leagues.some((candidate) => candidate.id === leagueId)) return;
    setLeagueId(
      (account?.leagues.find((candidate) => candidate.isDefault) ?? account?.leagues[0])
        ?.id ?? "",
    );
  }, [account, leagueId]);
  useEffect(() => {
    if (teamId && league?.teams.some((candidate) => candidate.id === teamId)) return;
    setTeamId(
      (league?.teams.find((candidate) => candidate.isOwned) ?? league?.teams[0])
        ?.id ?? "",
    );
  }, [league, teamId]);

  if (!enabled || (!data.accounts.length && !error)) return null;
  const warnings = league ? fantraxWarnings(league) : [];
  return (
    <section className={styles.fantraxPicker} aria-labelledby="projection-fantrax-title">
      <div>
        <h2 id="projection-fantrax-title">Linked Fantrax league</h2>
        <p>
          Applying here is session-only until you explicitly save in this browser or
          make the league your account default.
        </p>
      </div>
      {error ? <p className={styles.warning}>{error}</p> : null}
      <div className={styles.fantraxControls}>
        <label>
          Linked account
          <select
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            disabled={isLoading}
          >
            <option value="">Choose account</option>
            {data.accounts.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
            ))}
          </select>
        </label>
        <label>
          League
          <select
            value={leagueId}
            onChange={(event) => setLeagueId(event.target.value)}
            disabled={!account}
          >
            <option value="">Choose league</option>
            {account?.leagues.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
            ))}
          </select>
        </label>
        <label>
          Owned team
          <select
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
            disabled={!league || league.teams.length === 0}
          >
            <option value="">No team identity</option>
            {league?.teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </label>
      </div>
      {league ? (
        <div className={styles.fantraxMapping}>
          <strong>
            {league.settings.leagueType} · {league.settings.diagnostics.status}
            {league.settingsChanged ? " · upstream settings changed" : ""}
          </strong>
          {warnings.length ? (
            <ul>
              {warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          ) : (
            <span>Exact supported mapping.</span>
          )}
        </div>
      ) : null}
      <div className={styles.actions}>
        <button
          type="button"
          disabled={!league || league.settings.diagnostics.status === "unsupported"}
          onClick={() => {
            if (league && confirmFantraxMapping(league)) onApply(league);
          }}
        >
          Apply for this session
        </button>
        <button
          type="button"
          disabled={
            !data.apiEnabled ||
            !league ||
            league.settings.diagnostics.status === "unsupported"
          }
          onClick={() => {
            if (league && confirmFantraxMapping(league)) {
              onMakeDefault(league, teamId || null);
            }
          }}
        >
          Make account default
        </button>
      </div>
    </section>
  );
}

function PlayerProjectionTable({
  players,
  mode,
  scoringSettings,
  categoryScores,
  sortKey,
  sortDirection,
  onSort,
}: {
  players: FantasyProjectionPlayer[];
  mode: PlayerMode;
  scoringSettings: FantasyProjectionScoringSettingsV2;
  categoryScores: Map<string, number>;
  sortKey: string;
  sortDirection: "asc" | "desc";
  onSort: (key: string) => void;
}) {
  const columns =
    mode === "goalie"
      ? GOALIE_COLUMNS
      : mode === "skater"
        ? SKATER_COLUMNS
        : ["GAMES_PLAYED", "POINTS", "SHOTS_ON_GOAL", "HITS", "WINS_GOALIE", "SAVES_GOALIE"];
  const shownColumns = columns.includes(sortKey) || !STAT_LABELS[sortKey]
    ? columns
    : [...columns, sortKey];
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th><button type="button" onClick={() => onSort("player")}>Player</button></th>
            <th><button type="button" onClick={() => onSort("team")}>Team</button></th>
            <th><button type="button" onClick={() => onSort("position")}>Pos</button></th>
            <th>
              <button type="button" onClick={() => onSort("fantasyTotal")}>
                {scoringSettings.leagueType === "categories"
                  ? "Category score"
                  : "Fantasy total"}
              </button>
            </th>
            <th><button type="button" onClick={() => onSort("rating")}>Rating</button></th>
            <th><button type="button" onClick={() => onSort("deployment")}>Deployment</button></th>
            {shownColumns.map((target) => (
              <th key={target}>
                <button type="button" onClick={() => onSort(target)}>
                  {STAT_LABELS[target] ?? target}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const total =
              scoringSettings.leagueType === "categories"
                ? categoryScores.get(player.id) ?? 0
                : fantasyProjectionTotal(
                    player.publishedValues,
                    player.population === "goalie"
                      ? scoringSettings.goaliePoints
                      : scoringSettings.skaterPoints,
                  );
            const rating = ratingValue(player);
            return (
              <tr key={player.id} className={styles.dataRow}>
                <th scope="row">
                  <span className={styles.playerName}>{player.playerName}</span>
                  {player.adjusted ? (
                    <span
                      className={styles.adjusted}
                      title={Object.entries(player.adjustmentDelta)
                        .map(([key, value]) => `${STAT_LABELS[key] ?? key} ${value >= 0 ? "+" : ""}${value.toFixed(2)}`)
                        .join(", ")}
                    >
                      Adjusted
                    </span>
                  ) : null}
                </th>
                <td>{player.teamAbbreviation ?? "FA"}</td>
                <td>{player.position}</td>
                <td
                  className={styles.total}
                  title={
                    scoringSettings.leagueType === "categories"
                      ? "FHFH projected category-value composite"
                      : undefined
                  }
                >
                  {total.toFixed(scoringSettings.leagueType === "categories" ? 2 : 1)}
                </td>
                <td>
                  <strong>{rating.toFixed(0)}</strong>
                  <small>{confidenceLabel(player.rosterConfidence)} confidence</small>
                </td>
                <td>
                  <span>{roleLabel(player)}</span>
                  <small>{confidenceLabel(numberValue(player.deployment.confidence))}</small>
                </td>
                {shownColumns.map((target) => (
                  <td key={target}>
                    {player.publishedValues[target] == null ? "—" : (
                      <ProjectionInterval player={player} target={target} />
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {players.length === 0 ? <p className={styles.empty}>No players match these filters.</p> : null}
      <span className={styles.srOnly} aria-live="polite">
        Sorted by {sortKey}, {sortDirection}.
      </span>
    </div>
  );
}

function TeamProjectionTable({
  teams,
  players,
}: {
  teams: FantasyProjectionTeam[];
  players: FantasyProjectionPlayer[];
}) {
  const ratingKeys = [
    "overall",
    "offense",
    "defense",
    "goaltending",
    "powerPlay",
    "penaltyKill",
    "pace",
  ];
  const playerNames = new Map(
    players.map((player) => [player.fhfhPlayerId, player.playerName]),
  );
  const names = (raw: unknown): string =>
    (Array.isArray(raw) ? raw : [])
      .map((id) => playerNames.get(Number(id)) ?? `Player ${id}`)
      .join(" · ");
  return (
    <div className={styles.teamGrid}>
      {teams.map((team) => (
        <article key={team.id} className={styles.teamCard}>
          <header>
            <div>
              <span>{team.abbreviation}</span>
              <h2>{team.teamName}</h2>
            </div>
            <span>{confidenceLabel(team.confidence)} confidence</span>
          </header>
          <dl className={styles.ratings}>
            {ratingKeys.map((key) => {
              const raw = team.publishedRatings[key];
              const value = typeof raw === "number" ? raw : numberValue(raw?.value);
              return <div key={key}><dt>{key}</dt><dd>{value.toFixed(0)}</dd></div>;
            })}
          </dl>
          <div className={styles.lines}>
            <h3>Projected deployment</h3>
            {Object.keys(team.deployment).length === 0 ? (
              <p>Line and goalie-order review pending.</p>
            ) : (
              <dl>
                {(team.deployment.forwardLines as unknown[] | undefined)?.map((line, index) => (
                  <div key={`F${index + 1}`}><dt>Line {index + 1}</dt><dd>{names(line)}</dd></div>
                ))}
                {(team.deployment.defensePairs as unknown[] | undefined)?.map((pair, index) => (
                  <div key={`D${index + 1}`}><dt>Pair {index + 1}</dt><dd>{names(pair)}</dd></div>
                ))}
                {(team.deployment.powerPlayUnits as unknown[] | undefined)?.map((unit, index) => (
                  <div key={`PP${index + 1}`}><dt>PP{index + 1}</dt><dd>{names(unit)}</dd></div>
                ))}
                {(team.deployment.penaltyKillUnits as unknown[] | undefined)?.map((unit, index) => (
                  <div key={`PK${index + 1}`}><dt>PK{index + 1}</dt><dd>{names(unit)}</dd></div>
                ))}
                <div><dt>Goalies</dt><dd>{names(team.deployment.goalieOrder)}</dd></div>
              </dl>
            )}
          </div>
          {team.adjusted ? <span className={styles.adjusted}>Adjusted</span> : null}
        </article>
      ))}
    </div>
  );
}

export default function FantasyProjectionsPage() {
  const { user } = useAuth();
  const [view, setView] = useState<FantasyProjectionView>("current");
  const [productView, setProductView] = useState<ProductView>("players");
  const [mode, setMode] = useState<PlayerMode>("all");
  const [players, setPlayers] = useState<FantasyProjectionPlayer[]>([]);
  const [teams, setTeams] = useState<FantasyProjectionTeam[]>([]);
  const [releaseLabel, setReleaseLabel] = useState(FANTASY_PROJECTION_BETA_LABEL);
  const [issuedAt, setIssuedAt] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sortKey, setSortKey] = useState("fantasyTotal");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [scoringSettings, setScoringSettings] =
    useState<FantasyProjectionScoringSettingsV2>(() =>
      defaultFantasyProjectionScoringSettings(),
    );
  const [scoringSettingsReady, setScoringSettingsReady] = useState(false);
  const hasBrowserPresetRef = useRef(false);
  const hasSessionOverrideRef = useRef(false);
  const manualScoringEditRef = useRef(false);
  const activeLeagueOverrideRef = useRef<{
    provider: "fantrax" | "espn";
    externalLeagueId: string;
  } | null>(null);
  const accountDefaultsUserRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoringFeedback, setScoringFeedback] = useState<string | null>(null);

  useEffect(() => {
    const stored = readFantasyProjectionScoringSettings(window.localStorage);
    hasBrowserPresetRef.current = stored.source !== "default";
    manualScoringEditRef.current = hasBrowserPresetRef.current;
    const espnOverride = hasBrowserPresetRef.current
      ? null
      : loadEspnScoringOverride(window.sessionStorage, "fantasy-projections");
    if (espnOverride) {
      hasSessionOverrideRef.current = true;
      activeLeagueOverrideRef.current = {
        provider: "espn",
        externalLeagueId: espnOverride.externalLeagueId,
      };
      setScoringSettings({
        ...stored.settings,
        leagueType: espnOverride.settings.leagueType,
        ...(espnOverride.settings.leagueType === "points"
          ? {
              skaterPoints: espnOverride.settings.skaterScoringCategories,
              goaliePoints: espnOverride.settings.goalieScoringCategories,
            }
          : { categoryWeights: espnOverride.settings.categoryWeights }),
      });
    } else {
      setScoringSettings(stored.settings);
    }
    setScoringSettingsReady(true);
  }, []);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (!scoringSettingsReady || !userId || hasBrowserPresetRef.current) return;
    if (accountDefaultsUserRef.current === userId) return;
    accountDefaultsUserRef.current = userId;
    let active = true;
    void supabase
      .from("user_settings")
      .select(
        "league_type, scoring_categories, goalie_scoring_categories, category_weights, roster_config, team_count, draft_order_type, ui_preferences, active_context",
      )
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error: settingsError }) => {
        if (!active || settingsError || !data || hasSessionOverrideRef.current) return;
        const accountSettings = mapUserSettingsRowToLeagueSettings(data);
        setScoringSettings((current) => ({
          ...current,
          leagueType: accountSettings.leagueType,
          skaterPoints: accountSettings.scoringCategories,
          goaliePoints: accountSettings.goalieScoringCategories,
          categoryWeights: accountSettings.categoryWeights,
        }));
      });
    return () => {
      active = false;
    };
  }, [scoringSettingsReady, user?.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const releasesResponse = await fetch(
          `/api/v1/fantasy-projections/releases?seasonId=${FANTASY_PROJECTION_SEASON_ID}`,
        );
        const releasesPayload = await releasesResponse.json();
        if (!releasesResponse.ok || !releasesPayload.success) {
          throw new Error(releasesPayload.message ?? "Unable to inspect projection releases.");
        }
        const activeRelease = (releasesPayload.releases as FantasyProjectionRelease[])
          .find((release) => release.active && release.view === view);
        if (!activeRelease) {
          if (!cancelled) {
            setPlayers([]);
            setTeams([]);
            setReleaseLabel(FANTASY_PROJECTION_BETA_LABEL);
            setIssuedAt(null);
            setError("No published fantasy-projection release exists for this selection.");
          }
          return;
        }
        const playersRequest = fetch(
          `/api/v1/fantasy-projections/players?seasonId=${FANTASY_PROJECTION_SEASON_ID}&view=${view}`,
        ).then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.success) throw new Error(payload.message ?? "Unable to load player projections.");
          return payload as FantasyProjectionPlayersResponse;
        });
        const teamsRequest =
          view === "ros"
            ? Promise.resolve(null)
            : fetch(
                `/api/v1/fantasy-projections/teams?seasonId=${FANTASY_PROJECTION_SEASON_ID}&view=${view}`,
              ).then(async (response) => {
                const payload = await response.json();
                if (!response.ok || !payload.success) throw new Error(payload.message ?? "Unable to load team projections.");
                return payload as FantasyProjectionTeamsResponse;
              });
        const [playerPayload, teamPayload] = await Promise.all([
          playersRequest,
          teamsRequest,
        ]);
        if (cancelled) return;
        setPlayers(playerPayload.players);
        setTeams(teamPayload?.teams ?? []);
        setReleaseLabel(playerPayload.release.label);
        setIssuedAt(playerPayload.release.issuedAt);
        setError(null);
      } catch (caught) {
        if (!cancelled) {
          setPlayers([]);
          setTeams([]);
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view]);

  const teamsForFilter = useMemo(
    () => Array.from(new Set(players.map((player) => player.teamAbbreviation).filter(Boolean) as string[])).sort(),
    [players],
  );
  const positionsForFilter = useMemo(
    () => Array.from(new Set(players.map((player) => player.position))).sort(),
    [players],
  );
  const categoryScores = useMemo(
    () =>
      calculateCategoryScores(
        players.map((player) => ({
          id: player.id,
          role: player.population === "goalie" ? "goalie" : "skater",
          values: player.publishedValues,
        })),
        scoringSettings.categoryWeights,
      ),
    [players, scoringSettings.categoryWeights],
  );
  const sortedPlayers = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    const filtered = players.filter((player) => {
      if (mode === "goalie" && player.population !== "goalie") return false;
      if (mode === "skater" && player.population === "goalie") return false;
      if (teamFilter && player.teamAbbreviation !== teamFilter) return false;
      if (positionFilter && player.position !== positionFilter) return false;
      return !query || player.playerName.toLowerCase().includes(query);
    });
    const direction = sortDirection === "asc" ? 1 : -1;
    return filtered.sort((left, right) => {
      let leftValue: string | number;
      let rightValue: string | number;
      if (sortKey === "player") {
        leftValue = left.playerName;
        rightValue = right.playerName;
      } else if (sortKey === "team") {
        leftValue = left.teamAbbreviation ?? "ZZZ";
        rightValue = right.teamAbbreviation ?? "ZZZ";
      } else if (sortKey === "position") {
        leftValue = left.position;
        rightValue = right.position;
      } else if (sortKey === "fantasyTotal") {
        if (scoringSettings.leagueType === "categories") {
          leftValue = categoryScores.get(left.id) ?? 0;
          rightValue = categoryScores.get(right.id) ?? 0;
        } else {
          leftValue = fantasyProjectionTotal(
            left.publishedValues,
            left.population === "goalie"
              ? scoringSettings.goaliePoints
              : scoringSettings.skaterPoints,
          );
          rightValue = fantasyProjectionTotal(
            right.publishedValues,
            right.population === "goalie"
              ? scoringSettings.goaliePoints
              : scoringSettings.skaterPoints,
          );
        }
      } else if (sortKey === "rating") {
        leftValue = ratingValue(left);
        rightValue = ratingValue(right);
      } else if (sortKey === "deployment") {
        leftValue = numberValue(left.deployment.confidence);
        rightValue = numberValue(right.deployment.confidence);
      } else {
        leftValue = numberValue(left.publishedValues[sortKey]);
        rightValue = numberValue(right.publishedValues[sortKey]);
      }
      if (typeof leftValue === "string" && typeof rightValue === "string") {
        return leftValue.localeCompare(rightValue) * direction;
      }
      return (Number(leftValue) - Number(rightValue)) * direction;
    });
  }, [
    deferredSearch,
    mode,
    players,
    positionFilter,
    categoryScores,
    scoringSettings,
    sortDirection,
    sortKey,
    teamFilter,
  ]);

  function changeSort(next: string) {
    if (next === sortKey) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
    } else {
      setSortKey(next);
      setSortDirection(next === "player" || next === "team" || next === "position" ? "asc" : "desc");
    }
  }

  function changeScoring(next: FantasyProjectionScoringSettingsV2) {
    hasSessionOverrideRef.current = true;
    manualScoringEditRef.current = true;
    setScoringSettings(next);
    setScoringFeedback(null);
  }

  function saveScoringInBrowser() {
    try {
      saveFantasyProjectionScoringSettings(window.localStorage, scoringSettings);
      hasBrowserPresetRef.current = true;
      setScoringFeedback("Saved in this browser.");
    } catch {
      setScoringFeedback("Browser storage is unavailable.");
    }
  }

  async function saveScoringToAccount() {
    if (!user?.id) return;
    setScoringFeedback("Saving…");
    const { error: saveError } = await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: user.id,
          league_type: scoringSettings.leagueType,
          scoring_categories: scoringSettings.skaterPoints,
          goalie_scoring_categories: scoringSettings.goaliePoints,
          category_weights: scoringSettings.categoryWeights,
        },
        { onConflict: "user_id" },
      );
    setScoringFeedback(saveError ? saveError.message : "Saved to your account.");
  }

  function applyFantraxLeague(league: FantraxConnectionLeague) {
    hasSessionOverrideRef.current = true;
    manualScoringEditRef.current = false;
    activeLeagueOverrideRef.current = {
      provider: "fantrax",
      externalLeagueId: league.id,
    };
    setScoringSettings((current) => ({
      ...current,
      leagueType: league.settings.leagueType,
      ...(league.settings.leagueType === "points"
        ? {
            skaterPoints: league.settings.skaterScoringCategories,
            goaliePoints: league.settings.goalieScoringCategories,
          }
        : { categoryWeights: league.settings.categoryWeights }),
    }));
    setScoringFeedback(`${league.name} applied for this session only.`);
  }

  function confirmEspnLeague(
    league: EspnConnectionLeague,
    selection: EspnLeagueSelection,
  ) {
    const active = activeLeagueOverrideRef.current;
    const replacesActiveWork =
      manualScoringEditRef.current ||
      (active != null &&
        (active.provider !== "espn" ||
          active.externalLeagueId !== selection.externalLeagueId));
    return (
      !replacesActiveWork ||
      window.confirm(
        `Replace the active league scoring with ${league.name} (${league.seasonKey})?`,
      )
    );
  }

  function applyEspnLeague(
    league: EspnConnectionLeague,
    teamId: string | null,
    selection: EspnLeagueSelection,
  ) {
    hasSessionOverrideRef.current = true;
    manualScoringEditRef.current = false;
    activeLeagueOverrideRef.current = {
      provider: "espn",
      externalLeagueId: league.id,
    };
    setScoringSettings((current) => ({
      ...current,
      leagueType: league.settings.leagueType,
      ...(league.settings.leagueType === "points"
        ? {
            skaterPoints: league.settings.skaterScoringCategories,
            goaliePoints: league.settings.goalieScoringCategories,
          }
        : { categoryWeights: league.settings.categoryWeights }),
    }));
    try {
      saveEspnScoringOverride(window.sessionStorage, "fantasy-projections", {
        version: 1,
        namespace: selection.namespace,
        externalLeagueId: league.id,
        externalTeamId: teamId,
        leagueName: league.name,
        settings: league.settings,
      });
    } catch {
      // The in-memory override still applies when browser storage is unavailable.
    }
    setScoringFeedback(`${league.name} applied for this session only.`);
  }

  async function makeFantraxLeagueDefault(
    league: FantraxConnectionLeague,
    teamId: string | null,
  ) {
    setScoringFeedback("Saving Fantrax default…");
    try {
      const result = await fantraxAccountRequest<{
        settings: Database["public"]["Tables"]["user_settings"]["Row"];
      }>("/api/v1/account/fantrax/apply-settings", {
        method: "POST",
        body: JSON.stringify({
          externalLeagueId: league.id,
          externalTeamId: teamId,
          settingsHash: league.settings.sourceHash,
          acknowledgeWarnings: league.settings.diagnostics.status === "partial",
        }),
      });
      const accountSettings = mapUserSettingsRowToLeagueSettings(result.settings);
      hasSessionOverrideRef.current = true;
      setScoringSettings((current) => ({
        ...current,
        leagueType: accountSettings.leagueType,
        skaterPoints: accountSettings.scoringCategories,
        goaliePoints: accountSettings.goalieScoringCategories,
        categoryWeights: accountSettings.categoryWeights,
      }));
      setScoringFeedback(`${league.name} is now your account default.`);
    } catch (requestError) {
      setScoringFeedback(
        requestError instanceof Error
          ? requestError.message
          : "Fantrax default could not be saved.",
      );
    }
  }

  const sortTargets = Array.from(
    new Set([...SKATER_SCORING_TARGETS, ...GOALIE_SCORING_TARGETS]),
  );
  return (
    <>
      <Head>
        <title>2026–27 Fantasy Hockey Projections | FHFH</title>
        <meta
          name="description"
          content="Customizable 2026–27 NHL player and team fantasy projections with confidence intervals and deployment probabilities."
        />
      </Head>
      <main className={styles.page}>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Full-season player forecasts</p>
            <h1>2026–27 Fantasy Projections</h1>
            <p>
              Raw hockey outcomes, independent game components, projected deployment,
              and customizable fantasy scoring. FORGE remains separate.
            </p>
          </div>
          <div className={styles.release}>
            <span>{releaseLabel}</span>
            <small>{issuedAt ? `Issued ${new Date(issuedAt).toLocaleString()}` : "No published release yet"}</small>
          </div>
        </header>

        <nav className={styles.viewTabs} aria-label="Projection product view">
          <button type="button" aria-pressed={productView === "players"} onClick={() => setProductView("players")}>
            Player projections
          </button>
          <button
            type="button"
            aria-pressed={productView === "teams"}
            disabled={view === "ros"}
            onClick={() => setProductView("teams")}
          >
            Team Ratings &amp; Lines
          </button>
        </nav>

        <section className={styles.controls} aria-label="Projection filters">
          <label>
            Projection view
            <select value={view} onChange={(event) => {
              const next = event.target.value as FantasyProjectionView;
              setView(next);
              if (next === "ros") setProductView("players");
            }}>
              <option value="opening">Opening</option>
              <option value="current">Current full season</option>
              <option value="ros">Rest of season</option>
            </select>
          </label>
          {productView === "players" ? (
            <>
              <label>
                Population
                <select value={mode} onChange={(event) => setMode(event.target.value as PlayerMode)}>
                  <option value="all">All</option>
                  <option value="skater">Skaters</option>
                  <option value="goalie">Goalies</option>
                </select>
              </label>
              <label>
                Team
                <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
                  <option value="">All teams</option>
                  {teamsForFilter.map((team) => <option key={team}>{team}</option>)}
                </select>
              </label>
              <label>
                Position
                <select value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)}>
                  <option value="">All positions</option>
                  {positionsForFilter.map((position) => <option key={position}>{position}</option>)}
                </select>
              </label>
              <label>
                Search
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Player name" />
              </label>
              <label>
                Sort statistic
                <select value={STAT_LABELS[sortKey] ? sortKey : ""} onChange={(event) => changeSort(event.target.value)}>
                  <option value="">Choose statistic</option>
                  {sortTargets.map((target) => <option key={target} value={target}>{STAT_LABELS[target] ?? target}</option>)}
                </select>
              </label>
            </>
          ) : null}
        </section>

        {productView === "players" ? (
          <>
            <FantraxProjectionLeaguePicker
              enabled={Boolean(user?.id)}
              onApply={applyFantraxLeague}
              onMakeDefault={(league, teamId) =>
                void makeFantraxLeagueDefault(league, teamId)
              }
            />
            <EspnLeagueSettingsPanel
              enabled={Boolean(user?.id)}
              disabled={false}
              contextLabel="projection session"
              onApply={applyEspnLeague}
              onConfirmApply={confirmEspnLeague}
            />
            <ScoringEditor
              settings={scoringSettings}
              onChange={changeScoring}
              onReset={() => {
                hasSessionOverrideRef.current = true;
                manualScoringEditRef.current = true;
                setScoringSettings(defaultFantasyProjectionScoringSettings());
                setScoringFeedback("FHFH defaults restored for this session.");
              }}
              onSaveBrowser={saveScoringInBrowser}
              onSaveAccount={() => void saveScoringToAccount()}
              canSave={Boolean(user?.id)}
              feedback={scoringFeedback}
            />
          </>
        ) : null}

        {error ? (
          <div className={styles.error} role="alert">
            <strong>Projection release unavailable.</strong>
            <span>{error}</span>
          </div>
        ) : null}
        {loading ? <p className={styles.empty}>Loading published projection release…</p> : null}
        {!loading && !error && productView === "players" ? (
          <PlayerProjectionTable
            players={sortedPlayers}
            mode={mode}
            scoringSettings={scoringSettings}
            categoryScores={categoryScores}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={changeSort}
          />
        ) : null}
        {!loading && !error && productView === "teams" ? (
          <TeamProjectionTable teams={teams} players={players} />
        ) : null}
      </main>
    </>
  );
}

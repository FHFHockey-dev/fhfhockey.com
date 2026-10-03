import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fromZonedTime } from "date-fns-tz";
import { useAuth } from "contexts/AuthProviderContext";
import { useRosterPlanning } from "hooks/useRosterPlanning";
import { comparePlanSensitivity } from "lib/player-forecasts/planComparison";
import { resolvePlanningContributions } from "lib/player-forecasts/planningContributions";
import { sanitizeForecastInputs } from "lib/rosterScheduleOptimizer/planning";
import { expandActiveSlots } from "lib/rosterScheduleOptimizer/slots";
import { reconcileIntent } from "lib/rosterScheduleOptimizer/reconciliation";
import { supplementProviderRules } from "lib/rosterScheduleOptimizer/providerRules";
import type { LeagueRules, LockedAssignment, ManagerRuleOverrides, PlanEvaluation, PlanIntent, PlanStep, PlanningAssignment, PlanningData, PlanningGame, PlanningPlayer, PlanningSnapshot, PlanningWorkspace, ProviderCapabilities, RevisionProposal } from "lib/rosterScheduleOptimizer/planningTypes";
import { defaultWorkspace, readWorkspace, resolveImportedNames, retainedScheduleSnapshot, retainProviderInputs, writeWorkspace } from "lib/rosterScheduleOptimizer/workspace";
import supabase from "lib/supabase/client";
import styles from "./RosterScheduleOptimizer.module.scss";
import ForecastEvidence, { forecastSummary } from "./ForecastEvidence";
import BenchDecisions from "./BenchDecisions";
import CandidateBrowser from "./CandidateBrowser";

type Access = { eligible: boolean; capabilities: string[]; expiresAt?: string | null };
type AccountRecord = { workspace: PlanningWorkspace; snapshot: PlanningSnapshot | null; version: number; updatedAt: string };
type Tab = "itinerary" | "roster" | "candidates" | "matchup";
type OwnTeam = { id: string; external_league_id: string; team_name: string; provider: string; team_metadata: unknown; external_leagues?: { league_name: string | null } | null };
const message = (error: unknown) => error instanceof Error ? error.message : "Request failed.";
export function requestErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message.trim()) return error.message;
  return fallback;
}
async function authHeaders(): Promise<Record<string, string>> { const token = (await supabase.auth.getSession()).data.session?.access_token; return token ? { Authorization: `Bearer ${token}` } : {}; }
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const actionTime = (value: string, timeZone: string) => new Intl.DateTimeFormat(undefined, { timeZone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
const periodName = (value: string, rules: LeagueRules) => rules.periods.find((period) => Date.parse(value) >= Date.parse(period.start) && Date.parse(value) < Date.parse(period.end))?.id ?? "period unknown";
function leagueDate(value: string, timeZone: string) { const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value)); const part = (name: string) => parts.find((item) => item.type === name)?.value ?? ""; return `${part("year")}-${part("month")}-${part("day")}`; }
function leagueDateTime(value: string, timeZone: string) { const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value)); const part = (name: string) => parts.find((item) => item.type === name)?.value ?? ""; return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`; }
function goalieB2B(playerId: string, date: string, snapshot: PlanningSnapshot | null): boolean {
  const player = snapshot?.players.find(row => row.id === playerId);
  return player?.playerClass === "goalie" && !!snapshot?.games.some(game => game.teamAbbreviation === player.teamAbbreviation && game.status === "scheduled" && Math.abs(Date.parse(`${game.date}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) === 86400000);
}
function opponentDemandHint(snapshot: PlanningSnapshot | null, player: PlanningPlayer | undefined) {
  if (!snapshot?.opponent?.roster.length || !player?.teamAbbreviation) return null;
  const position = player.eligiblePositions.find((slot) => (snapshot.rules.rosterSlots[slot] ?? 0) > 0);
  if (!position) return null;
  const need = snapshot.rules.rosterSlots[position];
  for (const game of snapshot.games.filter((row) => row.teamAbbreviation === player.teamAbbreviation && row.status === "scheduled")) {
    const playing = snapshot.opponent.roster.filter((entry) => entry.position !== "IR" && entry.position !== "IR+" && entry.position !== "NA").map((entry) => snapshot.players.find((row) => row.id === entry.playerId)).filter((row): row is PlanningPlayer => Boolean(row)).filter((row) => row.eligiblePositions.includes(position) && snapshot.games.some((scheduled) => scheduled.date === game.date && scheduled.teamAbbreviation === row.teamAbbreviation && scheduled.status === "scheduled"));
    if (playing.length < need) return `Inferred opponent ${position} shortage on ${dateLabel(game.date)} (${playing.length}/${need} scheduled). This does not establish their intent.`;
  }
  return null;
}
function instantFromLeagueTime(value: string, timeZone: string) { try { return fromZonedTime(value, timeZone).toISOString(); } catch { return null; } }
function leagueDayBoundary(date: string, timeZone: string, end = false) { const value = new Date(`${date}T12:00:00Z`); if (end) value.setUTCDate(value.getUTCDate() + 1); return fromZonedTime(`${value.toISOString().slice(0, 10)}T00:00:00`, timeZone).toISOString(); }
const number = (value: number | null | undefined) => value == null ? "—" : Number.isInteger(value) ? String(value) : value.toFixed(1);
export function acquisitionDetail(rules: LeagueRules, evidence?: PlanningSnapshot["acquisitionEvidence"]): string {
  const allowance = rules.periods.length ? rules.periods.map(period => `${period.id}: ${period.source === "unknown" || period.remaining === null ? "Allowance unknown" : `${period.remaining} remaining (${period.source})`}`).join(" · ") : "Allowance unknown";
  return evidence?.counter.used != null && evidence.period.containsHorizon
    ? `${allowance} · Week ${evidence.period.week}: ${evidence.counter.used} used (Yahoo)` : allowance;
}
function fingerprint(value: unknown) { let hash = 0; for (const char of JSON.stringify(value)) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0; return (hash >>> 0).toString(36); }
export function grossAcquisitionGames(steps: PlanStep[], snapshot: PlanningSnapshot | null): number {
  if (!snapshot) return 0;
  let gross = 0;
  for (const add of steps.filter((step) => step.type === "add")) {
    const player = snapshot.players.find((row) => row.id === add.playerId);
    if (!player?.teamAbbreviation) continue;
    const start = Date.parse(add.effectiveAt);
    const end = Math.min(...steps.filter((step) => Date.parse(step.effectiveAt) >= start && ((step.type === "drop" && step.playerId === add.playerId) || (step.type === "add" && step.dropPlayerId === add.playerId))).map((step) => Date.parse(step.effectiveAt)), Infinity);
    gross += snapshot.games.filter((game) => game.teamAbbreviation === player.teamAbbreviation && game.status === "scheduled" && game.startsAt && Date.parse(game.startsAt) > Date.parse(snapshot.context.asOf) && Date.parse(game.startsAt) >= start && Date.parse(game.startsAt) < end).length;
  }
  return gross;
}
function datesBetween(start: string, end: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return [];
  const dates: string[] = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  for (let i = 0; i < 367 && cursor.toISOString().slice(0, 10) <= end; i++, cursor.setUTCDate(cursor.getUTCDate() + 1)) dates.push(cursor.toISOString().slice(0, 10));
  return dates;
}

export default function RosterScheduleOptimizer() {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<PlanningWorkspace>(() => defaultWorkspace());
  const [hydrated, setHydrated] = useState(false);
  const [data, setData] = useState<PlanningData | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [connected, setConnected] = useState<PlanningSnapshot | null>(null);
  const [capabilities, setCapabilities] = useState<ProviderCapabilities | null>(null);
  const [account, setAccount] = useState<AccountRecord | null>(null);
  const [viewingSaved, setViewingSaved] = useState(false);
  const [proposal, setProposal] = useState<RevisionProposal | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [query, setQuery] = useState("");
  const [paste, setPaste] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("itinerary");
  const [showLineup, setShowLineup] = useState(false);
  const [reviewedInputs, setReviewedInputs] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [ownTeams, setOwnTeams] = useState<OwnTeam[]>([]);
  const history = useRef<PlanningWorkspace[]>([]);
  const workspaceElement = useRef<HTMLDivElement>(null);
  const providerAbort = useRef<AbortController | null>(null);
  const reachInput = (view: Tab, selector: string) => {
    setTab(view);
    requestAnimationFrame(() => {
      const control = workspaceElement.current?.querySelector<HTMLElement>(selector);
      const disclosure = control?.closest("details");
      if (disclosure) disclosure.open = true;
      control?.focus();
      control?.scrollIntoView({ block: "nearest" });
    });
  };
  const canSync = Boolean(access?.capabilities.includes("rso_sync"));
  const canAutoUpkeep = Boolean(access?.capabilities.includes("rso_auto_upkeep"));
  const readOnlySaved = viewingSaved || (workspace.context.provider !== "manual" && !canSync && Boolean(account?.snapshot || workspace.roster.length));
  const readOnlyInert = readOnlySaved ? { inert: "true" as unknown as boolean } : {};

  useEffect(() => { const saved = readWorkspace(window.localStorage); if (saved) setWorkspace(saved); setHydrated(true); }, []);
  useEffect(() => { if (hydrated) setNotice(writeWorkspace(window.localStorage, workspace)); }, [hydrated, workspace]);
  const edit = useCallback((change: (current: PlanningWorkspace) => PlanningWorkspace) => setWorkspace((current) => {
    if (readOnlySaved) return current;
    let next = change(current);
    if (next.context.provider !== current.context.provider || next.context.leagueId !== current.context.leagueId || next.context.teamId !== current.context.teamId || next.context.seasonId !== current.context.seasonId) next = { ...next, managerRuleOverrides: {}, ...(next.context.provider !== "manual" ? { roster: [], manualPlayers: [], lockedAssignments: [] } : {}) };
    if (next !== current) {
      history.current = [...history.current.slice(-19), current];
      if (next.context.provider === "manual") next = { ...next, context: { ...next.context, asOf: new Date().toISOString() } };
    }
    return next;
  }), [readOnlySaved]);
  const editIntent = useCallback((change: (intent: PlanIntent) => PlanIntent) => edit((current) => ({ ...current, intent: { ...change(current.intent), revision: current.intent.revision + 1 } })), [edit]);
  const undo = () => { const previous = history.current.pop(); if (previous) setWorkspace(previous); };
  const contextKey = `${workspace.context.seasonId}:${workspace.context.startDate}:${workspace.context.endDate}:${workspace.context.timeZone}`;
  const accountKey = `${workspace.context.provider}:${workspace.context.leagueId}:${workspace.context.teamId}:${contextKey}`;
  useEffect(() => { setSelectedPlayer(null); setQuery(""); }, [accountKey, user?.id]);
  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController(); setLoadingData(true); setData(null);
    const params = new URLSearchParams({ seasonId: String(workspace.context.seasonId), startDate: workspace.context.startDate, endDate: workspace.context.endDate, timeZone: workspace.context.timeZone });
    fetch(`/api/v1/roster-schedule-optimizer/data?${params}`, { signal: controller.signal })
      .then(async (response) => { const body = await response.json(); if (!response.ok || !body.success) throw new Error(requestErrorMessage(body.error, "Planning data unavailable.")); return body.data as PlanningData; })
      .then((next) => { if (controller.signal.aborted) return; const asOf = new Date().toISOString(); setData(next); setLastUpdated(asOf); setWorkspace((current) => current.context.provider === "manual" && !viewingSaved ? { ...current, context: { ...current.context, asOf } } : current); })
      .catch((error) => { if (!controller.signal.aborted) setNotice(message(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoadingData(false); });
    return () => controller.abort();
  }, [hydrated, contextKey, viewingSaved]);
  useEffect(() => {
    const controller = new AbortController();
    setAccess(null); setAccessError(null);
    const load = async () => {
      try {
        const headers = await authHeaders(); if (controller.signal.aborted) return;
        const response = await fetch("/api/v1/roster-schedule-optimizer/access", { signal: controller.signal, headers });
        const body = response.ok ? await response.json() : null;
        if (!controller.signal.aborted) {
          setAccess((body?.data ?? null) as Access | null);
          setAccessError(!response.ok && user?.id ? "Provider synchronization is unavailable because in-season access could not be verified. Your account connection is unchanged; try again shortly." : null);
        }
      } catch { if (!controller.signal.aborted) { setAccess(null); setAccessError(user?.id ? "Provider synchronization is unavailable because access could not be checked. Your account connection is unchanged; try again shortly." : null); } }
    };
    void load();
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", visible);
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 5 * 60_000);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [user?.id]);
  useEffect(() => { providerAbort.current?.abort(); setConnected(null); setCapabilities(null); setProposal(null); setAccount(null); setViewingSaved(false); setNotice(current => current === "Saved to account." ? null : current); }, [user?.id]);
  useEffect(() => {
    if (!access?.expiresAt) return;
    const expiresAt = Date.parse(access.expiresAt);
    const expire = () => setAccess((current) => current ? { ...current, eligible: false, capabilities: [] } : current);
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => { const remaining = expiresAt - Date.now(); if (remaining <= 0) expire(); else timer = setTimeout(schedule, Math.min(remaining, 2_147_483_647)); };
    schedule();
    return () => clearTimeout(timer);
  }, [access?.expiresAt]);
  useEffect(() => {
    setOwnTeams([]);
    if (!user?.id) return;
    let active = true;
    void supabase.from("external_teams").select("id,external_league_id,team_name,provider,team_metadata,external_leagues!external_teams_external_league_id_fkey(league_name)").eq("user_id", user.id)
      .then(({ data }) => { if (active) setOwnTeams((data ?? []).filter((team) => Boolean(team.team_metadata && typeof team.team_metadata === "object" && !Array.isArray(team.team_metadata) && (team.team_metadata as Record<string, unknown>).is_owned === true)) as OwnTeam[]); });
    return () => { active = false; };
  }, [user?.id]);
  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController(); setAccount(null);
    const { provider, seasonId, leagueId, teamId, startDate, endDate } = workspace.context;
    const params = new URLSearchParams({ provider, seasonId: String(seasonId), leagueId, teamId, startDate, endDate });
    authHeaders().then((headers) => { if (controller.signal.aborted) return null; return fetch(`/api/v1/roster-schedule-optimizer/workspace?${params}`, { signal: controller.signal, headers }); })
      .then(async (response) => response?.ok ? (await response.json()).data as AccountRecord | null : null)
      .then((saved) => { if (!controller.signal.aborted) setAccount(saved); }).catch(() => undefined);
    return () => controller.abort();
  }, [hydrated, accountKey, user?.id]);
  const providerRef = useRef({ context: workspace.context, intent: workspace.intent, overrides: workspace.managerRuleOverrides, userId: user?.id });
  providerRef.current = { context: workspace.context, intent: workspace.intent, overrides: workspace.managerRuleOverrides, userId: user?.id };
  const connectedRef = useRef(connected);
  connectedRef.current = connected;
  const refreshProvider = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    const { context, userId } = providerRef.current;
    if (context.provider === "manual" || !canSync) return false;
    if (context.teamId === "manual") { setNotice("Select an owned team before refreshing provider inputs."); return false; }
    providerAbort.current?.abort();
    const controller = new AbortController();
    providerAbort.current = controller;
    signal?.addEventListener("abort", () => controller.abort(), { once: true });
    const requestKey = `${context.provider}:${context.teamId}:${context.seasonId}:${context.startDate}:${context.endDate}:${context.timeZone}`;
    try {
      const headers = await authHeaders(); if (controller.signal.aborted || userId !== providerRef.current.userId) return false;
      const response = await fetch("/api/v1/roster-schedule-optimizer/provider", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ provider: context.provider, teamId: context.teamId, startDate: context.startDate, endDate: context.endDate, timeZone: context.timeZone }), signal: controller.signal });
      const body = await response.json(); if (!response.ok || !body.success) throw new Error(requestErrorMessage(body.error, "Provider refresh failed."));
      const current = providerRef.current.context;
      if (controller.signal.aborted || userId !== providerRef.current.userId || requestKey !== `${current.provider}:${current.teamId}:${current.seasonId}:${current.startDate}:${current.endDate}:${current.timeZone}`) return false;
      const next = body.snapshot as PlanningSnapshot;
      const previous = connectedRef.current;
      const sameContext = previous && ["provider", "seasonId", "leagueId", "teamId", "startDate", "endDate", "timeZone"].every((key) => previous.context[key as keyof typeof previous.context] === next.context[key as keyof typeof next.context]);
      const overrides = providerRef.current.overrides ?? {};
      setConnected(next); connectedRef.current = next; setCapabilities(body.capabilities as ProviderCapabilities); setWorkspace((current) => ({ ...retainProviderInputs(current, next), context: next.context }));
      setProposal(reconcileIntent(supplementProviderRules(next, overrides).snapshot, providerRef.current.intent, sameContext ? supplementProviderRules(previous, overrides).snapshot : undefined)); setNotice(null); setLastUpdated(new Date().toISOString());
      return true;
    } catch (error) { if (!controller.signal.aborted) setNotice(message(error)); return false; }
  }, [canSync]);
  useEffect(() => {
    if (workspace.context.provider === "manual" || !canSync) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let delay = 5 * 60_000;
    const refresh = async () => {
      if (controller.signal.aborted || document.visibilityState !== "visible") return;
      const succeeded = await refreshProvider(controller.signal);
      if (controller.signal.aborted || !canAutoUpkeep) return;
      delay = succeeded ? 5 * 60_000 : Math.min(delay * 2, 30 * 60_000);
      timer = setTimeout(() => void refresh(), delay);
    };
    if (workspace.context.teamId !== "manual") void refresh();
    const visible = () => { if (document.visibilityState !== "visible") return; if (timer) clearTimeout(timer); void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { controller.abort(); providerAbort.current?.abort(); if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", visible); };
  }, [workspace.context.provider, workspace.context.teamId, contextKey, canSync, canAutoUpkeep, refreshProvider]);
  useEffect(() => {
    const current = connected?.context;
    const connectedKey = current ? `${current.provider}:${current.leagueId}:${current.teamId}:${current.seasonId}:${current.startDate}:${current.endDate}:${current.timeZone}` : null;
    if (connectedKey === accountKey) return;
    setConnected(null); setCapabilities(null); setProposal(null);
  }, [accountKey]);

  const connectedInput = [connected, workspace.context.provider !== "manual" ? account?.snapshot : null].find(input => input && ["provider", "leagueId", "teamId", "seasonId", "startDate", "endDate", "timeZone"].every(key => input.context[key as keyof typeof input.context] === workspace.context[key as keyof typeof workspace.context])) ?? null;
  const usingRetainedRoster = workspace.context.provider !== "manual" && !connectedInput && !viewingSaved && !!workspace.roster.length;
  const players = useMemo(() => [...new Map([...(data?.players ?? []), ...workspace.manualPlayers, ...(connectedInput?.players ?? []), ...(viewingSaved ? account?.snapshot?.players ?? [] : [])].map((player) => {
    const canonical = data?.players.find(row => row.id === player.id);
    const sameTeam = canonical?.nhlId === player.nhlId && canonical?.teamAbbreviation === player.teamAbbreviation;
    return [player.id, { ...player, eligibilityVerified: player.eligibilityVerified ?? canonical?.eligibilityVerified,
      nhlTeamId: canonical ? sameTeam ? canonical.nhlTeamId : undefined : player.nhlTeamId,
      rosterRevision: canonical ? sameTeam ? canonical.rosterRevision : undefined : player.rosterRevision }];
  })).values()], [data?.players, workspace.manualPlayers, connectedInput?.players, viewingSaved, account?.snapshot?.players]);
  const supplemented = useMemo(() => connectedInput ? supplementProviderRules(connectedInput, workspace.managerRuleOverrides ?? {}) : null, [connectedInput, workspace.managerRuleOverrides]);
  const snapshot = useMemo<PlanningSnapshot | null>(() => {
    if (viewingSaved) return account?.snapshot ?? null;
    if (workspace.context.provider !== "manual") {
      if (supplemented) return supplemented.snapshot;
      const retained = data ? retainedScheduleSnapshot(workspace, data, lastUpdated ?? workspace.context.asOf) : null;
      return retained ? { ...retained, id: `${retained.id}:${fingerprint(workspace)}` } : null;
    }
    if (!data) return null;
    return { id: `manual:${fingerprint({ contextKey, forecastManifest: data.forecastManifest?.id, roster: workspace.roster, rules: workspace.rules, locks: workspace.lockedAssignments, manualPlayers: workspace.manualPlayers, realized: workspace.realized, opponent: workspace.opponent, asOf: workspace.context.asOf })}`, context: workspace.context, players, roster: workspace.roster, games: data.games, forecasts: data.forecasts, baselineSources: data.baselineSources, forecastManifest: data.forecastManifest, rules: workspace.rules, lockedAssignments: workspace.lockedAssignments ?? [], realized: workspace.realized, opponent: workspace.opponent, evidence: data.evidence };
  }, [workspace, data, players, supplemented, contextKey, lastUpdated, viewingSaved, account]);
  const { result: rawResult, error: planningError, loading: planningLoading } = useRosterPlanning(snapshot, workspace.intent);
  const result = rawResult && rawResult.snapshotId === snapshot?.id && rawResult.intentRevision === workspace.intent.revision ? rawResult : null;
  const activeProposal = proposal && proposal.snapshotId === snapshot?.id && proposal.intentRevision === workspace.intent.revision ? proposal : null;
  const sensitivity = useMemo(() => snapshot && result ? comparePlanSensitivity(snapshot, result.baseline, result.selected) : null, [snapshot, result]);
  const roster = workspace.context.provider !== "manual" && connectedInput ? connectedInput.roster : workspace.roster;
  const rules = workspace.context.provider !== "manual" && supplemented ? supplemented.snapshot.rules : workspace.rules;
  const reviewKey = JSON.stringify({
    context: [user?.id, workspace.context.provider, workspace.context.seasonId, workspace.context.leagueId,
      workspace.context.teamId, workspace.context.startDate, workspace.context.endDate, workspace.context.timeZone, viewingSaved],
    rules, roster, locks: snapshot?.lockedAssignments ?? workspace.lockedAssignments ?? [],
    players: players.map(player => [player.id, player.nhlId, player.nhlTeamId, player.rosterRevision, player.teamAbbreviation, player.eligiblePositions,
      player.eligibilityVerified, player.availability, player.canDrop, player.reserveEligibility]),
  });
  const inputsReviewed = reviewedInputs === reviewKey;
  const scoringEntered = rules.scoring.mode === "points"
    ? Object.entries(rules.scoring.weights).length > 0 && Object.entries(rules.scoring.weights).every(([key, weight]) => key.trim() && Number.isFinite(weight))
    : rules.scoring.categories.length > 0 && rules.scoring.categories.every(category => category.key.trim());
  const actionableRulesReviewed = inputsReviewed && scoringEntered;
  const lineupSuggestionReady = actionableRulesReviewed && Boolean(result?.selected.legal && result.selected.recommendation?.eligible
    && (!workspace.intent.steps.length || result.selected.budgetVerified));
  const scheduleDateCount = new Set(snapshot?.games.filter((game) => game.status !== "cancelled" && game.status !== "postponed").map((game) => game.date) ?? []).size;
  const activeSlotCount = expandActiveSlots(rules.rosterSlots).activeSlots.length;
  const utilizationCapacity = scheduleDateCount * activeSlotCount;
  const dates = useMemo(() => datesBetween(workspace.context.startDate, workspace.context.endDate), [contextKey]);
  const rangeTooLong = Date.parse(workspace.context.endDate) - Date.parse(workspace.context.startDate) > 366 * 86_400_000;
  const matchupWeeks = data?.matchupWeeks ?? [];
  const weekIndex = matchupWeeks.findIndex(week => week.startDate === workspace.context.startDate && week.endDate === workspace.context.endDate);
  const selectWeek = (index: number) => { const week = matchupWeeks[index]; if (week) edit(current => ({ ...current, context: { ...current.context, startDate: week.startDate, endDate: week.endDate } })); };
  const focusedDate = selectedDate && dates.includes(selectedDate) ? selectedDate : dates[0];
  const matches = players.filter((player) => query.trim().length >= 2 && `${player.name} ${player.teamAbbreviation ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0, 20);
  const rosterIds = useMemo(() => new Set(roster.map((entry) => entry.playerId)), [roster]);
  const assignments = result?.selected.assignments ?? [];
  const nameOf = (id: string) => players.find((player) => player.id === id)?.name ?? id;
  const addRoster = (player: PlanningPlayer) => { if (rosterIds.has(player.id)) return; edit((current) => ({ ...current, roster: [...current.roster, { playerId: player.id, position: "bench" }], manualPlayers: [...current.manualPlayers.filter((row) => row.id !== player.id), player], unresolvedNames: current.unresolvedNames.filter((name) => name.toLowerCase() !== player.name.toLowerCase()) })); setQuery(""); };
  const importRoster = () => { const resolved = resolveImportedNames(paste, players); edit((current) => ({ ...current, roster: [...current.roster, ...resolved.matched.filter((player) => !current.roster.some((entry) => entry.playerId === player.id)).map((player) => ({ playerId: player.id, position: "bench" as const }))], manualPlayers: [...current.manualPlayers.filter((row) => !resolved.matched.some((player) => player.id === row.id)), ...resolved.matched], unresolvedNames: [...new Set([...current.unresolvedNames, ...resolved.unresolved])] })); setPaste(""); };
  const chooseCandidate = (player: PlanningPlayer) => {
    setSelectedPlayer(player.id);
    if (rosterIds.has(player.id) || !["free_agent", "manager_available", "waivers"].includes(player.availability)) return;
    const at = new Date(Date.now() + 60_000).toISOString(); editIntent((intent) => ({ ...intent, steps: [...intent.steps, { id: `selected-${Date.now()}`, type: "add", playerId: player.id, at, effectiveAt: at, conditional: true, dependsOn: [] }] }));
  };
  const saveAccount = async () => {
    const userId = user?.id;
    try {
      if (snapshot && JSON.stringify(snapshot.context) !== JSON.stringify(workspace.context)) throw new Error("Provider context changed. Refresh this workspace before saving.");
      const headers = await authHeaders();
      if (userId !== providerRef.current.userId) return;
      const response = await fetch("/api/v1/roster-schedule-optimizer/workspace", { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ workspace, snapshot, expectedVersion: account?.version ?? null }) });
      const body = await response.json(); if (userId !== providerRef.current.userId) return;
      if (response.status === 409) throw new Error("Another device saved this workspace. Your local plan is intact; review the other version before saving again.");
      if (!response.ok) throw new Error(requestErrorMessage(body.error, "Account save failed.")); setAccount(body.data as AccountRecord); setNotice("Saved to account.");
    } catch (error) { if (userId === providerRef.current.userId) setNotice(message(error)); }
  };
  const updateRules = (change: (rules: LeagueRules) => LeagueRules) => edit((current) => {
    const base = current.context.provider === "manual" ? current.rules : (connected ? supplementProviderRules(connected, current.managerRuleOverrides ?? {}).snapshot.rules : current.rules);
    const rules = change(base);
    const overrides: ManagerRuleOverrides = { ...current.managerRuleOverrides };
    for (const key of ["lineupMode", "acquisitionTiming", "acquisitionCost", "periods", "lineupPeriods", "waivers"] as const) {
      if (JSON.stringify(base[key]) !== JSON.stringify(rules[key])) (overrides as Record<string, unknown>)[key] = rules[key];
    }
    const slots = { ...overrides.rosterSlots };
    for (const [slot, count] of Object.entries(rules.rosterSlots)) if (base.rosterSlots[slot] !== count) slots[slot] = count;
    if (Object.keys(slots).length) overrides.rosterSlots = slots;
    const scoring = { ...overrides.scoring };
    if (base.scoring.mode !== rules.scoring.mode) scoring.mode = rules.scoring.mode;
    if (JSON.stringify(base.scoring.weights) !== JSON.stringify(rules.scoring.weights)) scoring.weights = rules.scoring.weights;
    if (JSON.stringify(base.scoring.categories) !== JSON.stringify(rules.scoring.categories)) scoring.categories = rules.scoring.categories;
    if (Object.keys(scoring).length) overrides.scoring = scoring;
    const goalie = { ...overrides.goalieMinimum };
    for (const key of ["required", "credited", "counts", "penalty", "periodStart", "periodEnd"] as const) if (base.goalieMinimum[key] !== rules.goalieMinimum[key]) (goalie as Record<string, unknown>)[key] = rules.goalieMinimum[key];
    if (Object.keys(goalie).length) overrides.goalieMinimum = goalie;
    return { ...current, rules, managerRuleOverrides: overrides };
  });

  return <div ref={workspaceElement} className={styles.workspace}>
    <header className={styles.topbar}><div><span className={styles.eyebrow}>Tools / In-season planning</span><h1>Roster Schedule Optimizer</h1></div><div className={styles.actions}><button onClick={undo} disabled={readOnlySaved || !history.current.length}>Undo</button><button onClick={() => setTab(tab === "matchup" ? "candidates" : "matchup")}>{tab === "matchup" ? "Candidates" : "Matchup"}</button>{account?.snapshot && <button onClick={() => { setWorkspace(account.workspace); setViewingSaved(true); }}>View account save</button>}{access?.capabilities.includes("rso_account_save") && !readOnlySaved && <button className={styles.primaryAction} onClick={saveAccount}>Save to account</button>}<span>{viewingSaved && snapshot ? `Saved evidence ${actionTime(snapshot.context.asOf, snapshot.context.timeZone)}` : lastUpdated ? `Data checked ${new Date(lastUpdated).toLocaleTimeString()}` : "Data not loaded"}</span></div></header>
    <fieldset className={styles.controls} aria-label="Planning setup" disabled={readOnlySaved}>
      <label>Source<select value={workspace.context.provider} onChange={(event) => { edit((current) => ({ ...current, context: { ...current.context, provider: event.target.value as PlanningWorkspace["context"]["provider"] } })); setConnected(null); }}><option value="manual">Manual</option><option value="yahoo">Yahoo{!access?.capabilities.includes("rso_sync") ? " saved view" : ""}</option><option value="fantrax">Fantrax{!access?.capabilities.includes("rso_sync") ? " saved view" : ""}</option></select></label>
      <label>Season<input type="number" value={workspace.context.seasonId} onChange={(event) => edit((current) => ({ ...current, context: { ...current.context, seasonId: Number(event.target.value) } }))} /></label>
      <label>From<input type="date" value={workspace.context.startDate} onChange={(event) => edit((current) => ({ ...current, context: { ...current.context, startDate: event.target.value } }))} /></label>
      <label>Through<input type="date" value={workspace.context.endDate} onChange={(event) => edit((current) => ({ ...current, context: { ...current.context, endDate: event.target.value } }))} /></label>
      {workspace.context.provider !== "manual" && <>{ownTeams.some((team) => team.provider === workspace.context.provider) ? <label>My team<select value={workspace.context.teamId} onChange={(event) => { const team = ownTeams.find((row) => row.id === event.target.value); if (team) edit((current) => ({ ...current, context: { ...current.context, teamId: team.id, leagueId: team.external_league_id } })); }}><option value="manual">Select an owned team</option>{ownTeams.filter((team) => team.provider === workspace.context.provider).map((team) => <option key={team.id} value={team.id}>{team.team_name} — {team.external_leagues?.league_name ?? team.external_league_id}</option>)}</select></label> : <label>Team ID<input value={workspace.context.teamId} onChange={(event) => edit((current) => ({ ...current, context: { ...current.context, teamId: event.target.value } }))} /></label>}<button onClick={() => void refreshProvider()} disabled={!access?.capabilities.includes("rso_sync")}>Refresh provider</button></>}
      <label>League ID<input value={workspace.context.leagueId} onChange={(event) => edit((current) => ({ ...current, context: { ...current.context, leagueId: event.target.value } }))} /></label>
      <label>Time zone<input key={workspace.context.timeZone} defaultValue={workspace.context.timeZone} onBlur={(event) => { const zone = event.target.value.trim(); try { new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(); edit((current) => ({ ...current, context: { ...current.context, timeZone: zone } })); } catch { event.target.value = workspace.context.timeZone; setNotice("Enter a valid IANA time zone, such as America/New_York."); } }} /></label>
      <label>Goalie choice<select value={workspace.intent.goalieCoverage} onChange={(event) => editIntent((intent) => ({ ...intent, goalieCoverage: event.target.value as PlanIntent["goalieCoverage"] }))}><option value="accept_risk">Accept risk</option><option value="cover">Cover minimum</option></select></label>
      <label>Window<select value={workspace.intent.goalieWindow} onChange={(event) => editIntent((intent) => ({ ...intent, goalieWindow: event.target.value as PlanIntent["goalieWindow"] }))}><option value="any">Any date</option><option value="early">Early</option><option value="late">Late</option></select></label>
      <label>Split<select value={workspace.intent.goalieSplit} onChange={(event) => editIntent((intent) => ({ ...intent, goalieSplit: event.target.value as PlanIntent["goalieSplit"] }))}><option value="mon_thu">Mon–Thu / Fri–Sun</option><option value="mon_wed">Mon–Wed / Thu–Sun</option></select></label>
      <div className={styles.weekNav} role="group" aria-label="Matchup week navigation"><button aria-label="Previous matchup week" disabled={weekIndex <= 0} onClick={() => selectWeek(weekIndex - 1)}>‹</button><label>Matchup week<select value={weekIndex} onChange={event => selectWeek(Number(event.target.value))}><option value={-1}>Custom dates</option>{matchupWeeks.map((week, index) => <option key={`${week.gameKey}:${week.week}`} value={index}>Week {week.week} · {dateLabel(week.startDate)} – {dateLabel(week.endDate)}</option>)}</select></label><button aria-label="Next matchup week" disabled={weekIndex < 0 || weekIndex >= matchupWeeks.length - 1} onClick={() => selectWeek(weekIndex + 1)}>›</button></div>
    </fieldset>
    <details className={styles.dataHealth}>
      <summary><strong>Planning readiness</strong><span>{roster.length ? `${roster.length} roster players` : "Roster needed"} → Rules → Coverage → Plan</span></summary>
      <ul>
        <li>Roster: {roster.length ? `${roster.length} players; review unresolved names and eligibility.` : "Add your players to begin schedule analysis."} <button onClick={() => reachInput("roster", workspace.context.provider === "manual" ? "#rso-roster-input" : "#rso-roster-heading")}>Review roster</button></li>
        <li>Rules: {roster.length > 0 && workspace.intent.steps.length > 0 && result?.selected.legal && result.selected.budgetVerified && scoringEntered ? actionableRulesReviewed ? "Selected plan passes the current rule checks with reviewed inputs." : "Review and confirm the current planning inputs before using an acquisition plan." : "Acquisition legality, budget or scoring is unresolved. Review timing, allowances, slots and locks."} <button onClick={() => reachInput("roster", "#rso-rule-settings > summary")}>Review rules</button></li>
        <li>Coverage: {loadingData ? "Loading schedule evidence." : !snapshot ? "Schedule evidence unavailable." : !snapshot.games.length ? "No games in this date range." : !roster.length ? "Add roster players to assess player-quality coverage." : result?.selected.recommendation?.eligible ? "Player-quality assignment evidence available; projected totals have separate coverage requirements." : "Schedule-only capacity; player-quality decisions remain unresolved."} <button onClick={() => reachInput("matchup", "#rso-matchup-heading")}>Review coverage</button></li>
        <li>Plan: {result && roster.length ? "Schedule analysis available. Selected moves remain manager intent; execute changes with your provider." : "Awaiting roster and schedule inputs."} <button onClick={() => reachInput("itinerary", "#rso-itinerary-heading")}>View plan</button></li>
      </ul>
    </details>
    {usingRetainedRoster && <div className={styles.notice} role="status">Using retained roster inputs with the shared schedule. Roster, locks and availability are unverified until Yahoo refresh succeeds.</div>}
    {data && !loadingData && !data.games.length && <div className={styles.notice}>No regular-season games were found in the shared schedule for these dates.</div>}
    {rangeTooLong && <div className={styles.notice} role="alert">Planning range must be at most 367 days.</div>}{(notice || planningError) && <div className={styles.notice} role="status">{notice || planningError}</div>}{loadingData && <div className={styles.notice} role="status">Loading schedule and forecasts…</div>}
    {activeProposal?.issues.length ? <div className={styles.notice} role="status">Provider refresh found {activeProposal.issues.length} item(s) to review. Selected moves were kept. {activeProposal.issues.map((issue, index) => <span key={`${issue.stepId}-${index}`}>{issue.message} </span>)}{activeProposal.suggestedSteps && <button disabled={readOnlySaved} onClick={() => { const steps = activeProposal.suggestedSteps; if (!steps) return; editIntent((intent) => ({ ...intent, steps })); setProposal(null); }}>Accept suggested repair</button>}</div> : null}
    {accessError && <div className={styles.notice} role="alert">{accessError}</div>}
    {capabilities?.limitations.length ? <details className={styles.dataHealth}><summary><strong>Data health</strong><span>{capabilities.limitations.length} items to review · Planning uses partial provider inputs</span></summary><ul>{capabilities.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul></details> : null}{(viewingSaved || (workspace.context.provider !== "manual" && !canSync)) && <div className={styles.notice}>{readOnlySaved || workspace.roster.length ? "Saved inputs are read-only and may be stale." : accessError ? "Provider refresh is disabled until access can be verified." : user?.id ? "Provider synchronization requires active in-season access. Your account connection is unchanged." : "Sign in to check access for provider synchronization."} <button disabled={!snapshot && !workspace.roster.length} onClick={() => { setViewingSaved(false); setWorkspace((current) => { const recovered = snapshot ? retainProviderInputs(current, snapshot) : current; return { ...recovered, managerRuleOverrides: {}, rules: { ...recovered.rules, periods: recovered.rules.periods.map((period) => period.source === "provider" ? { ...period, remaining: null, source: "unknown" as const } : period), goalieMinimum: { ...recovered.rules.goalieMinimum, credited: null } }, context: { ...recovered.context, provider: "manual", leagueId: "manual", teamId: "manual", asOf: new Date().toISOString() } }; }); }}>Continue manually</button></div>}
    {supplemented?.conflicts.length ? <div className={styles.notice} role="status">Provider rules changed. Manager inputs were kept for review: {supplemented.conflicts.join(" ")}</div> : null}
    <section className={styles.metrics} aria-label="Plan summary"><Metric label="Planned adds" value={String(workspace.intent.steps.filter((step) => step.type === "add").length)} detail={acquisitionDetail(rules, snapshot?.acquisitionEvidence)} /><Metric label="Active games" value={number(result?.selected.activeGames)} detail={`No move ${number(result?.baseline.activeGames)} · Maximum active games ${number(result?.noMoveAgp.activeGames)}`} /><Metric label="Bench games" value={number(result?.selected.benchGames)} detail={`Games without an active assignment · ${number(result?.selected.scheduledGames)} scheduled`} /><Metric label="Projected outcome" value={number(result?.selected.projectedValue)} detail={`Estimate using league scoring · ${forecastSummary(result?.selected.forecastInputs, rules.scoring)}`} /><Metric label="Goalie minimum" value={result?.selected.goalie.required == null ? "Unknown" : `${result.selected.goalie.credited ?? "?"} / ${result.selected.goalie.required}`} detail={result?.selected.goalie.minimumSatisfied ? "Satisfied by credited results" : result?.selected.goalie.risk ? "At risk" : "Not yet satisfied by credited results"} /><Metric label="Team DUST" value={result?.selected.scheduledGames ? `${number(100 * result.selected.benchGames / result.selected.scheduledGames)}%` : "—"} detail={`Scheduled games left on the bench · ${number(result?.selected.benchGames)} / ${number(result?.selected.scheduledGames)}`} /><Metric label="Utilization" value={result && utilizationCapacity ? `${number(100 * result.selected.activeGames / utilizationCapacity)}%` : "—"} detail={`Share of available starting slots used · ${number(result?.selected.activeGames)} / ${scheduleDateCount} dates × ${activeSlotCount} slots`} /></section>
    <nav className={styles.mobileTabs} aria-label="Workspace views">{(["itinerary", "roster", "candidates", "matchup"] as Tab[]).map((name) => <button key={name} className={tab === name ? styles.activeTab : ""} onClick={() => setTab(name)} aria-current={tab === name ? "page" : undefined}>{name[0].toUpperCase() + name.slice(1)}</button>)}</nav>
    <div className={styles.panels}>
      <section {...readOnlyInert} className={`${styles.panel} ${styles.rosterPanel} ${tab === "roster" ? styles.mobileActive : ""}`} aria-label="Roster and setup"><div className={styles.panelHead}><h2 id="rso-roster-heading" tabIndex={-1}><span className={styles.panelNumber} aria-hidden="true">1</span>Roster</h2><span>{roster.length} players</span></div><div className={styles.panelBody}>
        {workspace.context.provider === "manual" && <><label className={styles.field}>Find a player<input id="rso-roster-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or team" /></label>{query.length >= 2 && <ul className={styles.searchResults}>{matches.map((player) => <li key={player.id}><span>{player.name} · {player.teamAbbreviation ?? "—"} · {player.eligiblePositions.join("/")}</span><button onClick={() => addRoster(player)} disabled={rosterIds.has(player.id)}>Add</button></li>)}</ul>}<label className={styles.field}>Paste roster names<textarea value={paste} onChange={(event) => setPaste(event.target.value)} placeholder="One name per line" /></label><button onClick={importRoster} disabled={!paste.trim()}>Review pasted names</button>{workspace.unresolvedNames.length > 0 && <div className={styles.unresolved}><strong>Unresolved — excluded from analysis</strong>{workspace.unresolvedNames.map((name) => <div key={name}>{name}<button onClick={() => setQuery(name)}>Find match</button><button onClick={() => edit((current) => ({ ...current, unresolvedNames: current.unresolvedNames.filter((item) => item !== name) }))}>Dismiss</button></div>)}</div>}</>}
        {roster.map((entry) => { const player = players.find((item) => item.id === entry.playerId); if (!player) return <div key={entry.playerId} className={styles.rosterRow}>Unmatched ID {entry.playerId}</div>; const protectedPlayer = workspace.intent.protectedPlayerIds.includes(player.id); return <div key={player.id} className={styles.rosterRow}><button className={styles.playerButton} onClick={() => setSelectedPlayer(player.id)}>{player.name}<small>{player.teamAbbreviation ?? "—"} · {player.eligiblePositions.join("/")}</small></button>{workspace.context.provider === "manual" ? <select aria-label={`${player.name} roster position`} value={entry.position} onChange={(event) => edit((current) => ({ ...current, roster: current.roster.map((row) => row.playerId === player.id ? { ...row, position: event.target.value as typeof entry.position } : row) }))}><option value="active">Active</option><option value="bench">Bench</option><option value="IR">IR</option><option value="IR+">IR+</option><option value="NA">NA</option></select> : <span>{entry.position}</span>}<label className={styles.check}><input type="checkbox" checked={protectedPlayer} onChange={() => editIntent((intent) => ({ ...intent, protectedPlayerIds: protectedPlayer ? intent.protectedPlayerIds.filter((id) => id !== player.id) : [...intent.protectedPlayerIds, player.id] }))} />Protect</label>{workspace.context.provider === "manual" && <button aria-label={`Remove ${player.name}`} onClick={() => edit((current) => ({ ...current, roster: current.roster.filter((row) => row.playerId !== player.id) }))}>×</button>}{workspace.context.provider === "manual" && <ManualPlayerInputs player={player} edit={edit} />}</div>; })}
        <details id="rso-rule-settings" className={styles.settings}><summary>League rules and scoring</summary><p>Daily mode and roster slots are proposed defaults for manual planning. Review them against your league. Unknown acquisition, scoring and lock rules keep action and outcome readiness unresolved.</p><p>{inputsReviewed ? "Inputs reviewed for this session. Unknown values still need verification." : "Review league rules, scoring, locked assignments and player availability. Confirm again when these inputs change."} <button disabled={readOnlySaved || !snapshot || !roster.length || inputsReviewed} onClick={() => setReviewedInputs(reviewKey)}>Confirm planning inputs</button></p><div className={styles.settingsGrid}><label>Lineup mode<select value={rules.lineupMode} onChange={(event) => updateRules((rules) => ({ ...rules, lineupMode: event.target.value as LeagueRules["lineupMode"] }))}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="unsupported">Other / unknown</option></select></label><label>Scoring<select value={rules.scoring.mode} onChange={(event) => updateRules((rules) => ({ ...rules, scoring: { ...rules.scoring, mode: event.target.value as LeagueRules["scoring"]["mode"] } }))}><option value="points">Points</option><option value="categories">Categories</option></select></label><label>Acquisition timing<select value={rules.acquisitionTiming} onChange={(event) => updateRules((rules) => ({ ...rules, acquisitionTiming: event.target.value as LeagueRules["acquisitionTiming"] }))}><option value="unknown">Unknown</option><option value="same_day">Same day</option><option value="next_day">Next day</option></select></label><label>Goalie minimum<input type="number" min="0" value={rules.goalieMinimum.required ?? ""} onChange={(event) => updateRules((rules) => ({ ...rules, goalieMinimum: { ...rules.goalieMinimum, required: event.target.value ? Number(event.target.value) : null } }))} /></label><label>Goalie credited<input type="number" min="0" value={rules.goalieMinimum.credited ?? ""} onChange={(event) => updateRules((rules) => ({ ...rules, goalieMinimum: { ...rules.goalieMinimum, credited: event.target.value ? Number(event.target.value) : null } }))} /></label>{Object.entries(rules.rosterSlots).map(([slot, count]) => <label key={slot}>{slot}<input type="number" min="0" value={count} onChange={(event) => updateRules((rules) => ({ ...rules, rosterSlots: { ...rules.rosterSlots, [slot]: Number(event.target.value) } }))} /></label>)}</div></details>{Object.keys(workspace.managerRuleOverrides ?? {}).length > 0 && workspace.context.provider !== "manual" && <p className={styles.evidence}>Manager rule inputs retained for this league: {JSON.stringify(workspace.managerRuleOverrides)}</p>}<ExtraRules rules={rules} startDate={workspace.context.startDate} endDate={workspace.context.endDate} timeZone={workspace.context.timeZone} updateRules={updateRules} />{workspace.context.provider === "manual" && <ManualLocks workspace={workspace} players={players} edit={edit} />}
      </div></section>
      <section className={`${styles.panel} ${styles.itineraryPanel} ${tab === "itinerary" ? styles.mobileActive : ""}`} aria-label="Itinerary"><div className={styles.panelHead}><h2 id="rso-itinerary-heading" tabIndex={-1}><span className={styles.panelNumber} aria-hidden="true">2</span>Itinerary</h2><span>{planningLoading ? "Evaluating…" : result ? `Best found · ${result.search.evaluated} evaluated` : "Awaiting inputs"}</span></div><div className={styles.viewSwitch} role="group" aria-label="Schedule view"><button aria-pressed={!showLineup} onClick={() => setShowLineup(false)}>Streaming itinerary</button><button aria-pressed={showLineup} aria-label={result?.selected.recommendation?.eligible ? "Show lineup analysis" : "Show schedule-capacity assignment"} onClick={() => setShowLineup(true)}>{result?.selected.recommendation?.eligible ? "Lineup analysis" : "Schedule-capacity assignment"}</button></div><div className={styles.panelBody}><div className={styles.dateStrip} role="group" aria-label="Choose a date">{dates.map((date) => <button key={date} className={focusedDate === date ? styles.selectedDate : ""} onClick={() => setSelectedDate(date)}>{dateLabel(date)}</button>)}</div><div className={styles.dateSummary}><strong>{focusedDate ? dateLabel(focusedDate) : "Choose valid dates"}</strong><span>{assignments.filter((assignment) => assignment.date === focusedDate).length} planned starts · {new Set(snapshot?.games.filter((game) => game.date === focusedDate && game.status !== "cancelled" && game.status !== "postponed").map((game) => game.id) ?? []).size} NHL games</span></div>{!showLineup && <StreamingGrid dates={dates} assignments={assignments} games={snapshot?.games ?? []} players={players} steps={workspace.intent.steps} timeZone={workspace.context.timeZone} />}{showLineup && <div className={styles.gridScroll}><table><thead><tr><th scope="col">Player</th>{dates.map((date) => <th key={date} scope="col">{dateLabel(date)}</th>)}</tr></thead><tbody>{roster.map((entry) => { const player = players.find((row) => row.id === entry.playerId); if (!player) return null; return <tr key={entry.playerId}><th scope="row"><button onClick={() => setSelectedPlayer(player.id)}>{player.name}</button><small>{player.eligiblePositions.join("/")}</small></th>{dates.map((date) => { const game = snapshot?.games.find((item) => item.date === date && item.teamAbbreviation === player.teamAbbreviation); const assignment = assignments.find((item) => item.date === date && item.playerId === player.id); return <td key={date} className={assignment ? styles.startCell : game ? styles.benchCell : ""} title={game ? `${game.home ? "vs" : "@"} ${game.opponent} · ${assignment ? `Start ${assignment.slotId}` : "Bench or unavailable"}` : "No game"}>{game ? <><span>{game.home ? "vs" : "@"}{game.opponent}</span><small>{assignment ? assignment.slotId : "Bench"}</small></> : "·"}</td>; })}</tr>; })}</tbody></table></div>}{showLineup && <ForecastEvidence forecasts={result?.selected.forecastInputs} scoring={rules.scoring} nameOf={nameOf} timeZone={workspace.context.timeZone} label="Selected lineup" />}<div className={styles.itineraryLegs}><h3>Selected steps</h3>{workspace.intent.steps.length ? workspace.intent.steps.map((step) => <SelectedStep key={step.id} step={step} name={nameOf(step.playerId)} timeZone={workspace.context.timeZone} rules={rules} readOnly={readOnlySaved} continuation={result?.noClaimContinuations?.find((row) => row.claimStepId === step.id)?.evaluation.activeGames} update={(patch) => editIntent((intent) => ({ ...intent, steps: intent.steps.map((item) => item.id === step.id ? { ...item, ...patch } : item) }))} remove={() => editIntent((intent) => ({ ...intent, steps: intent.steps.filter((item) => item.id !== step.id) }))} setNotice={setNotice} />) : <p>No acquisition selected. The no-move lineup is the comparison.</p>}</div>{showLineup && result?.selected.recommendation?.eligible && <p role="status" className={styles.limitation}>{!inputsReviewed ? "Lineup analysis uses proposed or saved inputs. Review rules, locks and player availability before following this assignment." : lineupSuggestionReady ? "Suggested assignment uses reviewed inputs. Forecast and rule limitations still apply." : "Reviewed inputs still have unresolved rule checks. This assignment remains lineup analysis."}</p>}{showLineup && !result?.selected.recommendation?.eligible && <p role="status" className={styles.limitation}>This assignment shows legal schedule capacity. Player-quality start/sit decisions are unresolved where forecasts are missing or incomplete.</p>}{showLineup && <p className={styles.limitation}>Goalie games are scheduled opportunities, not confirmed starts or a satisfied minimum. Back-to-back assignments require starter evidence.</p>}{showLineup && <div className={styles.lineup}>{dates.map((date) => <div key={date}><h3>{dateLabel(date)}</h3><p>{assignments.filter(row => row.date === date).length} active / {activeSlotCount} slots · {Math.max(0, activeSlotCount - assignments.filter(row => row.date === date).length)} open</p>{assignments.filter((assignment) => assignment.date === date).map((assignment) => <span key={`${assignment.playerId}:${assignment.slotId}`}>{assignment.slotId} · {nameOf(assignment.playerId)}{goalieB2B(assignment.playerId, date, snapshot) && <small className={styles.formChip}> · B2B — verify starter</small>}</span>)}</div>)}</div>}{showLineup && <BenchDecisions decisions={result?.selected.recommendation?.exclusions} nameOf={nameOf} date={focusedDate} />}{result?.selected.limitations.filter(limit => /conditional ability|baseline estimates/i.test(limit)).map(limit => <p key={limit} className={styles.limitation}>{limit}</p>)}{result?.search.limitations.length ? <p className={styles.limitation}>{result.search.limitations.join(" ")}</p> : null}</div></section>
      <section {...readOnlyInert} className={`${styles.panel} ${styles.candidatePanel} ${tab === "matchup" ? styles.desktopHidden : ""} ${tab === "candidates" ? styles.mobileActive : ""}`} aria-label="Candidates and detail"><div className={styles.panelHead}><h2><span className={styles.panelNumber} aria-hidden="true">3</span>Candidates</h2><label>Show<select value={workspace.intent.alternativeCount} onChange={(event) => editIntent((intent) => ({ ...intent, alternativeCount: Number(event.target.value) as PlanIntent["alternativeCount"] }))}><option value="5">5</option><option value="10">10</option><option value="20">20</option></select></label></div><div className={styles.panelBody}>{selectedPlayer && <div className={styles.detail}><strong>{nameOf(selectedPlayer)}</strong><span>{players.find((player) => player.id === selectedPlayer)?.availability.replaceAll("_", " ") ?? "Unknown"}</span><span>Ownership {number(players.find((player) => player.id === selectedPlayer)?.ownership)}%</span>{players.find((player) => player.id === selectedPlayer)?.form && <span className={styles.formChip}>{players.find((player) => player.id === selectedPlayer)!.form!.label} · {players.find((player) => player.id === selectedPlayer)!.form!.points} points / {players.find((player) => player.id === selectedPlayer)!.form!.games} games · forecast inclusion unknown</span>}{opponentDemandHint(snapshot, players.find((player) => player.id === selectedPlayer)) && <span className={styles.demandHint}>{opponentDemandHint(snapshot, players.find((player) => player.id === selectedPlayer))}</span>}</div>}<p className={styles.limitation}>Availability is unknown until verified by a provider or entered by the manager.</p>{result?.alternatives.slice(0, workspace.intent.alternativeCount).map((alternative, index) => { const first = alternative.steps[0]; return <div className={styles.alternative} key={index}><div><strong>{first ? alternative.steps.map((step) => `${step.type.toUpperCase()} ${nameOf(step.playerId)}`).join(" → ") : "Hold roster"}</strong><small>Gross games {grossAcquisitionGames(alternative.steps, snapshot)} · displaced {result?.baseline.assignments.filter((assignment) => !alternative.assignments.some((next) => next.date === assignment.date && next.playerId === assignment.playerId && next.gameId === assignment.gameId)).length ?? 0} · net active games {alternative.activeGames - (result?.baseline.activeGames ?? 0)} · {alternative.steps.filter((step) => step.type === "add").length} adds</small><small>Contribution {alternative.comparisonEligible && result?.baseline.comparisonEligible && alternative.projectedValue != null && result.baseline.projectedValue != null ? number(alternative.projectedValue - result.baseline.projectedValue) : "unavailable"} · {actionableRulesReviewed && alternative.legal && alternative.budgetVerified ? "Rule checks passed" : "Needs review"}</small></div><button disabled={!first || !actionableRulesReviewed || !alternative.legal || !alternative.budgetVerified} onClick={() => editIntent((intent) => ({ ...intent, steps: alternative.steps }))}>Select plan</button></div>; })}{!result?.alternatives.length && <p>Alternatives appear after legal roster and candidate data are available.</p>}{result && <details className={styles.settings} open={!result.alternatives.some(alternative => alternative.steps.length)}><summary>Why add/drop plans may be unavailable</summary>{result.search.limitations.filter(limit => /Add\/drop plans|Safe drop recommendations/.test(limit)).map(limit => <p key={limit}>{limit}</p>)}</details>}<CandidateBrowser key={`${user?.id ?? "guest"}:${accountKey}`} players={players} rosterIds={rosterIds} snapshot={snapshot} intent={workspace.intent} fits={result?.scheduleFits} manual={workspace.context.provider === "manual"} select={setSelectedPlayer} add={chooseCandidate} markAvailable={player => edit(current => ({ ...current, manualPlayers: [...current.manualPlayers.filter(row => row.id !== player.id), { ...player, availability: "manager_available" }] }))} /></div></section>
      <section className={`${styles.panel} ${styles.matchupPanel} ${tab === "matchup" ? `${styles.desktopMatchup} ${styles.mobileActive}` : ""}`} aria-label="Matchup"><div className={styles.panelHead}><h2 id="rso-matchup-heading" tabIndex={-1}>Matchup</h2><span>{rules.scoring.mode}</span></div><div className={styles.panelBody}><p>{snapshot?.opponent ? "Opponent data present. Review category and goalie results below." : "Opponent inputs are missing. Matchup strategy is unavailable; schedule planning remains usable."}</p><div className={styles.compare}><strong>Optimized no move · {result?.baseline.objective === "outcome" ? "Outcome" : "Active games"}</strong><span>{number(result?.baseline.activeGames)} active · {number(result?.baseline.projectedValue)} projected</span><strong>Selected plan</strong><span>{number(result?.selected.activeGames)} active · {number(result?.selected.projectedValue)} projected</span></div>{result?.selected.categoryResults.map((category) => <div key={category.key} className={styles.categoryRow}><strong>{category.key}</strong><span>{number(category.own)} vs {number(category.opponent)}</span><span>{category.result}</span></div>)}<div className={styles.sensitivity}><h3>Plan sensitivity · provisional</h3>{sensitivity?.scenarios.map((scenario) => <div key={scenario.id}><span>{scenario.label}</span><span>{number(scenario.baseline)} → {number(scenario.candidate)} · Δ {number(scenario.difference)}</span></div>)}<p>{sensitivity?.direction === "sensitive" ? "Plan ranking changes across stress scenarios." : sensitivity?.direction === "unavailable" ? "Full comparison unavailable with current forecast or opponent coverage." : "Fixed-lineup stress comparison only."} These are not win probabilities.</p></div><ForecastEvidence forecasts={result?.baseline.forecastInputs} scoring={rules.scoring} nameOf={nameOf} timeZone={workspace.context.timeZone} label="Optimized no-move plan" /><ForecastEvidence forecasts={result?.selected.forecastInputs} scoring={rules.scoring} nameOf={nameOf} timeZone={workspace.context.timeZone} label="Selected lineup" /><ForecastCoverage coverage={result?.selected.recommendation?.coverage} nameOf={nameOf} /><div {...readOnlyInert}><MatchupSetup workspace={workspace} edit={edit} /></div><h3>Goalie evidence</h3><p>Projected and confirmed upcoming starts do not count as credited minimum progress.</p><GoalieEvidence snapshot={snapshot} /><p>Credited: {number(result?.selected.goalie.credited)} · Confirmed upcoming: {number(result?.selected.goalie.confirmed)} · Projected: {number(result?.selected.goalie.projected)}</p>{Object.entries(snapshot?.evidence ?? {}).map(([source, evidence]) => <p key={source} className={styles.evidence}>{source}: {evidence.completeness}{evidence.limitations.length ? ` · ${evidence.limitations.join(" ")}` : ""}</p>)}{result?.selected.limitations.map((limit, index) => <p key={index} className={styles.limitation}>{limit}</p>)}</div></section>
    </div>
  </div>;
}
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <article><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function SelectedStep({ step, name, timeZone, rules, readOnly, continuation, update, remove, setNotice }: { step: PlanStep; name: string; timeZone: string; rules: LeagueRules; readOnly: boolean; continuation?: number; update: (patch: Partial<PlanStep>) => void; remove: () => void; setNotice: (message: string) => void }) {
  const changeTime = (key: "at" | "effectiveAt", value: string) => { const instant = instantFromLeagueTime(value, timeZone); if (instant) update({ [key]: instant }); else setNotice("Enter a valid time in the league time zone."); };
  return <div className={styles.selectedStep}><strong>{step.type.toUpperCase()} {name}</strong><span>{actionTime(step.at, timeZone)} · effective {actionTime(step.effectiveAt, timeZone)} · {periodName(step.at, rules)} · {step.conditional ? "Conditional" : "Selected, not executed"}</span><div className={styles.stepControls}><label>Action (league time)<input type="datetime-local" disabled={readOnly} value={leagueDateTime(step.at, timeZone)} onChange={(event) => changeTime("at", event.target.value)} /></label><label>Effective<input type="datetime-local" disabled={readOnly} value={leagueDateTime(step.effectiveAt, timeZone)} onChange={(event) => changeTime("effectiveAt", event.target.value)} /></label>{step.conditional && rules.waivers?.mode === "budget" && <label>Waiver spend (manager input)<input type="number" min="0" disabled={readOnly} value={step.waiverSpend ?? ""} onChange={(event) => update({ waiverSpend: event.target.value === "" ? null : Number(event.target.value) })} /></label>}<button disabled={readOnly} onClick={remove}>Remove</button></div>{continuation !== undefined && <small>If claim fails: {continuation} active games; prior legal steps remain.</small>}</div>;
}

function StreamingGrid({ dates, assignments, games, players, steps, timeZone }: { dates: string[]; assignments: PlanningAssignment[]; games: PlanningGame[]; players: PlanningPlayer[]; steps: PlanStep[]; timeZone: string }) {
  const slots = [...new Set(assignments.map((assignment) => assignment.slotId))].sort();
  const orderedSteps = [...steps].sort((a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt));
  if (!slots.length) return <p className={styles.limitation}>No legal active assignments yet. Review roster slots, schedule coverage, and rule limits.</p>;
  return <div className={styles.streamingGrid}><table><thead><tr><th scope="col">Stream slot</th>{dates.map((date) => <th scope="col" key={date}>{dateLabel(date)}</th>)}</tr></thead><tbody>{slots.map((slot) => <tr key={slot}><th scope="row">{slot}</th>{dates.map((date) => {
    const assignment = assignments.find((row) => row.slotId === slot && row.date === date);
    if (!assignment) {
      const prior = assignments.filter((row) => row.slotId === slot && row.date < date).sort((a, b) => b.date.localeCompare(a.date))[0];
      let heldId: string | null = prior?.playerId ?? null;
      let conditional = false;
      for (const step of orderedSteps) {
        const effectiveDate = leagueDate(step.effectiveAt, timeZone);
        if (!prior || effectiveDate <= prior.date || effectiveDate > date) continue;
        if (step.type === "drop" && step.playerId === heldId) heldId = null;
        if (step.type === "add" && step.dropPlayerId === heldId) { heldId = step.playerId; conditional = step.conditional; }
      }
      const held = players.find((player) => player.id === heldId);
      return <td key={date} className={styles.emptyStream}>{held ? <><strong>{held.name}</strong><small>{conditional ? "Conditional hold" : "Planned hold"} · no active game</small></> : "Open / bench"}</td>;
    }
    const player = players.find((row) => row.id === assignment.playerId);
    const game = games.find((row) => row.id === assignment.gameId && row.teamAbbreviation === player?.teamAbbreviation);
    const move = steps.find((step) => step.type === "add" && step.playerId === assignment.playerId && leagueDate(step.effectiveAt, timeZone) === date);
    return <td key={date} className={styles.startCell}><strong>{player?.name ?? assignment.playerId}</strong><small>{move ? `${move.conditional ? "Conditional add" : "Add"} · ` : "Hold · "}{game ? `${game.home ? "vs" : "@"}${game.opponent}` : "game"}</small></td>;
  })}</tr>)}</tbody></table></div>;
}

type EditWorkspace = (change: (workspace: PlanningWorkspace) => PlanningWorkspace) => void;
function ManualPlayerInputs({ player, edit }: { player: PlanningPlayer; edit: EditWorkspace }) {
  const update = (patch: Partial<PlanningPlayer>) => edit((current) => ({ ...current, manualPlayers: [...current.manualPlayers.filter((row) => row.id !== player.id), { ...player, ...patch }] }));
  return <details className={styles.playerEvidence}><summary>Review evidence</summary><label>Droppable<select value={player.canDrop === null ? "unknown" : player.canDrop ? "yes" : "no"} onChange={(event) => update({ canDrop: event.target.value === "unknown" ? null : event.target.value === "yes" })}><option value="unknown">Unknown</option><option value="yes">Manager confirms yes</option><option value="no">No</option></select></label><label>Team<input value={player.teamAbbreviation ?? ""} onChange={(event) => update({ teamAbbreviation: event.target.value.trim().toUpperCase() || null, nhlTeamId: undefined, rosterRevision: undefined, eligibilityVerified: false })} /></label><label>Eligible positions<input defaultValue={player.eligiblePositions.join(", ")} onBlur={(event) => update({ eligiblePositions: event.target.value.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean), eligibilityVerified: true })} /></label><label><input type="checkbox" checked={player.eligibilityVerified === true} onChange={event => update({ eligibilityVerified: event.target.checked })} />Manager confirms league positions</label><div className={styles.reserveChoices}>Reserve eligibility{(["IR", "IR+", "NA"] as const).map((position) => <label key={position}><input type="checkbox" checked={player.reserveEligibility.includes(position)} onChange={(event) => update({ reserveEligibility: event.target.checked ? [...player.reserveEligibility, position] : player.reserveEligibility.filter((item) => item !== position) })} />{position}</label>)}</div></details>;
}
function ManualLocks({ workspace, players, edit }: { workspace: PlanningWorkspace; players: PlanningPlayer[]; edit: EditWorkspace }) {
  const locks = workspace.lockedAssignments ?? [];
  const slots = expandActiveSlots(workspace.rules.rosterSlots).activeSlots;
  const update = (index: number, patch: Partial<LockedAssignment>) => edit((current) => ({ ...current, lockedAssignments: (current.lockedAssignments ?? []).map((row, i) => i === index ? { ...row, ...patch } : row) }));
  return <details className={styles.settings}><summary>Locked lineup assignments</summary><p>Enter confirmed locks for games already fixed by the league. Use Bench when a player cannot be started that date.</p>{locks.map((lock, index) => <div className={styles.ruleRow} key={index}><label>Date<input type="date" value={lock.date} onChange={(event) => update(index, { date: event.target.value })} /></label><label>Player<select value={lock.playerId} onChange={(event) => update(index, { playerId: event.target.value })}>{workspace.roster.map((entry) => <option key={entry.playerId} value={entry.playerId}>{players.find((player) => player.id === entry.playerId)?.name ?? entry.playerId}</option>)}</select></label><label>Locked slot<select value={lock.slotId ?? "bench"} onChange={(event) => update(index, { slotId: event.target.value === "bench" ? null : event.target.value })}><option value="bench">Bench</option>{slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.id}</option>)}</select></label><button aria-label={`Remove lock ${index + 1}`} onClick={() => edit((current) => ({ ...current, lockedAssignments: (current.lockedAssignments ?? []).filter((_, i) => i !== index) }))}>×</button></div>)}<button disabled={!workspace.roster.length} onClick={() => edit((current) => ({ ...current, lockedAssignments: [...(current.lockedAssignments ?? []), { date: current.context.startDate, playerId: current.roster[0].playerId, slotId: null }] }))}>Add confirmed lock</button></details>;
}
function StatEditor({ label, stats, update }: { label: string; stats: Record<string, number | null>; update: (stats: Record<string, number | null>) => void }) {
  return <div className={styles.statEditor}><h4>{label}</h4>{Object.entries(stats).map(([key, value]) => <div className={styles.ruleRow} key={key}><label>Statistic<input aria-label={`${label} statistic ${key}`} defaultValue={key} onBlur={(event) => { const renamed = event.target.value.trim(); if (!renamed || renamed === key) return; const next = { ...stats }; delete next[key]; next[renamed] = value; update(next); }} /></label><label>Total<input aria-label={`${label} ${key} total`} type="number" value={value ?? ""} onChange={(event) => update({ ...stats, [key]: event.target.value === "" ? null : Number(event.target.value) })} /></label><button aria-label={`Remove ${label} ${key}`} onClick={() => { const next = { ...stats }; delete next[key]; update(next); }}>×</button></div>)}<button onClick={() => { let key = "STAT"; let i = 2; while (key in stats) key = `STAT${i++}`; update({ ...stats, [key]: 0 }); }}>Add statistic</button></div>;
}
function MatchupSetup({ workspace, edit }: { workspace: PlanningWorkspace; edit: EditWorkspace }) {
  const opponent = workspace.opponent;
  return <details className={styles.settings}><summary>Manual matchup totals</summary><p>Enter raw components for ratios, such as saves and shots against. Projected totals remain separate from realized totals.</p><StatEditor label="Own realized" stats={workspace.realized} update={(realized) => edit((current) => ({ ...current, realized }))} />{!opponent ? <button onClick={() => edit((current) => ({ ...current, opponent: { roster: [], realized: {}, remaining: {} } }))}>Add opponent totals</button> : <><StatEditor label="Opponent realized" stats={opponent.realized} update={(realized) => edit((current) => ({ ...current, opponent: { ...current.opponent!, realized } }))} /><StatEditor label="Opponent remaining" stats={opponent.remaining ?? {}} update={(remaining) => edit((current) => ({ ...current, opponent: { ...current.opponent!, remaining } }))} /></>}</details>;
}
function ForecastCoverage({ coverage, nameOf }: {
  coverage: NonNullable<NonNullable<PlanEvaluation["recommendation"]>["coverage"]> | undefined;
  nameOf: (playerId: string) => string;
}) {
  if (!coverage?.requiredCount) return null;
  return <details className={styles.settings}><summary>Forecast coverage · {coverage.assignmentEligibleCount}/{coverage.requiredCount} assignment targets</summary>
    <p>{coverage.totalsEligibleCount}/{coverage.requiredCount} totals targets · {coverage.comparisonEligibleCount}/{coverage.requiredCount} comparison targets. Counts include eligible competing bench opportunities.</p>
    {coverage.exclusions.slice(0, 100).map(row => <p key={`${row.gameId}:${row.playerId}:${row.targetKey}`}>
      {nameOf(row.playerId)} · game {row.gameId} · {row.targetKey}: {row.reasons.map(reason => reason.replaceAll("_", " ")).join(", ")}
    </p>)}
    {coverage.exclusions.length > 100 && <p>{coverage.exclusions.length - 100} more uncovered targets are omitted from this view.</p>}
  </details>;
}
export function GoalieEvidence({ snapshot }: { snapshot: PlanningSnapshot | null }) {
  const resolved = useMemo(() => {
    if (!snapshot) return null;
    const players = snapshot.players.filter(player => player.playerClass === "goalie");
    const playerIds = new Set(players.map(player => player.id));
    return resolvePlanningContributions(sanitizeForecastInputs({ ...snapshot, players,
      forecasts: snapshot.forecasts.filter(forecast => playerIds.has(forecast.playerId)),
      baselineSources: snapshot.baselineSources?.filter(source => playerIds.has(String(source.playerId))) }));
  }, [snapshot]);
  if (!snapshot || !resolved) return <p>Goalie evidence is unavailable until schedule data loads.</p>;
  const pairs: Array<{ team: string; first: PlanningSnapshot["games"][number]; second: PlanningSnapshot["games"][number] }> = [];
  const teams = [...new Set(snapshot.games.map((game) => game.teamAbbreviation))];
  for (const team of teams) {
    const games = snapshot.games.filter((game) => game.teamAbbreviation === team && game.status === "scheduled" && game.startsAt && Date.parse(game.startsAt) > Date.parse(snapshot.context.asOf)).sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < games.length; i++) if ((Date.parse(`${games[i].date}T12:00:00Z`) - Date.parse(`${games[i - 1].date}T12:00:00Z`)) / 86_400_000 === 1) pairs.push({ team, first: games[i - 1], second: games[i] });
  }
  if (!pairs.length) return <p>No back-to-back team games in this range.</p>;
  return <div className={styles.b2bList}>{pairs.map(({ team, first, second }) => {
    const goalies = snapshot.players.filter((player) => player.playerClass === "goalie" && player.teamAbbreviation === team && (snapshot.roster.some((entry) => entry.playerId === player.id) || ["free_agent", "manager_available", "waivers"].includes(player.availability)));
    const forecasts = resolved.forecasts.filter((forecast) => goalies.some((goalie) => goalie.id === forecast.playerId) && [first.id, second.id].includes(forecast.gameId));
    const conflict = resolved.forecastInputExclusions?.some(row => [first.id, second.id].includes(row.gameId)
      && row.reasons.includes("unsupported_conditioning") && goalies.some(goalie => goalie.id === row.playerId));
    const confirmed = forecasts.filter((forecast) => forecast.confirmedStart).length;
    const known = [first, second].filter((game) => forecasts.some((forecast) => forecast.gameId === game.id && (forecast.confirmedStart || typeof forecast.startProbability === "number" && Number.isFinite(forecast.startProbability))));
    const projected = known.reduce((total, game) => total + forecasts.filter((forecast) => forecast.gameId === game.id).reduce((sum, forecast) => sum + (forecast.confirmedStart ? 1 : forecast.startProbability ?? 0), 0), 0);
    return <div className={styles.b2bRow} key={`${team}:${first.id}:${second.id}`}><strong>{team} · {dateLabel(first.date)} {first.home ? "vs" : "@"}{first.opponent} / {dateLabel(second.date)} {second.home ? "vs" : "@"}{second.opponent}</strong><span>{goalies.length} unique available goalies · {confirmed} confirmed starts · {known.length ? `${number(projected)} projected across ${known.length}/2 evidenced games` : "projected starts unknown"}{known.length < 2 ? " · remaining start probabilities unknown" : ""}{conflict ? " · Starter evidence is incompatible; affected starts unavailable." : ""}</span></div>;
  })}</div>;
}
function ExtraRules({ rules, startDate, endDate, timeZone, updateRules }: { rules: LeagueRules; startDate: string; endDate: string; timeZone: string; updateRules: (change: (rules: LeagueRules) => LeagueRules) => void }) {
  const weights = rules.scoring.weights;
  const categories = rules.scoring.categories;
  const periods = rules.periods;
  const lineupPeriods = rules.lineupPeriods ?? [];
  return <details className={styles.settings}><summary>Scoring, budgets, and lock windows</summary><div className={styles.ruleFields}>
    <label>Acquisition cost<input type="number" min="0" value={rules.acquisitionCost ?? ""} onChange={(event) => updateRules((current) => ({ ...current, acquisitionCost: event.target.value ? Number(event.target.value) : null }))} /></label>
    <label>Waiver mode<select value={rules.waivers?.mode ?? "unknown"} onChange={(event) => updateRules((current) => ({ ...current, waivers: { mode: event.target.value as NonNullable<LeagueRules["waivers"]>["mode"], remainingBudget: current.waivers?.remainingBudget ?? null } }))}><option value="unknown">Unknown</option><option value="priority">Priority</option><option value="budget">Budget</option></select></label>
    {rules.waivers?.mode === "budget" && <label>Waiver budget remaining<input type="number" min="0" value={rules.waivers.remainingBudget ?? ""} onChange={(event) => updateRules((current) => ({ ...current, waivers: { mode: "budget", remainingBudget: event.target.value === "" ? null : Number(event.target.value) } }))} /></label>}
    <label>Goalie counting<select value={rules.goalieMinimum.counts} onChange={(event) => updateRules((current) => ({ ...current, goalieMinimum: { ...current.goalieMinimum, counts: event.target.value as LeagueRules["goalieMinimum"]["counts"] } }))}><option value="unknown">Unknown</option><option value="starts">Starts</option><option value="appearances">Appearances</option></select></label>
    <label>Goalie penalty<select value={rules.goalieMinimum.penalty} onChange={(event) => updateRules((current) => ({ ...current, goalieMinimum: { ...current.goalieMinimum, penalty: event.target.value as LeagueRules["goalieMinimum"]["penalty"] } }))}><option value="unknown">Unknown</option><option value="lose_goalie_categories">Lose goalie categories</option><option value="none">None</option></select></label>
    <label>Goalie period start<input type="date" value={rules.goalieMinimum.periodStart ?? ""} onChange={(event) => updateRules((current) => ({ ...current, goalieMinimum: { ...current.goalieMinimum, periodStart: event.target.value || null } }))} /></label>
    <label>Goalie period end<input type="date" value={rules.goalieMinimum.periodEnd ?? ""} onChange={(event) => updateRules((current) => ({ ...current, goalieMinimum: { ...current.goalieMinimum, periodEnd: event.target.value || null } }))} /></label>
    <h4>Point weights</h4>{Object.entries(weights).map(([stat, weight]) => <div className={styles.ruleRow} key={stat}><label>Statistic<input defaultValue={stat} onBlur={(event) => { const renamed = event.target.value.trim(); if (!renamed || renamed === stat) return; const next = { ...weights }; delete next[stat]; next[renamed] = weight; updateRules((current) => ({ ...current, scoring: { ...current.scoring, weights: next } })); }} /></label><label>Weight<input type="number" step="any" value={weight} onChange={(event) => updateRules((current) => ({ ...current, scoring: { ...current.scoring, weights: { ...current.scoring.weights, [stat]: Number(event.target.value) } } }))} /></label><button aria-label={`Remove ${stat} weight`} onClick={() => { const next = { ...weights }; delete next[stat]; updateRules((current) => ({ ...current, scoring: { ...current.scoring, weights: next } })); }}>×</button></div>)}<button onClick={() => { let stat = "STAT"; let i = 2; while (stat in weights) stat = `STAT${i++}`; updateRules((current) => ({ ...current, scoring: { ...current.scoring, weights: { ...current.scoring.weights, [stat]: 1 } } })); }}>Add point weight</button>
    <h4>Categories</h4>{categories.map((category, index) => <div className={styles.ruleRow} key={index}><label>Stat<input value={category.key} onChange={(event) => updateRules((current) => ({ ...current, scoring: { ...current.scoring, categories: current.scoring.categories.map((row, i) => i === index ? { ...row, key: event.target.value } : row) } }))} /></label><label>Direction<select value={category.direction} onChange={(event) => updateRules((current) => ({ ...current, scoring: { ...current.scoring, categories: current.scoring.categories.map((row, i) => i === index ? { ...row, direction: event.target.value as "higher" | "lower" } : row) } }))}><option value="higher">Higher</option><option value="lower">Lower</option></select></label><label>Numerator<input value={category.numerator ?? ""} onChange={(event) => updateRules((current) => ({ ...current, scoring: { ...current.scoring, categories: current.scoring.categories.map((row, i) => i === index ? { ...row, numerator: event.target.value || undefined } : row) } }))} /></label><label>Denominator<input value={category.denominator ?? ""} onChange={(event) => updateRules((current) => ({ ...current, scoring: { ...current.scoring, categories: current.scoring.categories.map((row, i) => i === index ? { ...row, denominator: event.target.value || undefined } : row) } }))} /></label><button aria-label={`Remove category ${category.key}`} onClick={() => updateRules((current) => ({ ...current, scoring: { ...current.scoring, categories: current.scoring.categories.filter((_, i) => i !== index) } }))}>×</button></div>)}<button onClick={() => updateRules((current) => ({ ...current, scoring: { ...current.scoring, categories: [...current.scoring.categories, { key: "STAT", direction: "higher" }] } }))}>Add category</button>
    <h4>Acquisition periods</h4>{periods.map((period, index) => <div className={styles.ruleRow} key={index}><label>Period<input value={period.id} onChange={(event) => updateRules((current) => ({ ...current, periods: current.periods.map((row, i) => i === index ? { ...row, id: event.target.value } : row) }))} /></label><label>Start<input type="date" value={leagueDate(period.start, timeZone)} onChange={(event) => { if (event.target.value) updateRules((current) => ({ ...current, periods: current.periods.map((row, i) => i === index ? { ...row, start: leagueDayBoundary(event.target.value, timeZone) } : row) })); }} /></label><label>End<input type="date" value={leagueDate(new Date(Date.parse(period.end) - 1).toISOString(), timeZone)} onChange={(event) => { if (event.target.value) updateRules((current) => ({ ...current, periods: current.periods.map((row, i) => i === index ? { ...row, end: leagueDayBoundary(event.target.value, timeZone, true) } : row) })); }} /></label><label>Moves left<input type="number" min="0" value={period.remaining ?? ""} onChange={(event) => updateRules((current) => ({ ...current, periods: current.periods.map((row, i) => i === index ? { ...row, remaining: event.target.value === "" ? null : Number(event.target.value), source: "manager" } : row) }))} /></label><button aria-label={`Remove period ${period.id}`} onClick={() => updateRules((current) => ({ ...current, periods: current.periods.filter((_, i) => i !== index) }))}>×</button></div>)}<button disabled={!startDate || !endDate || startDate > endDate} onClick={() => updateRules((current) => ({ ...current, periods: [...current.periods, { id: `Period ${current.periods.length + 1}`, start: leagueDayBoundary(startDate, timeZone), end: leagueDayBoundary(endDate, timeZone, true), remaining: null, source: "manager" }] }))}>Add acquisition period</button>
    <h4>Weekly lineup windows</h4>{lineupPeriods.map((period, index) => <div className={styles.ruleRow} key={index}><label>Window<input value={period.id} onChange={(event) => updateRules((current) => ({ ...current, lineupPeriods: (current.lineupPeriods ?? []).map((row, i) => i === index ? { ...row, id: event.target.value } : row) }))} /></label><label>Start<input type="date" value={leagueDate(period.start, timeZone)} onChange={(event) => { if (event.target.value) updateRules((current) => ({ ...current, lineupPeriods: (current.lineupPeriods ?? []).map((row, i) => i === index ? { ...row, start: leagueDayBoundary(event.target.value, timeZone) } : row) })); }} /></label><label>End<input type="date" value={leagueDate(new Date(Date.parse(period.end) - 1).toISOString(), timeZone)} onChange={(event) => { if (event.target.value) updateRules((current) => ({ ...current, lineupPeriods: (current.lineupPeriods ?? []).map((row, i) => i === index ? { ...row, end: leagueDayBoundary(event.target.value, timeZone, true) } : row) })); }} /></label><label>Lock at<input type="datetime-local" value={period.lockAt ? leagueDateTime(period.lockAt, timeZone) : ""} onChange={(event) => updateRules((current) => ({ ...current, lineupPeriods: (current.lineupPeriods ?? []).map((row, i) => i === index ? { ...row, lockAt: event.target.value ? instantFromLeagueTime(event.target.value, timeZone) : null } : row) }))} /></label><button aria-label={`Remove window ${period.id}`} onClick={() => updateRules((current) => ({ ...current, lineupPeriods: (current.lineupPeriods ?? []).filter((_, i) => i !== index) }))}>×</button></div>)}<button disabled={!startDate || !endDate || startDate > endDate} onClick={() => updateRules((current) => ({ ...current, lineupPeriods: [...(current.lineupPeriods ?? []), { id: `Window ${(current.lineupPeriods ?? []).length + 1}`, start: leagueDayBoundary(startDate, timeZone), end: leagueDayBoundary(endDate, timeZone, true), lockAt: null }] }))}>Add lineup window</button>
  </div></details>;
}

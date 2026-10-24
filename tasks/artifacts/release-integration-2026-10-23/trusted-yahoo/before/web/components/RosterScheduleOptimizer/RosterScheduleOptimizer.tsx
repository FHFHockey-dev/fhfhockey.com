import { PROVIDER_SYNC_UPSELL } from "lib/integrations/providerSyncAccess";
import { expandBridgeForecasts, packPlanningSnapshots, unpackPlanningSnapshots } from "lib/rosterScheduleData/bridgeForecastWire";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fromZonedTime } from "date-fns-tz";
import { useAuth } from "contexts/AuthProviderContext";
import { useRosterPlanning } from "hooks/useRosterPlanning";
import { useYahooEligibility, YAHOO_ELIGIBILITY_READ_LIMIT } from "hooks/useYahooEligibility";
import { cachedYahooPlayer, withCachedYahooEligibility } from "lib/rosterScheduleOptimizer/yahooEligibility";
import { comparePlanSensitivity } from "lib/player-forecasts/planComparison";
import { capacityPlanningSnapshot, type CurrentPlanningOptions } from "lib/rosterScheduleOptimizer/currentPlanningRead";
import { contributionLedger } from "lib/rosterScheduleOptimizer/contributionLedger";
import { gameForecastPoints, type GameForecastPoints } from "lib/rosterScheduleOptimizer/planning";
import { expandActiveSlots } from "lib/rosterScheduleOptimizer/slots";
import { localDate } from "lib/rosterScheduleOptimizer/planningDates";
import { acquisitionEffectiveAt } from "lib/rosterScheduleOptimizer/planningTimeline";
import { reconcileIntent } from "lib/rosterScheduleOptimizer/reconciliation";
import { supplementProviderRules } from "lib/rosterScheduleOptimizer/providerRules";
import type { LeagueRules, LockedAssignment, ManagerRuleOverrides, PlanEvaluation, PlanIntent, PlanStep, PlanningAssignment, PlanningData, PlanningGame, PlanningPlayer, PlanningSnapshot, PlanningWorkspace, ProviderCapabilities, RevisionProposal } from "lib/rosterScheduleOptimizer/planningTypes";
import { acquirePreservationWriter, assertPreservedKeys, capturePreservation, preservationChecksum, preservationJson, preservationKeys, readPreservedKeys, restorePreservedKeys, validatePreservation, withWorkspaceWriter, WORKSPACE_PRESERVATION_JOURNAL, type PreservedKey, type PreservationProvider, type WorkspacePreservation, currentPlanningRange, currentProviderPeriod, defaultWorkspace, readWorkspace, readWorkspaceHistory, resolveImportedNames, retainedScheduleSnapshot, retainProviderInputs, workspaceContextKey, writeWorkspace, WORKSPACE_HISTORY_LIMIT } from "lib/rosterScheduleOptimizer/workspace";
import supabase from "lib/supabase/client";
import styles from "./RosterScheduleOptimizer.module.scss";
import ForecastEvidence, { forecastSummary } from "./ForecastEvidence";
import BenchDecisions from "./BenchDecisions";
import CandidateBrowser from "./CandidateBrowser";
import OptimizeLineup from "./OptimizeLineup";
import BenchDays from "./BenchDays";
import SlotWeekGrid from "./SlotWeekGrid";
import { lineupGapReport } from "lib/rosterScheduleOptimizer/lineupGaps";
import { ownershipLabel } from "lib/rosterScheduleOptimizer/retention";
import AcquisitionPeriodTimes from "./AcquisitionPeriodTimes";
import CategoryGains from "./CategoryGains";
import CompactSchedule, { defaultScheduleDate } from "./CompactSchedule";
import RosterContribution from "./RosterContribution";
import RosterPlayerRow from "./RosterPlayerRow";
import HealthyReserveAlert from "./HealthyReserveAlert";
import InfoTooltip from "./InfoTooltip";
import TeamScheduleContext from "./TeamScheduleContext";
import { useCanonicalSchedule } from "./canonicalSchedule";

type Access = { eligible: boolean; capabilities: string[]; expiresAt?: string | null; grantingSources?: string[] };
type RequestFeedback = NonNullable<PreservationProvider["refresh"]>;
const PROVIDER_REFRESH_INTERVAL = 5 * 60_000;
type ProviderRefreshSchedule = NonNullable<PreservationProvider["schedule"]>;
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
export function scheduleFreshnessWarning(evidence: PlanningData["evidence"][string] | undefined,
  games: PlanningGame[], context: PlanningWorkspace["context"]): string | null {
  if (evidence?.source !== "roster_optimizer_team_games") return null;
  const evaluatedAt = Date.parse(context.asOf);
  const receivedAt = evidence.asOf ? Date.parse(evidence.asOf) : NaN;
  if (!Number.isFinite(evaluatedAt) || !Number.isFinite(receivedAt) || receivedAt > evaluatedAt) return "Schedule cache receipt age unknown.";
  const nearPuckDrop = games.some(game => {
    const untilStart = Date.parse(game.startsAt ?? "") - evaluatedAt;
    return game.status === "scheduled" && game.date >= context.startDate && game.date <= context.endDate
      && untilStart >= 0 && untilStart <= 120 * 60000;
  });
  const thresholdHours = nearPuckDrop ? 2 : 6;
  return evaluatedAt - receivedAt > thresholdHours * 3600000 ? `Provisional ${thresholdHours}-hour schedule warning.` : null;
}
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
  const dateRangeOrigin = useRef<"default" | "restored" | "custom" | "current">("default");
  const [hydrated, setHydrated] = useState(false);
  const [loadedData, setLoadedData] = useState<{ contextKey: string; data: PlanningData } | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [connected, setConnected] = useState<PlanningSnapshot | null>(null);
  const [capabilities, setCapabilities] = useState<ProviderCapabilities | null>(null);
  const [account, setAccount] = useState<AccountRecord | null>(null);
  const [viewingSaved, setViewingSaved] = useState(false);
  const [proposal, setProposal] = useState<RevisionProposal | null>(null);
  const [notice, setNoticeState] = useState<string | null>(null);
  const noticeRevision = useRef(0);
  const sharedReadNotice = useRef<{ contextKey: string; revision: number } | null>(null);
  const setNotice = useCallback((next: Parameters<typeof setNoticeState>[0]) => {
    noticeRevision.current++;
    setNoticeState(next);
  }, []);
  const [providerRefresh, setProviderRefresh] = useState<RequestFeedback | null>(null);
  const [settledProviderRefresh, setSettledProviderRefresh] = useState(0);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine !== false);
  const [accountSave, setAccountSave] = useState<RequestFeedback | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ key: string; userId: string | undefined; text: string; intentRevision?: number } | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [scheduleReadRevision, setScheduleReadRevision] = useState<{ contextKey: string; token: string } | null>(null);
  const [query, setQuery] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [paste, setPaste] = useState("");
  const [selectedDate, setSelectedDate] = useState<{ context: string; date: string } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("itinerary");
  const [setupExpanded, setSetupExpanded] = useState(false);
  const [desktop, setDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth > 1100);
  const [showLineup, setShowLineup] = useState(desktop);
  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [lineupView, setLineupView] = useState<"position" | "player">("position");
  // Each Optimize click replays the by-position animation; the plan itself is already computed.
  const [optimizeRuns, setOptimizeRuns] = useState(0);
  // Plan details is its own view next to By position / By player / Itinerary.
  const [planTab, setPlanTab] = useState(false);
  const [benchOpen, setBenchOpen] = useState(true);
  useEffect(() => {
    const resize = () => setDesktop(window.innerWidth > 1100);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const [reviewedInputs, setReviewedInputs] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [ownTeams, setOwnTeams] = useState<OwnTeam[]>([]);
  const [savedJournal] = useState(() => {
    try { const raw = typeof window === "undefined" ? null : sessionStorage.getItem(WORKSPACE_PRESERVATION_JOURNAL);
      return { raw, value: raw ? unpackPlanningSnapshots(JSON.parse(raw)) as { backup: WorkspacePreservation; expected: PreservedKey[]; exported: boolean; restored: boolean } : null };
    } catch { return { raw: "unreadable", value: null }; }
  });
  const journalRaw = useRef(savedJournal.raw);
  const localWrites = useRef<Promise<void>>(Promise.resolve());
  const [preservation, setPreservation] = useState<{ phase: "idle" | "preparing" | "held" | "testing" | "restoring" | "invalid"; text: string }>({ phase: savedJournal.raw !== null ? "invalid" : "idle", text: savedJournal.raw !== null ? "Saved preservation session found. Normal writers are paused; restore with the original account and context." : "" });
  const preservationRef = useRef({ phase: preservation.phase, backup: savedJournal.value?.backup ?? null as WorkspacePreservation | null,
    expected: savedJournal.value?.expected ?? [] as PreservedKey[], lease: null as { release: () => void } | null, exported: savedJournal.value?.exported ?? false, restored: savedJournal.value?.restored ?? false });
  const preservationPhaseRef = useRef(preservation.phase);
  preservationPhaseRef.current = preservation.phase;
  const skipRestoredPersist = useRef<PlanningWorkspace | null>(null);
  const [otherWritersExcluded, setOtherWritersExcluded] = useState(false);
  const pendingRequests = useRef(new Set<Promise<Response>>());
  const accountOperations = useRef(new Set<Promise<void>>());
  const uncertainRequest = useRef(false);
  const [networkSuspended, setNetworkSuspended] = useState(savedJournal.raw !== null);
  const planHeld = preservation.phase !== "idle" && preservation.phase !== "testing";
  const trackedFetch = useCallback((url: string, options?: RequestInit) => {
    if (preservationRef.current.phase !== "idle" && preservationRef.current.phase !== "testing") return Promise.reject(new Error("Preservation has suspended application requests."));
    const request = fetch(url, options);
    pendingRequests.current.add(request);
    void request.then(() => pendingRequests.current.delete(request), () => {
      pendingRequests.current.delete(request);
      if (options?.method === "PUT" || url.endsWith("/access") || url.endsWith("/provider")) uncertainRequest.current = true;
    });
    return request;
  }, []);
  const history = useRef<PlanningWorkspace[]>([]);
  const workspaceElement = useRef<HTMLDivElement>(null);
  const providerAbort = useRef<AbortController | null>(null);
  const providerPending = useRef<{ key: string; userId: string; promise: Promise<boolean> } | null>(null);
  const providerSchedule = useRef<ProviderRefreshSchedule | null>(null);
  const scheduleFor = useCallback((key: string, userId: string | undefined) => {
    if (providerSchedule.current?.key !== key || providerSchedule.current.userId !== userId) providerSchedule.current = { key, userId, nextAutoAt: 0, cooldownUntil: 0, delay: PROVIDER_REFRESH_INTERVAL, blocked: false };
    return providerSchedule.current;
  }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  const accountSaveRequest = useRef<{ key: string; userId: string } | null>(null);
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
  const readOnlySaved = planHeld || viewingSaved || (workspace.context.provider !== "manual" && !canSync && Boolean(account?.snapshot || workspace.roster.length));
  const readOnlyInert = readOnlySaved ? { inert: "true" as unknown as boolean } : {};

  useEffect(() => {
    if (savedJournal.raw !== null) return;
    const saved = readWorkspace(window.localStorage);
    if (saved) { dateRangeOrigin.current = "restored"; history.current = readWorkspaceHistory(window.localStorage, saved); setWorkspace(saved); }
    setHydrated(true);
  }, [savedJournal]);
  useEffect(() => {
    if (savedJournal.raw === null || !user?.id) return;
    let cancelled = false;
    void (async () => {
      const journal = savedJournal.value;
      if (!journal?.backup) throw new Error("The original browser journal is unreadable. Keep the downloaded backup; recovery remains held.");
      await validatePreservation(journal.backup, user.id, journal.backup.contextKey);
      if (!Array.isArray(journal.expected) || journal.expected.length !== journal.backup.local.length
        || journal.expected.some((entry, index) => entry.key !== journal.backup.local[index].key || entry.value !== null && typeof entry.value !== "string")) throw new Error("The original browser journal has an invalid storage scope.");
      if (sessionStorage.getItem(WORKSPACE_PRESERVATION_JOURNAL) !== savedJournal.raw) throw new Error("Preservation journal changed outside this writer.");
      assertPreservedKeys(localStorage, journal.expected);
      if (cancelled) return;
      // Show the validated original backup while recovery is held; never adopt fresh storage as this writer's state.
      history.current = journal.backup.history;
      dateRangeOrigin.current = "restored";
      setWorkspace(journal.backup.workspace);
      setSelectedDate(journal.backup.view.selectedDate); setSelectedPlayer(journal.backup.view.selectedPlayer); setTab(journal.backup.view.tab as Tab);
      setHydrated(true);
      setPreservation({ phase: "invalid", text: "Saved preservation session found. Original backup shown; normal writers are paused. Restore with the original account and context." });
    })().catch(error => { if (!cancelled) setPreservation({ phase: "invalid", text: message(error) }); });
    return () => { cancelled = true; };
  }, [savedJournal, user?.id]);
  const persistJournal = () => {
    const held = preservationRef.current;
    if (!held.backup) throw new Error("The original preservation backup is missing.");
    if (sessionStorage.getItem(WORKSPACE_PRESERVATION_JOURNAL) !== journalRaw.current) throw new Error("Preservation journal changed outside this writer.");
    const raw = JSON.stringify(packPlanningSnapshots({ backup: held.backup, expected: held.expected, exported: held.exported, restored: held.restored }));
    sessionStorage.setItem(WORKSPACE_PRESERVATION_JOURNAL, raw); journalRaw.current = raw;
  };
  const persistLocal = useCallback((write: () => string | null | void) => {
    if (preservationRef.current.phase === "idle" && !navigator.locks) {
      try { setNotice(write() ?? null); } catch (error) { setNotice(message(error)); }
      return Promise.resolve();
    }
    const operation = localWrites.current.then(async () => {
      const held = preservationRef.current;
      if (held.phase !== "idle" && held.phase !== "testing") return;
      const run = async () => {
        if (held.phase !== "idle" && held.phase !== "testing") return;
        const previous = held.expected;
        let previousHash = "";
        if (held.phase === "testing") {
          if (!held.lease || !held.backup || held.backup.principalId !== providerRef.current.userId || held.backup.contextKey !== workspaceContextKey(providerRef.current.context)) throw new Error("Preservation identity changed. Restore before continuing.");
          assertPreservedKeys(localStorage, previous); previousHash = await preservationChecksum(previous);
          if (held.phase !== "testing") return;
        }
        const error = write();
        if (held.phase === "testing") {
          held.expected = readPreservedKeys(localStorage, previous.map(entry => entry.key));
          try { persistJournal(); } catch (journalError) { restorePreservedKeys(localStorage, previous, held.expected); held.expected = previous; throw journalError; }
          const nextHash = await preservationChecksum(held.expected);
          if (nextHash !== previousHash) await preservationRequest("local_ack", held.backup!, { checksum: held.backup!.checksum, previousLocalHash: previousHash, localHash: nextHash });
        }
        if (error) throw new Error(error);
      };
      if (held.phase === "testing") await run(); else await withWorkspaceWriter(navigator.locks, run);
    });
    localWrites.current = operation.catch(error => {
      setNotice(message(error)); const held = preservationRef.current;
      if (held.phase !== "idle") { held.phase = "invalid"; setPreservation({ phase: "invalid", text: message(error) }); }
    });
    return localWrites.current;
  }, []);
  useEffect(() => {
    if (workspace === skipRestoredPersist.current) { skipRestoredPersist.current = null; return; }
    if (hydrated) void persistLocal(() => workspaceRef.current === workspace ? writeWorkspace(window.localStorage, workspace, history.current) : null);
  }, [hydrated, workspace, persistLocal]);
  useEffect(() => {
    const held = preservationRef.current;
    // Development effect replay retires this same ref before setting it up again.
    if (preservationPhaseRef.current === "idle" && savedJournal.raw === null && !held.backup) held.phase = "idle";
    return () => { held.phase = "invalid"; held.lease?.release(); held.lease = null; };
  }, [savedJournal]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      const held = preservationRef.current;
      if (held.phase !== "idle" && (!event.key || held.expected.some(entry => entry.key === event.key))) {
        held.phase = "invalid"; setPreservation({ phase: "invalid", text: "Another storage writer changed this workspace. Nothing may be overwritten; keep the backup." });
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  const edit = useCallback((change: (current: PlanningWorkspace) => PlanningWorkspace, rangeOrigin: "custom" | "current" = "custom") => setWorkspace((current) => {
    if (readOnlySaved) return current;
    let next = change(current);
    if (next.context.timeZone !== current.context.timeZone && next.context.startDate === current.context.startDate
      && next.context.endDate === current.context.endDate && ["default", "current"].includes(dateRangeOrigin.current)) {
      const range = currentPlanningRange(new Date(), next.context.timeZone);
      next = { ...next, context: { ...next.context, startDate: range.startDate, endDate: range.endDate } };
      rangeOrigin = "current";
    }
    const held = preservationRef.current;
    if (held.phase === "testing" && workspaceContextKey(next.context) !== held.backup?.contextKey) {
      held.phase = "invalid"; setPreservation({ phase: "invalid", text: "Context changes are held during preservation. Restore the original first." }); return current;
    }
    const changedContext = workspaceContextKey(next.context) !== workspaceContextKey(current.context);
    let restoredContext = false;
    if (changedContext) {
      const saved = readWorkspace(window.localStorage, next.context);
      if (saved) { next = saved; restoredContext = true; dateRangeOrigin.current = "restored"; }
      else if (next.context.provider !== current.context.provider || next.context.leagueId !== current.context.leagueId || next.context.teamId !== current.context.teamId || next.context.seasonId !== current.context.seasonId) next = { ...next, managerRuleOverrides: {}, ...(next.context.provider !== "manual" ? { roster: [], manualPlayers: [], lockedAssignments: [] } : {}) };
    }
    if (next !== current) {
      if (!restoredContext) {
        if (next.context.startDate !== current.context.startDate || next.context.endDate !== current.context.endDate || next.context.timeZone !== current.context.timeZone)
          dateRangeOrigin.current = rangeOrigin;
      }
      history.current = changedContext ? readWorkspaceHistory(window.localStorage, next) : [...history.current.slice(-(WORKSPACE_HISTORY_LIMIT - 1)), current];
      if (next.context.provider === "manual") next = { ...next, context: { ...next.context, asOf: new Date().toISOString() } };
    }
    return next;
  }), [readOnlySaved]);
  const editIntent = useCallback((change: (intent: PlanIntent) => PlanIntent) => edit((current) => ({ ...current, intent: { ...change(current.intent), revision: current.intent.revision + 1 } })), [edit]);
  const undo = () => {
    if (readOnlySaved) return;
    history.current = history.current.filter(entry => workspaceContextKey(entry.context) === workspaceContextKey(workspace.context));
    const previous = history.current.pop();
    if (!previous) return;
    setWorkspace(current => {
      const keys = ["provider", "seasonId", "leagueId", "teamId", "startDate", "endDate", "timeZone"] as const;
      const sameContext = keys.every(key => previous.context[key] === current.context[key]);
      const authority = connectedRef.current;
      const currentAuthority = sameContext && current.context.provider !== "manual" && authority
        && keys.every(key => authority.context[key] === current.context[key]);
      const next = currentAuthority ? retainProviderInputs(previous, authority)
        : sameContext ? { ...previous, context: { ...previous.context, asOf: current.context.asOf } } : previous;
      return { ...next, intent: { ...next.intent, revision: current.intent.revision + 1 } };
    });
  };
  const contextKey = `${workspace.context.seasonId}:${workspace.context.startDate}:${workspace.context.endDate}:${workspace.context.timeZone}`;
  const accountKey = workspaceContextKey(workspace.context);
  const data = loadedData?.contextKey === contextKey ? loadedData.data : null;
  useEffect(() => {
    const held = preservationRef.current;
    if (held.backup && (held.backup.principalId !== user?.id || held.backup.contextKey !== accountKey)) {
      held.phase = "invalid"; setPreservation({ phase: "invalid", text: "Account or context changed. Keep the original backup; restoration requires its original principal and context." });
    }
  }, [accountKey, user?.id]);
  const refreshFeedback = providerRefresh?.key === accountKey && providerRefresh.userId === user?.id ? providerRefresh : null;
  const refreshUnavailable = viewingSaved ? "Saved inputs are read-only. Continue manually to work with this saved plan."
    : !user?.id ? "Sign in to check access for provider synchronization."
      : !canSync ? checkingAccess ? "Checking access for provider synchronization…" : accessError ? "Provider refresh is disabled until access can be verified. Try again shortly." : PROVIDER_SYNC_UPSELL + " Your account connection is unchanged."
        : !online ? "You are offline. Reconnect to refresh provider inputs; your selected plan is preserved."
          : !workspace.context.teamId.trim() || workspace.context.teamId === "manual" ? "Select an owned team before refreshing provider inputs." : null;
  const refreshBusy = !refreshUnavailable && refreshFeedback?.state === "busy";
  const saveFeedback = accountSave?.key === accountKey && accountSave.userId === user?.id ? accountSave : null;
  const saveBusy = saveFeedback?.state === "busy";
  const localFeedback = actionFeedback?.key === accountKey && actionFeedback.userId === user?.id
    && (actionFeedback.intentRevision === undefined || actionFeedback.intentRevision === workspace.intent.revision) ? actionFeedback.text : null;
  const undoUnavailable = readOnlySaved ? "Saved inputs are read-only." : !history.current.some(entry => workspaceContextKey(entry.context) === accountKey) ? "No edits to undo." : null;
  useEffect(() => { accountSaveRequest.current = null; setAccountSave(null); return () => { accountSaveRequest.current = null; }; }, [accountKey, user?.id]);
  useEffect(() => { setSelectedPlayer(null); setQuery(""); setCandidateSearch(""); }, [accountKey, user?.id]);
  useEffect(() => {
    if (networkSuspended) return;
    const controller = new AbortController();
    let requestGeneration = 0;
    setAccess(null); setAccessError(null); setCheckingAccess(true);
    const load = async () => {
      if (navigator.onLine === false || preservationRef.current.phase !== "idle") return;
      const generation = ++requestGeneration;
      const current = () => !controller.signal.aborted && generation === requestGeneration;
      try {
        const headers = await authHeaders(); if (!current()) return;
        const response = await trackedFetch("/api/v1/roster-schedule-optimizer/access", { signal: controller.signal, headers });
        const body = response.ok ? await response.json() : null;
        if (current()) {
          setCheckingAccess(false);
          setAccess((body?.data ?? null) as Access | null);
          setAccessError(!response.ok && user?.id ? "Provider synchronization is unavailable because in-season access could not be verified. Your account connection is unchanged; try again shortly." : null);
        }
      } catch { if (current()) { setCheckingAccess(false); setAccess(null); setAccessError(user?.id ? "Provider synchronization is unavailable because access could not be checked. Your account connection is unchanged; try again shortly." : null); } }
    };
    void load();
    const visible = () => { if (document.visibilityState === "visible" && navigator.onLine !== false) void load(); };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("online", visible);
    const timer = setInterval(visible, 5 * 60_000);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", visible); window.removeEventListener("online", visible); };
  }, [user?.id, networkSuspended, trackedFetch]);
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
    if (!hydrated || networkSuspended) return;
    const controller = new AbortController(); setAccount(null);
    const { provider, seasonId, leagueId, teamId, startDate, endDate } = workspace.context;
    const params = new URLSearchParams({ provider, seasonId: String(seasonId), leagueId, teamId, startDate, endDate });
    authHeaders().then((headers) => { if (controller.signal.aborted) return null; return trackedFetch(`/api/v1/roster-schedule-optimizer/workspace?${params}`, { signal: controller.signal, headers }); })
      .then(async (response) => response?.ok ? unpackPlanningSnapshots(await response.json()).data as AccountRecord | null : null)
      .then((saved) => { if (!controller.signal.aborted) setAccount(saved); }).catch(() => undefined);
    return () => controller.abort();
  }, [hydrated, accountKey, user?.id, networkSuspended, trackedFetch]);
  const providerRef = useRef({ context: workspace.context, intent: workspace.intent, overrides: workspace.managerRuleOverrides, locks: workspace.lockedAssignments, userId: user?.id });
  providerRef.current = { context: workspace.context, intent: workspace.intent, overrides: workspace.managerRuleOverrides, locks: workspace.lockedAssignments, userId: user?.id };
  const connectedRef = useRef(connected);
  connectedRef.current = connected;
  const providerAuthorityRef = useRef<PreservationProvider>({ connected, capabilities, proposal, refresh: providerRefresh, schedule: providerSchedule.current, settledRefresh: settledProviderRefresh, lastUpdated });
  providerAuthorityRef.current = { connected, capabilities, proposal, refresh: providerRefresh, schedule: providerSchedule.current, settledRefresh: settledProviderRefresh, lastUpdated };
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const refreshProvider = useCallback((signal?: AbortSignal): Promise<boolean> => {
    const { context, userId } = providerRef.current;
    if (!["idle", "testing"].includes(preservationRef.current.phase) || viewingSaved || context.provider === "manual" || !canSync || !userId || !context.teamId.trim() || context.teamId === "manual" || signal?.aborted || navigator.onLine === false) return Promise.resolve(false);
    const requestKey = workspaceContextKey(context);
    if (providerAbort.current && !providerAbort.current.signal.aborted && providerPending.current?.key === requestKey && providerPending.current.userId === userId) return providerPending.current.promise;
    const schedule = scheduleFor(requestKey, userId);
    if (Date.now() < schedule.cooldownUntil) {
      setProviderRefresh({ key: requestKey, userId, state: "error", text: `Provider refresh is paused until ${new Date(schedule.cooldownUntil).toLocaleTimeString()}. Your selected plan is preserved.` });
      return Promise.resolve(false);
    }
    if (signal && schedule.blocked) return Promise.resolve(false);
    providerAbort.current?.abort();
    const controller = new AbortController();
    providerAbort.current = controller;
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const currentRequest = () => !controller.signal.aborted && userId === providerRef.current.userId && requestKey === workspaceContextKey(providerRef.current.context);
    const busy: RequestFeedback = { key: requestKey, userId, state: "busy", text: "Refreshing provider inputs…" };
    providerAuthorityRef.current.refresh = busy; setProviderRefresh(busy);
    const pending = (async () => { try {
      const headers = await authHeaders(); if (controller.signal.aborted || userId !== providerRef.current.userId) return false;
      const response = await trackedFetch("/api/v1/roster-schedule-optimizer/provider", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ provider: context.provider, teamId: context.teamId, startDate: context.startDate, endDate: context.endDate, timeZone: context.timeZone }), signal: controller.signal });
      const body = await response.json(); if (!currentRequest()) return false;
      if (typeof body.retryAfterSeconds === "number" && Number.isFinite(body.retryAfterSeconds) && body.retryAfterSeconds >= 0) schedule.cooldownUntil = Math.max(schedule.cooldownUntil, Date.now() + body.retryAfterSeconds * 1000);
      else if (response.status === 429 || body.code === "yahoo_rate_limited") schedule.cooldownUntil = Math.max(schedule.cooldownUntil, Date.now() + PROVIDER_REFRESH_INTERVAL);
      schedule.blocked = response.status === 401 || response.status === 403 || body.code === "yahoo_reauth_required" || body.code === "yahoo_access_denied";
      if (!response.ok || !body.success) throw new Error(requestErrorMessage(body.error, "Provider refresh failed."));
      const current = providerRef.current.context;
      if (controller.signal.aborted || userId !== providerRef.current.userId || requestKey !== workspaceContextKey(current)) return false;
      const provided = body.snapshot as PlanningSnapshot;
      const next = provided && Array.isArray(provided.forecasts) && body.bridgeForecasts
        ? { ...provided, forecasts: [...provided.forecasts, ...expandBridgeForecasts(body.bridgeForecasts, provided)] } : provided;
      if (preservationRef.current.backup && workspaceContextKey(next.context) !== preservationRef.current.backup.contextKey) {
        preservationRef.current.phase = "invalid"; setPreservation({ phase: "invalid", text: "Provider context differs from the admitted backup. The original plan was kept." });
        throw new Error("Provider context differs from the admitted backup.");
      }
      if (!next?.context) throw new Error("Provider refresh returned no inputs. Try again or continue manually.");
      // The adapter prefers the authoritative league zone; the original-request guard above still includes the client zone.
      if (workspaceContextKey({ ...next.context, timeZone: context.timeZone }) !== requestKey) throw new Error("Provider inputs do not match the selected league, team or timeframe. Review the context and refresh again.");
      const previous = connectedRef.current;
      const sameContext = previous && ["provider", "seasonId", "leagueId", "teamId", "startDate", "endDate", "timeZone"].every((key) => previous.context[key as keyof typeof previous.context] === next.context[key as keyof typeof next.context]);
      const unchanged = sameContext && JSON.stringify({ ...previous, id: null, context: { ...previous.context, asOf: null } }) === JSON.stringify({ ...next, id: null, context: { ...next.context, asOf: null } });
      const overrides = providerRef.current.overrides ?? {};
      setConnected(next); connectedRef.current = next; setCapabilities(body.capabilities as ProviderCapabilities); setWorkspace((current) => ({ ...retainProviderInputs(current, next), context: next.context }));
      const nextProposal = reconcileIntent(supplementProviderRules(next, overrides, providerRef.current.locks).snapshot, providerRef.current.intent, sameContext ? supplementProviderRules(previous, overrides, providerRef.current.locks).snapshot : undefined);
      const refreshedAt = new Date().toISOString();
      setProposal(nextProposal); setNotice(null); setLastUpdated(refreshedAt);
      const complete = !body.code && body.capabilities?.roster !== false && body.capabilities?.availability !== false;
      schedule.key = workspaceContextKey(next.context);
      schedule.delay = complete ? PROVIDER_REFRESH_INTERVAL : Math.min(schedule.delay * 2, 30 * 60_000);
      schedule.nextAutoAt = Math.max(Date.now() + schedule.delay, schedule.cooldownUntil);
      const feedback: RequestFeedback = { key: schedule.key, userId, state: complete ? "success" : "partial", text: complete ? unchanged ? "Provider refresh completed. Inputs are unchanged; selected moves were kept." : "Provider inputs refreshed. Selected moves were kept." : "Provider inputs partly refreshed. Selected moves were kept; some provider facts remain unverified." };
      providerAuthorityRef.current = { ...providerAuthorityRef.current, connected: next, capabilities: body.capabilities, proposal: nextProposal, refresh: feedback, schedule, lastUpdated: refreshedAt };
      setProviderRefresh(feedback);
      return complete;
    } catch (error) {
      if (currentRequest()) {
        schedule.delay = Math.min(schedule.delay * 2, 30 * 60_000);
        schedule.nextAutoAt = Math.max(Date.now() + schedule.delay, schedule.cooldownUntil);
        const feedback: RequestFeedback = { key: requestKey, userId, state: "error", text: message(error) };
        providerAuthorityRef.current = { ...providerAuthorityRef.current, refresh: feedback, schedule }; setProviderRefresh(feedback);
      }
      return false;
    }
    finally {
      signal?.removeEventListener("abort", abort);
      if (providerAbort.current === controller) {
        providerAbort.current = null; providerPending.current = null;
        if (currentRequest()) { providerAuthorityRef.current.settledRefresh += 1; setSettledProviderRefresh(current => current + 1); }
        if (controller.signal.aborted) setProviderRefresh(current => current?.key === requestKey && current.userId === userId ? null : current);
      }
    } })();
    providerPending.current = { key: requestKey, userId, promise: pending };
    return pending;
  }, [canSync, viewingSaved, scheduleFor, trackedFetch]);
  useEffect(() => {
    if (networkSuspended || viewingSaved || workspace.context.provider === "manual" || !canSync || !user?.id || !workspace.context.teamId.trim() || workspace.context.teamId === "manual") return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let refreshing = false;
    const clearTimer = () => { if (timer) clearTimeout(timer); timer = null; };
    const scheduleNext = () => {
      clearTimer();
      if (controller.signal.aborted) return;
      const schedule = scheduleFor(accountKey, providerRef.current.userId);
      if (!canAutoUpkeep || schedule.blocked || document.visibilityState !== "visible" || navigator.onLine === false) return;
      timer = setTimeout(() => void refresh(), Math.min(2_147_483_647, Math.max(0, Math.max(schedule.nextAutoAt, schedule.cooldownUntil) - Date.now())));
    };
    const refresh = async () => {
      clearTimer();
      if (controller.signal.aborted || document.visibilityState !== "visible" || navigator.onLine === false || refreshing) return;
      const schedule = scheduleFor(accountKey, providerRef.current.userId);
      if (schedule.blocked) return;
      if (Date.now() < Math.max(schedule.nextAutoAt, schedule.cooldownUntil)) { scheduleNext(); return; }
      refreshing = true;
      await refreshProvider(controller.signal);
      refreshing = false;
      scheduleNext();
    };
    void refresh();
    const availability = () => { clearTimer(); if (document.visibilityState === "visible" && navigator.onLine !== false) void refresh(); };
    document.addEventListener("visibilitychange", availability);
    window.addEventListener("online", availability); window.addEventListener("offline", availability);
    return () => { controller.abort(); providerAbort.current?.abort(); clearTimer(); document.removeEventListener("visibilitychange", availability); window.removeEventListener("online", availability); window.removeEventListener("offline", availability); };
  }, [accountKey, user?.id, workspace.context.provider, workspace.context.teamId, canSync, canAutoUpkeep, viewingSaved, refreshProvider, scheduleFor, settledProviderRefresh, networkSuspended]);
  useEffect(() => {
    const current = connected?.context;
    const connectedKey = current ? workspaceContextKey(current) : null;
    if (connectedKey === accountKey) return;
    setConnected(null); setCapabilities(null); setProposal(null);
  }, [accountKey]);

  const connectedInput = [connected, workspace.context.provider !== "manual" ? account?.snapshot : null].find(input => input && ["provider", "leagueId", "teamId", "seasonId", "startDate", "endDate", "timeZone"].every(key => input.context[key as keyof typeof input.context] === workspace.context[key as keyof typeof workspace.context])) ?? null;
  const usingRetainedRoster = workspace.context.provider !== "manual" && !connectedInput && !viewingSaved && !!workspace.roster.length;
  const yahooEligibilityIds = useMemo(() => [...new Set([...workspace.roster.map(entry => entry.playerId),
    ...(data?.players ?? []).map(player => player.id), ...workspace.manualPlayers.map(player => player.id)])]
    .filter(id => /^[1-9]\d{0,14}$/.test(id)), [workspace.roster, data?.players, workspace.manualPlayers]);
  const yahooEligibility = useYahooEligibility(workspace.context.seasonId, yahooEligibilityIds.slice(0, YAHOO_ELIGIBILITY_READ_LIMIT),
    workspace.context.provider === "yahoo" && usingRetainedRoster && !!data && !networkSuspended, settledProviderRefresh);
  const players = useMemo(() => [...new Map([...(data?.players ?? []), ...workspace.manualPlayers, ...(connectedInput?.players ?? []), ...(viewingSaved ? account?.snapshot?.players ?? [] : [])].map((player) => {
    const canonical = data?.players.find(row => row.id === player.id);
    const sameTeam = canonical?.nhlId === player.nhlId && canonical?.teamAbbreviation === player.teamAbbreviation;
    const current = { ...player, eligibilityVerified: player.eligibilityVerified ?? canonical?.eligibilityVerified,
      nhlTeamId: canonical ? sameTeam ? canonical.nhlTeamId : undefined : player.nhlTeamId,
      rosterRevision: canonical ? sameTeam ? canonical.rosterRevision : undefined : player.rosterRevision };
    return [player.id, usingRetainedRoster ? cachedYahooPlayer(current, yahooEligibility.receipt, workspace.context.seasonId) : current];
  })).values()], [data?.players, workspace.manualPlayers, connectedInput?.players, viewingSaved, account?.snapshot?.players, usingRetainedRoster, yahooEligibility.receipt, workspace.context.seasonId]);
  const supplemented = useMemo(() => connectedInput ? supplementProviderRules(connectedInput, workspace.managerRuleOverrides ?? {}, workspace.lockedAssignments) : null, [connectedInput, workspace.managerRuleOverrides, workspace.lockedAssignments]);
  const inputSnapshot = useMemo<PlanningSnapshot | null>(() => {
    if (!hydrated) return null;
    if (viewingSaved) return account?.snapshot ?? null;
    if (workspace.context.provider !== "manual") {
      if (supplemented) {
        const provider = supplemented.snapshot;
        const opponent = workspace.opponent ? {
          roster: provider.opponent?.roster ?? workspace.opponent.roster,
          realized: { ...provider.opponent?.realized, ...workspace.opponent.realized },
          remaining: workspace.opponent.remaining === null ? provider.opponent?.remaining ?? null
            : { ...provider.opponent?.remaining, ...workspace.opponent.remaining },
        } : provider.opponent;
        const manualTotals = { realized: { ...provider.realized, ...workspace.realized }, opponent };
        const changed = fingerprint(manualTotals) !== fingerprint({ realized: provider.realized, opponent: provider.opponent });
        const combined = changed ? { ...provider, ...manualTotals, id: `${provider.id}:matchup:${fingerprint(manualTotals)}` } : provider;
        return combined;
      }
      const retained = retainedScheduleSnapshot(workspace, { players: workspace.manualPlayers, games: [], forecasts: [], evidence: {} }, workspace.context.asOf);
      return retained ? withCachedYahooEligibility({ ...retained, id: `${retained.id}:${fingerprint(workspace)}` }, yahooEligibility.receipt) : null;
    }
    return { id: `manual:${fingerprint(workspace)}`, context: workspace.context, players: workspace.manualPlayers,
      roster: workspace.roster, games: [], forecasts: [], rules: workspace.rules,
      lockedAssignments: workspace.lockedAssignments ?? [], realized: workspace.realized, opponent: workspace.opponent, evidence: {} };
  }, [hydrated, workspace, supplemented, viewingSaved, account, yahooEligibility.receipt]);
  const executionOptions: CurrentPlanningOptions = {
    allowRead: !networkSuspended && online && !planHeld,
    publicContext: !viewingSaved && (workspace.context.provider === "manual" || !supplemented),
    yahooEligibility: usingRetainedRoster ? yahooEligibility.receipt : null,
    refreshKey: JSON.stringify([accountKey, user?.id, viewingSaved, scheduleReadRevision?.contextKey === contextKey ? scheduleReadRevision.token : null]),
  };
  const { result: rawResult, error: planningError, loading: planningLoading, displaySnapshot, data: currentData, healthyReserves } = useRosterPlanning(inputSnapshot, workspace.intent, executionOptions);
  // Only this generation's admitted view reaches numeric/evidence consumers.
  // The original saved/provider snapshot remains available for preservation.
  const snapshot = useMemo(() => displaySnapshot ?? (inputSnapshot ? capacityPlanningSnapshot(inputSnapshot) : null), [displaySnapshot, inputSnapshot]);
  const result = rawResult && rawResult.snapshotId === inputSnapshot?.id && rawResult.intentRevision === workspace.intent.revision ? rawResult : null;
  useEffect(() => {
    setLoadingData(planningLoading);
    if (currentData && !networkSuspended) {
      setLoadedData({ contextKey, data: currentData });
      setLastUpdated(displaySnapshot?.context.asOf ?? null);
      if (sharedReadNotice.current?.contextKey === contextKey && sharedReadNotice.current.revision === noticeRevision.current) setNotice(null);
      sharedReadNotice.current = null;
    }
  }, [currentData, contextKey, displaySnapshot, planningLoading, networkSuspended, setNotice]);
  const activeProposal = useMemo(() => {
    if (!snapshot || !connected || connectedInput !== connected || viewingSaved) return null;
    const current = reconcileIntent(snapshot, workspace.intent);
    const changes = proposal?.snapshotId === snapshot.id ? proposal.issues.filter(issue => issue.stepId === null) : [];
    return { ...current, issues: [...changes, ...current.issues] };
  }, [snapshot, connected, connectedInput, workspace.intent, proposal, viewingSaved]);
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
  const earliestSelectedTime = Math.min(...workspace.intent.steps.map(step => Date.parse(step.at)));
  const nextSelectedStep = workspace.intent.steps.find(step => Date.parse(step.at) === earliestSelectedTime && step.dependsOn.length === 0);
  const nextSelectedReview = readOnlySaved ? "Saved plan: continue manually before changing or following these steps."
    : !nextSelectedStep ? "Review action times and prerequisites to identify the next move."
      : earliestSelectedTime < Date.now() ? "Selected action time has passed; review the plan before acting."
        : !actionableRulesReviewed || rules.unsupported.length > 0 || !result?.selected.legal || !result.selected.budgetVerified ? "Review inputs and rule checks before acting."
          : nextSelectedStep.conditional ? "Recheck availability and clearance before this conditional move."
            : "Confirm this selected move with your provider.";
  const confirmUnavailable = readOnlySaved ? "Saved inputs are read-only." : !snapshot ? "Load planning data before confirming inputs." : !roster.length ? "Add roster players before confirming inputs." : inputsReviewed ? "Inputs are already confirmed for this session." : null;
  const categoryComparisonAvailable = rules.scoring.mode === "categories" && result?.selected.comparisonEligible === true;
  const lineupSuggestionReady = actionableRulesReviewed && Boolean(result?.selected.legal && result.selected.recommendation?.eligible
    && (!workspace.intent.steps.length || result.selected.budgetVerified));
  const scheduleDateCount = new Set(snapshot?.games.filter((game) => game.status !== "cancelled" && game.status !== "postponed").map((game) => game.date) ?? []).size;
  const activeSlotCount = expandActiveSlots(rules.rosterSlots).activeSlots.length;
  const utilizationCapacity = scheduleDateCount * activeSlotCount;
  const sharedSchedule = data?.evidence.schedule;
  const sharedForecasts = data?.evidence.forecasts;
  const sharedScheduleTime = sharedSchedule?.asOf && Number.isFinite(Date.parse(sharedSchedule.asOf))
    ? actionTime(sharedSchedule.asOf, workspace.context.timeZone) : "unknown";
  // Cache age advances on render; reader time and saved planning cutoffs retain their own meanings.
  const scheduleWarning = scheduleFreshnessWarning(sharedSchedule, data?.games ?? [], { ...workspace.context, asOf: new Date().toISOString() });
  const scheduleTimeLabel = sharedSchedule?.source === "roster_optimizer_team_games" ? "Cache received" : "Evidence timestamp";
  const dates = useMemo(() => datesBetween(workspace.context.startDate, workspace.context.endDate), [contextKey]);
  const canonicalRefreshToken = scheduleReadRevision?.contextKey === contextKey ? scheduleReadRevision.token : 0;
  const scheduleToday = useMemo(() => leagueDate(new Date().toISOString(), workspace.context.timeZone),
    // Context changes and explicit reloads advance this clock; expiry renders must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountKey, contextKey, workspace.context.timeZone, canonicalRefreshToken]);
  const remainingDates = dates.filter(date => date >= scheduleToday);
  const calendar = useCanonicalSchedule(remainingDates, workspace.context.seasonId, workspace.context.timeZone,
    hydrated && !networkSuspended, { source: "cache", weeks: data?.matchupWeeks ?? [] },
    canonicalRefreshToken);
  const scheduleComplete = snapshot?.evidence.schedule?.completeness === "complete";
  const gameSubtotal = (value: number | undefined) => value == null ? "—" : scheduleComplete ? number(value) : `${number(value)}+ known`;
  const currentRange = currentPlanningRange(new Date(), workspace.context.timeZone, currentProviderPeriod(connected, workspace.context, new Date()));
  useEffect(() => {
    if (!hydrated || networkSuspended || readOnlySaved || workspace.intent.steps.length || currentRange.source !== "provider"
      || !["default", "current"].includes(dateRangeOrigin.current)
      || currentRange.startDate === workspace.context.startDate && currentRange.endDate === workspace.context.endDate) return;
    edit(current => ({ ...current, context: { ...current.context, startDate: currentRange.startDate, endDate: currentRange.endDate } }), "current");
  }, [hydrated, networkSuspended, readOnlySaved, workspace.intent.steps.length, workspace.context.startDate, workspace.context.endDate,
    currentRange.source, currentRange.startDate, currentRange.endDate, edit]);
  const rangeTooLong = Date.parse(workspace.context.endDate) - Date.parse(workspace.context.startDate) > 366 * 86_400_000;
  const matchupWeeks = data?.matchupWeeks ?? [];
  const weekIndex = matchupWeeks.findIndex(week => week.startDate === workspace.context.startDate && week.endDate === workspace.context.endDate);
  const weekUnavailable = readOnlySaved ? "Saved inputs are read-only." : !matchupWeeks.length ? "No matchup weeks are available in the current schedule." : weekIndex < 0 ? "Select a listed matchup week to navigate." : matchupWeeks.length === 1 ? "Only one matchup week is available." : weekIndex === 0 ? "First matchup week; no previous week is available." : weekIndex === matchupWeeks.length - 1 ? "Last matchup week; no next week is available." : null;
  const selectWeek = (index: number) => { const week = matchupWeeks[index]; if (week) edit(current => ({ ...current, context: { ...current.context, startDate: week.startDate, endDate: week.endDate } })); };
  const today = leagueDate(new Date().toISOString(), workspace.context.timeZone);
  const displayContextKey = JSON.stringify([user?.id ?? null, workspaceContextKey(workspace.context)]);
  const displayDateStorageKey = `fhfh:rso:view-date:v1:${encodeURIComponent(displayContextKey)}`;
  useEffect(() => {
    if (!["idle", "testing"].includes(preservationRef.current.phase)) return;
    let storedDate: string | null = null;
    try { storedDate = localStorage.getItem(displayDateStorageKey); } catch { /* View preferences must not block planning. */ }
    setSelectedDate(current => current?.context === displayContextKey && dates.includes(current.date) ? current
      : storedDate && dates.includes(storedDate) ? { context: displayContextKey, date: storedDate } : null);
  }, [displayContextKey, displayDateStorageKey, dates]);
  const focusedDate = selectedDate?.context === displayContextKey && dates.includes(selectedDate.date) ? selectedDate.date : defaultScheduleDate(dates, today);
  const focusDate = (date: string) => {
    if (!dates.includes(date) || !["idle", "testing"].includes(preservationRef.current.phase)) return;
    setSelectedDate({ context: displayContextKey, date });
    void persistLocal(() => { localStorage.setItem(displayDateStorageKey, date); });
  };
  const preservationRequest = async (mode: string, backup?: WorkspacePreservation, extra: Record<string, string> = {}, body?: unknown) => {
    const userId = providerRef.current.userId;
    const context = backup?.workspace.context ?? workspaceRef.current.context;
    const key = workspaceContextKey(context);
    if (!userId || key !== workspaceContextKey(providerRef.current.context) || backup && backup.principalId !== userId) throw new Error("Preservation requires the original principal and exact context.");
    const params = new URLSearchParams({ ...Object.fromEntries(Object.entries(context).map(([name, value]) => [name, String(value)])), preservation: mode, ...extra });
    if (backup) params.set("receipt", backup.remote.receiptId);
    const headers = await authHeaders();
    if (providerRef.current.userId !== userId || workspaceContextKey(providerRef.current.context) !== key) throw new Error("Preservation context changed before dispatch.");
    const response = await fetch(`/api/v1/roster-schedule-optimizer/workspace?${params}`, { headers: { ...headers, "Content-Type": "application/json" }, ...(body ? { method: "PUT", body: JSON.stringify(packPlanningSnapshots(body)) } : {}) });
    const result = unpackPlanningSnapshots(await response.json());
    if (providerRef.current.userId !== userId || workspaceContextKey(providerRef.current.context) !== key) throw new Error("Preservation response belongs to a retired context.");
    if (!response.ok) throw new Error(requestErrorMessage(result.error, "Preservation could not be verified."));
    if (result.preservation?.principalId !== userId || result.preservation?.contextKey !== key) throw new Error("Authenticated preservation binding does not match.");
    return result;
  };
  const quiescePreservation = async () => {
    const held = preservationRef.current;
    held.phase = "preparing"; setPreservation({ phase: "preparing", text: "Finishing dispatched requests before preserving the plan…" });
    // Aborting a PUT cannot prove that the server stopped. Drain its whole save/acknowledgement operation.
    await Promise.allSettled([...pendingRequests.current, ...accountOperations.current, ...(providerPending.current ? [providerPending.current.promise] : []), localWrites.current]);
    if (uncertainRequest.current) throw new Error("A dispatched request has an uncertain server outcome. Preservation cannot be admitted.");
    setNetworkSuspended(true);
    providerAbort.current?.abort();
    if (!held.lease) held.lease = await acquirePreservationWriter(navigator.locks);
    if (held.backup) {
      if (sessionStorage.getItem(WORKSPACE_PRESERVATION_JOURNAL) !== journalRaw.current) throw new Error("Preservation journal changed outside this writer.");
      assertPreservedKeys(localStorage, held.expected);
    }
    else held.expected = readPreservedKeys(localStorage, preservationKeys(user!.id, workspaceRef.current.context));
  };
  const preservationFailure = (error: unknown) => {
    preservationRef.current.phase = "invalid";
    setPreservation({ phase: "invalid", text: message(error) });
  };
  const preparePreservation = async () => {
    try {
      if (!user?.id || viewingSaved || preservationRef.current.phase !== "idle") return;
      await quiescePreservation();
      const result = await preservationRequest("read");
      if (result.preservation.ownerVerified !== true) throw new Error("Actual server owner verification is missing.");
      const backup = await capturePreservation(localStorage, user.id, workspaceRef.current, history.current,
        { selectedDate, selectedPlayer, tab }, { receiptId: result.preservation.receiptId, row: result.preservation.row }, journalRaw.current, providerAuthorityRef.current);
      const sealed = await preservationRequest("seal", backup, { checksum: backup.checksum, localHash: await preservationChecksum(backup.local) });
      if (sealed.preservation.checksum !== backup.checksum || sealed.preservation.originalRowHash !== await preservationChecksum(backup.remote.row)) throw new Error("Independent server backup binding does not match.");
      assertPreservedKeys(localStorage, backup.local);
      const held = preservationRef.current;
      held.backup = backup; held.expected = backup.local; held.restored = false; held.phase = "held"; persistJournal();
      setAccount(result.data as AccountRecord | null);
      setPreservation({ phase: "held", text: backup.remote.row ? "Complete backup sealed. Download it before any protected planning. Older writers still require independent exclusion." : "Complete local backup sealed. Account saves are held: the original account record is absent and cannot be restored to absence." });
    } catch (error) { preservationFailure(error); }
  };
  const downloadPreservation = () => {
    const held = preservationRef.current;
    if (!held.backup || held.backup.principalId !== user?.id || held.backup.contextKey !== accountKey) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(held.backup, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "rso-preservation-backup.json"; link.click(); URL.revokeObjectURL(url);
    held.exported = true;
    try { persistJournal(); } catch (error) { preservationFailure(error); return; }
    setPreservation(current => ({ ...current, text: "Backup download requested. Verify the complete file was saved before starting the approved test." }));
  };
  const restorePreservation = async (imported?: WorkspacePreservation) => {
    try {
      const backup = imported ?? preservationRef.current.backup;
      if (!backup || !user?.id) return;
      await validatePreservation(backup, user.id, accountKey);
      if (!preservationRef.current.backup || preservationRef.current.backup.checksum !== backup.checksum || !journalRaw.current) throw new Error("The original browser journal is required. A fresh local read cannot authorize restoration.");
      await quiescePreservation();
      const held = preservationRef.current;
      const proof = await preservationRequest("verify", backup);
      if (proof.preservation.checksum !== backup.checksum || proof.preservation.originalRowHash !== await preservationChecksum(backup.remote.row)
        || proof.preservation.lastVersion !== proof.preservation.acknowledgedVersion || proof.preservation.localHash !== await preservationChecksum(held.expected)) throw new Error("Backup is not bound to the admitted writer's acknowledged state.");
      assertPreservedKeys(localStorage, held.expected);
      held.backup = backup; held.phase = "restoring"; setPreservation({ phase: "restoring", text: "Restoring the original account payload and local Undo state…" });
      let restoredAccount = proof.data as AccountRecord | null;
      if (backup.remote.row) {
        const restored = await preservationRequest("restore", backup, {}, { backup, expectedVersion: proof.preservation.lastVersion });
        if (!restored.preservation.restored || restored.preservation.checksum !== backup.checksum
          || preservationJson(restored.data.workspace) !== preservationJson(backup.remote.row.workspace)
          || preservationJson(restored.data.snapshot) !== preservationJson(backup.remote.row.snapshot)
          || restored.data.version !== proof.preservation.lastVersion + 1) throw new Error("Remote restoration proof is incomplete. Local state remains held.");
        await preservationRequest("ack", backup, { version: String(restored.data.version) });
        restoredAccount = restored.data;
      } else if (proof.preservation.row !== null) throw new Error("The originally absent account record is no longer absent. Nothing was deleted.");
      const previousLocalHash = await preservationChecksum(held.expected);
      restorePreservedKeys(localStorage, backup.local, held.expected);
      const original = JSON.parse(JSON.stringify(backup.workspace)) as PlanningWorkspace;
      history.current = JSON.parse(JSON.stringify(backup.history));
      skipRestoredPersist.current = original; setWorkspace(original);
      const provider = backup.provider;
      setConnected(provider?.connected ?? null); connectedRef.current = provider?.connected ?? null;
      setCapabilities(provider?.capabilities ?? null); setProposal(provider?.proposal ?? null); setProviderRefresh(provider?.refresh ?? null);
      providerSchedule.current = provider?.schedule ?? null; setSettledProviderRefresh(provider?.settledRefresh ?? 0); setLastUpdated(provider?.lastUpdated ?? null);
      providerAuthorityRef.current = provider ?? { connected: null, capabilities: null, proposal: null, refresh: null, schedule: null, settledRefresh: 0, lastUpdated: null };
      setSelectedDate(backup.view.selectedDate); setSelectedPlayer(backup.view.selectedPlayer); setTab(backup.view.tab as Tab); setAccount(restoredAccount); setViewingSaved(false);
      held.expected = backup.local; held.restored = true; held.phase = "held"; persistJournal();
      const restoredLocalHash = await preservationChecksum(backup.local);
      if (restoredLocalHash !== previousLocalHash) await preservationRequest("local_ack", backup, { checksum: backup.checksum, previousLocalHash, localHash: restoredLocalHash });
      setPreservation({ phase: "held", text: "Original local key values and absence, plan and Undo restored. Remote payload verified; its version/time may have advanced. Preservation remains held for final inspection." });
    } catch (error) { preservationFailure(error); }
  };
  const releasePreservation = async () => {
    try {
      const held = preservationRef.current;
      if (!held.backup || !held.restored) return;
      assertPreservedKeys(localStorage, held.backup.local);
      const proof = await preservationRequest("release", held.backup);
      if (!proof.preservation.released) throw new Error("Remote restoration release was not verified.");
      assertPreservedKeys(localStorage, held.backup.local);
      if (sessionStorage.getItem(WORKSPACE_PRESERVATION_JOURNAL) !== journalRaw.current) throw new Error("Preservation journal changed before release.");
      if (held.backup.session.value === null) sessionStorage.removeItem(WORKSPACE_PRESERVATION_JOURNAL); else sessionStorage.setItem(WORKSPACE_PRESERVATION_JOURNAL, held.backup.session.value);
      journalRaw.current = held.backup.session.value;
      held.lease?.release(); held.lease = null; held.backup = null; held.phase = "idle";
      setPreservation({ phase: "idle", text: "Original plan and Undo restoration verified. Normal planning resumed." }); setNetworkSuspended(false);
    } catch (error) { preservationFailure(error); }
  };
  const startProtectedPlanning = async () => {
    try {
      const held = preservationRef.current;
      if (!held.backup || !held.exported || !otherWritersExcluded || held.restored || !held.backup.remote.row || held.phase !== "held") return;
      const proof = await preservationRequest("verify", held.backup);
      if (proof.preservation.checksum !== held.backup.checksum || proof.preservation.lastVersion !== proof.preservation.acknowledgedVersion || proof.preservation.localHash !== await preservationChecksum(held.expected)) throw new Error("The original backup is not admitted for this writer.");
      assertPreservedKeys(localStorage, held.expected);
      held.phase = "testing"; setPreservation({ phase: "testing", text: "Protected planning active. Automatic readers are paused; selected changes and account saves remain bound to this backup. Restore before resuming normal use." });
    } catch (error) { preservationFailure(error); }
  };
  const matches = players.filter((player) => query.trim().length >= 2 && `${player.name} ${player.teamAbbreviation ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0, 20);
  const rosterIds = useMemo(() => new Set(roster.map((entry) => entry.playerId)), [roster]);
  const selectedManualCandidate = workspace.context.provider === "manual" && !readOnlySaved && selectedPlayer && !rosterIds.has(selectedPlayer) ? players.find((player) => player.id === selectedPlayer) : undefined;
  const resolvingName = workspace.unresolvedNames.find(name => name === query);
  const assignments = result?.selected.assignments ?? [];
  const contributions = useMemo(() => contributionLedger(snapshot, result?.selected ?? null, workspace.intent), [snapshot, result?.selected, workspace.intent]);
  const slotExpansion = useMemo(() => expandActiveSlots(rules.rosterSlots), [rules.rosterSlots]);
  const activeSlots = slotExpansion.activeSlots;
  // A readback of the no-move lineup (open slots, weakest droppable player); it runs no search of its own.
  const gapReport = useMemo(() => snapshot && result ? lineupGapReport(snapshot, workspace.intent, result.baseline) : null, [snapshot, result, workspace.intent]);
  const pointsFor = useMemo(() => {
    if (rules.scoring.mode !== "points" || !displaySnapshot || !result) return undefined;
    const byGame = new Map((result.selected.forecastInputs ?? []).map(row =>
      [`${row.playerId}:${row.gameId}`, gameForecastPoints(displaySnapshot, row)]));
    return (playerId: string, gameId: string): GameForecastPoints =>
      byGame.get(`${playerId}:${gameId}`) ?? { expected: null, ifStarts: null };
  }, [result, rules.scoring, displaySnapshot]);
  const goalieMinimum = result?.selected.goalie.required ?? rules.goalieMinimum.required;
  const addsLeft = rules.periods.find(period => typeof period.remaining === "number")?.remaining ?? null;
  const nameOf = (id: string) => players.find((player) => player.id === id)?.name ?? id;
  const timeZoneConfirmed = workspace.managerRuleOverrides?.timeZone === workspace.context.timeZone;
  const confirmTimeZone = (confirmed: boolean) => edit((current) => { const { timeZone: _previous, ...overrides } = current.managerRuleOverrides ?? {}; return { ...current, managerRuleOverrides: confirmed ? { ...overrides, timeZone: current.context.timeZone } : overrides }; });
  const goalieCreditedEntered = workspace.managerRuleOverrides?.goalieMinimum?.credited != null;
  const timeZoneItem = `Yahoo does not report a league time zone; planning uses ${workspace.context.timeZone} from Planning setup. Confirm it there if it matches your league's day boundary.`;
  // Derived from current manager overrides; stored provider capabilities stay unchanged.
  const healthItems = [...(capabilities?.limitations ?? []).flatMap((item) => {
    const verify = /^Verify (.+); these are not inferred from season transaction totals\.$/.exec(item);
    if (!verify || !/goalie minimum progress$/.test(verify[1])) return [item];
    const acquisitions = verify[1].replace(/ ?(and )?goalie minimum progress$/, "");
    return [...(acquisitions ? [`Verify ${acquisitions}; these are not inferred from season transaction totals.`] : []),
      ...(goalieCreditedEntered ? [] : ["Enter goalie starts so far this week in Planning setup (Goalie credited); Yahoo does not report goalie-minimum progress."])];
  }), ...(capabilities && workspace.context.provider === "yahoo" && !timeZoneConfirmed ? [timeZoneItem] : [])];
  const partialProviderInputs = Boolean(capabilities && (!capabilities.roster || !capabilities.availability || healthItems.length));
  const addRoster = (player: PlanningPlayer, unresolvedName?: string) => {
    if (readOnlySaved || rosterIds.has(player.id) && !unresolvedName) return;
    edit((current) => { const owned = current.roster.some(entry => entry.playerId === player.id); return { ...current,
      roster: owned ? current.roster : [...current.roster, { playerId: player.id, position: "bench" as const }],
      manualPlayers: owned ? current.manualPlayers : [...current.manualPlayers.filter(row => row.id !== player.id), player],
      unresolvedNames: current.unresolvedNames.filter(name => unresolvedName ? name !== unresolvedName : name.toLowerCase() !== player.name.toLowerCase()) }; });
    setQuery("");
    if (unresolvedName) setActionFeedback({ key: accountKey, userId: user?.id, intentRevision: workspace.intent.revision, text: `${unresolvedName} resolved as ${player.name}.` });
  };
  const importRoster = () => {
    if (readOnlySaved || !paste.trim()) return;
    const resolved = resolveImportedNames(paste, players);
    const added = resolved.matched.filter(player => !rosterIds.has(player.id)).length;
    const alreadyRostered = resolved.matched.length - added;
    edit((current) => ({ ...current, roster: [...current.roster, ...resolved.matched.filter((player) => !current.roster.some((entry) => entry.playerId === player.id)).map((player) => ({ playerId: player.id, position: "bench" as const }))], manualPlayers: [...current.manualPlayers.filter((row) => !resolved.matched.some((player) => player.id === row.id)), ...resolved.matched], unresolvedNames: [...new Set([...current.unresolvedNames, ...resolved.unresolved])] }));
    setPaste("");
    setActionFeedback({ key: accountKey, userId: user?.id, text: `Roster review complete: ${added} added, ${alreadyRostered} already rostered, ${resolved.unresolved.length} unresolved. ${added ? "Review player evidence before planning moves." : "No new roster players were added."}` });
  };
  const selectPlayer = (id: string) => {
    setSelectedPlayer(id); setTab("candidates");
    requestAnimationFrame(() => {
      if (accountKey !== workspaceContextKey(providerRef.current.context) || user?.id !== providerRef.current.userId) return;
      const detail = workspaceElement.current?.querySelector<HTMLElement>("#rso-player-detail");
      if (detail?.dataset.playerId !== id) return;
      detail.focus(); detail.scrollIntoView?.({ block: "nearest" });
    });
  };
  const chooseCandidate = (player: PlanningPlayer) => {
    selectPlayer(player.id);
    if (rosterIds.has(player.id) || !["free_agent", "manager_available", "waivers"].includes(player.availability)) return;
    const at = new Date(Date.now() + 60_000).toISOString();
    const effectiveAt = acquisitionEffectiveAt({ context: workspace.context, rules }, player, at);
    if (!effectiveAt) {
      setNotice(rules.acquisitionTiming === "unknown" ? "Verify acquisition timing before selecting an add."
        : "Verify waiver clearance before selecting this conditional claim.");
      return;
    }
    editIntent((intent) => ({ ...intent, steps: [...intent.steps, { id: `selected-${Date.now()}`, type: "add", playerId: player.id, at, effectiveAt, conditional: true, dependsOn: [] }] }));
  };
  const saveAccountNow = async () => {
    const userId = user?.id;
    if (!userId || readOnlySaved || !access?.capabilities.includes("rso_account_save") || !["idle", "testing"].includes(preservationRef.current.phase)) return;
    const backup = preservationRef.current.backup;
    if (backup && !backup.remote.row) { setNotice("Account saves are held because the original record was absent."); return; }
    const contextIdentity = workspaceContextKey(workspace.context);
    if (accountSaveRequest.current?.key === contextIdentity && accountSaveRequest.current.userId === userId) return;
    const request = { key: contextIdentity, userId }; accountSaveRequest.current = request;
    const sameContext = () => accountSaveRequest.current === request && userId === providerRef.current.userId && contextIdentity === workspaceContextKey(providerRef.current.context);
    setAccountSave({ ...request, state: "busy", text: "Saving to account…" });
    try {
      if (snapshot && workspaceContextKey(snapshot.context) !== contextIdentity) throw new Error("Provider context changed. Refresh this workspace before saving.");
      // A statistical reload advances evaluation time, not workspace identity or provider observation clocks.
      const submittedWorkspace = snapshot ? { ...workspace, context: { ...workspace.context, asOf: snapshot.context.asOf } } : workspace;
      const headers = await authHeaders();
      if (!sameContext()) return;
      const suffix = backup ? `?preservation=write&receipt=${encodeURIComponent(backup.remote.receiptId)}` : "";
      const response = await trackedFetch(`/api/v1/roster-schedule-optimizer/workspace${suffix}`, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(packPlanningSnapshots({ workspace: submittedWorkspace, snapshot, expectedVersion: account?.version ?? null })) });
      const body = unpackPlanningSnapshots(await response.json()); if (!sameContext()) return;
      if (response.status === 409) throw new Error("Another device saved this workspace. Your local plan is intact; review the other version before saving again.");
      if (!response.ok) throw new Error(requestErrorMessage(body.error, "Account save failed."));
      if (backup) {
        if (body.preservation?.checksum !== backup.checksum || body.preservation?.receiptId !== backup.remote.receiptId
          || body.data?.version !== (account?.version ?? 0) + 1) { uncertainRequest.current = true; throw new Error("Protected save acknowledgement does not match the admitted writer."); }
        await preservationRequest("ack", backup, { version: String(body.data.version) });
      }
      setAccount(body.data as AccountRecord); setAccountSave({ ...request, state: "success", text: JSON.stringify(workspaceRef.current) === JSON.stringify(workspace) ? "Saved to account." : "Submitted inputs saved to account. Newer local changes still need saving." });
    } catch (error) { if (sameContext()) { setAccountSave({ ...request, state: "error", text: message(error) }); if (backup) preservationFailure(error); } }
    finally { if (accountSaveRequest.current === request) accountSaveRequest.current = null; }
  };
  const saveAccount = () => {
    const protectedSave = preservationRef.current.phase === "testing";
    if (protectedSave && accountOperations.current.size) return Promise.resolve();
    if (protectedSave) setAccountSave({ key: workspaceContextKey(workspace.context), userId: user?.id, state: "busy", text: "Saving to account…" });
    // Share the local persistence queue through PUT and acknowledgement; local_ack must not cross an unacknowledged PUT.
    const operation = protectedSave ? localWrites.current.then(() => saveAccountNow()) : saveAccountNow();
    if (protectedSave) localWrites.current = operation;
    accountOperations.current.add(operation);
    void operation.then(() => accountOperations.current.delete(operation), () => accountOperations.current.delete(operation));
    return operation;
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

  const healthStrip = <div className={styles.healthStrip}>{data && (sharedSchedule || sharedForecasts) && <details className={styles.dataHealth}>
      <summary><strong>Shared schedule: {sharedSchedule?.completeness ?? "unknown"}</strong><span>{scheduleWarning ? " · Recheck game status" : ""} · Forecasts {sharedForecasts?.completeness ?? "unknown"}</span></summary>
      <ul><li>{scheduleTimeLabel} {sharedScheduleTime}. {scheduleWarning} {sharedSchedule?.limitations[0]} {sharedForecasts?.limitations[0] ?? `Forecast coverage: ${sharedForecasts?.completeness ?? "unknown"}.`}</li>{Object.entries(data.evidence).map(([source, evidence]) => <li key={source}>{source}: {evidence.completeness} · {source === "schedule" && evidence.source === "roster_optimizer_team_games" ? "Cache received" : "Evidence timestamp"} {evidence.asOf ?? "unknown"}{evidence.limitations.length ? ` · ${evidence.limitations.join(" ")}` : ""}</li>)}{scheduleWarning && <li>Schedule cache receipt time is separate from upstream publication and model-fit time. Six hours, or two hours within 0–120 minutes before a covered scheduled game, are provisional warning thresholds, not forecast rejection limits. Recheck material news and game status before issuing a forecast.</li>}</ul>
    </details>}
    <details className={styles.dataHealth}>
      <summary><strong>Planning readiness</strong><span>{!roster.length ? " · Roster needed" : !actionableRulesReviewed ? " · Review inputs" : " · Inputs reviewed"}</span></summary>
      <ul>
        <li>Roster: {roster.length ? `${roster.length} players; review unresolved names and eligibility.` : "Add your players to begin schedule analysis."} <button onClick={() => reachInput("roster", workspace.context.provider === "manual" ? "#rso-roster-input" : "#rso-roster-heading")}>Review roster</button></li>
        <li>Rules: {roster.length > 0 && workspace.intent.steps.length > 0 && result?.selected.legal && result.selected.budgetVerified && scoringEntered ? actionableRulesReviewed ? "Selected plan passes the current rule checks with reviewed inputs." : "Review and confirm the current planning inputs before using an acquisition plan." : "Acquisition legality, budget or scoring is unresolved. Review timing, allowances, slots and locks."} <button onClick={() => reachInput("roster", "#rso-rule-settings > summary")}>Review rules</button></li>
        <li>Coverage: {loadingData ? "Loading schedule evidence." : !snapshot ? "Schedule evidence unavailable." : !snapshot.games.length ? "No games in this date range." : !roster.length ? "Add roster players to assess player-quality coverage." : categoryComparisonAvailable ? "Supported category comparisons available; tradeoffs need your choice." : result?.selected.recommendation?.eligible ? "Player-quality assignment evidence available; projected totals have separate coverage requirements." : "Schedule-only capacity; player-quality decisions remain unresolved."} <button onClick={() => reachInput("matchup", "#rso-matchup-heading")}>Review coverage</button></li>
        <li>Plan: {result && roster.length ? "Schedule analysis available. Selected moves remain manager intent; execute changes with your provider." : "Awaiting roster and schedule inputs."} <button onClick={() => reachInput("itinerary", "#rso-itinerary-heading")}>View plan</button></li>
      </ul>
    </details>
    </div>;

  return <div ref={workspaceElement} className={styles.workspace}>
    <header className={styles.navBar} role="group" aria-label="Planning command bar">
      <h1 className={styles.navTitle}>Roster Schedule Optimizer</h1>
      <button className={styles.providerControl} aria-controls="rso-planning-setup" aria-expanded={setupExpanded} onClick={() => setSetupExpanded(value => !value)}><span className={styles.providerMark} aria-hidden="true">{workspace.context.provider === "yahoo" ? "Y!" : workspace.context.provider === "manual" ? "M" : "F"}</span><span><strong>{workspace.context.provider === "manual" ? "Manual roster" : workspace.context.provider === "yahoo" ? "Connected to Yahoo" : "Connected to Fantrax"}</strong><small>{usingRetainedRoster ? "Saved roster · refresh to sync" : viewingSaved ? "Saved plan" : connectedInput ? `Synced${addsLeft !== null ? ` · ${addsLeft} ${addsLeft === 1 ? "add" : "adds"} left this week` : ""}` : "Choose source and dates"}</small></span></button>
      <div className={styles.navWeek}><button className={styles.rangeButton} aria-controls="rso-planning-setup" aria-expanded={setupExpanded} onClick={() => setSetupExpanded(value => !value)} aria-label={`Planning setup · ${dateLabel(workspace.context.startDate)} – ${dateLabel(workspace.context.endDate)}`}>{dateLabel(workspace.context.startDate)} – {dateLabel(workspace.context.endDate)}</button><button disabled={readOnlySaved} aria-describedby="rso-current-week-range" onClick={() => edit(current => ({ ...current, context: { ...current.context, startDate: currentRange.startDate, endDate: currentRange.endDate } }), "current")}>Current week</button><small id="rso-current-week-range"><span className={styles.scheduleSrOnly}>{dateRangeOrigin.current === "restored" ? "Saved range retained. " : dateRangeOrigin.current === "custom" ? "Custom range retained. " : ""}Current week {dateLabel(currentRange.startDate)} – {dateLabel(currentRange.endDate)} · {currentRange.source === "provider" ? "Yahoo matchup dates" : "Mon–Sun fallback; league matchup dates unverified"}</span></small></div>
      <label className={styles.commandSearch}><span className={styles.scheduleSrOnly}>Player search</span><input type="search" aria-label="Search candidate players" placeholder="Search players or teams…" value={candidateSearch} onFocus={() => setTab("candidates")} onChange={event => setCandidateSearch(event.target.value)} /></label>
      {/* One line in the bar; hover or keyboard focus opens every notice as an overlay. */}
      <div className={styles.navStatus}><div className={styles.statusRail}>
    {workspace.context.provider !== "manual" && <div id="rso-provider-refresh-status" className={styles.notice} hidden={!refreshUnavailable && !refreshFeedback} role={refreshFeedback?.state === "error" && !refreshUnavailable ? "alert" : "status"}>{refreshUnavailable || refreshFeedback?.text}{!refreshUnavailable && refreshFeedback?.state === "error" && <span> Try Refresh provider again.</span>}</div>}
    <div id="rso-account-save-status" className={styles.notice} hidden={!saveFeedback} role={saveFeedback?.state === "error" ? "alert" : "status"}>{saveFeedback?.text}{saveFeedback?.state === "error" && <span> Review the reason and try Save to account again.</span>}</div>
    <div id="rso-action-status" className={styles.notice} role="status" hidden={!localFeedback}>{localFeedback}</div>
    {usingRetainedRoster && <div className={styles.notice} role="status">Retained roster · roster, locks &amp; availability unverified.</div>}
    {usingRetainedRoster && workspace.context.provider === "yahoo" && !yahooEligibility.loading && (yahooEligibility.error || yahooEligibility.receipt?.status === "error") && <div className={styles.notice} role="status">Saved Yahoo positions could not be read; refresh Yahoo to update them.</div>}
    {snapshot && result && !scheduleComplete && <div className={styles.notice} role="status">Some team schedules for these dates aren&apos;t confirmed yet, so a few game counts are estimates.</div>}
    {data && !loadingData && !data.games.length && <div className={styles.notice}>No regular-season games were found in the shared schedule for these dates.</div>}
    {rangeTooLong && <div className={styles.notice} role="alert">Planning range must be at most 367 days.</div>}{(notice || planningError) && <div className={styles.notice} role="status">{notice || planningError}</div>}{loadingData && <div className={styles.notice} role="status">Loading schedule and forecasts…</div>}
    {activeProposal?.issues.length ? <div className={styles.notice} role="status">Provider refresh found {activeProposal.issues.length} item(s) to review. Selected moves were kept. {activeProposal.issues.map((issue, index) => <span key={`${issue.stepId}-${index}`}>{issue.message} </span>)}{activeProposal.suggestedSteps && <button disabled={readOnlySaved} onClick={() => { const steps = activeProposal.suggestedSteps; if (!steps) return; editIntent((intent) => ({ ...intent, steps })); setProposal(null); }}>Accept suggested repair</button>}</div> : null}
    {accessError && <div className={styles.notice} role="alert">{accessError}</div>}
    {healthItems.length || capabilities?.diagnostics?.length ? <details className={styles.dataHealth}><summary><strong>Data health</strong><span>{healthItems.length ? `${healthItems.length} ${healthItems.length === 1 ? "item" : "items"} to review` : "No items to review"} · {partialProviderInputs ? "Planning uses partial provider inputs" : "Provider inputs complete"}</span></summary><ul>{healthItems.map((limitation, index) => <li key={index}>{limitation}{limitation === timeZoneItem && <> <button type="button" onClick={() => confirmTimeZone(true)}>Confirm {workspace.context.timeZone}</button></>}</li>)}</ul>{capabilities?.diagnostics?.length ? <details><summary>Provider diagnostics</summary><ul>{capabilities.diagnostics.map((line, index) => <li key={index}>{line}</li>)}</ul></details> : null}</details> : null}{(viewingSaved || (workspace.context.provider !== "manual" && !canSync)) && <div className={styles.notice}>{readOnlySaved || workspace.roster.length ? "Saved inputs are read-only and may be stale." : accessError ? "Provider refresh is disabled until access can be verified." : checkingAccess && user?.id ? "Checking access for provider synchronization…" : user?.id ? PROVIDER_SYNC_UPSELL + " Your account connection is unchanged." : "Sign in to check access for provider synchronization."} <button aria-describedby={!snapshot && !workspace.roster.length ? "rso-manual-continuation-reason" : undefined} disabled={!snapshot && !workspace.roster.length} onClick={() => { history.current = []; setViewingSaved(false); setWorkspace((current) => { const recovered = snapshot ? retainProviderInputs(current, snapshot) : current; return { ...recovered, managerRuleOverrides: {}, rules: { ...recovered.rules, periods: recovered.rules.periods.map((period) => period.source === "provider" ? { ...period, remaining: null, source: "unknown" as const } : period), goalieMinimum: { ...recovered.rules.goalieMinimum, credited: null } }, context: { ...recovered.context, provider: "manual", leagueId: "manual", teamId: "manual", asOf: new Date().toISOString() } }; }); }}>Continue manually</button>{!snapshot && !workspace.roster.length && <small id="rso-manual-continuation-reason"> No snapshot or roster inputs to continue from. Select Manual to start a plan.</small>}</div>}
    {supplemented?.conflicts.length ? <div className={styles.notice} role="status">Provider inputs changed. Manager inputs were kept for review: {supplemented.conflicts.join(" ")}</div> : null}
    </div></div>
      <div className={styles.commandActions} role="group" aria-label="Workspace actions"><button onClick={undo} disabled={Boolean(undoUnavailable)} aria-describedby={undoUnavailable ? "rso-undo-reason" : undefined}>Undo</button>{undoUnavailable && <small id="rso-undo-reason" className={styles.scheduleSrOnly}>{undoUnavailable}</small>}<button disabled={planHeld} onClick={() => setTab(tab === "matchup" ? "candidates" : "matchup")}>{tab === "matchup" ? "Candidates" : "Matchup"}</button>{account?.snapshot && <button disabled={planHeld} onClick={() => { dateRangeOrigin.current = "restored"; setWorkspace(account.workspace); setViewingSaved(true); }}>View account save</button>}{access?.capabilities.includes("rso_account_save") && !readOnlySaved && <button className={styles.primaryAction} onClick={() => void saveAccount()} disabled={saveBusy} aria-busy={saveBusy} aria-describedby="rso-account-save-status">Save to account{saveBusy && <span aria-hidden="true"> · Saving…</span>}</button>}</div>
      {workspace.context.provider !== "manual" && <button onClick={() => void refreshProvider()} disabled={readOnlySaved || Boolean(refreshUnavailable) || refreshBusy} aria-label="Refresh provider" aria-busy={refreshBusy} aria-describedby="rso-provider-refresh-status">{refreshBusy ? "Refreshing provider…" : "Refresh provider"}</button>}
      <details className={styles.navMenu}><summary aria-label="Settings and tools"><span aria-hidden="true">☰</span></summary><div className={styles.navMenuPanel}>
        <small id="rso-updated-at" className={styles.updatedAt}>{viewingSaved && inputSnapshot ? `Saved ${actionTime(inputSnapshot.context.asOf, inputSnapshot.context.timeZone)}` : lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</small>
        <button className={styles.commandControl} onClick={() => reachInput("roster", "#rso-rule-settings > summary")}><strong>League settings</strong><small>{rules.scoring.mode === "categories" ? "Categories" : "Points"} · {rules.lineupMode} lineup</small></button>
        <button className={styles.commandControl} aria-controls="rso-planning-setup" aria-expanded={setupExpanded} onClick={() => setSetupExpanded(value => !value)}><strong>Planning preferences</strong><small>Goalies: {workspace.intent.goalieCoverage === "cover" ? "Cover minimum" : "Accept risk"} · {workspace.intent.goalieWindow}</small></button>
        <button className={styles.commandControl} onClick={() => reachInput("candidates", "#rso-candidate-search")}><strong>Filters &amp; options</strong><small>Availability · teams · positions</small></button>
        {!viewingSaved && (workspace.context.provider === "manual" || usingRetainedRoster) && <>
      <button disabled={!hydrated || loadingData || networkSuspended} onClick={() => setScheduleReadRevision({ contextKey, token: crypto.randomUUID() })}>Reload schedule data</button>
      
    </>}
        {!viewingSaved && connectedInput && <>
      <button disabled={!hydrated || loadingData || networkSuspended} onClick={() => setScheduleReadRevision({ contextKey, token: crypto.randomUUID() })}>Reload shared forecasts</button>
      
    </>}
      </div></details>
    </header>
    <fieldset id="rso-planning-setup" className={`${styles.controls} ${setupExpanded ? styles.controlsExpanded : ""}`} aria-label="Planning setup" disabled={readOnlySaved}>
      <label>Source<select value={workspace.context.provider} onChange={(event) => { edit((current) => ({ ...current, context: { ...current.context, provider: event.target.value as PlanningWorkspace["context"]["provider"] } })); setConnected(null); }}><option value="manual">Manual</option><option value="yahoo">Yahoo{!access?.capabilities.includes("rso_sync") ? " saved view" : ""}</option><option value="fantrax">Fantrax{!access?.capabilities.includes("rso_sync") ? " saved view" : ""}</option></select></label>
      <label>Season<input type="number" value={workspace.context.seasonId} onChange={(event) => edit((current) => ({ ...current, context: { ...current.context, seasonId: Number(event.target.value) } }))} /></label>
      <label>From<input type="date" value={workspace.context.startDate} onChange={(event) => edit((current) => ({ ...current, context: { ...current.context, startDate: event.target.value } }))} /></label>
      <label>Through<input type="date" value={workspace.context.endDate} onChange={(event) => edit((current) => ({ ...current, context: { ...current.context, endDate: event.target.value } }))} /></label>
      {workspace.context.provider !== "manual" && <>{ownTeams.some((team) => team.provider === workspace.context.provider) ? <label>My team<select value={workspace.context.teamId} onChange={(event) => { const team = ownTeams.find((row) => row.id === event.target.value); if (team) edit((current) => ({ ...current, context: { ...current.context, teamId: team.id, leagueId: team.external_league_id } })); }}><option value="manual">Select an owned team</option>{ownTeams.filter((team) => team.provider === workspace.context.provider).map((team) => <option key={team.id} value={team.id}>{team.team_name} — {team.external_leagues?.league_name ?? team.external_league_id}</option>)}</select></label> : <label>Team ID<input value={workspace.context.teamId} onChange={(event) => edit((current) => ({ ...current, context: { ...current.context, teamId: event.target.value } }))} /></label>}</>}
      <label>League ID<input value={workspace.context.leagueId} onChange={(event) => edit((current) => ({ ...current, context: { ...current.context, leagueId: event.target.value } }))} /></label>
      <label>Time zone<input key={workspace.context.timeZone} defaultValue={workspace.context.timeZone} onBlur={(event) => { const zone = event.target.value.trim(); try { new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(); edit((current) => ({ ...current, context: { ...current.context, timeZone: zone } })); } catch { event.target.value = workspace.context.timeZone; setNotice("Enter a valid IANA time zone, such as America/New_York."); } }} /></label>
      {workspace.context.provider === "yahoo" && <label><input type="checkbox" checked={timeZoneConfirmed} onChange={(event) => confirmTimeZone(event.target.checked)} />{"Matches my league's day boundary"}</label>}
      <label>Goalie choice<select value={workspace.intent.goalieCoverage} onChange={(event) => editIntent((intent) => ({ ...intent, goalieCoverage: event.target.value as PlanIntent["goalieCoverage"] }))}><option value="accept_risk">Accept risk</option><option value="cover">Cover minimum</option></select></label>
      <label>Window<select value={workspace.intent.goalieWindow} onChange={(event) => editIntent((intent) => ({ ...intent, goalieWindow: event.target.value as PlanIntent["goalieWindow"] }))}><option value="any">Any date</option><option value="early">Early</option><option value="late">Late</option></select></label>
      <label>Split<select value={workspace.intent.goalieSplit} onChange={(event) => editIntent((intent) => ({ ...intent, goalieSplit: event.target.value as PlanIntent["goalieSplit"] }))}><option value="mon_thu">Mon–Thu / Fri–Sun</option><option value="mon_wed">Mon–Wed / Thu–Sun</option></select></label>
      <div className={styles.weekNav} role="group" aria-label="Matchup week navigation"><button aria-label="Previous matchup week" aria-describedby={weekUnavailable ? "rso-matchup-week-reason" : undefined} disabled={weekIndex <= 0} onClick={() => selectWeek(weekIndex - 1)}>‹</button><label>Matchup week<select value={weekIndex} onChange={event => selectWeek(Number(event.target.value))}><option value={-1}>Custom dates</option>{matchupWeeks.map((week, index) => <option key={`${week.gameKey}:${week.week}`} value={index}>Week {week.week} · {dateLabel(week.startDate)} – {dateLabel(week.endDate)}</option>)}</select></label><button aria-label="Next matchup week" aria-describedby={weekUnavailable ? "rso-matchup-week-reason" : undefined} disabled={weekIndex < 0 || weekIndex >= matchupWeeks.length - 1} onClick={() => selectWeek(weekIndex + 1)}>›</button>{weekUnavailable && <small id="rso-matchup-week-reason">{weekUnavailable}</small>}</div>
    </fieldset>
    <TeamScheduleContext calendar={calendar} expanded={desktop} dates={remainingDates} seasonId={workspace.context.seasonId} timeZone={workspace.context.timeZone} enabled={hydrated && !networkSuspended} />
    <nav className={styles.mobileTabs} aria-label="Workspace views">{(["itinerary", "roster", "candidates", "matchup"] as Tab[]).map((name) => <button key={name} className={tab === name ? styles.activeTab : ""} onClick={() => setTab(name)} aria-current={tab === name ? "page" : undefined}>{name[0].toUpperCase() + name.slice(1)}</button>)}</nav>
    <div className={styles.panels}>
      <section className={`${styles.panel} ${styles.rosterPanel} ${tab === "roster" ? styles.mobileActive : ""}`} aria-label="Roster and setup"><div className={styles.panelHead}><h2 id="rso-roster-heading" tabIndex={-1}><span className={styles.panelNumber} aria-hidden="true">1</span>Current Roster</h2><span>{roster.length} players</span><InfoTooltip label="About roster metrics and protection">GP is remaining scheduled games while rostered. AGP is legal active-game assignments. DUST is evaluated bench games. Points exclude banked results; unavailable values are not zero. ? means unknown, — unavailable, and a number with + is a known subtotal with an unknown full total. Select the numbers for daily evidence. Protect keeps a player out of drop proposals. Manage opens roster position and evidence controls.</InfoTooltip></div><div id="rso-roster-edit" {...readOnlyInert} className={styles.panelBody}>
        {workspace.context.provider === "manual" && <details className={styles.rosterEntryTools} open={roster.length === 0 || workspace.unresolvedNames.length > 0}><summary>Add or import roster</summary><label className={styles.field}>Find a player<input id="rso-roster-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or team" /></label>{query.length >= 2 && <ul className={styles.searchResults}>{matches.map((player) => <li key={player.id}><span>{player.name} · {player.teamAbbreviation ?? "—"} · {player.eligiblePositions.join("/")}</span><button onClick={() => addRoster(player, resolvingName)} disabled={rosterIds.has(player.id) && !resolvingName} aria-describedby={rosterIds.has(player.id) ? `rso-roster-add-${player.id}` : undefined}>{resolvingName ? "Resolve" : "Add"}</button>{rosterIds.has(player.id) && <small id={`rso-roster-add-${player.id}`}>Already in your roster.</small>}</li>)}</ul>}<label className={styles.field}>Paste roster names<textarea value={paste} onChange={(event) => setPaste(event.target.value)} placeholder="One name per line" /></label><button onClick={importRoster} disabled={!paste.trim()} aria-describedby={!paste.trim() ? "rso-paste-reason" : "rso-action-status"}>Review pasted names</button>{!paste.trim() && <small id="rso-paste-reason">Paste at least one roster name to review.</small>}{workspace.unresolvedNames.length > 0 && <div className={styles.unresolved}><strong>Unresolved — excluded from analysis</strong>{workspace.unresolvedNames.map((name) => <div key={name}>{name}<button onClick={() => setQuery(name)}>Find match</button><button onClick={() => edit((current) => ({ ...current, unresolvedNames: current.unresolvedNames.filter((item) => item !== name) }))}>Dismiss</button></div>)}</div>}</details>}

        {result && <HealthyReserveAlert reserves={healthyReserves} nameOf={nameOf} onSelect={selectPlayer} />}
        <div className={styles.rosterColumns} aria-hidden="true"><span>Player · range</span><div><span>GP</span><span>AGP</span><span>DUST</span><span>Pts</span></div><span>Protect</span><span>More</span></div>
        {gapReport && !gapReport.bestDrop && gapReport.projectionBlockers.length > 0 && <p className={styles.dropNotice} role="status">No drop suggested: {gapReport.projectionBlockers.map(row => row.playerId ? `${nameOf(row.playerId)} ${row.reason}` : row.reason).join(" · ")}.</p>}
        {gapReport && !gapReport.bestDrop && !gapReport.projectionBlockers.length && gapReport.unprojectedDrops.length > 0 && <p className={styles.dropNotice} role="status">No drop suggested: {gapReport.unprojectedDrops.length} {gapReport.unprojectedDrops.length === 1 ? "player" : "players"} unprojected ({gapReport.unprojectedDrops.map(nameOf).join(", ")}).</p>}
        {roster.map((entry) => { const player = players.find((item) => item.id === entry.playerId); if (!player) return <div key={entry.playerId} className={styles.rosterRow}>Unmatched ID {entry.playerId}<RosterContribution name={entry.playerId} contribution={contributions.get(entry.playerId)} nameOf={nameOf} /></div>; const protectedPlayer = workspace.intent.protectedPlayerIds.includes(player.id); return <RosterPlayerRow key={player.id}
          player={player} entry={entry} contribution={contributions.get(player.id)} nameOf={nameOf}
          slot={assignments.find(row => row.date === focusedDate && row.playerId === player.id)?.slotId}
          dropCandidate={gapReport?.bestDrop?.playerId === player.id} unprojected={gapReport?.unprojectedDrops.includes(player.id) ?? false} unprojectedReason={gapReport?.projectionBlockers.find(row => row.playerId === player.id)?.reason}
          protectedPlayer={protectedPlayer} manual={workspace.context.provider === "manual"} select={() => selectPlayer(player.id)}
          protect={() => editIntent((intent) => ({ ...intent, protectedPlayerIds: protectedPlayer ? intent.protectedPlayerIds.filter((id) => id !== player.id) : [...intent.protectedPlayerIds, player.id] }))}
          position={position => edit((current) => ({ ...current, roster: current.roster.map((row) => row.playerId === player.id ? { ...row, position } : row) }))}
          remove={() => edit((current) => ({ ...current, roster: current.roster.filter((row) => row.playerId !== player.id) }))}>
          {workspace.context.provider === "manual" && <ManualPlayerInputs player={player} edit={edit} />}
        </RosterPlayerRow>; })}
        <details id="rso-rule-settings" className={styles.settings}><summary>League rules and scoring</summary><p>Check these against your league settings.</p><p>{inputsReviewed ? "Inputs reviewed for this session. Unknown values still need verification." : "Review league rules, scoring, locked assignments and player availability. Confirm again when these inputs change."} <button disabled={Boolean(confirmUnavailable)} aria-describedby={confirmUnavailable ? "rso-confirm-reason" : undefined} onClick={() => setReviewedInputs(reviewKey)}>Confirm planning inputs</button>{confirmUnavailable && <small id="rso-confirm-reason"> {confirmUnavailable}</small>}</p><AcquisitionRules rules={rules} startDate={workspace.context.startDate} endDate={workspace.context.endDate} timeZone={workspace.context.timeZone} updateRules={updateRules} /><div className={styles.settingsGrid}><label>Lineup mode<select value={rules.lineupMode} onChange={(event) => updateRules((rules) => ({ ...rules, lineupMode: event.target.value as LeagueRules["lineupMode"] }))}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="unsupported">Other / unknown</option></select></label><label>Scoring<select value={rules.scoring.mode} onChange={(event) => updateRules((rules) => ({ ...rules, scoring: { ...rules.scoring, mode: event.target.value as LeagueRules["scoring"]["mode"] } }))}><option value="points">Points</option><option value="categories">Categories</option></select></label><label>Goalie minimum<input type="number" min="0" value={rules.goalieMinimum.required ?? ""} onChange={(event) => updateRules((rules) => ({ ...rules, goalieMinimum: { ...rules.goalieMinimum, required: event.target.value ? Number(event.target.value) : null } }))} /></label><label>Goalie credited<input type="number" min="0" value={rules.goalieMinimum.credited ?? ""} onChange={(event) => updateRules((rules) => ({ ...rules, goalieMinimum: { ...rules.goalieMinimum, credited: event.target.value ? Number(event.target.value) : null } }))} /></label>{Object.entries(rules.rosterSlots).map(([slot, count]) => <label key={slot}>{slot}<input type="number" min="0" value={count} onChange={(event) => updateRules((rules) => ({ ...rules, rosterSlots: { ...rules.rosterSlots, [slot]: Number(event.target.value) } }))} /></label>)}</div></details><ExtraRules rules={rules} startDate={workspace.context.startDate} endDate={workspace.context.endDate} timeZone={workspace.context.timeZone} updateRules={updateRules} showAcquisitionRules={() => reachInput("roster", "#rso-acquisition-rules select")} />{workspace.context.provider === "manual" && <ManualLocks workspace={workspace} players={players} edit={edit} />}
      </div><div className={styles.rosterSummary} aria-label="Week summary"><BenchDays roster={roster} players={players} contributions={contributions} today={today} onSelect={selectPlayer} />{goalieMinimum ? <button className={styles.goalieChip} onClick={() => reachInput("roster", "#rso-rule-settings > summary")} title="Goalie starts so far this week / league minimum">Goalie starts {result?.selected.goalie.credited ?? "?"}/{goalieMinimum}</button> : null}<section className={styles.metrics} aria-label="Plan summary"><Metric label="Active games" value={result ? `${number(result.selected.activeGames)}${utilizationCapacity ? ` / ${utilizationCapacity}` : ""}` : "—"} detail={result && utilizationCapacity ? `${Math.round(100 * result.selected.activeGames / utilizationCapacity)}% of starting slots used` : "Starts across your active slots"} /><Metric label="Bench games" value={number(result?.selected.benchGames)} detail={result?.selected.scheduledGames ? `${Math.round(100 * result.selected.benchGames / result.selected.scheduledGames)}% of scheduled games sit (DUST)` : "Scheduled games left on the bench (DUST)"} /><Metric label={rules.scoring.mode === "categories" ? "Category outcomes" : "Projected points"} value={number(result?.selected.projectedValue)} detail={result?.selected.projectedValue == null ? "Shows once projections cover your lineup" : rules.scoring.mode === "categories" ? "Projected wins minus losses" : "League scoring, active games only"} />{result && rules.scoring.mode !== "categories" && <div className={styles.comparison} aria-label="Lineup comparison"><span>Compare</span><p data-selected={result.selected.objective === "agp"}>Most starts <b>{number(result.noMoveAgp.activeGames)} GP · {number(result.noMoveAgp.projectedValue)} pts</b></p><p data-selected={result.selected.objective === "outcome"}>Best projected points <b>{number(result.noMoveOutcome.activeGames)} GP · {number(result.noMoveOutcome.projectedValue)} pts</b></p></div>}</section></div></section>
      <section className={`${styles.panel} ${styles.itineraryPanel} ${tab === "itinerary" ? styles.mobileActive : ""}`} aria-label="Itinerary"><div className={styles.panelHead}><h2 id="rso-itinerary-heading" tabIndex={-1}><span className={styles.panelNumber} aria-hidden="true">2</span>{desktop ? "Optimized Week" : "Itinerary"}</h2><span className={styles.panelSub}>{planningLoading ? "Updating…" : !result ? "Waiting for roster and schedule" : rules.scoring.mode === "categories" ? "Category lineup · tradeoffs need your call" : "Best lineup for each day"}</span>{rules.scoring.mode === "points" && <div className={styles.objectiveSwitch} role="group" aria-label="Lineup goal"><button aria-pressed={result?.selected.objective === "agp"} disabled={readOnlySaved || !result} onClick={() => editIntent((intent) => ({ ...intent, objective: "agp" }))}>Most starts</button><button aria-pressed={result?.selected.objective === "outcome"} disabled={readOnlySaved || !result?.noMoveOutcome.recommendation?.eligible} title={result?.noMoveOutcome.recommendation?.eligible ? undefined : "Needs projections for your whole lineup"} onClick={() => editIntent((intent) => ({ ...intent, objective: "outcome" }))}>Best projected points</button></div>}<button className={styles.optimizeButton} aria-pressed={optimizeOpen} onClick={() => { setTab("itinerary"); setPlanTab(false); setShowLineup(true); setLineupView("position"); setOptimizeOpen(true); setOptimizeRuns(count => count + 1); }}>Optimize lineup</button><div className={styles.viewSwitch} role="group" aria-label="Schedule view"><button aria-pressed={!planTab && showLineup && lineupView === "position"} onClick={() => { setPlanTab(false); setShowLineup(true); setLineupView("position"); }}>By position</button><button aria-pressed={!planTab && showLineup && lineupView === "player"} aria-label={categoryComparisonAvailable ? "Show category lineup comparison" : "Show lineup by player"} onClick={() => { setPlanTab(false); setShowLineup(true); setLineupView("player"); }}>By player</button><button aria-pressed={!planTab && !showLineup} aria-label="Streaming itinerary" onClick={() => { setPlanTab(false); setShowLineup(false); }}>Itinerary</button><button aria-pressed={planTab} onClick={() => setPlanTab(true)}>Plan details</button></div></div>{optimizeOpen && rules.acquisitionTiming === "unknown" && <OptimizeLineup readOnly={readOnlySaved} setTiming={(timing) => updateRules((rules) => ({ ...rules, acquisitionTiming: timing }))} />}<div className={`${styles.panelBody} ${showLineup && !planTab ? styles.lineupBody : ""}`}>{!planTab && <>{!showLineup && <div className={styles.dateStrip} role="group" aria-label="Choose a date">{dates.map((date) => <button key={date} className={focusedDate === date ? styles.selectedDate : ""} onClick={() => focusDate(date)}>{dateLabel(date)}</button>)}</div>}{!showLineup && <div className={styles.dateSummary}><strong>{focusedDate ? dateLabel(focusedDate) : "Choose valid dates"}</strong><span>{assignments.filter((assignment) => assignment.date === focusedDate).length} planned starts · {new Set(snapshot?.games.filter((game) => game.date === focusedDate && game.status !== "cancelled" && game.status !== "postponed").map((game) => game.id) ?? []).size} NHL games</span></div>}{!showLineup && <StreamingGrid dates={dates} assignments={assignments} games={snapshot?.games ?? []} players={players} steps={workspace.intent.steps} timeZone={workspace.context.timeZone} />}{showLineup && lineupView === "position" && <SlotWeekGrid dates={dates} slots={activeSlots} assignments={assignments} games={snapshot?.games ?? []} players={players} roster={roster} forecasts={result?.selected.forecastInputs} pointsFor={pointsFor} focusedDate={focusedDate} onSelectPlayer={selectPlayer} animationToken={optimizeRuns} today={today} benchCapacity={slotExpansion.benchCapacity} pastLineups={snapshot?.pastLineups} />}{showLineup && lineupView === "player" && focusedDate && <CompactSchedule admittedSnapshot={displaySnapshot} key={contextKey} snapshot={snapshot} roster={roster} rules={rules} players={players} assignments={assignments} intent={workspace.intent} dates={dates} date={focusedDate} today={today} ready={Boolean(result)} selectDate={focusDate} selectPlayer={selectPlayer} benchOpen={benchOpen} onBenchChange={setBenchOpen} contributions={contributions} />}</>}<section id="rso-plan-details" className={styles.planView} hidden={!planTab} aria-label="Plan details"><ForecastEvidence forecasts={result?.selected.forecastInputs} scoring={rules.scoring} nameOf={nameOf} timeZone={workspace.context.timeZone} label="Selected lineup" /><CategoryGains baseline={result?.baseline} plan={result?.selected} scoring={rules.scoring} label="Selected plan" reviewed={actionableRulesReviewed} snapshot={snapshot} /><div className={styles.itineraryLegs}><h3>Selected steps</h3><p aria-label="Planned adds">Planned adds: {workspace.intent.steps.filter((step) => step.type === "add").length} · {acquisitionDetail(rules, snapshot?.acquisitionEvidence)}</p>{workspace.intent.steps.length > 0 && <p className={styles.limitation}>{nextSelectedStep && <><strong>Next selected action: {nextSelectedStep.type.toUpperCase()} {nameOf(nextSelectedStep.playerId)}</strong> · {actionTime(nextSelectedStep.at, workspace.context.timeZone)}. </>}{nextSelectedReview}</p>}{workspace.intent.steps.length ? workspace.intent.steps.map((step) => <SelectedStep key={step.id} step={step} name={nameOf(step.playerId)} dropName={step.dropPlayerId ? nameOf(step.dropPlayerId) : null} prerequisites={step.dependsOn.map(id => { const prior = workspace.intent.steps.find(item => item.id === id); return prior ? `${prior.type.toUpperCase()} ${nameOf(prior.playerId)}` : "Unresolved prerequisite"; })} timeZone={workspace.context.timeZone} rules={rules} readOnly={readOnlySaved} continuation={result?.noClaimContinuations?.find((row) => row.claimStepId === step.id)?.evaluation.activeGames} update={(patch) => editIntent((intent) => ({ ...intent, steps: intent.steps.map((item) => item.id === step.id ? { ...item, ...patch } : item) }))} remove={() => editIntent((intent) => ({ ...intent, steps: intent.steps.filter((item) => item.id !== step.id) }))} setNotice={setNotice} />) : <p>No acquisition selected. The no-move lineup is the comparison.</p>}</div>{<BenchDecisions decisions={result?.selected.recommendation?.exclusions} nameOf={nameOf} date={focusedDate} />}{result?.selected.limitations.filter(limit => /conditional ability|baseline estimates/i.test(limit)).map(limit => <p key={limit} className={styles.limitation}>{limit}</p>)}{result?.search.limitations.length ? <p className={styles.limitation}>{result.search.limitations.join(" ")}</p> : null}</section></div></section>
      <section {...readOnlyInert} className={`${styles.panel} ${styles.candidatePanel} ${tab === "matchup" ? styles.desktopHidden : ""} ${tab === "candidates" ? styles.mobileActive : ""}`} aria-label="Candidates and detail"><div className={styles.panelHead}><h2><span className={styles.panelNumber} aria-hidden="true">3</span>Best Fit Available</h2><label>Show<select value={workspace.intent.alternativeCount} onChange={(event) => editIntent((intent) => ({ ...intent, alternativeCount: Number(event.target.value) as PlanIntent["alternativeCount"] }))}><option value="5">5</option><option value="10">10</option><option value="20">20</option></select></label></div><div className={styles.panelBody}>{selectedPlayer && <div id="rso-player-detail" className={styles.detail} role="region" aria-label={`Player details for ${nameOf(selectedPlayer)}`} data-player-id={selectedPlayer} tabIndex={-1}><strong>{nameOf(selectedPlayer)}</strong><span>{players.find((player) => player.id === selectedPlayer)?.availability.replaceAll("_", " ") ?? "Unknown"}</span><label className={styles.check}><input type="checkbox" checked={workspace.intent.excludedPlayerIds.includes(selectedPlayer)} disabled={readOnlySaved} title={readOnlySaved ? "Saved inputs are read-only. Continue manually to change exclusions." : undefined} onChange={(event) => { const excluded = event.currentTarget.checked; editIntent((intent) => ({ ...intent, excludedPlayerIds: excluded ? [...intent.excludedPlayerIds.filter(id => id !== selectedPlayer), selectedPlayer] : intent.excludedPlayerIds.filter(id => id !== selectedPlayer) })); }} />Exclude from suggestions</label>{workspace.intent.excludedPlayerIds.includes(selectedPlayer) && <span>Excluded from suggestions</span>}<span>{ownershipLabel(players.find((player) => player.id === selectedPlayer))}</span>{players.find((player) => player.id === selectedPlayer)?.form && <span className={styles.formChip}>{players.find((player) => player.id === selectedPlayer)!.form!.label} · {players.find((player) => player.id === selectedPlayer)!.form!.points} points / {players.find((player) => player.id === selectedPlayer)!.form!.games} games · forecast inclusion unknown</span>}{opponentDemandHint(snapshot, players.find((player) => player.id === selectedPlayer)) && <span className={styles.demandHint}>{opponentDemandHint(snapshot, players.find((player) => player.id === selectedPlayer))}</span>}{selectedManualCandidate && <ManualPlayerInputs key={`${user?.id ?? "guest"}:${accountKey}:${selectedManualCandidate.id}`} player={selectedManualCandidate} edit={edit} />}</div>}<CandidateBrowser preferredSort={result?.selected.objective === "agp" ? "schedule" : "points"} searchQuery={candidateSearch} changeSearch={setCandidateSearch} calendar={calendar} key={`${user?.id ?? "guest"}:${accountKey}`} players={players} rosterIds={rosterIds} snapshot={inputSnapshot} executionOptions={executionOptions} intent={workspace.intent} fits={result?.scheduleFits} manual={workspace.context.provider === "manual"} select={selectPlayer} add={chooseCandidate} canSelectPlan={actionableRulesReviewed && scoringEntered && !readOnlySaved} selectPlan={steps => { editIntent(intent => ({ ...intent, steps: steps.map(step => ({ ...step, dependsOn: [...step.dependsOn] })) })); setActionFeedback({ key: accountKey, userId: user?.id, intentRevision: workspace.intent.revision + 1, text: "Compared plan selected. Confirm roster changes with your provider." }); }} markAvailable={player => edit(current => ({ ...current, manualPlayers: [...current.manualPlayers.filter(row => row.id !== player.id), { ...player, availability: "manager_available" }] }))} /><details className={styles.settings}><summary>Plan alternatives ({result?.alternatives.length ?? 0})</summary>{result?.alternatives.slice(0, workspace.intent.alternativeCount).map((alternative, index) => { const first = alternative.steps[0]; const planUnavailable = readOnlySaved ? "Saved inputs are read-only." : !first ? "This plan keeps the roster unchanged; there are no moves to select." : !inputsReviewed ? "Review and confirm planning inputs before selecting this plan." : !scoringEntered ? "Enter league scoring before selecting this plan." : !alternative.legal ? `Plan rule checks failed. ${alternative.limitations.join(" ")}` : !alternative.budgetVerified ? "Acquisition budget is unverified. Review acquisition periods and remaining moves." : null; return <div className={styles.alternative} key={index}><div><strong>{first ? alternative.steps.map((step) => `${step.type.toUpperCase()} ${nameOf(step.playerId)}${step.dropPlayerId ? ` · DROP ${nameOf(step.dropPlayerId)}` : ""}`).join(" → ") : "Hold roster"}</strong><small>{alternative.objective === "agp" ? "Starts objective" : rules.scoring.mode === "categories" ? "Category outcome analysis" : "Projected outcome objective"} · Gross games {grossAcquisitionGames(alternative.steps, snapshot)} · displaced {result?.baseline.assignments.filter((assignment) => !alternative.assignments.some((next) => next.date === assignment.date && next.playerId === assignment.playerId && next.gameId === assignment.gameId)).length ?? 0} · net active games {alternative.activeGames - (result?.baseline.activeGames ?? 0)} · {alternative.steps.filter((step) => step.type === "add").length} adds</small><small>{rules.scoring.mode === "points" && <>Contribution {alternative.comparisonEligible && result?.baseline.comparisonEligible && alternative.projectedValue != null && result.baseline.projectedValue != null ? number(alternative.projectedValue - result.baseline.projectedValue) : "unavailable"} · </>}{actionableRulesReviewed && alternative.legal && alternative.budgetVerified ? "Rule checks passed" : "Needs review"}</small>{alternative.recommendation?.mode === "schedule_capacity" && !alternative.recommendation.eligible && alternative.steps.some(step => step.dropPlayerId || step.type === "drop") && <small>Hypothetical schedule comparison only. Net fantasy points and drop cost are unknown; additional games do not establish a better roster.</small>}<CategoryGains baseline={result?.baseline} plan={alternative} scoring={rules.scoring} label={`Alternative ${index + 1}`} reviewed={actionableRulesReviewed} snapshot={snapshot} />{planUnavailable && <small id={`rso-plan-reason-${index}`}>{planUnavailable}</small>}</div><button disabled={Boolean(planUnavailable)} aria-describedby={planUnavailable ? `rso-plan-reason-${index}` : "rso-action-status"} onClick={() => { editIntent((intent) => ({ ...intent, steps: alternative.steps })); setActionFeedback({ key: accountKey, userId: user?.id, intentRevision: workspace.intent.revision + 1, text: `Alternative ${index + 1} selected. Confirm roster changes with your provider.` }); }}>Select plan</button></div>; })}</details></div></section>
      <section className={`${styles.panel} ${styles.matchupPanel} ${tab === "matchup" ? `${styles.desktopMatchup} ${styles.mobileActive}` : ""}`} aria-label="Matchup"><div className={styles.panelHead}><h2 id="rso-matchup-heading" tabIndex={-1}>Matchup</h2><span>{rules.scoring.mode}</span></div><div className={styles.panelBody}><p>{snapshot?.opponent ? "Opponent data present. Review category and goalie results below." : "Opponent inputs are missing. Matchup strategy is unavailable; schedule planning remains usable."}</p><div className={styles.compare}><strong>{rules.scoring.mode === "categories" ? "No-move category lineup" : "Optimized no move"} · {result?.baseline.objective === "outcome" ? "Outcome" : "Active games"}</strong><span>{number(result?.baseline.activeGames)} active · {number(result?.baseline.projectedValue)} projected</span><strong>Selected plan</strong><span>{number(result?.selected.activeGames)} active · {number(result?.selected.projectedValue)} projected</span></div>{result?.selected.categoryResults.map((category) => <div key={category.key} className={styles.categoryRow}><strong>{category.key}</strong><span>{number(category.own)} vs {number(category.opponent)}</span><span>{category.result}</span></div>)}<div className={styles.sensitivity}><h3>Plan sensitivity · provisional</h3>{sensitivity?.scenarios.map((scenario) => <div key={scenario.id}><span>{scenario.label}</span><span>{number(scenario.baseline)} → {number(scenario.candidate)} · Δ {number(scenario.difference)}</span></div>)}<p>{sensitivity?.direction === "sensitive" ? "Plan ranking changes across stress scenarios." : sensitivity?.direction === "unavailable" ? categoryComparisonAvailable ? "Overall category sensitivity is withheld; category tradeoffs need your choice." : "Full comparison unavailable with current forecast or opponent coverage." : "Fixed-lineup stress comparison only."} These are not win probabilities.</p></div><ForecastEvidence forecasts={result?.baseline.forecastInputs} scoring={rules.scoring} nameOf={nameOf} timeZone={workspace.context.timeZone} label={rules.scoring.mode === "categories" ? "No-move category lineup" : "Optimized no-move plan"} /><ForecastEvidence forecasts={result?.selected.forecastInputs} scoring={rules.scoring} nameOf={nameOf} timeZone={workspace.context.timeZone} label="Selected lineup" /><ForecastCoverage coverage={result?.selected.recommendation?.coverage} nameOf={nameOf} /><div {...readOnlyInert}><MatchupSetup workspace={workspace} edit={edit} /></div><h3>Goalie evidence</h3><p>Projected and confirmed upcoming starts do not count as credited minimum progress.</p><GoalieEvidence snapshot={snapshot} admittedSnapshot={displaySnapshot} goalieSplit={workspace.intent.goalieSplit} /><p>Credited: {number(result?.selected.goalie.credited)} · Confirmed upcoming: {number(result?.selected.goalie.confirmed)} · Projected: {number(result?.selected.goalie.projected)}</p>{Object.entries(snapshot?.evidence ?? {}).map(([source, evidence]) => <p key={source} className={styles.evidence}>{source}: {evidence.completeness}{evidence.limitations.length ? ` · ${evidence.limitations.join(" ")}` : ""}</p>)}{result?.selected.limitations.map((limit, index) => <p key={index} className={styles.limitation}>{limit}</p>)}</div></section>
    </div>
    <footer className={styles.workspaceFooter}><details className={styles.moreTools}><summary>More tools</summary>{healthStrip}{result && <details className={styles.settings}><summary>Why add/drop plans may be unavailable</summary>{result.search.limitations.filter(limit => /Add\/drop plans|Safe drop recommendations/.test(limit)).map(limit => <p key={limit}>{limit}</p>)}</details>}
    <details className={styles.settings}><summary>Download planning evidence</summary>
      <p>Download the currently loaded inputs and their original timestamps. This file may contain private league information. It does not refresh providers or save your plan, and is not a restorable backup.</p>
      <button disabled={!snapshot} onClick={() => {
        if (!snapshot) return;
        const payload = { version: "rso-planning-evidence-v1", exportedAt: new Date().toISOString(),
          snapshot, providerSnapshot: connectedInput, providerCapabilities: capabilities,
          managerInputs: { rules: workspace.managerRuleOverrides ?? {}, realized: workspace.realized, opponent: workspace.opponent },
          intent: workspace.intent, readerCheckedAt: lastUpdated };
        try {
          const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
          const link = document.createElement("a"); link.href = url; link.download = "rso-planning-evidence.json";
          try { link.click(); } finally { URL.revokeObjectURL(url); }
          setNotice("Planning evidence download requested. Verify the file was saved.");
        } catch { setNotice("Planning evidence could not be downloaded. Your plan was kept."); }
      }}>Download loaded inputs</button>
    </details>
    {(access?.grantingSources?.includes("owner_testing") || preservation.phase !== "idle") && <details className={styles.settings} open={preservation.phase !== "idle"}><summary>Owner plan preservation</summary>
      <p role={preservation.phase === "invalid" ? "alert" : "status"}>{preservation.text || "Preserve this exact working context before a separately approved test."}</p>
      <button disabled={!hydrated || preservation.phase !== "idle"} onClick={() => void preparePreservation()}>Prepare plan backup</button>
      <button disabled={!preservationRef.current.backup || preservationRef.current.backup.principalId !== user?.id} onClick={downloadPreservation}>Download complete backup</button>
      <label><input type="checkbox" checked={otherWritersExcluded} onChange={event => setOtherWritersExcluded(event.target.checked)} /> Backup saved and other writers independently excluded</label>
      <button disabled={preservation.phase !== "held" || !preservationRef.current.exported || !otherWritersExcluded || !preservationRef.current.backup?.remote.row || preservationRef.current.restored} onClick={() => void startProtectedPlanning()}>Use backup for approved test</button>
      <button disabled={!preservationRef.current.backup || ["preparing", "restoring"].includes(preservation.phase)} onClick={() => void restorePreservation()}>Restore original plan and Undo</button>
      <label>Restore downloaded backup<input type="file" accept="application/json" onChange={event => { const file = event.target.files?.[0]; if (file) void file.text().then(text => restorePreservation(JSON.parse(text) as WorkspacePreservation)).catch(preservationFailure); event.target.value = ""; }} /></label>
      <button disabled={!preservationRef.current.restored || preservation.phase !== "held"} onClick={() => void releasePreservation()}>Resume normal planning</button>
      <p>This lock coordinates updated RSO writers. Older tabs need independent exclusion. Backups are bound to the running server receipt; a server restart holds recovery for review. Account saves remain blocked when the original remote record was absent.</p>
    </details>}
    </details></footer>
  </div>;
}
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <article><div className={styles.metricLabel}><span>{label}</span></div><strong>{value}</strong><small>{detail}</small></article>; }
function SelectedStep({ step, name, dropName, prerequisites, timeZone, rules, readOnly, continuation, update, remove, setNotice }: { step: PlanStep; name: string; dropName: string | null; prerequisites: string[]; timeZone: string; rules: LeagueRules; readOnly: boolean; continuation?: number; update: (patch: Partial<PlanStep>) => void; remove: () => void; setNotice: (message: string) => void }) {
  const changeTime = (key: "at" | "effectiveAt", value: string) => { const instant = instantFromLeagueTime(value, timeZone); if (instant) update({ [key]: instant }); else setNotice("Enter a valid time in the league time zone."); };
  return <div className={styles.selectedStep}><strong>{step.type.toUpperCase()} {name}</strong><span>{actionTime(step.at, timeZone)} · effective {actionTime(step.effectiveAt, timeZone)} · {periodName(step.at, rules)} · {step.conditional ? "Conditional" : "Selected, not executed"}</span>{step.type === "add" && <small>Acquisition cost: {rules.acquisitionCost ?? "unknown"} · Drop: {dropName ?? "none selected"}</small>}{prerequisites.length > 0 && <small>Requires: {prerequisites.join(" → ")}</small>}<div className={styles.stepControls}><label>Action (league time)<input type="datetime-local" disabled={readOnly} value={leagueDateTime(step.at, timeZone)} onChange={(event) => changeTime("at", event.target.value)} /></label><label>Effective<input type="datetime-local" disabled={readOnly} value={leagueDateTime(step.effectiveAt, timeZone)} onChange={(event) => changeTime("effectiveAt", event.target.value)} /></label>{step.conditional && rules.waivers?.mode === "budget" && <label>Waiver spend (manager input)<input type="number" min="0" disabled={readOnly} value={step.waiverSpend ?? ""} onChange={(event) => update({ waiverSpend: event.target.value === "" ? null : Number(event.target.value) })} /></label>}<button disabled={readOnly} onClick={remove}>Remove</button></div>{continuation !== undefined && <small>If claim fails: {continuation} active games; prior legal steps remain.</small>}</div>;
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
  return <details className={styles.settings}><summary>Locked lineup assignments</summary><p>Enter confirmed locks for games already fixed by the league. Use Bench when a player cannot be started that date.</p>{locks.map((lock, index) => <div className={styles.ruleRow} key={index}><label>Date<input type="date" value={lock.date} onChange={(event) => update(index, { date: event.target.value })} /></label><label>Player<select value={lock.playerId} onChange={(event) => update(index, { playerId: event.target.value })}>{workspace.roster.map((entry) => <option key={entry.playerId} value={entry.playerId}>{players.find((player) => player.id === entry.playerId)?.name ?? entry.playerId}</option>)}</select></label><label>Locked slot<select value={lock.slotId ?? "bench"} onChange={(event) => update(index, { slotId: event.target.value === "bench" ? null : event.target.value })}><option value="bench">Bench</option>{slots.map((slot) => <option key={slot.id} value={slot.id}>{slot.id}</option>)}</select></label><button aria-label={`Remove lock ${index + 1}`} onClick={() => edit((current) => ({ ...current, lockedAssignments: (current.lockedAssignments ?? []).filter((_, i) => i !== index) }))}>×</button></div>)}<button disabled={!workspace.roster.length} aria-describedby={!workspace.roster.length ? "rso-lock-reason" : undefined} onClick={() => edit((current) => ({ ...current, lockedAssignments: [...(current.lockedAssignments ?? []), { date: current.context.startDate, playerId: current.roster[0].playerId, slotId: null }] }))}>Add confirmed lock</button>{!workspace.roster.length && <small id="rso-lock-reason">Add a roster player before entering a confirmed lock.</small>}</details>;
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
export function GoalieEvidence({ snapshot, admittedSnapshot, goalieSplit = "mon_thu" }: { snapshot: PlanningSnapshot | null;
  admittedSnapshot?: PlanningSnapshot | null; goalieSplit?: PlanIntent["goalieSplit"] }) {
  const resolved = admittedSnapshot?.id === snapshot?.id ? admittedSnapshot : snapshot ? capacityPlanningSnapshot(snapshot) : null;
  if (!snapshot || !resolved) return <p>Goalie evidence is unavailable until schedule data loads.</p>;
  const today = localDate(snapshot.context.asOf, snapshot.context.timeZone);
  const remainingGames = [...new Map(snapshot.games.filter(game => game.status === "scheduled"
    && game.date >= snapshot.context.startDate && game.date <= snapshot.context.endDate
    && (Number.isFinite(Date.parse(game.startsAt ?? "")) ? Date.parse(game.startsAt!) > Date.parse(snapshot.context.asOf) : game.date >= today))
    .map(game => [`${game.id}:${game.teamAbbreviation}`, game])).values()];
  const evidence = (games: PlanningGame[]) => {
    const teams = new Set(games.map(game => game.teamAbbreviation));
    const members = snapshot.players.filter(player => player.playerClass === "goalie" && player.teamAbbreviation !== null && teams.has(player.teamAbbreviation));
    const knownOption = (player: PlanningPlayer) => snapshot.roster.some(entry => entry.playerId === player.id)
      || ["free_agent", "manager_available", "waivers"].includes(player.availability);
    const goalies = members.filter(knownOption);
    const unknown = new Set(members.filter(player => !knownOption(player) && player.availability === "unknown").map(player => player.id)).size;
    const forecasts = resolved.forecasts.filter(forecast => goalies.some(goalie => goalie.id === forecast.playerId)
      && games.some(game => game.id === forecast.gameId));
    const forGame = (game: PlanningGame) => forecasts.filter(forecast => forecast.gameId === game.id
      && goalies.some(goalie => goalie.id === forecast.playerId && goalie.teamAbbreviation === game.teamAbbreviation));
    const startEvidence = (game: PlanningGame) => forGame(game).filter(forecast => forecast.confirmedStart || forecast.startProbability !== null && Number.isFinite(forecast.startProbability));
    const known = games.filter(game => startEvidence(game).length > 0);
    const partial = known.filter(game => goalies.some(goalie => goalie.teamAbbreviation === game.teamAbbreviation
      && !startEvidence(game).some(forecast => forecast.playerId === goalie.id))).length;
    const projected = known.reduce((total, game) => total + startEvidence(game).reduce((sum, forecast) => sum + (forecast.confirmedStart ? 1 : forecast.startProbability!), 0), 0);
    const conflict = resolved.forecastInputExclusions?.some(row => games.some(game => game.id === row.gameId)
      && row.reasons.includes("unsupported_conditioning") && goalies.some(goalie => goalie.id === row.playerId));
    const unknownTimes = games.filter(game => !Number.isFinite(Date.parse(game.startsAt ?? ""))).length;
    const options = new Set(goalies.map(goalie => goalie.id)).size;
    return <span>{options} unique known goalie option{options === 1 ? "" : "s"} · {forecasts.filter(forecast => forecast.confirmedStart).length} confirmed starts · {known.length ? `${number(projected)} ${partial ? "projected (known subtotal)" : "projected"} across ${known.length}/${games.length} evidenced games` : "projected starts unknown"}{partial > 0 ? ` · ${partial} partially evidenced team game${partial === 1 ? "" : "s"}; other start probabilities unknown` : ""}{known.length < games.length ? " · remaining start probabilities unknown" : ""}{unknown > 0 ? ` · ${unknown} goalie${unknown === 1 ? "" : "s"} with unknown availability` : ""}{unknownTimes > 0 ? ` · ${unknownTimes} game${unknownTimes === 1 ? "" : "s"} with unverified start time` : ""}{conflict ? " · Starter evidence is incompatible; affected starts unavailable." : ""}</span>;
  };
  const pairs: Array<{ team: string; first: PlanningSnapshot["games"][number]; second: PlanningSnapshot["games"][number] }> = [];
  const teams = [...new Set(remainingGames.map((game) => game.teamAbbreviation))];
  for (const team of teams) {
    const games = remainingGames.filter(game => game.teamAbbreviation === team && Number.isFinite(Date.parse(game.startsAt ?? ""))).sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < games.length; i++) if ((Date.parse(`${games[i].date}T12:00:00Z`) - Date.parse(`${games[i - 1].date}T12:00:00Z`)) / 86_400_000 === 1) pairs.push({ team, first: games[i - 1], second: games[i] });
  }
  return <div className={styles.b2bList}>
    <p>Options include rostered goalies and known candidates. Waivers still require clearance; these counts do not verify a legal lineup or acquisition.</p>
    {[true, false].map(early => {
      const games = remainingGames.filter(game => ((new Date(`${game.date}T12:00:00Z`).getUTCDay() + 6) % 7 < (goalieSplit === "mon_wed" ? 3 : 4)) === early);
      return <div className={styles.b2bRow} role="group" aria-label={`${early ? "Early" : "Late"} goalie window`} key={String(early)}>
        <strong>{early ? `Early · ${goalieSplit === "mon_wed" ? "Mon–Wed" : "Mon–Thu"}` : `Late · ${goalieSplit === "mon_wed" ? "Thu–Sun" : "Fri–Sun"}`}</strong>
        {games.length ? <><span>{games.length} remaining team game{games.length === 1 ? "" : "s"}</span>{evidence(games)}</> : <span>No remaining scheduled games in this window.</span>}
      </div>;
    })}
    <div className={styles.b2bList} role="group" aria-label="Back-to-back goalie evidence">{pairs.length ? pairs.map(({ team, first, second }) =>
      <div className={styles.b2bRow} key={`${team}:${first.id}:${second.id}`}><strong>{team} · {dateLabel(first.date)} {first.home ? "vs" : "@"}{first.opponent} / {dateLabel(second.date)} {second.home ? "vs" : "@"}{second.opponent}</strong>{evidence([first, second])}</div>)
      : <p>No back-to-back team games in this range.</p>}</div>
  </div>;
}
function AcquisitionRules({ rules, startDate, endDate, timeZone, updateRules }: { rules: LeagueRules; startDate: string; endDate: string; timeZone: string; updateRules: (change: (rules: LeagueRules) => LeagueRules) => void }) {
  const periods = rules.periods;
  const windowUnavailable = !startDate || !endDate ? "Select start and end dates before adding a period or lineup window." : startDate > endDate ? "Start date must be on or before end date." : null;
  return <fieldset id="rso-acquisition-rules"><legend>Acquisition rules</legend>
    <p>Fill missing settings below. Comparisons update automatically; selected moves are kept. Cost is acquisition-allowance units per add, separate from waiver bids. Confirm each period against the league’s actual reset dates in {timeZone}.</p>
    <div className={styles.ruleFields}>
    <label>Acquisition timing<select value={rules.acquisitionTiming} onChange={(event) => updateRules((rules) => ({ ...rules, acquisitionTiming: event.target.value as LeagueRules["acquisitionTiming"] }))}><option value="unknown">Unknown</option><option value="same_day">Same day</option><option value="next_day">Next day</option></select></label>
    <label>Acquisition cost<input type="number" min="0" value={rules.acquisitionCost ?? ""} onChange={(event) => updateRules((current) => ({ ...current, acquisitionCost: event.target.value ? Number(event.target.value) : null }))} /></label>
    <h4>Acquisition periods</h4>{periods.map((period, index) => <div className={styles.ruleRow} key={index}><label>Period<input value={period.id} onChange={(event) => updateRules((current) => ({ ...current, periods: current.periods.map((row, i) => i === index ? { ...row, id: event.target.value } : row) }))} /></label>{!period.timeZone && <><label>Start<input type="date" value={leagueDate(period.start, timeZone)} onChange={(event) => { if (event.target.value) updateRules((current) => ({ ...current, periods: current.periods.map((row, i) => i === index ? { ...row, start: leagueDayBoundary(event.target.value, timeZone) } : row) })); }} /></label><label>End<input type="date" value={leagueDate(new Date(Date.parse(period.end) - 1).toISOString(), timeZone)} onChange={(event) => { if (event.target.value) updateRules((current) => ({ ...current, periods: current.periods.map((row, i) => i === index ? { ...row, end: leagueDayBoundary(event.target.value, timeZone, true) } : row) })); }} /></label></>}<AcquisitionPeriodTimes key={`${period.start}:${period.end}:${period.timeZone ?? timeZone}`} period={period} leagueTimeZone={timeZone} onApply={period => updateRules(current => ({ ...current, periods: current.periods.map((row, i) => i === index ? period : row) }))} /><label>Moves left<input type="number" min="0" value={period.remaining ?? ""} onChange={(event) => updateRules((current) => ({ ...current, periods: current.periods.map((row, i) => i === index ? { ...row, remaining: event.target.value === "" ? null : Number(event.target.value), source: "manager" } : row) }))} /></label><button aria-label={`Remove period ${period.id}`} onClick={() => updateRules((current) => ({ ...current, periods: current.periods.filter((_, i) => i !== index) }))}>×</button></div>)}<button disabled={Boolean(windowUnavailable)} aria-describedby={windowUnavailable ? "rso-period-reason" : undefined} onClick={() => updateRules((current) => ({ ...current, periods: [...current.periods, { id: `Period ${current.periods.length + 1}`, start: leagueDayBoundary(startDate, timeZone), end: leagueDayBoundary(endDate, timeZone, true), remaining: null, source: "manager" }] }))}>Add acquisition period</button>{windowUnavailable && <small id="rso-period-reason">{windowUnavailable}</small>}
    </div>
  </fieldset>;
}

function ExtraRules({ rules, startDate, endDate, timeZone, updateRules, showAcquisitionRules }: { rules: LeagueRules; startDate: string; endDate: string; timeZone: string; updateRules: (change: (rules: LeagueRules) => LeagueRules) => void; showAcquisitionRules: () => void }) {
  const weights = rules.scoring.weights;
  const categories = rules.scoring.categories;
  const lineupPeriods = rules.lineupPeriods ?? [];
  const windowUnavailable = !startDate || !endDate ? "Select start and end dates before adding a period or lineup window." : startDate > endDate ? "Start date must be on or before end date." : null;
  return <details className={styles.settings}><summary>Scoring, budgets, and lock windows</summary><p>For acquisition timing, counting cost and remaining moves, <button onClick={showAcquisitionRules}>Review acquisition rules</button>.</p><div className={styles.ruleFields}>
    <label>Waiver mode<select value={rules.waivers?.mode ?? "unknown"} onChange={(event) => updateRules((current) => ({ ...current, waivers: { mode: event.target.value as NonNullable<LeagueRules["waivers"]>["mode"], remainingBudget: current.waivers?.remainingBudget ?? null } }))}><option value="unknown">Unknown</option><option value="priority">Priority</option><option value="budget">Budget</option></select></label>
    {rules.waivers?.mode === "budget" && <label>Waiver budget remaining<input type="number" min="0" value={rules.waivers.remainingBudget ?? ""} onChange={(event) => updateRules((current) => ({ ...current, waivers: { mode: "budget", remainingBudget: event.target.value === "" ? null : Number(event.target.value) } }))} /></label>}
    <label>Goalie counting<select value={rules.goalieMinimum.counts} onChange={(event) => updateRules((current) => ({ ...current, goalieMinimum: { ...current.goalieMinimum, counts: event.target.value as LeagueRules["goalieMinimum"]["counts"] } }))}><option value="unknown">Unknown</option><option value="starts">Starts</option><option value="appearances">Appearances</option></select></label>
    <label>Goalie penalty<select value={rules.goalieMinimum.penalty} onChange={(event) => updateRules((current) => ({ ...current, goalieMinimum: { ...current.goalieMinimum, penalty: event.target.value as LeagueRules["goalieMinimum"]["penalty"] } }))}><option value="unknown">Unknown</option><option value="lose_goalie_categories">Lose goalie categories</option><option value="none">None</option></select></label>
    <label>Goalie period start<input type="date" value={rules.goalieMinimum.periodStart ?? ""} onChange={(event) => updateRules((current) => ({ ...current, goalieMinimum: { ...current.goalieMinimum, periodStart: event.target.value || null } }))} /></label>
    <label>Goalie period end<input type="date" value={rules.goalieMinimum.periodEnd ?? ""} onChange={(event) => updateRules((current) => ({ ...current, goalieMinimum: { ...current.goalieMinimum, periodEnd: event.target.value || null } }))} /></label>
    <h4>Point weights</h4>{Object.entries(weights).map(([stat, weight]) => <div className={styles.ruleRow} key={stat}><label>Statistic<input defaultValue={stat} onBlur={(event) => { const renamed = event.target.value.trim(); if (!renamed || renamed === stat) return; const next = { ...weights }; delete next[stat]; next[renamed] = weight; updateRules((current) => ({ ...current, scoring: { ...current.scoring, weights: next } })); }} /></label><label>Weight<input type="number" step="any" value={weight} onChange={(event) => updateRules((current) => ({ ...current, scoring: { ...current.scoring, weights: { ...current.scoring.weights, [stat]: Number(event.target.value) } } }))} /></label><button aria-label={`Remove ${stat} weight`} onClick={() => { const next = { ...weights }; delete next[stat]; updateRules((current) => ({ ...current, scoring: { ...current.scoring, weights: next } })); }}>×</button></div>)}<button onClick={() => { let stat = "STAT"; let i = 2; while (stat in weights) stat = `STAT${i++}`; updateRules((current) => ({ ...current, scoring: { ...current.scoring, weights: { ...current.scoring.weights, [stat]: 1 } } })); }}>Add point weight</button>
    <h4>Categories</h4>{categories.map((category, index) => <div className={styles.ruleRow} key={index}><label>Stat<input value={category.key} onChange={(event) => updateRules((current) => ({ ...current, scoring: { ...current.scoring, categories: current.scoring.categories.map((row, i) => i === index ? { ...row, key: event.target.value } : row) } }))} /></label><label>Direction<select value={category.direction} onChange={(event) => updateRules((current) => ({ ...current, scoring: { ...current.scoring, categories: current.scoring.categories.map((row, i) => i === index ? { ...row, direction: event.target.value as "higher" | "lower" } : row) } }))}><option value="higher">Higher</option><option value="lower">Lower</option></select></label><label>Numerator<input value={category.numerator ?? ""} onChange={(event) => updateRules((current) => ({ ...current, scoring: { ...current.scoring, categories: current.scoring.categories.map((row, i) => i === index ? { ...row, numerator: event.target.value || undefined } : row) } }))} /></label><label>Denominator<input value={category.denominator ?? ""} onChange={(event) => updateRules((current) => ({ ...current, scoring: { ...current.scoring, categories: current.scoring.categories.map((row, i) => i === index ? { ...row, denominator: event.target.value || undefined } : row) } }))} /></label><button aria-label={`Remove category ${category.key}`} onClick={() => updateRules((current) => ({ ...current, scoring: { ...current.scoring, categories: current.scoring.categories.filter((_, i) => i !== index) } }))}>×</button></div>)}<button onClick={() => updateRules((current) => ({ ...current, scoring: { ...current.scoring, categories: [...current.scoring.categories, { key: "STAT", direction: "higher" }] } }))}>Add category</button>
    <h4>Weekly lineup windows</h4>{lineupPeriods.map((period, index) => <div className={styles.ruleRow} key={index}><label>Window<input value={period.id} onChange={(event) => updateRules((current) => ({ ...current, lineupPeriods: (current.lineupPeriods ?? []).map((row, i) => i === index ? { ...row, id: event.target.value } : row) }))} /></label><label>Start<input type="date" value={leagueDate(period.start, timeZone)} onChange={(event) => { if (event.target.value) updateRules((current) => ({ ...current, lineupPeriods: (current.lineupPeriods ?? []).map((row, i) => i === index ? { ...row, start: leagueDayBoundary(event.target.value, timeZone) } : row) })); }} /></label><label>End<input type="date" value={leagueDate(new Date(Date.parse(period.end) - 1).toISOString(), timeZone)} onChange={(event) => { if (event.target.value) updateRules((current) => ({ ...current, lineupPeriods: (current.lineupPeriods ?? []).map((row, i) => i === index ? { ...row, end: leagueDayBoundary(event.target.value, timeZone, true) } : row) })); }} /></label><label>Lock at<input type="datetime-local" value={period.lockAt ? leagueDateTime(period.lockAt, timeZone) : ""} onChange={(event) => updateRules((current) => ({ ...current, lineupPeriods: (current.lineupPeriods ?? []).map((row, i) => i === index ? { ...row, lockAt: event.target.value ? instantFromLeagueTime(event.target.value, timeZone) : null } : row) }))} /></label><button aria-label={`Remove window ${period.id}`} onClick={() => updateRules((current) => ({ ...current, lineupPeriods: (current.lineupPeriods ?? []).filter((_, i) => i !== index) }))}>×</button></div>)}<button disabled={Boolean(windowUnavailable)} aria-describedby={windowUnavailable ? "rso-window-reason" : undefined} onClick={() => updateRules((current) => ({ ...current, lineupPeriods: [...(current.lineupPeriods ?? []), { id: `Window ${(current.lineupPeriods ?? []).length + 1}`, start: leagueDayBoundary(startDate, timeZone), end: leagueDayBoundary(endDate, timeZone, true), lockAt: null }] }))}>Add lineup window</button>{windowUnavailable && <small id="rso-window-reason">{windowUnavailable}</small>}
  </div></details>;
}

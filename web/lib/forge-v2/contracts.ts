/** FORGE product v2. These contracts do not change the private Player Forecasts system. */
export const CATEGORIES = ["G", "A", "PPP", "SOG", "HIT", "BLK", "PIM"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Horizon = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export const TARGET_VERSION = "nhl-official-skater-appearance-v1" as const;
export const CONDITIONING = "official_appearance_given_game_occurs" as const;
export type EvidenceClass = "fixture" | "retrospective_reconstruction" | "prospective_shadow" | "public_serving";
export type Available<T> = { state: "available"; value: T };
export type Unavailable = { state: "unavailable"; reason: string };
export type Component<T> = Available<T> | Unavailable;
export type Categories<T> = Record<Category, T>;
export type CategoryMeans = Categories<Component<number>>;
export type Instant = string;
export type Appearance = "official_appearance" | "dressed_unused" | "nonappearance" | "ambiguous" | "game_not_played";
export type GameStatus = "scheduled" | "postponed" | "cancelled" | "in_progress" | "suspended" | "final";

export interface Target {
  playerId: number;
  gameId: number;
  seasonId: number;
  targetVersion: typeof TARGET_VERSION;
  conditioning: typeof CONDITIONING;
}

export interface SourceClock {
  observedAt: Instant;
  publishedAt: Instant | null;
  firstReceivedAt: Instant;
}

export interface SourceReference extends SourceClock {
  id: string;
  revision: string;
  sha256: string;
  source: string;
  /** Unknown rights/receipt history never becomes admissible by inference. */
  use: "approved" | "unknown" | "restricted";
}

export interface ScheduleGame {
  gameId: number;
  seasonId: number;
  gameType: "regular" | "preseason" | "playoff";
  homeTeamId: number;
  awayTeamId: number;
  sourceGameDate: string;
  scheduledStartAt: Instant | null;
  actualStartAt: Instant | null;
  status: GameStatus;
  revision: string;
  source: SourceReference;
  noPlayConfirmed: boolean;
  replacementGameId: number | null;
}

export interface Affiliation {
  playerId: number;
  teamId: number | null;
  position: "F" | "D" | "G" | "unknown";
  status: "roster" | "injury_reserve" | "reserve" | "assigned" | "unresolved";
  effectiveAt: Instant;
  revision: string;
  source: SourceReference;
}

export interface Opportunity extends Target {
  id: string;
  teamId: number;
  opponentId: number;
  home: boolean;
  horizon: Horizon;
  observedAt: Instant;
  scheduleRevision: string;
  affiliationRevision: string;
  scheduledStartAt: Instant;
  sourceGameDate: string;
}

export interface HorizonEpisode extends Target {
  id: string;
  horizon: Horizon;
  /** Count within this target/horizon, never reset on a reschedule. */
  episode: number;
  enteredAt: Instant;
  exitedAt: Instant | null;
  scheduleRevision: string;
  affiliationRevision: string;
}

export interface LockEpoch {
  id: string;
  gameId: number;
  adoptedAt: Instant;
  lockAt: Instant;
  scheduleRevision: string;
  predecessorId: string | null;
  reopened: boolean;
  actualStartAt: Instant | null;
  /** Authoritative play-begun evidence survives even if exact actual-start time is unknown. */
  playBegun: boolean;
  timingStatus: "provisional" | "confirmed";
}

export interface ScoringProfile {
  id: string;
  ruleVersion: "linear-seven-v1";
  weights: Categories<number>;
}

export interface ArtifactReference {
  id: string;
  version: string;
  sha256: string;
  kind: "joint_distribution" | "calibration";
  schemaVersion: string;
  decoderVersion: string;
  calculationVersion: string;
  categories: Category[];
  horizons: Horizon[];
  cohorts: string[];
  profileIds: string[];
  targetVersion: typeof TARGET_VERSION;
  conditioning: typeof CONDITIONING;
}

export interface Participation {
  event: "official_appearance_given_game_occurs";
  probability: Component<number>;
  verifiedStatus: "available" | "injured" | "scratched" | "unknown";
  modelVersion: string;
  qualificationId: string | null;
  evidenceIds: string[];
}

export interface Vintage extends Target {
  id: string;
  issuanceKey: string;
  sequence: number;
  teamId: number;
  opponentId: number;
  home: boolean;
  horizon: Horizon;
  episodeId: string;
  lockEpochId: string;
  scheduleRevision: string;
  affiliationRevision: string;
  sourceGameDate: string;
  scheduledStartAt: Instant;
  inputCutoffAt: Instant;
  generatedAt: Instant;
  means: CategoryMeans;
  participation: Participation;
  distribution: Component<ArtifactReference>;
  calibration: Component<ArtifactReference>;
  scoring: ScoringProfile;
  modelVersion: string;
  featureVersion: string;
  codeVersion: string;
  cohort: string;
  qualificationId: string | null;
  sourceManifest: SourceReference[];
  trigger: "daily" | "pregame" | "material";
  predecessorId: string | null;
  evidenceClass: EvidenceClass;
  limitations: string[];
}

/** Receipt is written only after a separate reader sees committed, hash-matching bytes. */
export interface PublicationReceipt {
  id: string;
  vintageId: string;
  outputHash: string;
  confirmedAt: Instant;
  witness: "committed_readback";
  evidenceClass: EvidenceClass;
}
export interface PublishedVintage { vintage: Vintage; receipt: PublicationReceipt }

export interface QualificationManifest {
  id: string;
  version: string;
  createdAt: Instant;
  targetVersion: typeof TARGET_VERSION;
  conditioning: typeof CONDITIONING;
  modelVersion: string;
  featureVersion: string;
  codeVersion: string;
  horizons: Horizon[];
  cohorts: string[];
  categories: Category[];
  profileIds: string[];
  participationModelVersion: string;
  participationQualified: boolean;
  intervalLevels: Array<0.5 | 0.9>;
  artifactHashes: string[];
  finalEvaluationId: string;
  prospectiveEvaluationId: string;
  independentReviewId: string;
  status: "unqualified" | "qualified" | "withdrawn";
  evidenceClass: Exclude<EvidenceClass, "fixture">;
}

export interface OutcomeRevision extends Target {
  id: string;
  predecessorId: string | null;
  appearance: Appearance;
  values: Categories<Component<number>>;
  status: "pending" | "provisional" | "final" | "corrected";
  source: SourceReference;
  recordedAt: Instant;
  reason: string | null;
}

export interface HistoryEvent extends Target {
  id: string;
  at: Instant;
  kind: "failed_attempt" | "unavailable" | "missing_refresh" | "retraction" | "technical_correction" | "team_change";
  reason: string;
  vintageId: string | null;
  predecessorId: string | null;
}

export interface Interval { level: 0.5 | 0.9; lower: number; upper: number }
export interface PublicRevision {
  id: string;
  sequence: number;
  publishedAt: Instant;
  inputCutoffAt: Instant;
  horizon: Horizon;
  teamId: number;
  modelVersion: string;
  trigger: Vintage["trigger"];
  evidenceClass: EvidenceClass;
  value: Component<number>;
  issuedValue: Component<number>;
  issuedProfileId: string;
  means: CategoryMeans;
  participation: Component<number>;
  intervals: Component<Interval[]>;
  intervalVintageId: string;
  eligiblePregame: boolean;
  artifactState: "online" | "archived" | "retrieval_pending" | "unavailable";
  limitations: string[];
}

export interface PublicGameView {
  profileId: string;
  opportunity: Opportunity;
  revisions: PublicRevision[];
  events: HistoryEvent[];
  nextCursor: string | null;
  lockedFinal: { state: "pending" | "selected" | "unavailable"; vintageId: string | null; value: Component<number>; lockAt: Instant; timingStatus: "provisional" | "confirmed"; reason: string | null };
  actual: { revisionId: string | null; appearance: Appearance | "pending"; value: Component<number>; status: OutcomeRevision["status"] };
  freshness: { state: "fresh" | "stale" | "late" | "unavailable"; asOf: Instant; reason: string | null };
  qualification: { state: "qualified" | "unqualified"; reason: string; supportedHorizons: Horizon[]; supportedCategories: Category[] };
}

export interface PublicAccountability {
  requested: number;
  forecastCount: number;
  outcomeCount: number;
  abstentions: number;
  mae: Component<number>;
  rmse: Component<number>;
  bias: Component<number>;
  evidenceClass: EvidenceClass;
  limitations: string[];
}

export interface PublicPlayerView {
  player: { id: number; name: string };
  games: PublicGameView[];
  excluded: Array<{ gameId: number | null; reason: string }>;
  profile: ScoringProfile;
  scoringLabel: "as issued" | "re-scored under selected profile";
  methodology: string;
  accountability: PublicAccountability;
}

export function available<T>(value: T): Available<T> { return { state: "available", value }; }
export function unavailable(reason: string): Unavailable {
  if (!reason.trim()) throw new Error("Unavailable values require a reason");
  return { state: "unavailable", reason };
}
export function assertId(value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("Invalid canonical NHL identity");
}
export function instant(value: string): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) throw new Error("UTC instant required");
  const ms = Date.parse(value);
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== (value.includes(".") ? value : value.replace("Z", ".000Z"))) throw new Error("Invalid UTC instant");
  return ms;
}
export function assertTarget(target: Target): void {
  assertId(target.playerId); assertId(target.gameId); assertId(target.seasonId);
  if (target.targetVersion !== TARGET_VERSION || target.conditioning !== CONDITIONING) throw new Error("Incompatible forecast target");
}
export function assertHorizon(horizon: number): asserts horizon is Horizon {
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 10) throw new Error("Horizon must be H1–H10");
}
export function assertComponent(value: Component<number>, probability = false): void {
  if (!value || !["available", "unavailable"].includes(value.state)) throw new Error("Invalid component state");
  if (value.state === "unavailable") {
    if (!value.reason?.trim()) throw new Error("Missing unavailability reason");
  } else if (!Number.isFinite(value.value) || value.value < 0 || (probability && value.value > 1)) throw new Error("Invalid component value");
}

export function assertSource(source: SourceReference, cutoffAt?: Instant): void {
  if (!source || !source.id || !source.revision || !source.source || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error("Incomplete source reference");
  const received = instant(source.firstReceivedAt);
  if (instant(source.observedAt) > received || (source.publishedAt !== null && instant(source.publishedAt) > received)) throw new Error("Source clock conflict");
  if (source.use !== "approved") throw new Error("Source use not approved");
  if (cutoffAt && received > instant(cutoffAt)) throw new Error("Source unavailable at cutoff");
}

export function assertArtifact(reference: ArtifactReference): void {
  if (!reference || !reference.id || !reference.version || !/^[a-f0-9]{64}$/.test(reference.sha256)) throw new Error("Invalid artifact identity");
  if (!reference.schemaVersion || !reference.decoderVersion || !reference.calculationVersion || !["joint_distribution", "calibration"].includes(reference.kind)) throw new Error("Missing artifact calculation contract");
  if (reference.targetVersion !== TARGET_VERSION || reference.conditioning !== CONDITIONING) throw new Error("Incompatible artifact target");
  if (!reference.categories.length || new Set(reference.categories).size !== reference.categories.length || reference.categories.some(c => !CATEGORIES.includes(c))) throw new Error("Invalid artifact categories");
  if (!reference.horizons.length || !reference.cohorts.length || !Array.isArray(reference.profileIds)) throw new Error("Missing artifact applicability");
  reference.horizons.forEach(assertHorizon);
}

export function assertVintage(vintage: Vintage): void {
  assertTarget(vintage); assertHorizon(vintage.horizon);
  assertId(vintage.teamId); assertId(vintage.opponentId);
  if (vintage.teamId === vintage.opponentId || typeof vintage.home !== "boolean") throw new Error("Invalid game sides");
  if (!Number.isSafeInteger(vintage.sequence) || vintage.sequence <= 0) throw new Error("Invalid issuance sequence");
  for (const key of ["id", "issuanceKey", "episodeId", "lockEpochId", "scheduleRevision", "affiliationRevision", "modelVersion", "featureVersion", "codeVersion", "cohort"] as const) {
    if (typeof vintage[key] !== "string" || !vintage[key].trim()) throw new Error(`Missing vintage ${key}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vintage.sourceGameDate)) throw new Error("Missing source game date");
  instant(vintage.scheduledStartAt);
  if (instant(vintage.generatedAt) < instant(vintage.inputCutoffAt)) throw new Error("Generation precedes cutoff");
  if (!Array.isArray(vintage.sourceManifest) || !vintage.sourceManifest.length) throw new Error("Missing source manifest");
  vintage.sourceManifest.forEach(source => assertSource(source, vintage.inputCutoffAt));
  CATEGORIES.forEach(c => assertComponent(vintage.means[c]));
  const g = vintage.means.G, a = vintage.means.A, ppp = vintage.means.PPP;
  if (g.state === "available" && a.state === "available" && ppp.state === "available" && ppp.value > g.value + a.value + 1e-12) throw new Error("PPP exceeds G+A");
  if (vintage.participation.event !== CONDITIONING || !vintage.participation.modelVersion || !Array.isArray(vintage.participation.evidenceIds)) throw new Error("Invalid participation contract");
  assertComponent(vintage.participation.probability, true);
  if (!["available", "injured", "scratched", "unknown"].includes(vintage.participation.verifiedStatus)) throw new Error("Invalid availability status");
  for (const [key, kind] of [["distribution", "joint_distribution"], ["calibration", "calibration"]] as const) {
    const component = vintage[key];
    if (component.state === "available") {
      assertArtifact(component.value);
      if (component.value.kind !== kind || !component.value.horizons.includes(vintage.horizon) || !component.value.cohorts.includes(vintage.cohort)) throw new Error("Artifact not applicable to vintage");
    } else if (component.state !== "unavailable" || !component.reason) throw new Error("Invalid artifact availability");
  }
  if (!vintage.scoring || vintage.scoring.ruleVersion !== "linear-seven-v1" || !vintage.scoring.id || CATEGORIES.some(c => !Number.isFinite(vintage.scoring.weights[c]))) throw new Error("Invalid issued scoring profile");
  if (!["daily", "pregame", "material"].includes(vintage.trigger) || !["fixture", "retrospective_reconstruction", "prospective_shadow", "public_serving"].includes(vintage.evidenceClass)) throw new Error("Invalid issuance class");
  for (const value of [vintage.predecessorId, vintage.qualificationId, vintage.participation.qualificationId]) if (value !== null && (typeof value !== "string" || !value)) throw new Error("Missing nullable identity");
  if (!Array.isArray(vintage.limitations)) throw new Error("Missing limitations");
}

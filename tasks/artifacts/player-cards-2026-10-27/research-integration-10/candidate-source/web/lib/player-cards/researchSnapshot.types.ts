/** Offline additive Card boundary. No production/live mode is defined in v1. */
export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };
export type Track = 'fantasy_points' | 'raw_points' | 'wigo_game_score' | 'composite';
export type StreakState = 'unavailable' | 'warming_up' | 'normal' | 'pending_hot' | 'pending_cold' |
  'candidate_cancelled' | 'confirmed_hot' | 'confirmed_cold' | 'exiting_hot' | 'exiting_cold' | 'exited' | 'censored';
export interface EpisodeFacts {
  readonly id: string | null; readonly direction: 'hot' | 'cold';
  readonly firstCrossingOn: string | null; readonly confirmedOn: string | null;
  readonly exitConfirmedOn: string | null; readonly censoredOn: string | null;
}
export interface StreakTrack {
  readonly status: StreakState; readonly availability: 'available' | 'partial' | 'unavailable'; readonly reason: string | null;
  readonly reference: {
    readonly kind: 'frozen_previous_regular_season'; readonly seasonId: 20222023;
    readonly requiredRecordedSlots: 50; readonly observedRecordedSlots: number; readonly status: string;
    readonly sourceIds: readonly number[]; readonly dates: readonly string[];
    readonly rawMean: number | null; readonly rawSampleSD: number | null; readonly block5SampleSD: number | null;
    readonly cohortFallbackUsed: false;
  };
  readonly observation: null | { readonly gameDate: string; readonly sourceId: number; readonly sourceIndex: number;
    readonly savedPhase: string; readonly savedState: string; readonly contextBoundary: string | null };
  readonly signal: { readonly savedZ: number | null; readonly valuePerGame: number | null;
    readonly windowSourceIds: readonly number[] | null; readonly windowDates: readonly string[] | null; readonly requiredSlots: 5 };
  readonly episode: EpisodeFacts | null;
  readonly lastTransition: null | { readonly kind: string; readonly eventOn: string; readonly knownOn: string };
  readonly lastKnownFlag: 'hot' | 'cold' | null; readonly issuedAtUTC: null;
  readonly timePrecision: 'game_date'; readonly retrospectivePhaseLabelsIncluded: false;
}
export interface BlshResearch {
  readonly version: 'support-conditioned-production-gap-v1';
  readonly status: 'unavailable' | 'measured_process' | 'provisional' | 'conflicting' | 'balanced' | 'unsupported_direction';
  readonly reason: string | null; readonly productionP: number | null; readonly supportDiscrepancy: number | null;
  readonly direction: 'BL' | 'SH' | null; readonly includedInSavedResearchList: boolean;
  readonly trustedForActivation: false; readonly confidenceProbability: null; readonly recommendation: null;
  readonly sourceSnapshotDate: string | null; readonly sourceCandidate: Json; readonly components: Json; readonly windows: Json;
}
export interface PlayerResearchSnapshotV1 {
  readonly schemaVersion: 'fhfh.player-research-snapshot.v1'; readonly playerId: number;
  readonly fixtureKind: 'historical_development' | 'synthetic_contract';
  readonly usage: { readonly researchOnly: true; readonly productionDetectorSelected: false; readonly trustedForActivation: false };
  readonly asOf: { readonly eventThroughDate: string; readonly sourceAvailableThroughUTC: null; readonly retrievedAtUTC: null;
    readonly issuedAtUTC: null; readonly generatedAtUTC: string; readonly historicalIssuance: false; readonly timePrecision: 'game_date' };
  readonly streak: { readonly version: 'blsh-overnight-three-track-v2'; readonly researchOption: 'block5';
    readonly productionAdopted: false; readonly availability: 'available' | 'partial' | 'unavailable';
    readonly parameters: Json; readonly tracks: Readonly<Record<Track, StreakTrack>> };
  readonly blshResearch: BlshResearch; readonly limits: readonly string[];
}
// Proposed extension only: existing Card fields are neither replaced nor renamed.
export interface ResearchCardExtension { readonly playerResearchSnapshot?: PlayerResearchSnapshotV1 }

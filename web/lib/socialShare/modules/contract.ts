import { SHARE_TIME_ZONE, type ShareDataState } from "lib/socialShare/types";
import type { ComponentType } from "react";
import type { PeriodControl } from "./shared/periodWindow";

/**
 * The post-module seam (CONTRACT.md in tasks/artifacts/social-share-expansion-2026-10-31). A new post is its own files:
 * `lib/socialShare/modules/<name>.ts` (this contract), its test, an optional `<name>.sources.ts`, and
 * `components/SocialShare/modules/<Name>Card.tsx`, listed in its lane's barrel (`modules/lanes/<lane>.ts`).
 * Access control, the same-snapshot PNG, labels and unavailable states come from the shell, not from the post.
 */
export const SHARE_POST_SLUG = /^[a-z][a-z0-9-]{0,47}$/;
export const SHARE_POST_DEFAULT_TTL_SECONDS = 900;

/** What a card's claims are; the shell prints it on every card and export. */
export type SharePostBasis = "observed" | "market-observation" | "hypothetical" | "conditional-forecast";
export const SHARE_BASIS_LABELS: Record<SharePostBasis, string> = {
  observed: "OBSERVED RESULTS", "market-observation": "MARKET OBSERVATION", hypothetical: "HYPOTHETICAL SCENARIO", "conditional-forecast": "CONDITIONAL FORECAST",
};
export type SharePostGroup = "skaters" | "goalies" | "schedule" | "comparison";
export const SHARE_POST_GROUP_LABELS: Record<SharePostGroup, string> = { skaters: "Skaters", goalies: "Goalies", schedule: "Schedule", comparison: "Comparisons" };

export type ShareSettingValue = string | number | null;
export type ShareSettings = Record<string, ShareSettingValue>;
type FieldBase = {
  id: string; label: string;
  /** Applied in the browser to the loaded snapshot: changing it never refetches, and the export token still covers it. */
  clientOnly?: boolean;
  /** Set through the post's `panel`, so the settings form leaves it out; it still round-trips through the URL and the token. */
  panelOnly?: boolean;
  /** Drawn on the settings form only while the post's `period` field holds this value. */
  onlyForPeriod?: string;
};
/** Every configurable threshold is a field, so its default and active value are visible in the studio and the export. */
export type ShareSettingField =
  | FieldBase & { kind: "number"; default: number | null; min: number; max: number; step?: number }
  | FieldBase & { kind: "select"; default: string; options: readonly { value: string; label: string }[] }
  | FieldBase & { kind: "date"; default: string | null }
  | FieldBase & { kind: "text"; default: string; maxLength?: number };

export type SharePostSource = {
  /** Reader-facing name, e.g. "NHL.com game stats"; `tables` names the exact relations read. */
  name: string; tables: readonly string[]; state: ShareDataState;
  /** Newest game or observation date covered, and the writer's last update; null when the source does not say. */
  asOf: string | null; updatedAt: string | null; reasons?: readonly string[];
};
/** Required on every snapshot: the shell prints all of it, so a post cannot ship without its labels. */
export type SharePostEvidence = {
  sources: readonly SharePostSource[];
  /** Actual sample, e.g. "Last 7 days: 212 skaters, 34 completed games". */
  sample: string;
  /** e.g. "All situations". */
  strength: string;
  /** Who is compared and how many, e.g. "All 32 teams". */
  cohort: string;
  coverage: { observed: number; expected: number | null; missing: number; unit: string } | null;
};
export const UNKNOWN_EVIDENCE: SharePostEvidence = { sources: [], sample: "Not available", strength: "Not available", cohort: "Not available", coverage: null };

export type SharePostSnapshot<Settings extends ShareSettings = ShareSettings, Data = unknown> = {
  schemaVersion: 1; id: string; post: string;
  state: ShareDataState; reasons: string[];
  generatedAt: string; expiresAt: string | null; timeZone: typeof SHARE_TIME_ZONE;
  settings: Settings; evidence: SharePostEvidence; data: Data | null;
  /** Abbreviations whose logos the shell prepares before the preview can render. */
  teams: string[];
  /** Offline fixture data: the shell watermarks it and refuses every export. Real sources never set this. */
  fixture: boolean;
  /** Notes for the editor, such as a window cut short by a late feed: printed beside the card, never on the PNG. */
  pageNotes?: string[];
};
export type SharePostLoadResult<Data> = { state: ShareDataState; reasons?: string[]; evidence: SharePostEvidence; data: Data | null; teams?: string[]; ttlSeconds?: number; pageNotes?: string[] };

/** Structural subset of the supabase-js client; tests pass a fake with the same methods. */
export type SharePostReadClient = { from: (table: string) => any };
export type SharePostContext = { client: SharePostReadClient; generatedAt: string };

export type SharePostCardProps<Settings extends ShareSettings = ShareSettings, Data = unknown> = {
  snapshot: SharePostSnapshot<Settings, Data>; data: Data; settings: Settings; logos: Record<string, string | null>;
};

/** A sidebar beside the preview for posts built by hand from the loaded edition. It sets fields through `change`, never the data. */
export type SharePostPanelProps<Settings extends ShareSettings = ShareSettings, Data = unknown> = SharePostCardProps<Settings, Data> & {
  change: (fieldId: string, value: ShareSettingValue) => void; disabled: boolean;
};

export type ShareModule<Settings extends ShareSettings = ShareSettings, Data = unknown> = {
  id: string; title: string; summary: string; group: SharePostGroup; basis: SharePostBasis;
  /** The card's printed headline when it follows the settings or the edition; `title` still names the post in the studio. */
  headline?: (settings: Settings, data?: Data | null) => string;
  /** The line above the headline, when one post's views cover more than its group. */
  kicker?: (settings: Settings) => string;
  /** A suggestion shown beside the post; posts are chosen freely and nothing is scheduled. */
  suggestedUse?: string;
  fields: readonly ShareSettingField[];
  /** Draws the shared period control over the fields from `periodWindowFields` (shared/periodWindow.ts). */
  periodControl?: PeriodControl;
  /** Cross-field checks on already typed settings; return a reason to refuse them. */
  validate?: (settings: Settings) => string | null;
  /** Server only and lazy, so a definition file stays free of Supabase imports. A failure becomes a "missing" snapshot. */
  load: () => Promise<(context: SharePostContext, settings: Settings) => Promise<SharePostLoadResult<Data>>>;
  card: () => Promise<ComponentType<SharePostCardProps<Settings, Data>>>;
  panel?: () => Promise<ComponentType<SharePostPanelProps<Settings, Data>>>;
  /** True when this data and these settings have something to publish. An empty pool stays empty and is not exportable. */
  hasRows: (data: Data, settings: Settings) => boolean;
  altText: (snapshot: SharePostSnapshot<Settings, Data>, data: Data, settings: Settings) => string;
};
/* Module generics are erased at the registry: each module only ever receives its own settings and data. */
export type AnyShareModule = ShareModule<any, any>;
export const defineShareModule = <Settings extends ShareSettings, Data>(module: ShareModule<Settings, Data>): AnyShareModule => module;

export class SharePostRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const fieldValue = (field: ShareSettingField, raw: string): ShareSettingValue => {
  const refuse = (): never => { throw new SharePostRequestError(`Invalid value for ${field.label}.`, 400); };
  switch (field.kind) {
    case "number": {
      const value = raw.trim() === "" ? NaN : Number(raw);
      return !Number.isFinite(value) || value < field.min || value > field.max ? refuse() : value;
    }
    case "select": return field.options.some(option => option.value === raw) ? raw : refuse();
    case "date": return /^[1-9]\d{3}-\d{2}-\d{2}$/.test(raw) && new Date(`${raw}T12:00:00Z`).toISOString().slice(0, 10) === raw ? raw : refuse();
    case "text": return raw.length <= (field.maxLength ?? 80) ? raw : refuse();
  }
};
/** Typed settings from a query: unknown keys are refused, absent ones take their visible defaults. */
export function parseShareSettings<Settings extends ShareSettings>(module: Pick<ShareModule<Settings, unknown>, "fields" | "validate">, query: Record<string, string | undefined>, scope: "server" | "all" = "all"): Settings {
  const fields = module.fields.filter(field => scope === "all" || !field.clientOnly);
  for (const key of Object.keys(query)) if (!fields.some(field => field.id === key)) throw new SharePostRequestError("Invalid query parameters.", 400);
  const settings: ShareSettings = {};
  for (const field of module.fields) {
    const raw = fields.includes(field) ? query[field.id] : undefined;
    try { settings[field.id] = raw === undefined ? field.default : fieldValue(field, raw); }
    catch (cause) { if (cause instanceof SharePostRequestError) throw cause; throw new SharePostRequestError(`Invalid value for ${field.label}.`, 400); }
  }
  const reason = module.validate?.(settings as Settings);
  if (reason) throw new SharePostRequestError(reason, 400);
  return settings as Settings;
}
/** Stable key over a post's settings, in field order. */
export const shareSettingsKey = (fields: readonly ShareSettingField[], settings: ShareSettings) => JSON.stringify(fields.map(field => [field.id, settings[field.id] ?? null]));
export const sharePostExportToken = (fields: readonly ShareSettingField[], snapshot: Pick<SharePostSnapshot, "id" | "post">, settings: ShareSettings) => `${snapshot.id}|${snapshot.post}|${shareSettingsKey(fields, settings)}`;
/** Active settings as printed on the card, with the select's label rather than its value. */
export function shareSettingLines(fields: readonly ShareSettingField[], settings: ShareSettings) {
  return fields.map(field => {
    const value = settings[field.id] ?? null;
    const shown = value === null || value === "" ? "any" : field.kind === "select" ? field.options.find(option => option.value === value)?.label ?? String(value) : String(value);
    return { id: field.id, label: field.label, value: shown };
  });
}
/** Why this snapshot cannot be exported right now, or null when it can. Checked before and after capture. */
/** Header type shrinks past 22 characters, the most the 52px header holds on one line, so a long headline keeps to one line where it can. */
export const shareHeadlineSize = (headline: string) => headline.length <= 22 ? undefined : Math.max(32, Math.floor(52 * 22 / headline.length));

export function sharePostExportBlock(module: Pick<AnyShareModule, "hasRows" | "fields">, snapshot: SharePostSnapshot, settings: ShareSettings, now = Date.now()): string | null {
  if (snapshot.fixture) return "Offline fixture data cannot be exported.";
  if (snapshot.state !== "ready" || snapshot.data === null) return snapshot.reasons[0] ?? "This post's sources are not ready.";
  if (!snapshot.expiresAt || Date.parse(snapshot.expiresAt) <= now) return "This edition expired. Load a new one before downloading.";
  if (!snapshot.evidence.sources.length) return "This post has no source labels.";
  // The card and footer print the current settings, so data built under other server settings would export mislabeled.
  const serverFields = module.fields.filter(field => !field.clientOnly);
  if (shareSettingsKey(serverFields, snapshot.settings) !== shareSettingsKey(serverFields, settings)) return "Settings changed. Wait for the post to update before downloading.";
  return module.hasRows(snapshot.data, settings) ? null : "Nothing qualifies with these settings.";
}
/** Partial data may preview under its warning; stale, missing and blocked data never render as a card. */
export const sharePostShowsCard = (snapshot: SharePostSnapshot) => snapshot.data !== null && (snapshot.state === "ready" || snapshot.state === "partial");

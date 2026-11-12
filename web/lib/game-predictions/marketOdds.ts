/**
 * Client-safe market win probability from the NHL schedule feed
 * (`/api/v1/schedule/date/[date]`, a pass-through of NHL `/schedule/{date}`).
 * Owner decision 42: this is a labelled market probability, never an FHFH
 * prediction. Imports nothing server-side.
 *
 * Declared source format for an NHL schedule odds offer `{ providerId, value }`:
 * - a signed integer (`+150`, `-180`) with |value| >= 100 is American odds;
 * - an unsigned value with a decimal point (`2.50`) above 1 is decimal odds;
 * - an unsigned integer (`150`) is ambiguous between the two and unavailable;
 * - anything else is invalid.
 *
 * Pairing: one sportsbook prices both sides. The book is chosen from those with
 * exactly one valid price on each side and an implied-probability sum inside
 * devig.ts's sanity band, in preference order provider 9, then 8, then the
 * lowest providerId. With no complete same-book pair the market is
 * unavailable; two books are never combined.
 *
 * De-vig method: proportional (each implied probability divided by the book's
 * implied sum), via devig.ts `devigProportional`.
 */
import {
  MAX_VALID_BOOK_SUM,
  MIN_VALID_BOOK_SUM,
  americanToImpliedProbability,
  devigProportional,
} from "lib/projections/utils/devig";
import { displayedWinPair } from "components/HomePage/homepageWinPair";

export const FHFH_PREDICTIONS_UNAVAILABLE_NOTICE =
  "FHFH predictions unavailable while the model is developed and validated.";

/** Preferred NHL schedule odds providers, in order; then lowest providerId. */
export const MARKET_PROVIDER_PREFERENCE: readonly number[] = [9, 8];

/** Schedule game states whose odds are still a pregame market. */
const PREGAME_STATES = new Set(["FUT", "PRE"]);

export type NhlScheduleOddsOffer = { providerId?: unknown; value?: unknown };
export type NhlScheduleOddsPartner = { partnerId?: unknown; name?: unknown };

export type ParsedOddsPrice = {
  format: "american" | "decimal";
  /** The price in its declared format (e.g. -150 American, 1.75 decimal). */
  price: number;
  impliedProbability: number;
};

export function parseNhlScheduleOddsPrice(value: unknown): ParsedOddsPrice | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (/^[+-]\d+$/.test(text)) {
    const price = Number(text);
    const implied = americanToImpliedProbability(price);
    return implied == null
      ? null
      : { format: "american", price, impliedProbability: implied };
  }
  if (/^\d+\.\d+$/.test(text)) {
    const decimal = Number(text);
    return Number.isFinite(decimal) && decimal > 1
      ? { format: "decimal", price: decimal, impliedProbability: 1 / decimal }
      : null;
  }
  return null;
}

export type MarketWinProbability =
  | {
      status: "available";
      providerId: number;
      partnerName: string;
      method: "proportional";
      awayProbability: number;
      homeProbability: number;
      /** Book implied sum minus 1. */
      overround: number;
      /** Displayed whole percentages; they sum to 100. */
      awayPercent: number;
      homePercent: number;
      favourite: "away" | "home" | "even";
    }
  | {
      status: "unavailable";
      reason: "no_same_book_pair" | "game_not_found" | "game_started";
    };

/** One valid implied probability per provider; providers with duplicates or invalid prices drop out. */
function impliedByProvider(offers: NhlScheduleOddsOffer[] | undefined) {
  const seen = new Map<number, number | null>();
  for (const offer of Array.isArray(offers) ? offers : []) {
    const id = offer?.providerId;
    if (typeof id !== "number" || !Number.isInteger(id)) continue;
    const implied = parseNhlScheduleOddsPrice(offer.value)?.impliedProbability ?? null;
    seen.set(id, seen.has(id) ? null : implied);
  }
  return seen;
}

function providerRank(id: number): [number, number] {
  const preferred = MARKET_PROVIDER_PREFERENCE.indexOf(id);
  return preferred >= 0 ? [preferred, id] : [MARKET_PROVIDER_PREFERENCE.length, id];
}

export function selectMarketWinProbability(input: {
  awayOffers?: NhlScheduleOddsOffer[];
  homeOffers?: NhlScheduleOddsOffer[];
  oddsPartners?: NhlScheduleOddsPartner[];
}): MarketWinProbability {
  const away = impliedByProvider(input.awayOffers);
  const home = impliedByProvider(input.homeOffers);
  const candidates = [...away.keys()]
    .filter((id) => home.has(id))
    .sort((a, b) => {
      const [ra, ia] = providerRank(a);
      const [rb, ib] = providerRank(b);
      return ra - rb || ia - ib;
    });

  for (const providerId of candidates) {
    const awayImplied = away.get(providerId);
    const homeImplied = home.get(providerId);
    if (awayImplied == null || homeImplied == null) continue;
    const bookSum = awayImplied + homeImplied;
    if (bookSum < MIN_VALID_BOOK_SUM || bookSum > MAX_VALID_BOOK_SUM) continue;
    const devigged = devigProportional([awayImplied, homeImplied]);
    if (!devigged) continue;
    const [awayProbability, homeProbability] = devigged.probabilities;
    const displayed = displayedWinPair(awayProbability, homeProbability);
    if (!displayed) continue;
    const partner = (input.oddsPartners ?? []).find(
      (item) => item?.partnerId === providerId,
    );
    const partnerName =
      typeof partner?.name === "string" && partner.name.trim()
        ? partner.name.trim()
        : `Sportsbook ${providerId}`;
    return {
      status: "available",
      providerId,
      partnerName,
      method: "proportional",
      awayProbability,
      homeProbability,
      overround: devigged.overround,
      awayPercent: displayed.awayPercent,
      homePercent: displayed.homePercent,
      favourite: displayed.pick === "tie" ? "even" : displayed.pick,
    };
  }
  return { status: "unavailable", reason: "no_same_book_pair" };
}

type ScheduleTeam = { odds?: NhlScheduleOddsOffer[] };
export type NhlScheduleOddsGame = {
  id?: unknown;
  gameState?: unknown;
  awayTeam?: ScheduleTeam;
  homeTeam?: ScheduleTeam;
};
export type NhlScheduleOddsResponse = {
  gameWeek?: Array<{ games?: NhlScheduleOddsGame[] }>;
  oddsPartners?: NhlScheduleOddsPartner[];
};

export function findScheduleGame(
  schedule: NhlScheduleOddsResponse | null | undefined,
  gameId: number,
): NhlScheduleOddsGame | undefined {
  for (const day of schedule?.gameWeek ?? []) {
    const game = day?.games?.find((item) => item?.id === gameId);
    if (game) return game;
  }
  return undefined;
}

/**
 * The market pair for one game. Odds for a game whose schedule state shows it
 * has started are stale as a pregame market, so they are unavailable.
 */
export function marketWinProbabilityForGame(
  schedule: NhlScheduleOddsResponse | null | undefined,
  gameId: number,
): MarketWinProbability {
  const game = findScheduleGame(schedule, gameId);
  if (!game) return { status: "unavailable", reason: "game_not_found" };
  if (typeof game.gameState === "string" && !PREGAME_STATES.has(game.gameState)) {
    return { status: "unavailable", reason: "game_started" };
  }
  return selectMarketWinProbability({
    awayOffers: game.awayTeam?.odds,
    homeOffers: game.homeTeam?.odds,
    oddsPartners: schedule?.oddsPartners,
  });
}

/** Key the client fetcher stamps on a schedule response when it arrives. */
export const SCHEDULE_FETCHED_AT_KEY = "fhfhFetchedAt";

/** Valid client fetch time of a schedule response, or null. */
export function scheduleFetchedAt(schedule: unknown): Date | null {
  const raw =
    schedule && typeof schedule === "object"
      ? (schedule as Record<string, unknown>)[SCHEDULE_FETCHED_AT_KEY]
      : null;
  if (typeof raw !== "string") return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function marketSourceLabel(partnerName: string, fetchedAt: Date): string {
  const time = fetchedAt.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `De-vigged sportsbook odds · ${partnerName} · as of ${time}`;
}

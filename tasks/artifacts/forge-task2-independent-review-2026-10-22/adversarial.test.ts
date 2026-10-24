import { describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(() => { throw new Error('Unexpected service table read'); }) }));
vi.mock('lib/supabase/server', () => ({ default: db }));
import { fetchRollingRows, fetchLeaguePhysicalTotals, ROLLING_ROW_SELECT_CLAUSE } from './lib/projections/queries/skater-queries';
import { computeSkaterPhysicalEventRates } from './lib/projections/calculators/skater-adjustments';
import { captureProjectionInputs } from './lib/projections/inputCapture';

const identity = { player_id: 7, game_id: 2026020030, game_date: '2026-10-06', season: 20262027, strength_state: 'all' };
function row(extra: Record<string, unknown> = {}) {
  return { ...Object.fromEntries(ROLLING_ROW_SELECT_CLAUSE.split(',').map(key => [key, null])), ...identity, ...extra } as any;
}
async function hydrate(history: Record<string, unknown>, change: Record<string, unknown> = {}) {
  const wide = row();
  db.rpc.mockResolvedValue({ error: null, data: [{ player_id: 7, rolling_row: wide,
    support_row: { ...identity, payload_schema_version: 1, support_payload: { historicalCompatibility: history }, ...change } }] });
  return (await fetchRollingRows([7], 'all', '2026-10-07'))[0];
}
const rates = (all: any, position = 'C') => computeSkaterPhysicalEventRates({ all, position, esPpToiSeconds: 1200, currentSeasonId: 20262027, league: null });

describe('independent task-2 physical-history checks', () => {
  it.each([['C', 4.9, 2.1], ['D', 3.2, 4.4]] as const)('keeps unknown history null and uses %s priors', async (position, hits, blocks) => {
    const hydrated = await hydrate({ hits_per_60_hits_3ya: null, hits_per_60_toi_seconds_3ya: 240000 });
    expect(hydrated.hits_per_60_hits_3ya).toBeNull();
    expect(hydrated.blocks_per_60_blocks_3ya).toBeNull();
    expect(rates(hydrated, position)).toMatchObject({ hitsPer60: hits, blocksPer60: blocks, hitsLeagueScale: 1, blocksLeagueScale: 1 });
  });

  it('retains an observed zero while distinguishing it from absent history', async () => {
    const hydrated = await hydrate({ hits_per_60_hits_3ya: 0, hits_per_60_toi_seconds_3ya: 240000 });
    expect(hydrated.hits_per_60_hits_3ya).toBe(0);
    expect(rates(hydrated).hitsPer60).toBeCloseTo(50 * 4.9 / (2000 + 50), 12);
    expect(rates(hydrated).hitsPer60).toBeLessThan(rates(row()).hitsPer60);
  });

  it.each([['C', 4.9, 2.1], ['D', 3.2, 4.4]] as const)('uses seconds, current full weight and prior half weight for %s', async (position, hp, bp) => {
    const hydrated = await hydrate({ hits_per_60_hits_3ya: 200, hits_per_60_toi_seconds_3ya: 240000,
      hits_per_60_hits_season: 20, hits_per_60_toi_seconds_season: 24000,
      blocks_per_60_blocks_3ya: 300, blocks_per_60_toi_seconds_3ya: 240000,
      blocks_per_60_blocks_season: 30, blocks_per_60_toi_seconds_season: 24000 });
    const actual = rates(hydrated, position);
    expect(actual.hitsPer60).toBeCloseTo(((20 + 180 / 2) * 60 + 50 * hp) / (400 + 3600 / 2 + 50), 12);
    expect(actual.blocksPer60).toBeCloseTo(((30 + 270 / 2) * 60 + 300 * bp) / (400 + 3600 / 2 + 300), 12);
    const stale = rates({ ...hydrated, season: 20252026 }, position);
    expect(stale.hitsPer60).toBeCloseTo((100 * 60 + 50 * hp) / (2000 + 50), 12);
  });

  it.each([{ strength_state: 'ev' }, { season: 20252026 }, { game_id: 2026020031 }])('rejects mismatched sidecar identity %j', async changed => {
    await expect(hydrate({ hits_per_60_hits_3ya: 200 }, changed)).rejects.toMatchObject({ reason: 'invalid_support_row' });
  });

  it('does not even obtain the RPC property in an awaited read-only capture', async () => {
    const spy = vi.fn(() => { throw new Error('RPC property must not be accessed'); });
    const unavailable = { get rpc() { return spy(); } };
    await captureProjectionInputs(async () => {
      await Promise.resolve();
      await expect(fetchLeaguePhysicalTotals(20262027, '2026-10-07', unavailable as any)).rejects.toMatchObject({ reason: 'read_only_reconstruction' });
    }, { suppressWrites: true });
    expect(spy).not.toHaveBeenCalled();
  });

  it.each(['hits', 'blocks'] as const)('does not treat unknown current-season %s counts as observed zero', async metric => {
    const history = { [`${metric}_per_60_${metric}_3ya`]: 200, [`${metric}_per_60_toi_seconds_3ya`]: 240000,
      [`${metric}_per_60_${metric}_season`]: null, [`${metric}_per_60_toi_seconds_season`]: 120000 };
    const hydrated = await hydrate(history);
    expect((hydrated as any)[`${metric}_per_60_${metric}_season`]).toBeNull();
    const unknown = rates(hydrated)[`${metric}Per60`];
    const knownZero = rates({ ...hydrated, [`${metric}_per_60_${metric}_season`]: 0 })[`${metric}Per60`];
    expect(unknown).not.toBe(knownZero);
  });
});

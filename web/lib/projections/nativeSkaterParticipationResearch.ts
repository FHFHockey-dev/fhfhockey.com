/** Disconnected finite-frame diagnostics. Labels/assumptions are supplied, not authenticated here. */
export type ParticipationLabel = boolean | null;
export type SkaterResearchRow = {
  gameId: number;
  dress: ParticipationLabel;
  credit: ParticipationLabel;
  positiveMinutes: ParticipationLabel;
};
export type ResearchFraction = { numerator: string; denominator: string };
export type ResearchBounds = { lower: ResearchFraction; upper: ResearchFraction };

// M implies D and C. Whether credit without dressing (010) is possible is unresolved.
const cells = ["000", "010", "100", "110", "111"] as const;
const dimensions = ["dress", "credit", "positiveMinutes"] as const;

/** Lexical research decoder only: it does not bind an upstream unit or historical schema. */
export function decodeResearchToi(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{1,3}:[0-5]\d$/.test(value)) return null;
  const [minutes, seconds] = value.split(":").map(Number);
  return minutes * 60 + seconds;
}

function fraction(n: bigint, d: bigint): ResearchFraction {
  if (n < BigInt(0) || d <= BigInt(0)) throw new Error("Expected a nonnegative fraction with positive denominator");
  let a = n, b = d;
  while (b) { const remainder = a % b; a = b; b = remainder; }
  return { numerator: String(n / a), denominator: String(d / a) };
}

/** Arithmetic sensitivity under a fixed kernel, never a population-transfer or forecast claim. */
export function fixedKernelSensitivity(bounds: ResearchBounds, kernel: ResearchFraction): ResearchBounds {
  const parse = (value: ResearchFraction) => {
    if (!/^\d+$/.test(value.numerator) || !/^[1-9]\d*$/.test(value.denominator)) {
      throw new Error("Invalid research fraction");
    }
    return [BigInt(value.numerator), BigInt(value.denominator)] as const;
  };
  const [ln, ld] = parse(bounds.lower), [un, ud] = parse(bounds.upper), [kn, kd] = parse(kernel);
  if (ln > ld || un > ud || ln * ud > un * ld) throw new Error("Invalid probability bounds");
  return { lower: fraction(ln * kn, ld * kd), upper: fraction(un * kn, ud * kd) };
}

export function inspectSkaterParticipationFrame(expectedGameIds: readonly number[], rows: readonly SkaterResearchRow[]) {
  const findings: Array<{ code: string; gameId?: number }> = [];
  const validId = (id: number) => Number.isSafeInteger(id) && id > 0;
  if (!expectedGameIds.length || expectedGameIds.some(id => !validId(id))
    || new Set(expectedGameIds).size !== expectedGameIds.length) findings.push({ code: "invalid_expected_frame" });
  if (rows.some(row => !validId(row.gameId)) || new Set(rows.map(row => row.gameId)).size !== rows.length) {
    findings.push({ code: "invalid_or_duplicate_row_identity" });
  }
  const expected = new Set(expectedGameIds), actual = new Set(rows.map(row => row.gameId));
  if (rows.length !== expectedGameIds.length || expectedGameIds.some(id => !actual.has(id))
    || rows.some(row => !expected.has(row.gameId))) findings.push({ code: "frame_membership_mismatch" });

  const observed = Object.fromEntries(dimensions.map(key => [key, { yes: 0, no: 0, unknown: 0 }])) as
    Record<typeof dimensions[number], { yes: number; no: number; unknown: number }>;
  const feasibleRows: Array<{ gameId: number; cells: string[] }> = [];
  for (const row of rows) {
    if (dimensions.some(key => row[key] !== null && typeof row[key] !== "boolean")) {
      findings.push({ code: "invalid_label", gameId: row.gameId });
      continue;
    }
    for (const key of dimensions) observed[key][row[key] === null ? "unknown" : row[key] ? "yes" : "no"]++;
    const possible = cells.filter(cell => dimensions.every((key, index) =>
      row[key] === null || row[key] === (cell[index] === "1")));
    if (!possible.length) findings.push({ code: "incompatible_joint_labels", gameId: row.gameId });
    feasibleRows.push({ gameId: row.gameId, cells: [...possible] });
  }
  const frameRates: Partial<Record<typeof dimensions[number], ResearchBounds>> = {};
  if (!findings.length) {
    dimensions.forEach((key, index) => {
      const lower = feasibleRows.filter(row => row.cells.every(cell => cell[index] === "1")).length;
      const upper = feasibleRows.filter(row => row.cells.some(cell => cell[index] === "1")).length;
      frameRates[key] = { lower: fraction(BigInt(lower), BigInt(rows.length)), upper: fraction(BigInt(upper), BigInt(rows.length)) };
    });
  }
  return {
    version: "native-skater-participation-research-v1" as const,
    status: findings.length ? "invalid" as const : "finite_frame_analyzed" as const,
    purpose: "disconnected_research" as const,
    frameSize: expectedGameIds.length,
    observed,
    feasibleRows,
    completeJointRows: feasibleRows.filter(row => row.cells.length === 1).length,
    frameRates: findings.length ? null : frameRates,
    findings,
    // Finite-frame rates and their bounds are not target probabilities or confidence intervals.
    targetParticipation: null,
    expectedHitsGivenGamePlayed: null,
    qualificationEligible: false as const,
  };
}

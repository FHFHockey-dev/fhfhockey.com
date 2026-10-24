import baselineHandler from "pages/api/v1/db/audit-ctpi-baseline";

describe("independent CTPI filtering and payload validation", () => {
  const realComputeCtpi = ctpi.computeCtpi;
  const score = (team: string) => realComputeCtpi([ctpi.computeTrendMetrics([{ team, date: "2026-10-07", gp: 1 }])])[0];
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T14:00:00.000Z"));
    mocks.fetchSeason.mockResolvedValue({ id: 20262027, startDate: "2026-10-07", endDate: "2027-06-20" });
    mocks.upsert.mockResolvedValue({ error: null });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it("never supplies future-only, aggregate-only or malformed-team histories to league normalization", async () => {
    const eligible = [sourceRow("TOR", "2026-10-07", 7), sourceRow("MTL", "2026-10-07", 1)];
    setSourceRows(eligible);
    await invoke();
    const control = writtenRows();
    mocks.upsert.mockClear();
    const calls: any[] = [];
    vi.spyOn(ctpi, "computeCtpi").mockImplementation(metrics => {
      calls.push(metrics);
      return realComputeCtpi(metrics);
    });
    setSourceRows([...eligible,
      sourceRow("FUTURE", "2026-10-19", 999),
      { ...sourceRow("AGGREGATE", "2026-10-07", 999), gp: 82 },
      ...["\t", "\nTOR", "TOR\u00a0", "\ufeffTOR", false, 0, {}, []].map(team => sourceRow(team, "2026-10-07", 999))]);
    const response = await invoke();
    expect(response.statusCode).toBe(200);
    expect(calls).toHaveLength(12);
    expect(calls.every(metrics => metrics.map((m: any) => m.team).join(",") === "TOR,MTL")).toBe(true);
    expect(writtenRows()).toEqual(control);
  });

  it("skips a source containing only ineligible histories without inventing scores", async () => {
    setSourceRows([
      sourceRow("FUTURE", "2026-10-19"),
      { ...sourceRow("AGGREGATE", "2026-10-07"), gp: 2 },
      sourceRow("\u00a0", "2026-10-07"),
    ]);
    const response = await invoke();
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ outcome: "skipped", rowsUpserted: 0, sourceRows: 3 });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("preserves actual baseline scores, identities and trust gates for a valid cohort across batches", async () => {
    const input = Array.from({ length: 48 }, (_, i) => sourceRow(`T${String(i).padStart(2, "0")}`, "2026-10-07", 1 + i / 12));
    setSourceRows(input);
    const fixed = await invoke();
    const fixedRows = writtenRows();
    expect(fixed.statusCode).toBe(200);
    expect(fixedRows).toHaveLength(576);
    expect(mocks.upsert.mock.calls.map(([rows]) => rows.length)).toEqual([500, 76]);
    expect(fixedRows.every(row => row.payload.publicationStatus === "legacy_unapproved"
      && !ctpi.isTrustedRecentTeamFormPayload(row.payload))).toBe(true);
    expect(mocks.upsert.mock.calls.every(([, options]) => options.onConflict === "season_id,team,date")).toBe(true);
    mocks.upsert.mockClear();
    setSourceRows(input);
    const res: any = { statusCode: 200, body: null, status(n: number) { this.statusCode = n; return this; },
      json(body: any) { this.body = body; return this; }, setHeader: vi.fn() };
    await baselineHandler({ method: "GET", query: {} } as any, res);
    expect(res.statusCode).toBe(200);
    expect(writtenRows()).toEqual(fixedRows);
  });

  it.each(["", "\t", "\u00a0", " TOR", "TOR ", null, undefined, 123])(
    "rejects an invalid destination after 500 valid rows before the first write (%s)", async invalid => {
      setSourceRows([sourceRow("TOR", "2026-10-07")]);
      const valid = score("TOR");
      const values = Array.from({ length: 500 }, (_, i) => ({ ...valid, team: `T${i}` }));
      values.push({ ...valid, team: invalid as any });
      vi.spyOn(ctpi, "computeCtpi").mockReturnValue(values);
      const response = await invoke({ start: "2026-10-18" });
      expect(response.statusCode).toBe(500);
      expect(response.body.error).toContain("Invalid CTPI destination identity");
      expect(mocks.upsert).not.toHaveBeenCalled();
    });

  it.each(["duplicate", "blank"])("validates the last date before writing a full earlier date (%s)", async invalid => {
    setSourceRows([sourceRow("TOR", "2026-10-07")]);
    const valid = score("TOR");
    const firstDay = Array.from({ length: 500 }, (_, i) => ({ ...valid, team: `T${i}` }));
    const lastDay = invalid === "duplicate" ? [valid, valid] : [{ ...valid, team: " " }];
    vi.spyOn(ctpi, "computeCtpi").mockReturnValueOnce(firstDay).mockReturnValueOnce(lastDay);
    const response = await invoke({ start: "2026-10-17" });
    expect(response.statusCode).toBe(500);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});

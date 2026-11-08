import sys
src = open(sys.argv[1]).read()
anchor = '    it("the snapshot import keeps the mark only from a fresh roster read, never from saved metadata"'
assert src.count(anchor) == 1
extra = '''    // --- C7 R33 controls ---
    it("C7: withholds a fresh mark dated another day", async () => {
      const fixture = confirmationsFixture();
      world.ownRows = [playerRow(5, { starting_status: { coverage_type: "date", date: "2026-10-20", is_starting: 1 } })];
      expect((await fixture.run()).data.forecasts).toEqual(fixture.data.forecasts);
    });
    it("C7: withholds a mark whose Yahoo team differs from the planner team (traded goalie)", async () => {
      const fixture = confirmationsFixture();
      world.ownRows = [{ player: [{ player_key: "453.p.5" }, { name: { full: "g1" } }, { editorial_team_abbr: "CGY" }, { starting_status: fixture.status(1) }] }];
      expect((await fixture.run()).data.forecasts).toEqual(fixture.data.forecasts);
    });
    it("C7: withholds a week-coverage mark", async () => {
      const fixture = confirmationsFixture();
      world.ownRows = [playerRow(5, { starting_status: { coverage_type: "week", date: TODAY, is_starting: 1 } })];
      expect((await fixture.run()).data.forecasts).toEqual(fixture.data.forecasts);
    });
    it.each([
      ["stale", () => { world.responseDate = "2026-10-19T13:57:00Z"; }, {}, "yahoo_confirmations_unavailable"],
      ["expired cache age", () => { world.ageSeconds = 121; }, {}, "yahoo_confirmations_unavailable"],
      ["wrong principal", () => undefined, { userId: "owner-b" }, "team_unavailable"],
    ] as const)("C7: %s rejects for that reason, not another", async (_label, edit, extra, code) => {
      const fixture = confirmationsFixture(); edit();
      await expect(fixture.run(extra as never)).rejects.toMatchObject({ code });
    });
'''
open(sys.argv[2], "w").write(src.replace(anchor, extra + anchor))

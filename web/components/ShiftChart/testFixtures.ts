export function gameFixture(id = 2026010054) {
  const home = {
    id: 68,
    abbrev: "UTA",
    placeName: { default: "Utah" },
    commonName: { default: "Mammoth" },
    score: 1,
  };
  const away = {
    id: 21,
    abbrev: "COL",
    placeName: { default: "Colorado" },
    commonName: { default: "Avalanche" },
    score: 0,
  };
  const player = (playerId: number, name: string, position: string) => ({
    playerId,
    name: { default: name },
    position,
    sweaterNumber: playerId % 100,
  });
  const roster = (offset: number) => ({
    forwards: [
      player(offset + 1, offset === 100 ? "C. Keller" : "N. MacKinnon", "C"),
      player(offset + 2, "Second Forward", "L"),
    ],
    defense: [player(offset + 3, "Defense Player", "D")],
    goalies: [
      player(offset + 4, "Starting Goalie", "G"),
      player(offset + 5, "Backup Goalie", "G"),
    ],
  });
  const box = {
    id,
    gameType: 2,
    gameDate: "2026-09-26",
    gameState: "FINAL",
    gameScheduleState: "OK",
    periodDescriptor: { number: 3, periodType: "REG" },
    clock: { secondsRemaining: 0 },
    homeTeam: home,
    awayTeam: away,
    playerByGameStats: { homeTeam: roster(100), awayTeam: roster(200) },
  };
  const shift = (
    playerId: number,
    startTime: string,
    endTime: string,
    period = 1,
  ) => ({
    id: playerId * 100 + period,
    gameId: id,
    playerId,
    period,
    startTime,
    endTime,
    duration: (() => {
      const toSeconds = (time: string) =>
        time.split(":").reduce((total, part) => total * 60 + Number(part), 0);
      const duration = toSeconds(endTime) - toSeconds(startTime);
      return `${String(Math.floor(duration / 60)).padStart(2, "0")}:${String(duration % 60).padStart(2, "0")}`;
    })(),
    teamId: playerId < 200 ? 68 : 21,
    firstName: "Test",
    lastName: "Player",
    teamName: "Team",
  });
  const shifts = {
    data: [
      shift(101, "00:00", "00:30"),
      shift(101, "01:00", "02:00"),
      shift(102, "00:30", "01:00"),
      shift(103, "00:00", "02:00"),
      shift(104, "00:00", "10:00"),
      shift(105, "10:00", "20:00"),
      shift(201, "00:00", "02:00"),
      shift(203, "00:00", "02:00"),
      shift(204, "00:00", "20:00"),
    ],
  };
  const plays: Record<string, unknown>[] = [
    {
      eventId: 1,
      typeDescKey: "shot-on-goal",
      periodDescriptor: { number: 1, periodType: "REG" },
      timeInPeriod: "00:10",
      details: { eventOwnerTeamId: 68, shootingPlayerId: 101 },
    },
    {
      eventId: 2,
      typeDescKey: "goal",
      periodDescriptor: { number: 1, periodType: "REG" },
      timeInPeriod: "00:20",
      details: { eventOwnerTeamId: 68, scoringPlayerId: 101 },
    },
    {
      eventId: 3,
      typeDescKey: "shot-on-goal",
      periodDescriptor: { number: 1, periodType: "REG" },
      timeInPeriod: "01:00",
      details: { eventOwnerTeamId: 21, shootingPlayerId: 201 },
    },
  ];
  return { box, shifts, pbp: { plays } };
}

// Deliberately synthetic full rosters for geometry tests; never used by the page.
export function fullRosterFixture(id = 2026010054, overtime = false) {
  const fixture = gameFixture(id);
  fixture.shifts.data = [];
  const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  for (const [side, offset, teamId] of [["homeTeam", 100, 68], ["awayTeam", 200, 21]] as const) {
    const roster = Array.from({ length: 20 }, (_, index) => ({
      playerId: offset + index + 1,
      name: { default: `T. Player ${index + 1}` },
      position: index < 12 ? ["C", "L", "R"][index % 3] : index < 18 ? "D" : "G",
      sweaterNumber: index + 1,
    }));
    fixture.box.playerByGameStats[side] = {
      forwards: roster.slice(0, 12), defense: roster.slice(12, 18), goalies: roster.slice(18),
    };
    for (const [index, player] of roster.entries()) {
      // Include the backup with no recorded shifts to exercise complete roster rendering.
      if (index === 19) continue;
      for (let period = 1; period <= (overtime ? 4 : 3); period++) {
        const end = period === 4 ? 180 : 1200;
        for (let start = index === 18 ? 0 : (index % 4) * 60; start < end; start += index === 18 ? end : 240) {
          const finish = Math.min(end, start + (index === 18 ? end : 45));
          fixture.shifts.data.push({ id: fixture.shifts.data.length + 1, gameId: id,
            playerId: player.playerId, teamId, period, startTime: clock(start), endTime: clock(finish),
            duration: clock(finish - start), firstName: "Test", lastName: `Player ${index + 1}`, teamName: "Fixture team" });
        }
      }
    }
  }
  if (overtime) {
    fixture.box.periodDescriptor = { number: 4, periodType: "OT" };
    fixture.box.clock.secondsRemaining = 120;
    fixture.pbp.plays.push({ eventId: 4, typeDescKey: "goal", periodDescriptor: { number: 4, periodType: "OT" },
      timeInPeriod: "03:00", details: { eventOwnerTeamId: 68, scoringPlayerId: 101 } });
  }
  return fixture;
}

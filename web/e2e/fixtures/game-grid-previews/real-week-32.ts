/**
 * Real NHL schedule cells (opponent per day, "@" = away) for Mon 2025-03-17 .. Sun 2025-03-23:
 * 32 teams, 52 games, nightly slate 5/9/2/14/1/14/7. Source: TJ's Frozen Tools "Schedule Planner"
 * export, reduced to team/date/opponent/venue and validated by
 * tasks/artifacts/game-grid-lane-2026-10-18/crowding-experiment/convert-schedule.mjs.
 * The fixture replays these matchups on its own synthetic week (2026-10-05 .. 2026-10-11);
 * team names, logos, game IDs, states, coverage and receipt times are synthetic.
 */
export const REAL_WEEK_32: Record<string, string> = {
  "ANA": ",@DAL,,@NSH,,,CAR",
  "BOS": "BUF,,,@VGK,,@S.J,@L.A",
  "BUF": "@BOS,,,@UTA,,@MIN,@WPG",
  "CAR": ",,,@S.J,,@L.A,@ANA",
  "CBJ": "N.J,,,FLA,@PIT,,",
  "CGY": "@TOR,@NYR,,@N.J,,@NYI,",
  "CHI": ",SEA,,L.A,,@STL,PHI",
  "COL": ",,@TOR,@OTT,,@MTL,",
  "DAL": ",ANA,,T.B,,PHI,",
  "DET": ",@WSH,,,,@VGK,",
  "EDM": ",UTA,,WPG,,SEA,",
  "FLA": ",,,@CBJ,,@WSH,PIT",
  "L.A": "@MIN,,,@CHI,,CAR,BOS",
  "MIN": "L.A,,SEA,,,BUF,",
  "MTL": ",OTT,,@NYI,,COL,",
  "N.J": "@CBJ,,,CGY,,OTT,",
  "NSH": ",STL,,ANA,,TOR,@STL",
  "NYI": ",@PIT,,MTL,,CGY,",
  "NYR": ",CGY,,TOR,,VAN,",
  "OTT": ",@MTL,,COL,,@N.J,",
  "PHI": "@T.B,,,@WSH,,@DAL,@CHI",
  "PIT": ",NYI,,,CBJ,,@FLA",
  "S.J": ",,,CAR,,BOS,",
  "SEA": ",@CHI,@MIN,,,@EDM,",
  "STL": ",@NSH,,VAN,,CHI,NSH",
  "T.B": "PHI,,,@DAL,,@UTA,@VGK",
  "TOR": "CGY,,COL,@NYR,,@NSH,",
  "UTA": ",@EDM,,BUF,,T.B,",
  "VAN": ",WPG,,@STL,,@NYR,",
  "VGK": ",,,BOS,,DET,T.B",
  "WPG": ",@VAN,,@EDM,,,BUF",
  "WSH": ",DET,,PHI,,FLA,"
};

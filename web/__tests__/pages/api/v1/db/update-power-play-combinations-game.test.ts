import { describe, expect, it, vi } from "vitest";

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler
}));

import handler, {
  PP_COMBINATIONS_CALCULATION_VERSION,
  buildPowerPlayGameSet,
  updatePowerPlayCombinations,
  type PowerPlayGameInputs,
  type StoredPbpEvent
} from "../../../../../pages/api/v1/db/update-power-play-combinations/[gameId]";

// Decision 152 fixtures from stored 2026-27 rows (nhl_api_pbp_events, nhl_api_shift_rows,
// nhl_api_game_roster_spots, teamGameStats, powerPlayCombinations). Events: every penalty, goal and period marker
// plus one interior event per PP span; each subset rebuilds the full game's clock exactly. Shifts: every shift of
// the listed team that overlaps one of its PP spans (shifts elsewhere add no PP time).
type EventRow = Array<string | number | null>;
type ShiftRow = [playerId: number, teamId: number, period: number, start: number, end: number];
type RosterRow = [playerId: number, teamId: number, position: string];
type StoredRow = [playerId: number, unit: number, PPTOI: number, percentageOfPP: number, usage: number,
  relative: number, vsAvg: number, share: number];

const toEvents = (rows: EventRow[]): StoredPbpEvent[] => rows.map((r) => ({
  event_id: r[0] as number,
  sort_order: r[1] as number,
  period_number: r[2] as number,
  period_type: r[3] as string,
  time_in_period: r[4] as string,
  time_remaining: r[5] as string,
  situation_code: r[6] as string,
  type_desc_key: r[7] as string,
  event_owner_team_id: (r[8] ?? null) as number | null,
  penalty_type_code: (r[9] ?? null) as string | null,
  penalty_desc_key: (r[10] ?? null) as string | null,
  penalty_duration_minutes: (r[11] ?? null) as number | null,
  committed_by_player_id: (r[12] ?? null) as number | null,
  served_by_player_id: (r[13] ?? null) as number | null
}));
const toShifts = (rows: ShiftRow[]) => rows.map(([player_id, team_id, period, start_seconds, end_seconds]) =>
  ({ player_id, team_id, period, start_seconds, end_seconds }));
const toRoster = (rows: RosterRow[]) => rows.map(([player_id, team_id, position_code]) => ({ player_id, team_id, position_code }));
const tgs = (rows: Array<[teamId: number, powerPlayToi: string, powerPlay: string]>) =>
  rows.map(([teamId, powerPlayToi, powerPlay]) => ({ teamId, powerPlayToi, powerPlay }));

const events163: EventRow[] = [
  [52, 8, 1, "REG", "00:00", "20:00", "1551", "period-start"],
  [229, 130, 1, "REG", "08:04", "11:56", "1551", "penalty", 12, "MIN", "tripping", 2, 8475235],
  [232, 135, 1, "REG", "08:07", "11:53", "1451", "goal", 22],
  [266, 167, 1, "REG", "10:24", "09:36", "1551", "penalty", 22, "MIN", "slashing", 2, 8477953],
  [271, 173, 1, "REG", "10:28", "09:32", "1541", "shot-on-goal", 12],
  [272, 174, 1, "REG", "10:30", "09:30", "1541", "goal", 12],
  [364, 215, 1, "REG", "13:08", "06:52", "1551", "penalty", 22, "MIN", "roughing", 2, 8480834],
  [377, 224, 1, "REG", "13:42", "06:18", "1541", "shot-on-goal", 12],
  [25, 302, 1, "REG", "20:00", "00:00", "1551", "period-end"],
  [511, 308, 2, "REG", "00:00", "20:00", "1551", "period-start"],
  [512, 312, 2, "REG", "00:30", "19:30", "1551", "goal", 12],
  [558, 352, 2, "REG", "03:36", "16:24", "1551", "penalty", 12, "BEN", "too-many-men-on-the-ice", 2, null, 8482809],
  [567, 358, 2, "REG", "03:58", "16:02", "1451", "giveaway", 22],
  [568, 363, 2, "REG", "04:20", "15:40", "1451", "goal", 22],
  [586, 383, 2, "REG", "05:46", "14:14", "1551", "penalty", 12, "MIN", "tripping", 2, 8479976],
  [591, 389, 2, "REG", "06:18", "13:42", "1451", "shot-on-goal", 22],
  [740, 486, 2, "REG", "12:59", "07:01", "1551", "goal", 12],
  [810, 548, 2, "REG", "17:53", "02:07", "1551", "goal", 12],
  [39, 571, 2, "REG", "20:00", "00:00", "1551", "period-end"],
  [839, 577, 3, "REG", "00:00", "20:00", "1551", "period-start"],
  [844, 584, 3, "REG", "00:26", "19:34", "1551", "goal", 22],
  [879, 618, 3, "REG", "02:41", "17:19", "1551", "penalty", 12, "MIN", "slashing", 2, 8480336],
  [883, 623, 3, "REG", "02:51", "17:09", "1451", "goal", 22],
  [973, 707, 3, "REG", "08:51", "11:09", "1551", "penalty", 12, "MIN", "cross-checking", 2, 8480336],
  [984, 713, 3, "REG", "09:05", "10:55", "1451", "giveaway", 22],
  [1089, 824, 3, "REG", "17:20", "02:40", "1551", "goal", 12],
  [1151, 837, 3, "REG", "18:32", "01:28", "1560", "goal", 22],
  [415, 862, 3, "REG", "20:00", "00:00", "1551", "period-end"],
  [1132, 869, 4, "OT", "00:00", "05:00", "1331", "period-start"],
  [422, 910, 4, "OT", "05:00", "00:00", "1331", "period-end"],
  [427, 915, 5, "SO", "00:00", "00:00", "1010", "period-start"],
  [1156, 922, 5, "SO", "00:00", "00:00", "1010", "goal", 22],
  [428, 925, 5, "SO", "00:00", "00:00", "0101", "period-end"],
  [432, 929, 5, "SO", "00:00", "00:00", "0101", "game-end"],
];
const shifts163: ShiftRow[] = [
  [8475218, 22, 2, 455, 506],
  [8475786, 22, 1, 484, 487],
  [8475786, 22, 2, 216, 260],
  [8475786, 22, 2, 346, 421],
  [8475786, 22, 3, 161, 201],
  [8475786, 22, 3, 470, 618],
  [8476454, 22, 1, 484, 487],
  [8476454, 22, 2, 216, 260],
  [8476454, 22, 2, 346, 426],
  [8476454, 22, 3, 161, 201],
  [8476454, 22, 3, 531, 615],
  [8476473, 22, 3, 648, 680],
  [8477934, 22, 1, 484, 525],
  [8477934, 22, 2, 158, 260],
  [8477934, 22, 2, 346, 422],
  [8477934, 22, 3, 135, 171],
  [8477934, 22, 3, 530, 618],
  [8477953, 22, 2, 426, 455],
  [8477953, 22, 3, 616, 669],
  [8478013, 22, 2, 442, 455],
  [8478402, 22, 1, 484, 534],
  [8478402, 22, 2, 180, 260],
  [8478402, 22, 2, 346, 412],
  [8478402, 22, 3, 135, 171],
  [8478402, 22, 3, 529, 616],
  [8478472, 22, 2, 455, 466],
  [8478854, 22, 2, 417, 455],
  [8478854, 22, 3, 615, 652],
  [8480029, 22, 2, 455, 466],
  [8480803, 22, 1, 484, 526],
  [8480803, 22, 2, 171, 260],
  [8480803, 22, 2, 346, 417],
  [8480803, 22, 2, 455, 505],
  [8480803, 22, 3, 120, 171],
  [8480803, 22, 3, 526, 615],
  [8481617, 22, 2, 421, 455],
  [8481617, 22, 3, 618, 676],
  [8482221, 22, 1, 0, 1200],
  [8482221, 22, 2, 0, 1200],
  [8482221, 22, 3, 0, 1059],
  [8482703, 22, 2, 412, 442],
  [8482703, 22, 3, 618, 648],
  [8483455, 22, 2, 422, 455],
  [8483455, 22, 3, 615, 653],
  [8486161, 22, 2, 455, 466],
  [8476906, 12, 1, 624, 630],
  [8476906, 12, 1, 788, 867],
  [8477940, 12, 1, 624, 630],
  [8477940, 12, 1, 788, 874],
  [8478427, 12, 1, 624, 668],
  [8478427, 12, 1, 773, 866],
  [8479976, 12, 1, 866, 921],
  [8480817, 12, 1, 866, 933],
  [8480829, 12, 1, 874, 929],
  [8480830, 12, 1, 624, 668],
  [8480830, 12, 1, 782, 866],
  [8482093, 12, 1, 867, 913],
  [8482702, 12, 1, 866, 922],
  [8482809, 12, 1, 624, 630],
  [8482809, 12, 1, 788, 866],
  [8483548, 12, 1, 0, 1200],
];
const events131: EventRow[] = [
  [52, 8, 1, "REG", "00:00", "20:00", "1551", "period-start"],
  [138, 99, 1, "REG", "06:21", "13:39", "1551", "goal", 19],
  [222, 126, 1, "REG", "08:11", "11:49", "1551", "penalty", 19, "MIN", "tripping", 2, 8484790],
  [228, 131, 1, "REG", "08:37", "11:23", "1451", "shot-on-goal", 18],
  [14, 132, 1, "REG", "08:40", "11:20", "1451", "penalty", 19, "PS", "ps-throwing-object-at-puck", 0, 8476412],
  [153, 136, 1, "REG", "08:40", "11:20", "1010", "goal", 18],
  [154, 174, 1, "REG", "12:22", "07:38", "1551", "goal", 18],
  [421, 273, 1, "REG", "19:30", "00:30", "1551", "penalty", 18, "MIN", "tripping", 2, 8476887],
  [427, 278, 1, "REG", "19:40", "00:20", "1541", "missed-shot", 19],
  [22, 279, 1, "REG", "20:00", "00:00", "1541", "period-end"],
  [439, 286, 2, "REG", "00:00", "20:00", "1541", "period-start"],
  [570, 369, 2, "REG", "05:58", "14:02", "1551", "penalty", 18, "MIN", "tripping", 2, 8486189],
  [573, 374, 2, "REG", "06:07", "13:53", "1541", "shot-on-goal", 19],
  [580, 381, 2, "REG", "07:05", "12:55", "1541", "goal", 18],
  [588, 387, 2, "REG", "07:36", "12:24", "1541", "goal", 19],
  [767, 515, 2, "REG", "17:41", "02:19", "1551", "penalty", 18, "MIN", "holding", 2, 8480246],
  [772, 520, 2, "REG", "17:42", "02:18", "1541", "shot-on-goal", 18],
  [42, 541, 2, "REG", "20:00", "00:00", "1551", "period-end"],
  [804, 548, 3, "REG", "00:00", "20:00", "1551", "period-start"],
  [842, 588, 3, "REG", "02:50", "17:10", "1551", "goal", 18],
  [860, 597, 3, "REG", "04:06", "15:54", "0651", "penalty", 18, "MIN", "interference", 2, 8477021],
  [864, 605, 3, "REG", "04:36", "15:24", "1541", "faceoff", 19],
  [907, 646, 3, "REG", "08:14", "11:46", "1551", "goal", 18],
  [987, 729, 3, "REG", "14:08", "05:52", "1551", "penalty", 18, "MIN", "hooking", 2, 8474564],
  [994, 735, 3, "REG", "14:10", "05:50", "1541", "shot-on-goal", 18],
  [458, 798, 3, "REG", "20:00", "00:00", "1551", "period-end"],
  [462, 802, 3, "REG", "20:00", "00:00", "1551", "game-end"],
];
const shifts131: ShiftRow[] = [
  [8474564, 18, 1, 491, 602],
  [8474600, 18, 1, 491, 601],
  [8475158, 18, 1, 491, 603],
  [8476539, 18, 1, 479, 601],
  [8476869, 18, 1, 600, 661],
  [8476887, 18, 1, 491, 600],
  [8477021, 18, 1, 601, 665],
  [8477424, 18, 1, 0, 1200],
  [8479525, 18, 1, 603, 662],
  [8480246, 18, 1, 601, 671],
  [8484241, 18, 1, 602, 667],
];
const events174: EventRow[] = [
  [52, 8, 1, "REG", "00:00", "20:00", "1551", "period-start"],
  [134, 88, 1, "REG", "05:17", "14:43", "1551", "penalty", 29, "MIN", "tripping", 2, 8479066],
  [138, 93, 1, "REG", "05:32", "14:28", "1541", "blocked-shot", 54],
  [219, 175, 1, "REG", "11:51", "08:09", "1551", "goal", 29],
  [341, 245, 1, "REG", "17:13", "02:47", "1551", "goal", 54],
  [25, 276, 1, "REG", "20:00", "00:00", "1551", "period-end"],
  [433, 282, 2, "REG", "00:00", "20:00", "1551", "period-start"],
  [351, 514, 2, "REG", "20:00", "00:00", "1551", "period-end"],
  [726, 520, 3, "REG", "00:00", "20:00", "1551", "period-start"],
  [770, 564, 3, "REG", "03:17", "16:43", "1551", "penalty", 54, "MIN", "tripping", 2, 8475343],
  [776, 569, 3, "REG", "04:12", "15:48", "1451", "shot-on-goal", 29],
  [806, 597, 3, "REG", "06:01", "13:59", "1551", "penalty", 54, "MIN", "interference", 2, 8478468],
  [810, 603, 3, "REG", "06:04", "13:56", "1451", "shot-on-goal", 54],
  [376, 792, 3, "REG", "20:00", "00:00", "1551", "period-end"],
  [1102, 799, 4, "OT", "00:00", "05:00", "1331", "period-start"],
  [381, 803, 4, "OT", "00:15", "04:45", "1331", "penalty", 54, "MIN", "holding", 2, 8477447],
  [1109, 808, 4, "OT", "00:20", "04:40", "1341", "blocked-shot", 29],
  [1114, 813, 4, "OT", "00:59", "04:01", "1341", "goal", 29],
  [385, 814, 4, "OT", "00:59", "04:01", "1331", "period-end"],
  [389, 819, 4, "OT", "00:59", "04:01", "0440", "game-end"],
];
const shifts174: ShiftRow[] = [
  [8475660, 29, 3, 0, 1200],
  [8475660, 29, 4, 0, 59],
  [8475745, 29, 3, 197, 255],
  [8475745, 29, 3, 327, 420],
  [8475745, 29, 4, 0, 59],
  [8476923, 29, 3, 197, 255],
  [8476923, 29, 3, 361, 418],
  [8477497, 29, 3, 255, 327],
  [8477497, 29, 3, 418, 502],
  [8477501, 29, 3, 197, 255],
  [8477501, 29, 3, 361, 422],
  [8478460, 29, 3, 197, 299],
  [8478460, 29, 3, 361, 418],
  [8478460, 29, 4, 0, 59],
  [8478856, 29, 3, 255, 320],
  [8478856, 29, 3, 420, 489],
  [8482660, 29, 3, 197, 255],
  [8482660, 29, 3, 361, 417],
  [8482660, 29, 4, 15, 59],
  [8482720, 29, 3, 255, 327],
  [8482720, 29, 3, 422, 506],
  [8483485, 29, 3, 299, 327],
  [8483485, 29, 3, 417, 492],
  [8484166, 29, 3, 255, 327],
  [8484166, 29, 3, 418, 506],
  [8484166, 29, 4, 15, 59],
];
const events038: EventRow[] = [
  [52, 8, 1, "REG", "00:00", "20:00", "1551", "period-start"],
  [78, 44, 1, "REG", "02:22", "17:38", "1551", "goal", 55],
  [170, 81, 1, "REG", "04:40", "15:20", "1551", "goal", 55],
  [212, 119, 1, "REG", "07:40", "12:20", "1551", "goal", 55],
  [14, 124, 1, "REG", "08:11", "11:49", "1551", "penalty", 55, "MIN", "high-sticking", 2, 8482713],
  [227, 130, 1, "REG", "08:27", "11:33", "1541", "shot-on-goal", 20],
  [26, 260, 1, "REG", "20:00", "00:00", "1551", "period-end"],
  [515, 266, 2, "REG", "00:00", "20:00", "1551", "period-start"],
  [661, 415, 2, "REG", "11:58", "08:02", "1551", "goal", 55],
  [764, 519, 2, "REG", "19:34", "00:26", "1551", "goal", 55],
  [47, 528, 2, "REG", "20:00", "00:00", "1551", "period-end"],
  [781, 534, 3, "REG", "00:00", "20:00", "1551", "period-start"],
  [952, 706, 3, "REG", "13:33", "06:27", "1551", "penalty", 55, "MIN", "high-sticking", 2, 8482866],
  [957, 711, 3, "REG", "14:03", "05:57", "1541", "missed-shot", 20],
  [958, 712, 3, "REG", "14:25", "05:35", "1541", "goal", 20],
  [965, 719, 3, "REG", "15:04", "04:56", "1551", "goal", 55],
  [459, 779, 3, "REG", "20:00", "00:00", "1551", "penalty", 55, "MIN", "slashing", 2, 8479324],
  [422, 781, 3, "REG", "20:00", "00:00", "1541", "period-end"],
  [426, 785, 3, "REG", "20:00", "00:00", "1541", "game-end"],
];
const shifts038: ShiftRow[] = [
];

const roster163: RosterRow[] = [
  [8476906, 12, "D"], [8477940, 12, "L"], [8478427, 12, "C"], [8479976, 12, "D"],
  [8480817, 12, "D"], [8480829, 12, "C"], [8480830, 12, "R"], [8481611, 12, "G"],
  [8482093, 12, "R"], [8482702, 12, "C"], [8482809, 12, "R"], [8483548, 12, "G"],
  [8475218, 22, "D"], [8475786, 22, "L"], [8476454, 22, "C"], [8476473, 22, "D"],
  [8477465, 22, "G"], [8477934, 22, "C"], [8477953, 22, "R"], [8478013, 22, "D"],
  [8478402, 22, "C"], [8478472, 22, "R"], [8478854, 22, "D"], [8480029, 22, "L"],
  [8480803, 22, "D"], [8481617, 22, "R"], [8482221, 22, "G"], [8482703, 22, "C"],
  [8483455, 22, "L"], [8486161, 22, "R"],
];
const roster131: RosterRow[] = [
  [8474564, 18, "C"], [8474600, 18, "D"], [8475158, 18, "C"], [8476539, 18, "R"],
  [8476869, 18, "D"], [8476887, 18, "L"], [8477021, 18, "C"], [8477424, 18, "G"],
  [8479525, 18, "C"], [8480246, 18, "D"], [8481020, 18, "G"], [8484241, 18, "R"],
  [8476412, 19, "G"], [8480981, 19, "G"],
];
const roster174: RosterRow[] = [
  [8475660, 29, "G"], [8475745, 29, "C"], [8476923, 29, "D"], [8477497, 29, "C"],
  [8477501, 29, "R"], [8478460, 29, "D"], [8478856, 29, "R"], [8482660, 29, "C"],
  [8482720, 29, "L"], [8482982, 29, "G"], [8483485, 29, "D"], [8484166, 29, "C"],
  [8478499, 54, "G"], [8479394, 54, "G"],
];
const roster038: RosterRow[] = [
  [8481692, 20, "G"], [8482445, 20, "G"], [8475831, 55, "G"], [8478916, 55, "G"],
];
// Stored powerPlayCombinations rows for 2026020163 (read 2026-11-13): playerId, unit, PPTOI, percentageOfPP,
// pp_unit_usage_index, pp_unit_relative_toi, pp_vs_unit_avg, pp_share_of_team.
const stored163: StoredRow[] = [
  [8475218, 3, 11, 1.1, 1.1, 1, 0.1, 0.037037],
  [8475786, 1, 219, 1.003666, 1.003666, 1, 0.003666, 0.737374],
  [8476454, 1, 221, 1.012832, 1.012832, 3, 0.012832, 0.744108],
  [8476473, 3, 3, 0.3, 0.3, -7, -0.7, 0.010101],
  [8476906, 1, 85, 0.990676, 0.990676, -1, -0.009324, 0.674603],
  [8476958, 3, 34, 0.965909, 0.965909, -1, -0.034091, 0.141667],
  [8477934, 1, 220, 1.008249, 1.008249, 2, 0.008249, 0.740741],
  [8477940, 1, 92, 1.072261, 1.072261, 6, 0.072261, 0.730159],
  [8477953, 2, 64, 0.958084, 0.958084, -3, -0.041916, 0.215488],
  [8478013, 3, 13, 1.3, 1.3, 3, 0.3, 0.043771],
  [8478402, 1, 208, 0.953254, 0.953254, -10, -0.046746, 0.700337],
  [8478427, 1, 84, 0.979021, 0.979021, -2, -0.020979, 0.666667],
  [8478472, 3, 11, 1.1, 1.1, 1, 0.1, 0.037037],
  [8478854, 2, 74, 1.107784, 1.107784, 7, 0.107784, 0.249158],
  [8478970, 3, 34, 0.965909, 0.965909, -1, -0.034091, 0.141667],
  [8479976, 2, 42, 1.044776, 1.044776, 2, 0.044776, 0.333333],
  [8480029, 3, 11, 1.1, 1.1, 1, 0.1, 0.037037],
  [8480336, 2, 41, 0.539474, 0.539474, -35, -0.460526, 0.170833],
  [8480803, 1, 223, 1.021998, 1.021998, 5, 0.021998, 0.750842],
  [8480817, 2, 42, 1.044776, 1.044776, 2, 0.044776, 0.333333],
  [8480829, 2, 34, 0.845771, 0.845771, -6, -0.154229, 0.269841],
  [8480830, 1, 84, 0.979021, 0.979021, -2, -0.020979, 0.666667],
  [8481617, 2, 67, 1.002994, 1.002994, 0, 0.002994, 0.225589],
  [8482093, 2, 41, 1.0199, 1.0199, 1, 0.0199, 0.325397],
  [8482702, 2, 42, 1.044776, 1.044776, 2, 0.044776, 0.333333],
  [8482703, 2, 60, 0.898204, 0.898204, -7, -0.101796, 0.20202],
  [8482809, 1, 84, 0.979021, 0.979021, -2, -0.020979, 0.666667],
  [8483455, 2, 69, 1.032934, 1.032934, 2, 0.032934, 0.232323],
  [8486161, 3, 11, 1.1, 1.1, 1, 0.1, 0.037037],
];

const game = (gameId: number, homeTeamId: number, awayTeamId: number, parts: Omit<PowerPlayGameInputs,
  "gameId" | "homeTeamId" | "awayTeamId" | "gameType">): PowerPlayGameInputs =>
  ({ gameId, homeTeamId, awayTeamId, gameType: 2, ...parts });

// Group A: 3 stale pre-11-01 rows (team 12) kept beside the 11-07 re-run's rows. Both teams' shifts are complete.
const game2026020163 = game(2026020163, 22, 12, {
  events: toEvents(events163), shifts: toShifts(shifts163), roster: toRoster(roster163),
  teamGameStats: tgs([[22, "04:57", "3/5"], [12, "02:06", "1/2"]])
});
// Group C: the 11-01 clock ended team 18's PP after 29 s; the qualified clock and the official total have 120 s.
// Only team 18's shifts are in the fixture, so team 19 is unavailable (incomplete shifts).
const game2026020131 = game(2026020131, 18, 19, {
  events: toEvents(events131), shifts: toShifts(shifts131), roster: toRoster(roster131),
  teamGameStats: tgs([[18, "02:00", "1/1"], [19, "09:38", "1/5"]])
});
// Group B: team 29's PP includes 44 s of overtime (P4 0:15-0:59) that the stored rows lack for 4 players.
const game2026020174 = game(2026020174, 29, 54, {
  events: toEvents(events174), shifts: toShifts(shifts174), roster: toRoster(roster174),
  teamGameStats: tgs([[29, "04:44", "1/3"], [54, "02:00", "0/1"]])
});
// A verified zero: team 55 had no PP ("00:00", "0/0"); team 20 had 172 s (no shifts in the fixture).
const game2026020038 = game(2026020038, 55, 20, {
  events: toEvents(events038), shifts: [], roster: toRoster(roster038),
  teamGameStats: tgs([[55, "00:00", "0/0"], [20, "02:52", "1/2"]])
});

const teamRows = (set: ReturnType<typeof buildPowerPlayGameSet>, teamId: number) =>
  set.playerRows.filter((row) => row.team_id === teamId);
const pptoi = (set: ReturnType<typeof buildPowerPlayGameSet>, teamId: number) =>
  Object.fromEntries(teamRows(set, teamId).map((row) => [row.playerId, row.PPTOI]));
const clockOf = (set: ReturnType<typeof buildPowerPlayGameSet>, teamId: number) =>
  set.clockRows.find((row) => row.team_id === teamId);

describe("decision 152: stored-calculation PP writer", () => {
  it("reads stored rows only and builds both clock rows from the qualified clock", () => {
    const set = buildPowerPlayGameSet(game2026020163);
    expect(set.clockRows).toEqual([
      expect.objectContaining({ team_id: 22, availability: "available", qualified: true, clock_seconds: 297,
        reference_source: "teamGameStats", official_class: "nonzero", official_seconds: 297, unavailable_reason: null }),
      expect.objectContaining({ team_id: 12, availability: "available", qualified: true, clock_seconds: 126,
        reference_source: "teamGameStats", official_class: "nonzero", official_seconds: 126, unavailable_reason: null })
    ]);
    for (const teamId of [22, 12]) {
      const clock = clockOf(set, teamId)!;
      const rows = teamRows(set, teamId);
      expect(rows.reduce((sum, row) => sum + row.PPTOI, 0)).toBe(clock.skater_seconds);
      expect(clock.skater_seconds).toBeGreaterThanOrEqual(3 * clock.clock_seconds!);
      for (const row of rows) {
        expect(row.PPTOI).toBeLessThanOrEqual(clock.clock_seconds!);
        expect(row.pp_share_of_team).toBe(Number((row.PPTOI / clock.clock_seconds!).toFixed(6)));
      }
      expect(rows.filter((row) => row.unit === 1)).toHaveLength(5);
    }
    // Goalies never get rows.
    expect(set.playerRows.map((row) => row.playerId)).not.toEqual(expect.arrayContaining([8482221]));
    expect(set.playerRows.map((row) => row.playerId)).not.toEqual(expect.arrayContaining([8483548]));
  });

  it("group A: the 3 stale pre-11-01 players get no row; the other 26 match the stored rows", () => {
    const set = buildPowerPlayGameSet(game2026020163);
    const ids = set.playerRows.map((row) => row.playerId);
    expect(ids).not.toEqual(expect.arrayContaining([8476958]));
    expect(ids).not.toEqual(expect.arrayContaining([8478970]));
    expect(ids).not.toEqual(expect.arrayContaining([8480336]));
    expect(set.playerRows).toHaveLength(26);
  });

  it("group B: OT PP seconds come from the stored shifts (4 players +44 s over the stored rows)", () => {
    const set = buildPowerPlayGameSet(game2026020174);
    expect(clockOf(set, 29)).toMatchObject({ availability: "available", clock_seconds: 284, skater_seconds: 1376 });
    expect(pptoi(set, 29)).toEqual({
      8478460: 203, 8484166: 169, 8475745: 161, 8482660: 158, 8477497: 125,
      8478856: 123, 8482720: 121, 8477501: 119, 8476923: 115, 8483485: 82
    });
    // Units by the writer's rule (pivot plus the 4 with the most shared PP time), as stored.
    expect(Object.fromEntries(teamRows(set, 29).map((row) => [row.playerId, row.unit]))).toEqual({
      8478460: 1, 8475745: 1, 8482660: 1, 8477501: 1, 8476923: 1,
      8484166: 2, 8477497: 2, 8478856: 2, 8482720: 2, 8483485: 2
    });
    expect(clockOf(set, 54)).toMatchObject({ availability: "unavailable", clock_seconds: 120 });
    expect(clockOf(set, 54)!.unavailable_reason).toMatch(/below 3 x the 120 s clock/);
    expect(teamRows(set, 54)).toEqual([]);
  });

  it("group C: 2026020131 team 18 is 120 s with all 10 skaters, not 29 s with 5", () => {
    const set = buildPowerPlayGameSet(game2026020131);
    expect(clockOf(set, 18)).toMatchObject({ availability: "available", qualified: true, clock_seconds: 120,
      official_seconds: 120 });
    expect(pptoi(set, 18)).toEqual({
      8475158: 112, 8474564: 111, 8476539: 110, 8474600: 110, 8476887: 109,
      8476869: 11, 8480246: 10, 8477021: 10, 8484241: 9, 8479525: 8
    });
    expect(teamRows(set, 18).find((row) => row.playerId === 8475158)!.pp_share_of_team).toBe(0.933333);
  });

  describe("availability: never capped", () => {
    it("a qualified clock of 0 is not applicable, with no player rows", () => {
      const set = buildPowerPlayGameSet(game2026020038);
      expect(clockOf(set, 55)).toMatchObject({ availability: "not_applicable", qualified: true, clock_seconds: 0,
        official_class: "zero", unavailable_reason: null, skater_seconds: null });
      expect(teamRows(set, 55)).toEqual([]);
    });

    it.each([
      { name: "an official total off by more than 2 s",
        change: (g: PowerPlayGameInputs) => ({ ...g, teamGameStats: tgs([[18, "02:28", "1/1"], [19, "09:38", "1/5"]]) }),
        reason: "The clock differs from the official team PP total by -28 s (clock 120 s, official 148 s)." },
      { name: "a missing official row",
        change: (g: PowerPlayGameInputs) => ({ ...g, teamGameStats: [] }),
        reason: "No official team PP total (teamGameStats) for this game." },
      { name: "no stored play-by-play",
        change: (g: PowerPlayGameInputs) => ({ ...g, events: [] }),
        reason: "No play-by-play for this game." },
      { name: "incomplete play-by-play (no game-end)",
        change: (g: PowerPlayGameInputs) => ({ ...g, events: g.events.filter((e) => e.type_desc_key !== "game-end") }),
        reason: "Complete final NHL play-by-play is required to qualify PP time." },
      { name: "no stored roster",
        change: (g: PowerPlayGameInputs) => ({ ...g, roster: [] }),
        reason: "No stored roster with a goalie for this team, so skaters can't be told from goalies." },
      { name: "a shift player missing from the roster",
        change: (g: PowerPlayGameInputs) => ({ ...g, roster: g.roster.filter((s) => s.player_id !== 8475158) }),
        reason: "Player 8475158 has shifts but isn't in the stored roster." },
      { name: "incomplete shifts (one PP skater's shifts missing)",
        change: (g: PowerPlayGameInputs) => ({ ...g, shifts: g.shifts.filter((s) => ![8475158, 8474564, 8476539].includes(s.player_id)) }),
        reason: "Stored shifts cover 267 skater-seconds of PP, below 3 x the 120 s clock; the shift rows look incomplete." }
    ])("$name: team 18 is unavailable with its reason and no player rows", ({ change, reason }) => {
      const set = buildPowerPlayGameSet(change(game2026020131));
      expect(clockOf(set, 18)).toMatchObject({ availability: "unavailable", unavailable_reason: reason });
      expect(teamRows(set, 18)).toEqual([]);
    });

    it("overlapping duplicate shift rows never push a player above the clock (union, not sum)", () => {
      const doubled = { ...game2026020131, shifts: [...game2026020131.shifts, ...game2026020131.shifts] };
      expect(pptoi(buildPowerPlayGameSet(doubled), 18)).toEqual(pptoi(buildPowerPlayGameSet(game2026020131), 18));
    });
  });
});

const storedObjects = (rows: StoredRow[]) => rows.map(([playerId, unit, PPTOI, percentageOfPP, pp_unit_usage_index,
  pp_unit_relative_toi, pp_vs_unit_avg, pp_share_of_team]) => ({ playerId, unit, PPTOI, percentageOfPP,
  pp_unit_usage_index, pp_unit_relative_toi, pp_vs_unit_avg, pp_share_of_team }));

// A stored-table double: answers the reads from fixture rows and records every write.
function storedDatabase(inputs: PowerPlayGameInputs, stored: StoredRow[]) {
  const tables: Record<string, any[]> = {
    games: [{ id: inputs.gameId, homeTeamId: inputs.homeTeamId, awayTeamId: inputs.awayTeamId, type: 2 }],
    nhl_api_pbp_events: inputs.events,
    nhl_api_shift_rows: inputs.shifts,
    nhl_api_game_roster_spots: inputs.roster,
    teamGameStats: inputs.teamGameStats,
    powerPlayCombinations: storedObjects(stored)
  };
  const reads: string[] = [];
  const writes: string[] = [];
  const rpc = vi.fn(async (_fn: string, args: { p_player_rows: unknown[] }) => ({
    data: [{ deleted_player_rows: stored.length, inserted_player_rows: args.p_player_rows.length, clock_rows: 2 }],
    error: null
  }));
  const from = vi.fn((table: string) => {
    reads.push(table);
    const rows = tables[table] ?? [];
    const builder: any = {
      select: () => builder, eq: () => builder, order: () => builder,
      range: (start: number, end: number) => Promise.resolve({ data: rows.slice(start, end + 1), error: null }),
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      upsert: () => { writes.push(`upsert ${table}`); return builder; },
      insert: () => { writes.push(`insert ${table}`); return builder; },
      update: () => { writes.push(`update ${table}`); return builder; },
      delete: () => { writes.push(`delete ${table}`); return builder; }
    };
    return builder;
  });
  return { supabase: { from, rpc } as any, reads, writes, rpc };
}

describe("decision 152: dry run and transactional replace", () => {
  it("the dry run returns the exact diff and writes nothing (2026020163: the 3 stale rows go)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network"));
    const db = storedDatabase(game2026020163, stored163);
    const summary = await updatePowerPlayCombinations(2026020163, db.supabase, { dryRun: true });
    expect(summary.dryRun).toBe(true);
    expect(summary.receipt).toBeNull();
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db.writes).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect([...new Set(db.reads)].sort()).toEqual(["games", "nhl_api_game_roster_spots", "nhl_api_pbp_events",
      "nhl_api_shift_rows", "powerPlayCombinations", "teamGameStats"]);
    expect(summary.diff.inserted).toEqual([]);
    expect(summary.diff.updated).toEqual([]);
    expect(summary.diff.unchanged).toBe(26);
    // Exactly the stored rows of the 3 stale players, as stored.
    expect(summary.diff.deleted).toEqual(storedObjects(stored163.filter(([playerId]) =>
      [8476958, 8478970, 8480336].includes(playerId))));
    fetchSpy.mockRestore();
  });

  it("a write replaces the game's set in one RPC call and never deletes or upserts row by row", async () => {
    const db = storedDatabase(game2026020163, stored163);
    const summary = await updatePowerPlayCombinations(2026020163, db.supabase);
    expect(db.writes).toEqual([]);
    expect(db.rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = db.rpc.mock.calls[0] as unknown as [string, Record<string, any>];
    expect(fn).toBe("replace_power_play_game_v1");
    expect(args).toMatchObject({ p_game_id: 2026020163, p_calculation_version: PP_COMBINATIONS_CALCULATION_VERSION });
    expect(args.p_clock_rows.map((row: any) => [row.team_id, row.availability])).toEqual([[22, "available"], [12, "available"]]);
    expect(args.p_player_rows).toHaveLength(26);
    expect(summary.receipt).toEqual({ deletedPlayerRows: 29, insertedPlayerRows: 26, clockRows: 2 });
    expect(summary.keptUnproven).toBe(0);
  });

  it("a refused replace writes nothing and fails the run", async () => {
    const db = storedDatabase(game2026020163, stored163);
    db.rpc.mockResolvedValueOnce({ data: null, error: { message: "PP_GAME_REPLACE_PLAYER_ROWS" } } as any);
    await expect(updatePowerPlayCombinations(2026020163, db.supabase)).rejects.toThrow(
      "Replacing the power-play rows for game 2026020163 failed; nothing was written: PP_GAME_REPLACE_PLAYER_ROWS");
    expect(db.writes).toEqual([]);
  });

  it("the route takes dryRun=true and reports the diff", async () => {
    const db = storedDatabase(game2026020163, stored163);
    const json = vi.fn();
    await handler({ query: { gameId: "2026020163", dryRun: "true" }, supabase: db.supabase } as any,
      { json, status: () => ({ json }) } as any);
    expect(db.rpc).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      success: true, dryRun: true, message: "Dry run for game 2026020163: nothing was written."
    }));
  });
});

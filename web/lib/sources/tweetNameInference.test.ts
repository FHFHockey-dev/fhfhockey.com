// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildTeamDirectory, type RosterNameEntry } from "./lineupSourceIngestion";
import { inferTweetRosterNames, type TweetRosterNameInput } from "./tweetNameInference";
import { resolveTweetRosterIdentity } from "./tweetNameLexicon";

it("holds only the reviewed spelling using the last roster entry for that player", () => {
  const ordinary = { playerId: 1, fullName: "Alex Smith", lastName: "Smith" };
  const held = { ...ordinary, reviewOnlyNames: ["smith"] };
  expect(resolveTweetRosterIdentity("Smith", [ordinary, held]).status).toBe("missing_player");
  expect(resolveTweetRosterIdentity("Alex Smith", [ordinary, held]).status).toBe("matched");
  expect(resolveTweetRosterIdentity("Smith", [held, ordinary]).status).toBe("matched");
});

const teams = buildTeamDirectory([
  { id: 17, name: "Detroit Red Wings", abbreviation: "DET", logo: "" },
  { id: 5, name: "Pittsburgh Penguins", abbreviation: "PIT", logo: "" },
  { id: 9, name: "Ottawa Senators", abbreviation: "OTT", logo: "" },
]);
const player = (playerId: number, fullName: string, lastName: string, teamId: number): RosterNameEntry =>
  ({ playerId, fullName, lastName, teamId });
const det = [player(100, "Michael Brandsegg-Nygård", "Brandsegg-Nygård", 17), player(101, "Dylan Larkin", "Larkin", 17),
  player(102, "Lucas Raymond", "Raymond", 17), player(103, "Alex Smith", "Smith", 17)];
const pit = [player(201, "Trevor van Riemsdyk", "van Riemsdyk", 5), player(202, "Jeff Smith", "Smith", 5)];
const ott = [player(301, "Jacob Bernard-Docker", "Bernard-Docker", 9)];
const rosterByTeam = new Map([[17, det], [5, pit], [9, ott]]);
const read = (text: string, changes: Partial<TweetRosterNameInput> = {}) => inferTweetRosterNames({ text, teams, rosterByTeam, ...changes });

describe("publication-roster inference", () => {
  it.each([
    ["Detroit lines tonight:\nRaymond-Larkin-MBN", "MBN", 100, 17],
    ["Pittsburgh's morning skate: TVR is back.", "TVR", 201, 5],
    ["#Sens lineup: JBD is scratched", "JBD", 301, 9],
    ["🧊 Raymond-Larkin-MBN", "MBN", 100, 17],
    ["Dylan Larkin is skating with MBN.", "MBN", 100, 17],
    ["Larkin-M.B.N.-Raymond", "M.B.N.", 100, 17],
    ["Detroit lines versus Ottawa:\nRaymond - Larkin - MBN", "MBN", 100, 17],
    ["Larkin, Raymond and MBN all missed practice.", "MBN", 100, 17],
    ["Larkin, Raymond and MBN", "MBN", 100, 17],
  ] as const)("resolves an exact name-token initialism in %s", (text, rawName, id, teamId) => {
    const inference = read(text);
    expect(inference.establishedTeamId).toBe(teamId);
    expect(inference.autoMatches).toHaveLength(1);
    expect(inference.autoMatches[0]).toMatchObject({ rawName, teamId, reason: "unique_initials", playerId: id, candidatePlayerIds: [id] });
    const {start, end} = inference.autoMatches[0]!;
    expect(text.slice(start, end)).toBe(rawName);
  });
  it("keeps same-team collisions, incomplete scope, conflicting memberships and beat-only names in review", () => {
    expect(read("MBN starts", { beatTeamIds: [17] })).toMatchObject({ establishedTeamId: null, autoMatches: [],
      review: [{ rawName: "MBN", reason: "beat_only", teamId: 17, candidatePlayerIds: [100] }] });
    expect(read("MBN starts")).toMatchObject({ establishedTeamId: null, autoMatches: [], review: [{ reason: "team_unresolved", teamId: null }] });
    const collision = new Map(rosterByTeam).set(17, [...det, player(104, "Max Brown-Noel", "Brown-Noel", 17)]);
    expect(read("Detroit lineup: MBN", { rosterByTeam: collision })).toMatchObject({ autoMatches: [],
      review: [{ reason: "ambiguous_initials", candidatePlayerIds: [100,104] }] });
    expect(read("Detroit lineup: MBN", { rosterByTeam: new Map(rosterByTeam).set(17, det.slice(1)) }).autoMatches).toEqual([]);
    const conflicting = new Map(rosterByTeam).set(5, [...pit, {...det[0]!, teamId: 5}]);
    expect(read("Detroit lineup: MBN", {rosterByTeam: conflicting})).toMatchObject({ autoMatches: [], review: [{reason:"conflicting_context"}] });
    expect(read("MBN - TVR - JBD", { beatTeamIds: [17,9] }).autoMatches).toEqual([]);
    expect(read("MBN and MBN", { beatTeamIds: [17] }).establishedTeamId).toBeNull();
  });
  it("does not count relayer, venue, trade, opposing lineup, or the other side's player as post evidence", () => {
    for (const text of ["TVR will play in Pittsburgh.", "Trade: Ottawa is sending JBD to Pittsburgh.",
      "AHL projected lineup\nLarkin-Raymond-MBN", "Ontario Reign lines vs. DET:\nLarkin-MBN-Raymond",
      "Detroit vs. Ottawa\nMBN is in net.", "DET @OTT\nMBN is in.", "Detroit at ottawa\nMBN is in.", "Raymond/Larkin\nOpponents:\nMBN",
      "Detroit lines: Larkin / MBN\nPittsburgh lines: TVR / Smith",
      "Detroit will face MBN in goal.", "Detroit is taking on MBN tonight.", "Larkin vs TVR in goal.", "MBN will play against Detroit.", "MBN had lunch at @DET"]) {
      expect(read(text, {beatTeamIds:[17,5,9]}).autoMatches, text).toEqual([]);
    }
    expect(read("TVR will play in Pittsburgh.", {postTeamId:5}).autoMatches).toEqual([]);
  });
  it("allows the same initials on a different club only when the post establishes the subject", () => {
    const collision = new Map(rosterByTeam).set(5, [...pit, player(205,"Milo Brown-Neal","Brown-Neal",5)]);
    expect(read("Detroit lineup: MBN.", {rosterByTeam: collision}).autoMatches[0]?.candidatePlayerIds).toEqual([100]);
    expect(read("MBN", {rosterByTeam: collision, beatTeamIds: [17]})).toMatchObject({autoMatches:[],review:[{reason:"ambiguous_initials",candidatePlayerIds:[100,205]}]});
  });
  it("protects approved aliases, role aliases and canonical surnames; independently verified aliases can anchor a teammate", () => {
    for (const alternate of [
      { ...det[3]!, aliases: ["MBN"] }, { ...det[3]!, roleAliases: [{alias:"MBN", role:"goalie" as const}] },
      { ...det[3]!, fullName: "Alex Mbn", lastName: "Mbn" },
    ]) {
      const dated = new Map(rosterByTeam).set(17, [...det.slice(0, 3), alternate]);
      expect(read("DET lineup: MBN", {rosterByTeam:dated})).toMatchObject({autoMatches: [],
        review:[{reason:"ambiguous_initials",candidatePlayerIds:[100,103]}]});
    }
    const otherClub = new Map(rosterByTeam).set(5, [...pit, {...pit[1]!, aliases:["MBN"]}]);
    expect(read("DET lineup: MBN", {rosterByTeam:otherClub}).autoMatches).toEqual([]);
    const approved = new Map(rosterByTeam).set(17, [det[0]!, {...det[1]!,aliases:["Larks"]}]);
    expect(read("Larks - MBN", {rosterByTeam:approved}).autoMatches[0]?.playerId).toBe(100);
    expect(read("MBN will start in det", {postTeamId:17}).autoMatches).toEqual([]);
    expect(read("MBN will start at @DET", {postTeamId:17}).autoMatches).toEqual([]);
    expect(read("Pittsburgh lineup: TVR paired with Trevor van Riemsdyk.", {
      teams: [...teams, ...buildTeamDirectory([{id:23,name:"Vancouver Canucks",abbreviation:"VAN",logo:""}])],
    }).autoMatches[0]?.playerId).toBe(201);
    expect(read("Detroit lines are on the MBN network.").autoMatches).toEqual([]);
    const falseTypo = new Map(rosterByTeam).set(17, [...det, player(105,"Sam Moring","Moring",17)]);
    expect(read("Morning lines update tonight", {rosterByTeam:falseTypo,beatTeamIds:[17]}).review).toEqual([]);
  });
  it("offers surname alternatives, never fuzzy initials or automatic typo matches", () => {
    expect(read("Smith missed practice.", {beatTeamIds:[17]})).toMatchObject({autoMatches:[],
      review:[{rawName:"Smith",teamId:17,reason:"ambiguous_name",candidatePlayerIds:[103,202]}]});
    expect(read("Larkinn skated.", {beatTeamIds:[17]})).toMatchObject({autoMatches:[],
      review:[{rawName:"Larkinn",teamId:17,reason:"fuzzy_name",candidatePlayerIds:[101]}]});
    expect(read("Ottawa lineup: JBB", {beatTeamIds:[9]})).toMatchObject({autoMatches:[],review:[]});
    expect(read("Dylan Larkin skated.", {beatTeamIds:[17]})).toMatchObject({autoMatches:[],review:[]});
  });
  it("narrows only the subject-side occurrence of a shared exact name by independent post evidence", () => {
    for (const text of ["🧊 Larkin and Smith will miss tonight.", "Raymond - Larkin - Smith", "Detroit lineup: Smith is out."]) {
      const result = read(text);
      const start = text.indexOf("Smith");
      expect(result.scopedNames).toEqual([{ rawName: "Smith", start, end: start + 5, teamId: 17, playerId: 103 }]);
      expect(result.autoMatches).toEqual([]);
      expect(result.review).toEqual([]);
    }
    const both = read("Detroit lines: Smith vs Smith");
    expect(both.scopedNames.map(x => x.start)).toEqual([15]);
    expect(both.review).toMatchObject([{rawName:"Smith", start:24, candidatePlayerIds:[103,202]}]);
    const dated = new Map(rosterByTeam).set(17, [...det.slice(0,3), {...det[3]!, aliases:["Smitty"]}])
      .set(5, [pit[0]!, {...pit[1]!, aliases:["Smitty"]}]);
    expect(read("Smitty missed practice.", {rosterByTeam:dated, beatTeamIds:[17]}).scopedNames).toEqual([]);
    expect(read("Larkin and Smitty missed practice.", {rosterByTeam:dated}).scopedNames)
      .toMatchObject([{rawName:"Smitty", teamId:17, playerId:103}]);
  });
  it("withholds shared names when the slot, membership, or side is disputed", () => {
    const text = "Detroit lines: Smith is out.";
    const role = {...det[1]!, roleAliases:[{alias:"Smith",role:"goalie" as const}]};
    const rosters = [
      new Map(rosterByTeam).set(17,[...det,player(104,"Bob Smith","Smith",17)]),
      new Map(rosterByTeam).set(17,[role,...det.filter(p => p.playerId !== 101)]),
      new Map(rosterByTeam).set(9,[...ott,{...det[3]!,teamId:9}]),
    ];
    for (const roster of rosters) {
      const result = read(text, {rosterByTeam:roster});
      expect(result.scopedNames).toEqual([]);
      expect(result.review[0]?.rawName).toBe("Smith");
    }
    for (const other of ["Smith missed practice.", "Smith will play in Detroit.", "Pittsburgh at Detroit: Smith is out.",
      "Detroit lines: Larkin collided with Smith", "Larkin injured Smith at practice", "Detroit lines: Smith played here last season.",
      "Detroit last season:\nLarkin - Smith",
      "Trade: Detroit acquired Smith.", "Quoted post: Detroit lineup: Smith.", "Detroit lineup: @Smith is out.",
      "Detroit lineup: “Smith is out.”", "AHL lineup: Smith is scratched."]) {
      expect(read(other, {beatTeamIds:[17]}).scopedNames, other).toEqual([]);
    }
  });
  it("identifies a team established by teammates without an inferred name", () => {
    expect(read("Larkin - Raymond")).toMatchObject({teammateTeamId:17,autoMatches:[],scopedNames:[],review:[]});
    expect(read("Detroit lineup: Smith is out.").teammateTeamId).toBeNull();
    expect(read("Smith missed practice.", {beatTeamIds:[17]}).teammateTeamId).toBeNull();
    expect(read("Larkin - Raymond\nPittsburgh lines: Smith").teammateTeamId).toBeNull();
  });
  it("refuses common acronyms and never promotes a spelling that also occurs outside admissible source spans", () => {
    const acronymRoster = new Map(rosterByTeam).set(17,[...det,player(106,"Noah Hall-Lang","Hall-Lang",17), player(107,"Alex Holtz-Lee","Holtz-Lee",17)]);
    expect(read("Detroit lines: NHL/AHL", {rosterByTeam:acronymRoster})).toMatchObject({autoMatches:[],review:[]});
    for (const suffix of ["mbn", "M.b.N.", "@MBN", "#MBN", "https://example.com/MBN", "www.MBN.com", "MBN.ca/roster", "vs MBN", "“MBN”", "> MBN", "MBN17", "video_MBN"]) {
      const found = read("Detroit lines: MBN\n"+suffix);
      expect(found.autoMatches, suffix).toEqual([]);
      expect(found.review.some(r => r.rawName === "MBN" && r.start === 15),suffix).toBe(true);
    }
    expect(read('Detroit lines: MBN\nMBN will skate.').autoMatches).toHaveLength(2);
  });
});

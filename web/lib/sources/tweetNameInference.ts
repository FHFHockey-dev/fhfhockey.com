import { teamsInfo } from "lib/teamsInfo";
import type { RosterNameEntry, TeamDirectoryEntry } from "./lineupSourceIngestion";
import { normalizeIdentityName } from "./playerIdentity";
import { boundedDistance, canonicalAcronymMatches } from "./tweetNameLexicon";
import { reportedPowerPlayPenalty, surnameReadsAsPhrase } from "./tweetInterpretation";
import { isNonPlayerNameUse } from "./playerNameInProse";
import { reportedAbsenceDuration } from "./tweetAbsenceDuration";

export type TweetRosterNameMatch = {
  rawName: string; start: number; end: number; teamId: number | null; candidatePlayerIds: number[];
  reason: "unique_initials" | "ambiguous_initials" | "ambiguous_name" | "beat_only" | "fuzzy_name" | "team_unresolved" | "conflicting_context" | "no_dated_match";
};
export type TweetRosterAutoMatch = TweetRosterNameMatch & { reason: "unique_initials"; playerId: number };
export type TweetRosterScopedName = { rawName: string; start: number; end: number; teamId: number; playerId: number };
export type TweetRosterNameInference = {
  establishedTeamId: number | null; teammateTeamId: number | null;
  autoMatches: TweetRosterAutoMatch[]; scopedNames: TweetRosterScopedName[]; review: TweetRosterNameMatch[];
};
export type TweetRosterNameInput = {
  text: string; teams: readonly TeamDirectoryEntry[]; rosterByTeam: ReadonlyMap<number, readonly RosterNameEntry[]>;
  /** Caller-established subject of this post, independently of the reporter and inferred names. */
  postTeamId?: number | null; beatTeamIds?: readonly number[];
};

type Member = { player: RosterNameEntry; teamId: number; surname: string };
type Mention = { rawName: string; start: number; end: number; exact: Member[] };
const reserved = new Set(("NHL AHL ECHL OHL WHL QMJHL NCAA KHL SHL USHL CHL IIHF NHLPA USA CAN SWE FIN CZE GER RUS SUI SVK DEN NOR LAT "
  + "PP PK PPG PPA SHG GWG ENG TOI ATOI AAV IR LTIR DTD GTD UFA RFA PTO ELC OT OTL SO SOG GAA SV FO FOW "
  + "ESPN TSN TNT MSG NBC CBC SN USD EST EDT PST PDT CST CDT MST MDT ET PT AM PM TBD TBA MVP HOF CBA GM AGM UBI LBI ACL MCL PCL SCF LHD RHD LHS RHS PDO NHLER NHLERS "
  + "LINES LINEUP TONIGHT TODAY MORNING UPDATE PROJECTED PRACTICE WARMUPS WARMUP SCRATCH SCRATCHES INJURED INJURY STARTING EXPECTED SKATING SKATED SKATES RETURNS RETURNED PLAYING PLAYED DRAWING REPLACES FORWARDS DEFENCE DEFENSE GOALIES OFFICIAL CAPTAIN COACH REPORT PREGAME OPTIONAL STARTER EXTRAS STATUS HEALTHY TRAINING THURSDAY FRIDAY MONDAY SATURDAY WEDNESDAY TUESDAY SUNDAY "
  + "THE WAS HAS HIS HER HIM FOR AND ARE BUT WHO OUT OFF ICE NET DAY ONE TWO NEW").toLowerCase().split(" "));
const word = /(?:\p{L}\.){2,4}\p{L}\.?|[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu;
const initialism = /^(?:\p{Lu}\p{M}*\.?){3,5}$/u;
const league = /\b(?:AHL|ECHL|OHL|WHL|QMJHL|NCAA|USHL|KHL|Ontario Reign|Colorado Eagles|ReignInsider)\b/i;
const transaction = /\b(?:trade[ds]?|trading|acquir\w*|recall(?:ed|s)?|assign(?:ed|s)?|loan(?:ed|s)?|opponents?|visitors?)\b/i;
const opponent = /\b(?:vs\b\.?|versus|against|fac(?:e[sd]?|ing)|(?:takes?|taking) on|(?:lost|loses?) to|hosts?|hosting|visiting|opposing)\s+|(?:^|\s)@\s+/i;
const teammate = /\b(?:lines?|lineups?|pair(?:s|ed|ing)?|linemates?|rushes|alongside|skating with|skates with|with|replaces?|centers?|centres?)\b/i;
const historical = /\b(?:former(?:ly)?|previously|last (?:season|year))\b/i;
const otherSide = /\b(?:opposing|opposition|collid(?:ed|es) with|fought|fights|fight with|hit by|checked by|injured by|elbowed|cross[- ]checked)\b/i;
function isNameRow(row: string): boolean {
  const cells = row.replace(/^(?:[LFD][1-9]|PP[12]|PK[12])\s*:\s*/i, "").split(/[-–—/+,\s]+/u);
  return cells.length >= 2 && cells.length <= 6
    && /[-–—/+,]/u.test(row)
    && cells.every(cell => /^(?:[\p{Lu}][\p{L}\p{M}.'’]*|and|van|de|der|den|la)$/u.test(cell));
}
const unique = <T>(values: T[]) => [...new Set(values)];
const mask = (value: string) => " ".repeat(value.length);
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The roster map must contain only memberships valid at publication. Returned spans address the original, unsanitized text. */
export function inferTweetRosterNames(args: TweetRosterNameInput): TweetRosterNameInference {
  const members: Member[] = [];
  const names = new Map<string, Member[]>(), roleAliases = new Map<string, Member[]>();
  const memberships = new Map<number, Set<number>>();
  const teamIds = new Set(args.teams.map(team => team.id));
  for (const [teamId, roster] of args.rosterByTeam) {
    if (!teamIds.has(teamId)) continue;
    for (const player of roster) {
      if (!player.fullName || !player.lastName || (player.teamId != null && player.teamId !== teamId)) continue;
      const member = { player, teamId, surname: normalizeIdentityName(player.lastName) };
      members.push(member);
      const teams = memberships.get(player.playerId) ?? new Set<number>();
      teams.add(teamId);
      memberships.set(player.playerId, teams);
      for (const key of unique([player.fullName, player.lastName, ...(player.aliases ?? [])].map(normalizeIdentityName))) {
        const entries = names.get(key) ?? [];
        entries.push(member);
        names.set(key, entries);
      }
      for (const { alias } of player.roleAliases ?? []) {
        const key = normalizeIdentityName(alias);
        roleAliases.set(key, [...(roleAliases.get(key) ?? []), member]);
      }
    }
  }

  function mentions(line: string, offset: number): Mention[] {
    const words = [...line.matchAll(word)];
    const result: Mention[] = [];
    for (let i = 0; i < words.length; i++) {
      const first = words[i]!;
      let last = i, exact: Member[] = [];
      // Prefer the full canonical name over a substring, including multi-word surnames.
      for (let j = i; j < Math.min(i + 6, words.length); j++) {
        const item = words[j]!;
        if (j > i && !/^[\s‐‑–—-]+$/u.test(line.slice(words[j - 1]!.index + words[j - 1]![0].length, item.index))) break;
        const raw = line.slice(first.index, item.index + item[0].length);
        const players = names.get(normalizeIdentityName(raw));
        if (players && !surnameReadsAsPhrase(raw, line.slice(item.index + item[0].length), line.slice(0, first.index))) {
          last = j; exact = players;
        }
      }
      const end = words[last]!.index + words[last]![0].length;
      const rawName = line.slice(first.index, end);
      if (!isNonPlayerNameUse(rawName, line.slice(end), line.slice(0, first.index)))
        result.push({ rawName, start: offset + first.index, end: offset + end, exact });
      i = last;
    }
    return result;
  }

  const teamLabels = args.teams.map(team => {
    const labels = unique([team.name, team.shortName, team.abbreviation, team.location, ...team.hashtags, ...team.hashtags.flatMap(tag => tag.match(/^#go([a-z]{3,})go$/i)?.slice(1) ?? [])]
      .filter((label): label is string => !!label).map(label => label.replace(/^#/, "")));
    return { id: team.id, location: team.location, abbreviation: team.abbreviation, pattern: new RegExp(`(?<![\\p{L}\\p{N}_])#?(?:${labels.sort((a, b) => b.length - a.length).map(escape).join("|")})(?![\\p{L}\\p{N}_])`, "giu") };
  });
  const ignored = new Set([...reserved, ...Object.keys(teamsInfo).map(normalizeIdentityName), ...args.teams.map(team => normalizeIdentityName(team.abbreviation))]);
  const subjects = new Set<number>(), opponents = new Set<number>(), anchors = new Set<number>(), mentionedTeams = new Set<number>();
  const penalty = reportedPowerPlayPenalty(args.text);
  const penaltyTakers = penalty ? names.get(normalizeIdentityName(penalty.player)) ?? [] : [];
  const taker = penaltyTakers[0];
  const penalizedTeam = taker && penaltyTakers.every(member => member.player.playerId === taker.player.playerId)
    && memberships.get(taker.player.playerId)?.size === 1 ? taker.teamId : null;
  const ppTeammates = new Set<number>();
  const numberedSkaters = new Set<number>();
  const clubMentions: Array<{ id: number; abbreviation: string; start: number; end: number }> = [];
  const lines: { items: Mention[]; blocked: boolean; opponentStart: number; labelSpans: [number, number][]; disputedSide: boolean }[] = [];
  let quoted = false, neutralMatchup = false;
  const body = args.text.replace(/“[^”]*”|"[^"]*"/g, quote => quote.replace(/[^\r\n]/g, " "));

  for (const line of body.matchAll(/[^\r\n]+/g)) {
    if (/^\s*(?:quoted (?:post|tweet)|opponents?\s*:|opponent(?:'s)? (?:lineup|lines)|around the league|elsewhere\s*:)/i.test(line[0])
      || (line.index > 0 && /^\s*RT\s+@/i.test(line[0]))) quoted = true;
    const blocked = quoted || /^\s*>/.test(line[0]);
    // Only the numbered rows describe PP teammates. The lead can name the penalized skater,
    // the player who drew the penalty, or the opposing goalie who faced the shots.
    const penaltyLead = penalty != null && penalizedTeam != null && line.index < penalty.firstUnitStart;
    const visible = line[0].replace(/(?:https?:\/\/|\bwww\.)\S+|\b(?:[\w-]+\.)+(?:com|ca|org|net|co|io|tv|news|hockey)\b(?:\/\S*)?/gi, mask);
    const playerText = visible.replace(/[@#][\p{L}\p{N}_]+/gu, mask);
    const divide = opponent.exec(visible)?.index ?? Infinity;
    const labelSpans: [number, number][] = [];
    for (const team of teamLabels) for (const label of visible.matchAll(team.pattern)) {
      // "Hamilton" in a numbered personnel list can be Dougie Hamilton. The historical
      // Hamilton club has no skaters on this date and contributes no competing team evidence.
      if (penalty && line.index >= penalty.firstUnitStart && !args.rosterByTeam.get(team.id)?.length
        && label[0].toLowerCase() === team.location?.toLowerCase() && names.has(normalizeIdentityName(label[0]))) continue;
      const prefix = visible.slice(0, label.index);
      const penaltyVictim = penaltyLead && /\bwas called for [\w-]+ against\s+$/i.test(prefix);
      const place = !penaltyVictim && (label.index >= divide || /(?:\b(?:in|at|from|to|over|visit(?:s|ing)?|hosting|against|vs|versus)\.?\s+(?:the\s+)?|@\s*)$/i.test(prefix));
      if (!place && !label[0].startsWith("#") && label[0].toUpperCase() === team.abbreviation && label[0] !== team.abbreviation) continue;
      labelSpans.push([line.index + label.index, line.index + label.index + label[0].length]);
      if (blocked) continue;
      (place ? opponents : subjects).add(team.id);
      if (!place) clubMentions.push({ id: team.id, abbreviation: team.abbreviation, start: line.index + label.index,
        end: line.index + label.index + label[0].length });
    }
    labelSpans.sort((a, b) => a[0] - b[0]);
    const pairedTeams = labelSpans.some(([start], index) => index > 0
      && /^\s*(?:at|@|in|vs\.?|versus|against)\s*$/i.test(args.text.slice(labelSpans[index - 1]![1], start)));
    if (pairedTeams || (divide !== Infinity && labelSpans.length >= 2 && !teammate.test(visible.slice(0, divide)))) neutralMatchup = true;
    const items = mentions(playerText, line.index);
    const row = visible.replace(/^\s*[^\p{L}\p{N}]+/u, "").trim();
    const named = items.filter(item => item.exact.length);
    const disputedSide = otherSide.test(visible) || named.some((item, index) => index > 0
      && /^\s+(?:injured|hits?|checked|boarded|slashed|tripped)\s+$/i.test(args.text.slice(named[index - 1]!.end, item.start)));
    const playerRow = penalty && penalizedTeam != null ? row.replace(/^PP\s*[12]\s+is\s+/i, "").replace(/\s&(?:amp;)?\s/g, ", ") : row;
    const sameTeam = !blocked && !disputedSide && divide === Infinity && (isNameRow(playerRow) || teammate.test(visible)
      || (named.length >= 2 && /\b(?:skated|practice|warmups|scratched|lineup|out (?:today|tonight)|injured|absent|day.to.day|will (?:play|dress|miss))\b/i.test(visible)));
    for (const item of items) {
      if (!item.exact.length || !/^\p{Lu}/u.test(item.rawName) || ignored.has(normalizeIdentityName(item.rawName))
        || labelSpans.some(([a, b]) => item.start < b && item.end > a) || blocked || penaltyLead) continue;
      const owners = unique(item.exact.map(m => m.teamId));
      if (owners.length !== 1 || unique(item.exact.map(m => m.player.playerId)).length !== 1) continue;
      const anchorId = item.exact[0]!.player.playerId;
      if (memberships.get(anchorId)!.size !== 1 || roleAliases.get(normalizeIdentityName(item.rawName))?.some(m => m.player.playerId !== anchorId)) continue;
      // A historical alias cannot establish the team if these same letters could name someone else.
      if (initialism.test(item.rawName) && members.some(m => m.player.playerId !== item.exact[0]!.player.playerId
        && canonicalAcronymMatches(item.rawName, m.player.fullName))) continue;
      mentionedTeams.add(owners[0]!);
      if (penalizedTeam != null && penalty && line.index >= penalty.firstUnitStart) ppTeammates.add(anchorId);
      const namedAbsence = !disputedSide && item.start < line.index + divide
        && normalizeIdentityName(item.rawName) === normalizeIdentityName(item.exact[0]!.player.fullName)
        && reportedAbsenceDuration(args.text, item.start, item.end);
      if (sameTeam && /^PP\s*[12]\s*:/i.test(row)) numberedSkaters.add(anchorId);
      if (sameTeam || namedAbsence) anchors.add(owners[0]!);
    }
    lines.push({ items, blocked: blocked || penaltyLead, opponentStart: line.index + divide, labelSpans, disputedSide });
  }

  // A shared label such as "Utah" can match both franchise records. Require independent
  // PP skaters on one club and identical source spans before dropping a rosterless duplicate.
  if (subjects.size > 1 && numberedSkaters.size >= 2 && anchors.size === 1 && mentionedTeams.size === 1) {
    const [anchor] = anchors;
    const active = clubMentions.filter(hit => hit.id === anchor);
    for (const id of subjects) {
      if (id === anchor || args.rosterByTeam.get(id)?.length) continue;
      const duplicate = clubMentions.filter(hit => hit.id === id).every(hit => active.some(other =>
        other.abbreviation === hit.abbreviation && other.start === hit.start && other.end === hit.end));
      if (duplicate) subjects.delete(id);
    }
  }
  const proposed = args.postTeamId && teamIds.has(args.postTeamId) ? args.postTeamId : null;
  const evidence = unique([...subjects, ...anchors, ...(proposed ? [proposed] : [])]);
  const team = evidence.length === 1 ? evidence[0]! : null;
  const conflict = neutralMatchup || evidence.length > 1 || mentionedTeams.size > 1 || (team !== null && [...mentionedTeams].some(id => id !== team))
    || (penalizedTeam != null && (team === penalizedTeam || ppTeammates.size < 2))
    || transaction.test(args.text) || league.test(args.text) || historical.test(body);
  const establishedTeamId = !conflict && team !== null && (!opponents.has(team) || subjects.has(team)) ? team : null;
  const beats = new Set(args.beatTeamIds?.filter(id => teamIds.has(id)));
  const teammateTeamId = establishedTeamId !== null && anchors.has(establishedTeamId) ? establishedTeamId : null;
  const result: TweetRosterNameInference = { establishedTeamId, teammateTeamId, autoMatches: [], scopedNames: [], review: [] };

  for (const { items, blocked, opponentStart, labelSpans, disputedSide } of lines) for (const item of items) {
    const { rawName, start, end } = item, key = normalizeIdentityName(rawName);
    if (/[\p{L}\p{N}_]/u.test(args.text.charAt(start - 1)) || /[\p{L}\p{N}_]/u.test(args.text.charAt(end))
      || ignored.has(key) || labelSpans.some(([a, b]) => start < b && end > a)) continue;
    const nonPlayerUse = /\b(?:via|according to|presented by|sponsored by)\s*$/i.test(args.text.slice(0, start))
      || /^\s+(?:network|television|TV|broadcast|foundation|agency|media)\b/i.test(args.text.slice(end));
    const unsafe = blocked || start >= opponentStart || conflict || nonPlayerUse || disputedSide;
    const scoped = unsafe ? null : establishedTeamId;
    let candidates: Member[], reason: TweetRosterNameMatch["reason"];
    const roles = roleAliases.get(key) ?? [];
    const exactOwners = [...item.exact, ...roles];
    if (scoped !== null && item.exact.length && exactOwners.some(m => m.teamId !== scoped)
      && unique(exactOwners.map(m => m.player.playerId)).length > 1) {
      const initials = initialism.test(rawName) ? members.filter(m => m.teamId === scoped && canonicalAcronymMatches(rawName, m.player.fullName)) : [];
      candidates = [...exactOwners, ...initials];
      const localIds = unique(candidates.filter(m => m.teamId === scoped).map(m => m.player.playerId));
      const exact = item.exact.find(m => m.teamId === scoped);
      const disputedMembership = exact && memberships.get(exact.player.playerId)!.size !== 1;
      if (exact && localIds.length === 1 && !disputedMembership) {
        result.scopedNames.push({ rawName, start, end, teamId: scoped, playerId: exact.player.playerId });
        continue;
      }
      reason = disputedMembership ? "conflicting_context" : "ambiguous_name";
    } else if (initialism.test(rawName)) {
      candidates = members.filter(m => (scoped === null || m.teamId === scoped) && canonicalAcronymMatches(rawName, m.player.fullName));
      // An established spelling is already handled by the ordinary resolver. A generated
      // alias may never overwrite a different player, even when the alias has a slot restriction.
      const known = [...item.exact, ...(roleAliases.get(key) ?? [])];
      if (known.length) {
        candidates = [...candidates, ...known];
        if (unique(candidates.map(m => m.player.playerId)).length < 2) continue;
        reason = "ambiguous_initials";
      } else {
        if (!candidates.length) continue;
        const ids = unique(candidates.map(m => m.player.playerId));
        if (unsafe || memberships.get(ids[0]!)!.size > 1 || (scoped === null && candidates.every(m => opponents.has(m.teamId)))) reason = "conflicting_context";
        else if (ids.length > 1) reason = "ambiguous_initials";
        else if (scoped !== null) reason = "unique_initials";
        else reason = candidates.some(m => beats.has(m.teamId)) ? "beat_only" : "team_unresolved";
      }
    } else if (item.exact.length) {
      candidates = item.exact.filter(m => scoped === null || m.teamId === scoped);
      if (unique(candidates.map(m => m.player.playerId)).length < 2) continue;
      reason = "ambiguous_name";
    } else {
      if (blocked || start >= opponentStart || !/^\p{Lu}[\p{Ll}\p{M}'’]{4,}$/u.test(rawName)) continue;
      candidates = members.filter(m => (scoped === null ? !beats.size || beats.has(m.teamId) : m.teamId === scoped)
        && boundedDistance(key, m.surname, 1) === 1);
      if (!candidates.length) continue;
      reason = "fuzzy_name";
    }
    const ids = unique(candidates.map(m => m.player.playerId)).sort((a, b) => a - b);
    const suggested = !unsafe && beats.size === 1 && candidates.some(m => beats.has(m.teamId) && !opponents.has(m.teamId));
    const teamId = scoped ?? (suggested ? [...beats][0]! : null);
    const reading = { rawName, start, end, teamId, candidatePlayerIds: ids, reason };
    if (reason === "unique_initials") result.autoMatches.push({ ...reading, reason, playerId: ids[0]! });
    else result.review.push(reading);
  }

  // Downstream aliases apply to the entire post. Every equivalent spelling in the original
  // bytes must be an admitted, standalone occurrence, including masked URLs and quoted text.
  const unsafeSpellings = new Set<string>();
  for (const key of unique(result.autoMatches.map(m => normalizeIdentityName(m.rawName)))) {
    const matches = result.autoMatches.filter(m => normalizeIdentityName(m.rawName) === key);
    const occurrences = normalizeIdentityName(args.text).match(new RegExp(escape(key), "gu"))?.length ?? 0;
    if (occurrences !== matches.length || unique(matches.map(m => m.rawName)).length !== 1
      || unique(matches.map(m => m.playerId)).length !== 1) unsafeSpellings.add(key);
  }
  result.autoMatches = result.autoMatches.filter(m => {
    if (!unsafeSpellings.has(normalizeIdentityName(m.rawName))) return true;
    result.review.push({ rawName: m.rawName, start: m.start, end: m.end, candidatePlayerIds: m.candidatePlayerIds, teamId: m.teamId, reason: "conflicting_context" });
    return false;
  });
  result.review.sort((a, b) => a.start - b.start);
  return result;
}

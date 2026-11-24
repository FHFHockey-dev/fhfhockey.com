import clubHandles from "../lines/fixtures/clubHandles.ledger.json";

// AHL clubs by full name (also as one-word hashtags). Many carry an NHL location or nickname ("Colorado Eagles",
// "Providence Bruins", "Iowa Wild"), so without this they label-match an NHL team. Bare nicknames are left out:
// a quoted "Wolf Pack lines" relayed as "Rangers lines" is still the NHL club's post. A post that also names an NHL
// club in words ("The Mammoth have signed … from the Rochester Americans") stays an NHL post.
export const AHL_CLUB_NAMES = [
  "abbotsford canucks", "bakersfield condors", "belleville senators", "bridgeport islanders", "calgary wranglers",
  "charlotte checkers", "chicago wolves", "cleveland monsters", "coachella valley firebirds", "colorado eagles",
  "grand rapids griffins", "hartford wolf pack", "henderson silver knights", "hershey bears", "iowa wild", "laval rocket",
  "lehigh valley phantoms", "manitoba moose", "milwaukee admirals", "ontario reign", "providence bruins",
  "rochester americans", "rockford icehogs", "san diego gulls", "san jose barracuda", "springfield thunderbirds",
  "syracuse crunch", "texas stars", "toronto marlies", "tucson roadrunners", "utica comets",
  "wilkes barre scranton penguins", "wbs penguins",
];
// An affiliate in a recall identifies where the player came from. In a mixed bulletin,
// qualify the subsequent medical subjects individually against the publication roster.
const medicalRole = "(?:forward|defen[cs]eman|goaltender)";
const bulletinName = String.raw`[\p{L}.'’-]+(?: [\p{L}.'’-]+){1,3}?`;
const retroactiveDate = String.raw`(?:\d{1,2}\/\d{1,2}|[\p{L}]{3,9}\.? \d{1,2})`;
const injuredReserve = String.raw`(?:injured reserve|IR)(?: retroactive to ${retroactiveDate})?`;
const bulletinRecall = new RegExp(String.raw`^(?:ROSTER UPDATES?\s+|TRANSACTIONS?:\s+)(?:the )?[@#](\w{1,15}) (?:have|has) recalled ${medicalRole} (${bulletinName}) from (?:the )?([\p{L} -]+) \(AHL\)\.?(?:[ \t]*\n+|[ \t]+)([\s\S]+)$`, "iu");
const medicalSubject = new RegExp(String.raw`^${medicalRole} (${bulletinName}) (?:\((?:upper|lower)[- ]body\) )?(?=will |has )`, "iu");
const placedByClub = new RegExp(String.raw`^the ([\p{L} -]+?) (?:also )?placed ${medicalRole} (${bulletinName}) on ${injuredReserve}\.?$`, "iu");
const irPlacement = new RegExp(String.raw`^has been placed on ${injuredReserve}\.?(?: He is considered week[- ]to[- ]week\.?)?$`, "iu");
const missedGame = /^will not play tonight \((?:upper|lower)[- ]body\) and (?:has been placed on injured reserve \(IR\)\.?(?: He will miss approximately \d+[-–]\d+ weeks\.?)?|is listed as day[- ]to[- ]day\.?)$/iu;
const activated = /^has been activated off IR and will play tonight\.?$/iu;

export function bulletinNamesClub(token: string, name: string, abbreviation: string, publishedAt: string) {
  if (name.replace(/ /g, "").toLowerCase() === token) return true;
  return datedClubByline(token, name, abbreviation, publishedAt);
}

export function datedClubByline(token: string, name: string, abbreviation: string, publishedAt: string) {
  const club = clubHandles.teams[abbreviation as keyof typeof clubHandles.teams];
  // An abbreviation can belong to a former club, as with the two Utah teams.
  return publishedAt.slice(0, 10) > clubHandles.checkedAt && club?.handle === token && club.name === name;
}

function medicalUpdate(line: string, offset: number) {
  const active = placedByClub.exec(line);
  const subject = active ?? medicalSubject.exec(line);
  if (!subject) return null;
  const name = active ? active[2]! : subject[1]!;
  const predicate = line.slice(subject[0].length);
  if (!active && !irPlacement.test(predicate) && !missedGame.test(predicate) && !activated.test(predicate)) return null;
  const move = active || /\bplaced on (?:injured reserve|IR)\b/iu.test(predicate) ? "placed_on_ir" as const
    : activated.test(predicate) ? "activated_off_ir" as const : null;
  const retroactive = /\bretroactive to (\d{1,2}\/\d{1,2}|[\p{L}]{3,9}\.? \d{1,2})/iu.exec(line)?.[1] ?? null;
  const start = offset + (active ? line.lastIndexOf(name) : subject[0].indexOf(name));
  return { clubName: active?.[1] ?? null, move, retroactive,
    subject: { start, end: start + name.length, text: name },
    evidence: { start: offset, end: offset + line.length, text: line } };
}

/** A single club's recall followed exclusively by named medical updates. Spans use the unmodified source. */
export function readClubMedicalBulletin(text: string) {
  if (!/\(AHL\)/iu.test(text)) return null;
  const raw = text.trimEnd();
  const recall = bulletinRecall.exec(raw.replace(/^\s*(?:RT @\w{1,15}:\s*)?/iu, ""));
  if (!recall || !AHL_CLUB_NAMES.includes(recall[3]!.toLowerCase())) return null;
  const body = recall[4]!, offset = raw.length - body.length;
  const updates: NonNullable<ReturnType<typeof medicalUpdate>>[] = [];
  for (const line of body.matchAll(/[^\r\n]+/gu)) {
    const clean = line[0].trim();
    if (!clean) continue;
    const update = medicalUpdate(clean, offset + line.index + line[0].indexOf(clean));
    if (!update || updates.some(old => old.subject.text === update.subject.text)) return null;
    updates.push(update);
  }
  const name = recall[2]!, start = raw.indexOf(name + " from", raw.length - recall[0].length);
  if (!updates.length || start < 0) return null;
  return { handle: recall[1]!.toLowerCase(), updates, recalled: { start, end: start + name.length, text: name },
    recallEvidence: { start: raw.length - recall[0].length, end: offset, text: raw.slice(raw.length - recall[0].length, offset) } };
}

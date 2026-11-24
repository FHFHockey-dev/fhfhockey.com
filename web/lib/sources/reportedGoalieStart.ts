import { NHL_TEXT_HINTS, teamHashtagsByAbbreviation, teamsInfo } from "../teamsInfo";

function teamId(label: string | undefined) {
  if (!label) return null;
  const key = label.replace(/^#/u, "").toLowerCase();
  const teams = Object.values(teamsInfo).filter(team => [team.abbrev, team.name, team.shortName, team.location,
    ...(teamHashtagsByAbbreviation[team.abbrev] ?? [])].some(n => n?.replace(/^#/u, "").toLowerCase() === key)
    || NHL_TEXT_HINTS[key] === team.abbrev);
  return teams.length === 1 ? teams[0]!.id : null;
}

/** The reporter quotes a named speaker directly confirming this goalie. Keep the printed matchup separate from game binding. */
export function reportedGoalieStart(text: string, start: number, end: number) {
  const prefix = /^(?:(#[\w]+)[ \t]+)?([\p{Lu}][\p{L}’'-]*(?:[ \t]+[\p{Lu}][\p{L}’'-]*){0,2})[ \t]+confirms(?: that)?[ \t]+$/u.exec(text.slice(0, start));
  if (!prefix || /\b(?:if|unless|assuming|provided|conditional|except|pending|projected|likely|probably|not|never|guess|doubt\w*|speculat\w*|next (?:game|week|night)|last (?:game|night|week)|withdraw\w*|deni\w*|suppos\w*|unconfirmed|no|nobody|nothing|rumou?r|expected|maybe|possibly|practice|warm[- ]?ups?|previous|yesterday|tomorrow|incorrect|false|untrue|misquot\w*|instead|actually|correction|update|retract\w*|disregard|mistake)\b|[?“”"]/iu.test(text)) return null;
  const match = /^[ \t]+((?:will get the start|will start|starts)(?: in (?:net|goal))?(?: (?:today|tonight))?(?: (?:vs\.?|against|for) (?:the )?(#?[\p{L}][\p{L} -]*?)(?: tonight)?)?)([.!]|$)(?=\s|$)/iu.exec(text.slice(end));
  if (!match) return null;
  const after = text.slice(end + match[0].length).trim();
  const surname = text.slice(start, end).trim().split(/\s+/u).at(-1)!;
  // A later sentence about a different skater is independent. A change to this goalie,
  // another starter, or an unresolved pronoun needs review.
  if (after && !/^(?:#\w+\s*)+$/u.test(after)
    && (!/^[\p{Lu}][\p{L}'’-]+\s+[\p{Lu}][\p{L}'’-]+\s/u.test(after)
      || after.toLowerCase().includes(surname.toLowerCase()) || /\b(?:he|she|they|goalie|net|goal|start\w*|backup|back up|mistaken|wrong|deni\w*|scratch\w*)\b/iu.test(after))) return null;
  const forTeam = /\bfor (?:the )?/iu.test(match[1]!);
  const subjectTeamId = teamId(prefix[1]), namedTeam = teamId(match[2]);
  if ((prefix[1] && !subjectTeamId) || (forTeam && (!namedTeam || (subjectTeamId && subjectTeamId !== namedTeam)))) return null;
  const opponent = forTeam ? null : match[2] ?? null;
  const opponentId = opponent ? namedTeam : null;
  if (opponent && !opponentId && (!subjectTeamId || !/^(?:#[\w]+|[\p{Lu}][\p{L}’'-]+)$/u.test(opponent))) return null;
  if (opponentId && opponentId === subjectTeamId) return null;
  const predicateStart = end + match[0].indexOf(match[1]!);
  return { speaker: prefix[2]!, teamId: subjectTeamId ?? (forTeam ? namedTeam : null), opponent, opponentId,
    predicate: { start: predicateStart, end: predicateStart + match[1]!.length, text: match[1]! },
    evidence: { start: 0, end: end + match[0].length, text: text.slice(0, end + match[0].length) } };
}

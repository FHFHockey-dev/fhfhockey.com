import { teamsInfo, teamHashtagsByAbbreviation } from "../teamsInfo";
import { fiveForwardWorkHeading, reportedPowerPlayPenalty, type TweetInterpretation } from "./tweetInterpretation";

/** Separate the governing PP headings from the player rows without changing their source coordinates. */
export function readNumberedPowerPlayReport(text: string, verifiedRepostAuthor?: string | null) {
  if (/\b(?:correction|retract\w*|ignore|instead|previous|yesterday|if|would|might|projected|expected|5[- ](?:on[- ])?3|five[- ]on[- ]three)\b|[?“”"]/i.test(text)) return null;
  const headings = [...text.matchAll(/^[ \t]*(PP[ \t]*([12]))(?:[ \t]*:|[ \t]+is\b|[ \t]*--|(?=[ \t]*\r?$))/gim)];
  if (!headings.length || new Set(headings.map(h => h[2])).size !== headings.length) return null;
  const prefix = /^RT @([A-Za-z0-9_]{1,15}):\s*/i.exec(text);
  if (prefix && prefix[1]!.toLowerCase() !== verifiedRepostAuthor?.toLowerCase()) return null;
  const lead = text.slice(prefix?.[0].length ?? 0, headings[0]!.index).trim();
  const penalty = reportedPowerPlayPenalty(text);
  let club: RegExpExecArray | null = null;
  if (penalty) {
    club = /\band the ([\w .'-]+?) PP will get another look[.!]?$/i.exec(lead)
      ?? /\bagainst\s+(#\w+)\b/i.exec(lead)
      ?? /\bso\s+(#\w+)\s+will get the (?:first |next )?power play\b/i.exec(lead)
      ?? /^(?:\d+[-–]\d+\s+)(#\w+)\./i.exec(lead);
  } else if (lead) {
    club = /^(#?[\w .-]+?)(?:['’]s)?\s+power[ -]play\s+(?:units|lines)\s*:?$/i.exec(lead)
      ?? /^PP units for the ([\w .'-]+?) at practice\s*:?$/i.exec(lead)
      ?? fiveForwardWorkHeading(text);
  }
  if (lead && !club) return null;
  const label = club?.[1];
  const footer = /\r?\n[ \t]*(#\w+(?:[ \t]+#\w+)*)[ \t]*\s*$/u.exec(text);
  const tags = [...lead.matchAll(/#\w+/g), ...(footer?.[1].matchAll(/#\w+/g) ?? [])].map(m => m[0].toLowerCase());
  const teams = Object.values(teamsInfo).filter(team => {
    if (!label) return false;
    const names = [team.abbrev, team.name, team.shortName];
    if (team.abbrev === "COL") names.push("Avs");
    const hashtags = [`#${team.abbrev}`, ...(teamHashtagsByAbbreviation[team.abbrev] ?? [])].map(t => t.toLowerCase());
    // A market name alone can also describe another league. Require its NHL tag on this report.
    if (team.location && tags.some(t => hashtags.includes(t))) names.push(team.location);
    if (team.abbrev === "COL") hashtags.push("#avs");
    return [...names, ...hashtags].some(n => n.toLowerCase() === label.toLowerCase()) && tags.every(t => hashtags.includes(t));
  });
  if ((label || footer) && teams.length !== 1) return null;
  const phase = penalty ? "in_game" as const : /\bat practice\s*:?$/i.test(lead) ? "practice" as const : "unspecified" as const;
  const sections = headings.map((match, i) => {
    const start = match.index + match[0].indexOf(match[1]!);
    return { number: Number(match[2]), heading: { start, end: start + match[1]!.length, text: match[1]! },
      bodyStart: match.index + match[0].length, end: headings[i + 1]?.index ?? footer?.index ?? text.length };
  });
  const start = club && label ? text.indexOf(lead, prefix?.[0].length ?? 0) + club.index + club[0].indexOf(label) : -1;
  return { teamId: teams[0]?.id ?? null, clubSpan: label ? { start, end: start + label.length, text: label } : null, phase, sections };
}

/** Require five distinct, exact printed names accounting for the whole numbered section. */
export function printedPowerPlayUnits(text: string, reading: TweetInterpretation, report: NonNullable<ReturnType<typeof readNumberedPowerPlayReport>>) {
  return report.sections.flatMap(section => {
    const units = reading.units.filter(u => u.situation === "pp" && u.explicitNumber && u.number === section.number);
    const unit = units[0];
    if (units.length !== 1 || !unit?.complete || unit.group || unit.evidence.length !== 5 || unit.players.length !== 5
      || new Set(unit.players.map(p => p.playerId)).size !== 5) return [];
    let cursor = section.bodyStart;
    const separators = (s: string) => /^[\s,&|\-–—]*$/u.test(s.replace(/&amp;/g, "&"));
    const names = [];
    for (const span of unit.evidence) {
      if (span.start < cursor || span.end <= span.start || span.end > section.end || text.slice(span.start, span.end) !== span.text
        || !separators(text.slice(cursor, span.start))) return [];
      // Older and current row interpretations may include a spaced dash after the name.
      // Verify the stored span above, then use only the printed name to join the identity occurrence.
      const name = span.text.replace(/\s+[-–—−]$/u, "");
      if (!name) return [];
      names.push({ start: span.start, end: span.start + name.length, text: name });
      cursor = span.start + name.length;
    }
    const remaining = text.slice(cursor, section.end).replace(/\s+https:\/\/t\.co\/[A-Za-z0-9]+\s*$/, "");
    // The Colorado practice original puts a separate PK assignment between the two PP fives.
    const pkAside = report.phase === "practice" && /^[ \t]*\r?\n[ \t]*\p{Lu}[\p{L}’'-]* is on the PK\.?\s*$/u.test(remaining);
    return separators(remaining) || pkAside ? [{ unit: { ...unit, evidence: names }, heading: section.heading }] : [];
  });
}

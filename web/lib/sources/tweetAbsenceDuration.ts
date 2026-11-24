import { isNonPlayerNameUse } from "./playerNameInProse";
import { bilingualAbsenceBulletin, translatedAbsencePredicate } from "./bilingualAbsenceBulletin";

// An absence period describes availability. It does not identify a game or a return date.
const counts: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const quantity = `(?:\\d+|${Object.keys(counts).join("|")})`;
const units = "(?:days?|weeks?|months?)";
const predicate = new RegExp(
  String.raw`^[ \t]+(?:\((?:(?:upper|lower)[- ]body|(?:high )?(?:ankle|arm|back|foot|hand|head|hip|knee|leg|neck|shoulder|throat|wrist)(?: (?:sprain|injury))?)\)[ \t]+)?` +
  String.raw`(?<predicate>(?:(?<expected>is expected to) (?:be out|miss)|will (?:be out|miss)|(?:is |remains )?out)(?: for)? ` +
  String.raw`(?<period>(?:(?<modifier>at least|a minimum of|approximately|about|around) )?(?<lower>${quantity})` +
  String.raw`(?:(?:\s*[-–—]\s*|\s+to\s+)(?<upper>${quantity}))?\s+(?:more )?(?<unit>${units})` +
  String.raw`(?:\s+to\s+(?<otherUpper>${quantity})\s+(?<otherUnit>${units}))?))\b`, "iu");
const count = (value: string) => counts[value.toLowerCase()] ?? Number(value);
const unitOf = (unit: string) => (unit.toLowerCase().replace(/s$/, "") + "s") as "days" | "weeks" | "months";

export function absenceCoachCredit(lead: string) {
  const match = /^(?:(#?[\p{L}]+)\s+)?(?:head\s+)?coach\s+(.+?)\s+(?:says|confirms)(?: that)?$/iu.exec(lead);
  if (!match || !/^(?:[\p{Lu}][\p{L}\p{M}.'’-]*)(?: [\p{Lu}][\p{L}\p{M}.'’-]*){0,3}$/u.test(match[2]!)) return null;
  return { club: match[1] ?? null };
}

/** Read only a direct predicate of this specific named subject. Offsets address the unmodified source. */
export function reportedAbsenceDuration(source: string, start: number, end: number) {
  const bulletin = bilingualAbsenceBulletin(source);
  if (bulletin && translatedAbsencePredicate.test(source.slice(end))) return bulletin.reports.find(r => r.start === start && r.end === end) ?? null;
  const subject = source.slice(start, end);
  if (isNonPlayerNameUse(subject, source.slice(end), source.slice(0, start))) return null;
  // An adjacent IR sentence supplies one explicit antecedent. Keep both sentences in the evidence.
  const ir = /^[\p{Lu}][\p{L}'’.-]+(?: [\p{Lu}][\p{L}'’.-]+)+$/u.test(subject)
    && source.slice(end).match(/^ will not play tonight \((?:upper|lower)[- ]body\) and has been placed on Injured Reserve \(IR\)\.[ \t]+He(?= will miss )/u);
  if (ir && (source.slice(0, start) + "\n" + source.slice(end)).toLowerCase().includes(subject.split(" ").at(-1)!.toLowerCase())) return null;
  if (ir && /\b(?:correction|actually|if cleared|may still|could still|might still|he (?:may|might|could|will) (?:play|return)|he (?:is|was) available)\b/iu.test(source.slice(end + ir[0].length))) return null;
  const predicateOffset = end + (ir ? ir[0].length : 0);
  const match = predicate.exec(source.slice(predicateOffset));
  const fields = match?.groups;
  if (!match || !fields || start < 0 || end <= start) return null;
  const before = source.slice(0, start).replace(/^\s*RT\s+@[\w]+:\s*/i, "");
  const lead = (before.split(/[.!?;\n]/u).at(-1) ?? "").trim();
  if (lead && !(ir && /^(?:forward|defen[cs]eman)$/iu.test(lead)) && !/^[-•‼️\s]+$/u.test(lead) && !absenceCoachCredit(lead) && !/^by the way,$/i.test(lead)) return null;
  if (/\b(?:if|unless|hypothetical|rumou?r|unconfirmed|prediction|incorrect|correction|disregard|retracted|last (?:game|week|month|season|year)|yesterday|previously)\b|[“”"?]/iu.test(source)) return null;
  const tail = source.slice(predicateOffset + match[0].length).replace(/^[ \t]+/, "");
  // A following qualifier, alternative unit or date can change the meaning of the number.
  if (!/^(?:\s*$|[.!;\n]|https?:\/\/|#|,\s*[\p{Lu}][\p{L}'’-]+ says\b|with (?:an? )?(?:upper|lower)[- ]body injury\b)/u.test(tail)) return null;
  let unit = unitOf(fields.unit!), minimum = count(fields.lower!), maximum = count(fields.upper ?? fields.lower!);
  if (fields.otherUnit) {
    const otherUnit = unitOf(fields.otherUnit);
    if (fields.upper || unit === "months" || otherUnit === "months") return null;
    minimum *= unit === "weeks" ? 7 : 1;
    maximum = count(fields.otherUpper!) * (otherUnit === "weeks" ? 7 : 1);
    unit = "days";
  }
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || minimum <= 0 || maximum < minimum) return null;
  const modifier = fields.modifier?.toLowerCase();
  const lowerBound = modifier === "at least" || modifier === "a minimum of";
  const approximate = Boolean(modifier && !lowerBound);
  if (lowerBound && (fields.upper || fields.otherUpper)) return null;
  const estimate = approximate && !fields.upper && !fields.otherUpper;
  const predicateStart = predicateOffset + match[0].indexOf(fields.predicate!);
  return {
    ...(ir ? { irContinuation: true as const } : {}),
    predicate: { start: predicateStart, end: predicateOffset + match[0].length, text: fields.predicate! },
    tentative: Boolean(fields.expected),
    timeline: { purpose: "absence" as const, minimum: estimate ? null : minimum, maximum: lowerBound || estimate ? null : maximum,
      ...(approximate ? { approximate: true, ...(estimate ? { estimate: minimum } : {}) } : {}),
      unit, targetDate: null, text: fields.period! },
  };
}

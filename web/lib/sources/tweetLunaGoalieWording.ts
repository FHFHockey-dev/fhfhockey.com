import type { IdentitySourceSpan } from "./tweetIdentityProposal";

// Deliberately conservative lexical gates, not a general semantic classifier.
// Unknown/omitted proposals remain valid when these patterns cannot establish support.
const firstOff = /\bfirst[ -]+(?:(?:goalie|goaltender)[ -]+)?off\b/iu;
const negative = /\b(?:not|never|no|cannot|can['’]t|won['’]t|isn['’]t|wasn['’]t|doesn['’]t|didn['’]t)\b/iu;
const backup = /\bback[ -]?up\b|\bbacks?\s+(?:him|her|them)\s+up\b/iu;
const conditional = /\b(?:if|unless|provided|providing|assuming|whether|depending|subject to|as long as|in case|would|could|might|may)\b/iu;
const disavowed = /\b(?:false|untrue|incorrect|inaccurate|denied|denies|deny|retracted|rumou?r|no confirmation)\b|\bnot\s+(?:true|correct)|\b(?:did not|didn't|didn’t|never)\s+(?:say|confirm|report)\b/iu;
const historicalOrInGame = /\b(?:yesterday|last (?:night|game|season|week)|earlier (?:today|tonight)|(?:second|third|2nd|3rd) period|mid[ -]?game|replaces?|replaced|relief)\b/iu;

export function lunaGoalieContext(text: string, subject: IdentitySourceSpan) {
  const before = text.slice(0, subject.start), after = text.slice(subject.end);
  const start = Math.max(...[".", "!", "?", ";", "\n"].map(mark => before.lastIndexOf(mark))) + 1;
  const boundary = after.search(/[.!?;\n]/u);
  const end = boundary < 0 ? text.length : subject.end + boundary + 1;
  return { start, end, text: text.slice(start, end) };
}

export function assertLunaGoalieWording(args: {
  source: string; subject: IdentitySourceSpan; evidence: IdentitySourceSpan;
  status: "confirmed" | "ruled_out" | "likely" | "projected" | "unknown";
  repeatedIdentity: boolean;
}) {
  if (args.status === "unknown") return;
  const sentence = lunaGoalieContext(args.source, args.subject), context = sentence.text;
  const outside = args.source.slice(0, sentence.start) + "\n" + args.source.slice(sentence.end);
  // No relation/phase fields exist in this response. Conservatively hold the
  // whole report's non-unknown statuses when it announces a correction/update.
  if (args.repeatedIdentity || /\b(?:correction|correcting|update|updated|retract\w*|disregard|instead)\b/iu.test(args.source)) {
    throw new Error("goalie_conflict_or_correction_unresolved");
  }
  // No pronoun/coreference or correction relation exists in this response. Hold
  // separate pronoun starter clauses, even when they might concern someone else.
  if (/\b(?:he|she|they|he['’]s|she['’]s|they['’]re)\b[^.!?;\n]*\b(?:start(?:s|ed|ing|er)?|in (?:net|goal)|back[ -]?up|first[ -]+(?:goalie[ -]+)?off)\b/iu.test(outside)) {
    throw new Error("goalie_conflict_or_correction_unresolved");
  }
  if (conditional.test(context) || disavowed.test(context) || historicalOrInGame.test(context) || /\?/u.test(context)) {
    throw new Error("goalie_context_unresolved");
  }
  if (args.status !== "ruled_out" && (negative.test(context) || backup.test(context))) {
    throw new Error("goalie_context_unresolved");
  }
  // Predicate must begin after this exact subject with only listed auxiliaries.
  // A phrase elsewhere in the sentence can describe a teammate or quoted speaker.
  const tails = [args.source.slice(args.subject.end, sentence.end), args.evidence.text.slice(args.subject.end - args.evidence.start)];
  if (firstOff.test(context)) {
    if (args.status !== "projected" || !firstOff.test(args.evidence.text)) throw new Error("goalie_certainty_inflation");
    if (!tails.every(text => /^\s+(?:(?:is|was)\s+)?(?:the\s+)?first[ -]+(?:(?:goalie|goaltender)[ -]+)?off\b/iu.test(text))) {
      throw new Error("goalie_tentative_wording_unsupported");
    }
    return;
  }
  if (args.status === "likely" || args.status === "projected") {
    const qualifier = args.status === "likely" ? "(?:likely|probable|probably)" : "(?:expected|projected)";
    const prediction = new RegExp(`^\\s+(?:(?:(?:is|was)(?:\\s+the)?|will(?:\\s+be)?)\\s+)?${qualifier}\\s+(?:(?:to|as|will)\\s+)?(?:(?:be|is)\\s+)?(?:start(?:s|ing)?\\b|(?:the\\s+)?(?:starter|starting (?:goalie|goaltender)|in (?:net|goal))\\b|gets? the (?:start|nod)\\b)`, "iu");
    // Attendance, a bare name, or an unconditional starter report is not a
    // supplied likely/projected claim. Both exact evidence and governing context
    // must include the positive prediction, without negation/backup/conditions.
    if (!tails.every(text => prediction.test(text))
      || (args.status === "projected" && /\b(?:likely|probable|probably)\b/iu.test(context))) {
      throw new Error("goalie_tentative_wording_unsupported");
    }
  }
}

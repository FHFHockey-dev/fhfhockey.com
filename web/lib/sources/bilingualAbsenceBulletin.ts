// Compare the original clauses before interpreting a repeated player in a bilingual medical bulletin.
const name = String.raw`([\p{Lu}][\p{L}\p{M}.'’-]*(?: [\p{Lu}][\p{L}\p{M}.'’-]*){1,4})`;
const french = new RegExp(String.raw`^(L['’]attaquant|le défenseur) ` + name
  + String.raw` \((bas|haut) du corps\) sera à l['’]écart du jeu pour approximativement (\d{1,2}) à (\d{1,2}) semaines$`, "iu");
const english = new RegExp(String.raw`^(Forward|defen[sc]eman) ` + name
  + String.raw` \((lower|upper)[ -]body\) (will be out for (approximately (\d{1,2}) to (\d{1,2}) weeks))$`, "iu");
export const translatedAbsencePredicate = /^[ \t]+\((?:(?:bas|haut) du corps|(?:lower|upper)[ -]body)\)[ \t]+(?:sera à l['’]écart du jeu|will be out for)\b/iu;

export function bilingualAbsenceBulletin(text: string) {
  if (!/sera à l['’]écart du jeu/iu.test(text) || !/will be out/iu.test(text)) return null;
  const paragraphs = /^(?:RT @[\w]+:\s*)?([\s\S]+?)\.\s+((?:Forward|defen[sc]eman) [\s\S]+)\.\s*$/iu.exec(text);
  const reports: { start: number; end: number; predicate: { start: number; end: number; text: string };
    timeline: { purpose: "absence"; minimum: number; maximum: number; approximate: true;
      unit: "weeks"; targetDate: null; text: string }; tentative: false }[] = [];
  if (!paragraphs || !/^(?:L['’]attaquant|le défenseur) /iu.test(paragraphs[1]!)) return null;
  const en = paragraphs[2]!.split(/ and (?=(?:forward|defen[sc]eman) )/iu);
  const fr = paragraphs[1]!.split(/ et (?=(?:l['’]attaquant|le défenseur) )/iu);
  if (fr.length !== en.length) return { reports };
  let offset = text.indexOf(paragraphs[2]!, text.indexOf(paragraphs[1]!) + paragraphs[1]!.length);
  const frenchSubjects = new Set<string>(), englishSubjects = new Set<string>();
  for (const [i, clause] of en.entries()) {
    const f = french.exec(fr[i]!), e = english.exec(clause);
    const clauseStart = offset;
    offset += clause.length + " and ".length;
    // Extra prose can qualify the whole bulletin. A duration disagreement only affects its player.
    if (!f || !e || frenchSubjects.has(f[2]!) || englishSubjects.has(e[2]!)) return { reports: [] };
    frenchSubjects.add(f[2]!);
    englishSubjects.add(e[2]!);
    if (f[2] !== e[2] || /attaquant/iu.test(f[1]!) !== /^forward$/iu.test(e[1]!)
      || (f[3]!.toLowerCase() === "bas") !== (e[3]!.toLowerCase() === "lower")
      || Number(f[4]) !== Number(e[6]) || Number(f[5]) !== Number(e[7])
      || Number(e[6]) < 1 || Number(e[6]) > Number(e[7])) continue;
    const start = clauseStart + e[1]!.length + 1;
    const end = start + e[2]!.length;
    reports.push({ start, end, tentative: false,
      predicate: { start: clauseStart + clause.length - e[4]!.length, end: clauseStart + clause.length, text: e[4]! },
      timeline: { purpose: "absence", minimum: Number(e[6]), maximum: Number(e[7]), approximate: true,
        unit: "weeks", targetDate: null, text: e[5]! } });
  }
  return { reports };
}

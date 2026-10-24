import { extractStructuredPlayerGroupsFromText } from "/private/tmp/fhfh-c2-isolated/web/lib/sources/lineupSourceIngestion";
import { interpretTweetUnits } from "/private/tmp/fhfh-c2-isolated/web/lib/sources/tweetInterpretation";
const shapes = [
  "Stars lines:\nPerron-Blackwell skating on a fourth line-Hryckowian",
  "Perron / Blackwell skating on a fourth line / Hryckowian",
  "Perron, Blackwell skating on a fourth line, Hryckowian",
  "Fourth line: Perron - Blackwell skating on a fourth line - Hryckowian",
];
for (const text of shapes) {
  let units: unknown = null; try { units = (interpretTweetUnits as any)(text, []).units?.map((u: any) => u.players?.map((p: any) => p.name)); } catch (e: any) { units = "error:" + e.message; }
  console.log(JSON.stringify({ text, groups: extractStructuredPlayerGroupsFromText(text, []), interpretationUnitNames: units }));
}

// C2-PARSER-EVIDENCE-20261024-001: synthetic shapes only (the real tweet was not fetched).
import { extractStructuredPlayerGroupsFromText } from "/private/tmp/fhfh-c2-isolated/web/lib/sources/lineupSourceIngestion";
const shapes = [
  "Perron-Blackwell skating on a fourth line-Hryckowian",
  "Perron - Blackwell skating on a fourth line - Hryckowian",
  "Hryckowian-Perron-Blackwell skating on a fourth line",
  "Mavrik Bourque, Perron, Blackwell skating on a fourth line with Hryckowian",
  "Perron-Blackwell-Hryckowian skating on a fourth line",
];
for (const text of shapes) console.log(JSON.stringify({ text, groups: extractStructuredPlayerGroupsFromText(text, []) }));

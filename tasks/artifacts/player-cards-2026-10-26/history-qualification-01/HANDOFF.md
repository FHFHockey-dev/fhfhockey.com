# History/date/finality qualification01 — concrete findings

Frozen observed-pipeline sources were preserved throughout. Parent reports independent task5 review PASSED (16independentchecks,2changed+40unchangedpins); that is helper acceptance, not live-card acceptance. No runtime source or admission ledger changed here.

## Observed progress

1. All11captured NHL game-log rows match one official TBL season-schedule game each, including season/type/gameDate/team/opponent. GAME-DATE-MAP.json records exact source and UTC start dates. Three rows cross UTC midnight (game177:Oct24→25;167:Oct23→24;151:Oct20→21). All five older database game-date records also match the public history.
2. Located actual end-clock evidence in the official NHL Game Summary for game2026020167. Matching reportdate/teams/game/final status, publiclanding identity and timezone inspected. The report prints End9:58MDT at minute precision; the recorded evening-schedule inference yields the03:58UTCminute onOct24, after the original00:00cutoff. AM/PM/precision assumptions remain explicit and unadmitted. REPORT-QUALIFICATION.json and qualify-report.mjs preserve the actual checks. Do not manufacture00seconds or use ingestion completion as game end.
3. The date qualification reveals a concrete adapter seam: source date for NST lookup and UTC calendar date cannot remain one relabeled field. NEXT-CONTRACT-AND-READ.md specifies the narrow binding/precision change required before real admission. It is artifact-only while review of the previous slice completes.
4. METRIC-QUALIFICATION.json traces all12implemented formulas/fields to the actual local ingestion mapping. Current dash→0 coercion prevents proving stored zeros are measured; source definitions/model/zero semantics remain unadmitted. NST's public glossary fetch was denied by robots.txt; no raw-download workaround, authenticated NST request, credential use or third-party model substitution was attempted.

## Requests and evidence

Three bounded direct public NHL reads in this qualification slice, each once/no retry/redirect/fanout,5srequest/15sprocess/2MiBcap:
- Landing2026020167:HTTP200,16,962bytes; SHA559a1232740357bb42d9311afeffd47dd0482aa5d379f985c3781602558cdca0.
- OfficialGS020167report:HTTP200,40,457bytes; SHAe9523ce8f9177fa87958e8f8c51ca1d4679bbb5070a5c316584763e05abd87a8.
- TBL20262027schedule:HTTP200,177,781bytes,88games(128cap); SHA5667c3bc07e9088c024e007513898d24bb0ff380a702dcaf79116656baf3a695.

Web research additionally located a historical official report format, could not read the current landingJSON, and received the non-retryable NSTglossaryrobots block. PUBLIC-RESEARCH-LIMITATIONS.json distinguishes those web results from successful public JSON/HTML captures. No FHFH/privateDBreads, writes, provider-metric pages, population scan, app/server/Git/image action.

## Smallest next blocking input

A reviewed representation for minute-resolution official ends and source→UTC date bindings is now the narrowest integration dependency; an exact endedAt field cannot truthfully hold this report's precision. NEXT-CONTRACT-AND-READ.md makes it concrete. After that, the smallest proposed new source read is one officialGS020151report, with exact bounds in that document; it is unexecuted. NSTdefinition/zero-token evidence remains an external source limitation. No rank population or live value is activated from these public receipts. Thursday remains held until card acceptance.

# Existing export selected; source packet still unqualified

TJ's “Any” resolved the choice of local export. Selected **[October 1 exact-ID classification export](../../../../TASKS/lines-gdl-ingestion/audit/2026-10-01-classification-seeds.json)**: 11 seed event records, 11 snapshots and 24 candidate rows. Its recorded retrieval time is October 1, 2026 at 13:02:21 UTC. Its method explicitly describes provider copies rather than independently authenticated author originals. [SELECTION.json](SELECTION.json) pins the file and records only metadata, not report bodies or expected answers.

Two concrete rows illustrate the intended intake slots:

| Slot | Local candidate ID | Recorded provider category | Recorded provider source |
| --- | --- | --- | --- |
| Possible supported-start report | `2105476883966206037` | `goalie_start` | `gamedaygoalies` |
| Possible practice/abstention report | `2105476593967894778` | `practice_lines` | `gamedaylines` |

These are **unqualified metadata candidates**. The categories are existing parser output, not verified report meaning or human answers. The two provider streams do not establish two distinct original reporters or event families. No related revision was selected; the bound remains two primary reports plus at most one direct revision each, four retained records total. An actual review packet contains zero qualified records at this stage.

Both IDs already appear in `tweetClassificationLabels.json` and the 19-candidate classification evaluation in `tweetInterpretation.test.ts`. That label file explicitly records Chef-only review, no blind pre-tuning holdout, unauthenticated original-author publication time and a zero canonical-accuracy denominator. Rights clearance or new labels would not undo this development exposure. These rows can therefore only be considered for appropriately permitted **development review**, never the proposed unseen evaluation.

The larger existing `web/scripts/output/tweet-news-phrase-audit/tweet-corpus.json` was also checked at metadata level: 6,016 records, including 18 marked `reviewed`. It contains no explicit rights/reviewer-identity provenance fields establishing the required use and independent field labels. A reviewed category alone does not establish canonical identity, exact evidence, goalie certainty or Decisions answers. This current file is not assumed to be the historical 5,494-receipt snapshot. No additional source body was selected from it.

## What is missing, and why

- **Permitted-use evidence:** a person who knows the source's permission or applicable use basis must identify what allows retention and human annotation, and any restrictions. That is the rights custodian's role; TJ can fill it if he knows the basis. Possession of the export or a public post URL does not itself document it. This records an evidence gap, not a finding that use is prohibited.
- **Original lineage and dated context:** identify the original reporter, original/revision relationship, trustworthy publication clock, and complete supplied identity/game context. Relay account names and copied timestamps cannot establish those facts alone.
- **An actually separated family:** a custodian must locate a permitted, already-retained family outside development exposure and check related posts/corrections together. These two chosen rows fail that requirement conclusively. No unseen original reporter or family is claimed here.
- **Human expected answers:** a named person must label each supplied identity occurrence, goalie wording, allowed exact excerpts/UTF-16 offsets and eligible pre-bound Decisions question before seeing model predictions or assistant answers. TJ can be that reviewer; his export preference did not accept the role. Disputed fields need another human or remain unresolved. Existing agent labels and `reviewed` flags do not satisfy this requirement.

The local human-only route keeps reports and labels in an owner-controlled location, with this assistant receiving only metadata/hashes. If report text is opened in this assistant conversation, OpenAI processes that text here. A later Luna evaluation would separately transmit the report, attribution/clocks and supplied dated identity/statement context to the configured OpenAI API. Neither transmission is authorized by this selection artifact. No new collection, API call, production query or publication occurred.

## Concrete next decision

The export is selected; TJ does not need to choose another path. The remaining decision can be asked as:

> Can you confirm the permitted-use basis for human review of reports in this local export, or name the person who can, and will you label the expected answers before seeing Luna's output? The two identified rows are already development material. For an unseen pilot, that custodian would need to identify two cleared, previously unused original-report families in existing retained data. If none is available, a human can instead write two new fictional reports and seal their labels after the prompt/rubric freeze; we would describe that as human-authored synthetic feasibility, not real-report validation. This step authorizes no source collection or API submission.

No complete real-source packet was fabricated. The prior [qualification plan](../PLAN.md), labels, raw failed grades and ledger remain unchanged. Metadata selection is complete; body preparation is **pending the missing qualification evidence**, not denied and not attempted. There is no need to repeat a denied credential or computer action.

Verification is recorded in [VERIFICATION.json](VERIFICATION.json): source hashes, JSON, relative links, metadata-only contents, prior qualification pins and the unchanged disabled ledger. This documentation-only change needs no application test/build. Current cumulative history remains 17 calls and $0.269790750 exposure, including the historical uncertain reservation; no new paid request, credential access or production action.

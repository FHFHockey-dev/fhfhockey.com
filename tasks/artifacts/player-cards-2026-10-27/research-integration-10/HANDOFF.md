# Paused optional research-to-card crossover — isolated, not delivered

TJ asked “What BLSH cards? I am confused?” Scout acknowledged that integration was its inference and instructed immediatepause. No furtherresearchUI,tests,readsorimplementationwillrunwithoutanexplicitownerintegrationchoice. PlayerCardsreturns toapprovedrealdata,stat-suitesandstyling;BLSHresearch/score/flags/listsremainseparate.

## Safe isolation
All33proposedfilesandtheirhashes/patchpreservedunder candidate-source/ plus SOURCE-PINS-PROPOSED.json and candidate.patch. No permanentdeletion/Gitreset/deploy. FiveexistingCardintegrationhunkswerepreciselydetachedafterpreservingtheirproposedversions; exactpre-crossoverbaselinehashesmatch.28newfiles(including15fixtures+exactmanifest/types/helpers/components/newAPIroute)reversiblyrenamedoutoftheappsourcepathsintothisartifactcandidate-source,soNextcannotdiscoverthenewresearchAPIandtheexistingpagecannotreachresearchUI. Originalscientificinputs inDocumentsunchanged.

Exact existingpaths detached:
- web/lib/player-cards/currentNhl.ts
- web/components/player-cards/CurrentPlayerCardStudio.tsx
- web/lib/player-cards/currentNhlExport.ts
- web/components/player-cards/CurrentPlayerCardStudio.test.tsx
- web/pages/social-share/player-cards.tsx

Allother28exactproposedpaths+newlocations in PAUSE-ISOLATION.json. All33candidatehashesmatch afterisolation; all13checkpoint09sourcepinsmatch. Existing69351staticcheckpoint09previewunchanged; research10HTMLwasgeneratedlocallybutNEVERserved. No currentKucherovresearchfieldwasattached. No existingfields lost. No newtestsorreadswererunafterpause.

## Receipts retained, not acceptance
- Sourcefixturemanifestbeeb34c351e31b91598ca771518bf93030cc7d6079ba5a5b1eab9925c14d8f0a;15exact494014-bytefixtures/copiedtypes preserved, originalDocumentsinputsuntouched.
-37uniqueVitestcases passed acrossboundedruns:18pinnedbinding/chronology,2fileloader/API,3consumer/export,4currentNHL,10checkpoint09Studio. Initialtest-harnesspatherrorspreserved(initial-tests.log andfixture-path-fixed-tests.log); correctedtestpathandfile-readerannotationonly. No detector/scorer/model/source-recalculation.
- ScopedTypeScriptand17filelintPASS. Originaltypecheckerrorpreservedinitial-types.log.
- CandidateHTMLrendered. FirstofflinebrowserrunFAILEDassertionat browser-check.mjs:11:601 (browser.log), beforefinalevidence/exports; unresolvedatpause. No claimofbrowser/PNG/visualacceptance. Noattemptedfixornewtestafterpause.
- No live/current/reserveddatareads, DB/auth/profilechanges,newdependencies,Git/deployorpermanentdeletion. Ownheavyslotreleased perqualify-command.json.

## Next
Keepthiscandidatepaused. Do notcopyback/restarttests/exposeBLSHcards withoutTJexplicitintegrationchoice. Preserve09customizerandretainedNHLresults. Continueonlytheowner-approvedPlayerCardsreal-data/stat-suite/stylinglaneinaseparatelyboundednextslice;BLSHremainsitsownlane.

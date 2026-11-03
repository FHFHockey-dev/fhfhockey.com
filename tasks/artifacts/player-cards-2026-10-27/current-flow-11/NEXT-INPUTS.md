# Next bounded inputs — no reads executed

## Name selection can reuse an existing offline identity catalog

Already-approved 2026-10-24 roster/landing manifest: `/Users/tim/Documents/FHFH-local-image-tests/2026-10-25-birefnet-roster805/manifest.json`, SHA256 4cac57ecdbee629bd82b017a624ecbbe342aa9b43b450588b84dad506c2ad43c,805uniqueIDs withname/position/roster_team/datedlandingrecord. This slice read only manifestmetadata, not images or a fresh database/feed. Proposed next consumer: searchable datedcatalog labels+stableID, manualID/FHFHplayerURLfallback forplayersoutsidecatalog, currentteamverifiedbyexistinglandingprovideronexplicitLoad. No all-NHLcoverageclaim/rankpoolinferredfrom805. Image-sourceexceptions mustnotremoveidentityresults. This can advance name search without a newDBread; no catalogcopiedintoappin11.

Existing search references are readonly: `web/components/StatsPage/PlayerSearchBar.tsx` (directplayers-tablequery/select10) and `web/lib/NHL/server/index.ts:getAllPlayers` (`rosters`,players(*),currentmembership). The latter is not a metric population and is broader than the needed identity fields. No suchDBqueryranhere.

## Advanced stat suites: smallest local snapshot contract

CurrentNHLbasic3responses do NOT contain individualNSTchance/xG,on-iceIPP/SH or deploymentPP/PK denominators. Consumer remains `web/lib/player-cards/nstCapture.ts`, metric mappings in registry.ts/aggregation.ts; these are expected schemas, not proof that current rows exist or are correct.

A next bounded SOURCE-OWNER handoff/read proposal (NOT executed/approved by this note): player8476453/season20262027/AllStrengths, onlythe11alreadycapturedappearances; provide1individualbatch and1onicebatch, maximum32rowseach/64total includingdup-detection,128KiBtotal,concurrency1,atmost2read-onlyrequests,5seach/10stotal,noredirect/retry/sourcewrites. Nootherplayers/privateaccounts,repair/refresh/model/providerfanout. Prefer supplyinganexistinglocalcapture ifavailable, so nonewproductionread is needed.

Expected individual `nst_gamelog_as_counts`: player/queryidentityreceipt,season,date_scraped,gp,toi,shots,icf,iscfs,ixg,total_points,goals. Expected on-ice `nst_gamelog_as_counts_oi`: sameidentity/date/sample fields,toi,cf,scf,xgf,xga,gf,sf. Explicitseconds/providermodel/strengthversion/capturedAt/rawnull-dash-zero semantics andofficialgame-ID↔providerlookupdate binding required. Do NOTassume providerlookupdate equals UTCdate; theapprovedNHLcapture keepsbothseparate. Verifyactualtable/identitycolumns underowner'scurrentcontract beforeanyread; this isnot ready-to-runSQLorblanketDBauthority.

No minGP/TOI/positionthreshold. A one-playerhandback cannotqualifyall-NHLrank/N/percentiles. Exactgame-end/historicalcutoffadmission andmilestone/careerbaselines are separate evidence; thislocalbasiccurrent-observationflowdoesnotclaimthem. Sustainability/isolatedimpactformulas,goalie workloadandotherunsupportedformats remainuninvented. BLSH/research10remainsparked.

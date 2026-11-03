# Smallest safe action to unblock RSO identity discovery

**Smallest immediate action: copy the seven Production configuration values below from the existing Vercel dashboard, with `unset` for an absent key.** No database export is needed. The Vercel 403 will not be retried or bypassed. Claude's actual PROV-GUARD owner, session `1e668672`, has now returned the exact candidate commit and admission allocation, but explicitly did not read or establish the issued model identity; session `799e2b6c` was the Social Share owner.

For the separate issuance document, this short message can be sent in the existing legacy FORGE owner conversation:

> Please give the RSO Codex lane an **existing, non-secret legacy FORGE production configuration and issuance receipt**, or identify its current owner. Use `tasks/artifacts/rso-resume-2026-11-01/release-prep/qualification-capture/TJ-HANDOFF.md` for the exact fields. Do not run FORGE, change flags, deploy, query outcomes or create a new receipt through production execution. If no released captured-live issuance exists, say so explicitly. FORGE v2 ownership alone is not enough.

## What the existing owner should provide

**Current configuration:** target project/environment, observed time, deployment SHA if recorded, and these seven exact string values or the explicit word `unset`:

```
STARTER_BOARD_CAPTURE_ENABLED
STARTER_BOARD_COMPUTE_ENABLED
STARTER_BOARD_SERVING_ENABLED
STARTER_BOARD_SCHEDULER_ENABLED
STARTER_BOARD_CANARY_GAME_IDS
START_CHART_GAME_REVISIONS
FORGE_CODE_VERSION
```

If TJ already has dashboard access, these can be viewed at **Vercel → fhfhockeydevs-projects → fhfhockey → Settings → Environment Variables**, filtering each key to **Production**. Navigation link: https://vercel.com/fhfhockeydevs-projects/fhfhockey/settings/environment-variables . Read only these keys; do not edit/save/redeploy or export all variables. Project settings describe configuration now; they do **not** prove which values an older deployment or issued forecast used. Mark the receipt `project settings observed now` unless it is explicitly deployment-specific. This screen cannot supply the issued model identity by itself.

**Existing issuance document:** supply the local path or saved metadata JSON for the first released `captured_live`, horizon-1 legacy game revision after October 30, with:

- revision/run/game IDs and slate date; cutoff, issue and scheduled-start times;
- method/modelMode and exact codeVersion;
- modelIdentity (version, artifact, configurationHash, artifactHash);
- the original stored eight-key modelEnvironment;
- matching snapshot identity and run status/SHA/producer proof; receipt observation time and byte hash if already present.

The field-by-field schema is the SELECT output in `discovery-20261101/identity-query.sql`. **Provide an existing saved result; do not execute that SQL or broaden its dates as part of this handoff.** That November 1 query was already run once and returned zero rows. An owner statement that no suitable saved receipt or issuance exists is useful and preferable to substituting current settings.

The stored modelEnvironment keys are `FORGE_SKATER_MODEL_MODE`, `NHL_XG_TEAM_AGGREGATE_MODEL_VERSION`, `NHL_XG_TEAM_AGGREGATE_FEATURE_VERSION`, `NHL_XG_TEAM_AGGREGATE_WINDOW_GAMES`, `NHL_XG_MODEL_VERSION`, `START_CHART_GAME_REVISIONS`, `STARTER_BOARD_COMPUTE_ENABLED`, and `STARTER_BOARD_SEASON_BOOTSTRAP_ENABLED`. Preserve string/null exactly. Codex will validate the hashes and provenance offline; TJ need not calculate them.

**Exclude** API keys, tokens, passwords, connection strings, cookies, auth headers, full `.env` exports, player forecast/outcome payloads, and private Yahoo league/account data. Copy only the allowlisted fields, or send the existing sanitized receipt's path. Do not send an unfiltered environment screenshot.

## Why this is needed

Configuration establishes whether capture/compute/serving and a canary are configured. The immutable issuance receipt establishes which model actually produced a forecast. #403 being deployed and the November 1 zero-row result establish neither. Codex can validate supplied receipts offline, identify the proper first slate and present a genuinely bounded pilot decision. No feature activation, qualification approval or new production access is requested by this handoff.

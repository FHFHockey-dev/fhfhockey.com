# Adjacent Yahoo backlog

These items are outside live-draft P0. Global public ingestion credentials and per-user OAuth must remain separate. Cadences are proposals pending Yahoo/provider validation.

| Item | Official Yahoo resource | Auth | Proposed cadence | User value | Complexity / retention / validation |
| --- | --- | --- | --- | --- | --- |
| Automatic scoring and roster configuration | League settings and roster positions | Per-user league OAuth | On connection and explicit refresh | Removes setup work | Medium; retain normalized settings and provenance; validate unsupported categories. |
| Postdraft roster reconciliation | Team roster | Per-user league OAuth | Once after confirmed completion, then bounded retry | Confirms drafted roster | Medium; owner-scoped current state; provider rehearsal required. |
| Transaction/add-drop sync | League transactions | Per-user league OAuth | 5–15 minutes in season | Keeps roster context current | High; bounded event retention and pagination proof required. |
| Availability and personalized recommendations | League players/ownership plus team roster | Per-user league OAuth | User-triggered or 15–60 minutes | League-aware recommendations | High/private; no cross-user cache without proven authorization. |
| Keeper detection | League settings/draft results | Per-user league OAuth | Connection and predraft checkpoints | Avoids incorrect draft-slot assumptions | High; separate keeper rehearsal required. |
| Matchup and standings context | League scoreboard/standings | Per-user league OAuth | Daily and explicit refresh | Weekly decision support | Medium; retain normalized snapshots, not raw private payloads. |
| Ongoing roster sync | Team roster | Per-user league OAuth | 15–60 minutes and explicit refresh | Accurate team state | Medium; owner-scoped current state and failure UX. |
| Historical draft analysis | Draft results | Per-user league OAuth | Postdraft/user-triggered | Draft review and trends | Medium; explicit history retention/consent policy required. |
| Public ADP and ownership ingestion | Game/player resources | Separate global ingestion credential | Existing scheduled lifecycle | Market context | Existing high-impact pipeline; never merge with per-user live-draft tokens. |

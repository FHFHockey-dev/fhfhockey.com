Goal: Implement the FHFH Account-Backed Personal NHL Draft Ranker

Use `tasks/TASKS/draft-ranker/product-strategy.md` as the authoritative product-strategy reference.

The goal is to design and incrementally implement an account-backed personal NHL draft-ranking system for FHFH Hockey Analytics. A user’s visible ranking contains 250 players, but the eligible player universe must include verified real players beyond the prior season’s Yahoo top 250.

Core requirements

* Seed each new user’s initial 1–250 ranking from the prior season’s verified Yahoo preseason ADP.
* Treat Yahoo ADP only as an initial seed, never as the complete eligible-player universe.
* Use the existing FHFH canonical player records and extend the identity model where necessary.
* Support active NHL players, goalies, rookies, prospects, current Yahoo players, projection-source players, organizational roster players, and verified currently unranked players.
* Never create a player identity from arbitrary free text.
* Provide autocomplete-backed real-player search and a player-addition request workflow.
* Maintain a personal top 250, ordered candidate bench, watchlist, pairwise evidence, direct-edit evidence, and ranking-event history.
* Preserve all evidence when players move into or out of the top 250.
* Insert newly added players through an assisted pairwise placement process.
* When an outside player enters the top 250, move the previous No. 250 to No. 251.
* When a player is removed, promote the highest-ranked eligible candidate outside the cutoff.
* Persist all ranking state across sessions and devices.
* Support direct editing and CSV, XLSX, and JSON exports.
* Collect eligible explicit pairwise decisions anonymously for a separate FHFH Community Ranking.
* Allow previously undrafted players to enter the community top 250 without assigning them artificial Yahoo ADP.

Required working process

1. Audit before implementation

Inspect the repository and document:

* Existing player and Yahoo identity tables
* Current Supabase schemas and migration conventions
* Authentication and user-account architecture
* Projection-source tables and mapping logic
* Homepage components
* Existing draft or ranking features
* API conventions
* Export utilities
* Testing infrastructure

Create an audit document describing what can be reused, what must be extended, and any conflicts with the proposed strategy.

2. Produce an implementation plan

Create a phased PRD and task list covering:

1. Canonical identity extensions
2. Personal ranking persistence
3. Candidate bench and watchlist
4. Initial Yahoo ADP seeding
5. Full ranking page
6. Real-player autocomplete
7. Assisted insertion
8. Homepage pairwise comparisons
9. Adaptive matchup selection
10. Explainable candidate discovery
11. Community ranking v1
12. Confidence and sample-size presentation
13. Export support
14. Abuse, privacy, and identity-quality controls
15. Tests, migrations, observability, and rollout

Each task must contain:

* Dependencies
* Files or systems likely affected
* Acceptance criteria
* Test requirements
* Migration or rollback considerations
* Status

3. Implement incrementally

Finish incomplete prerequisite work first. Then implement not-started work in dependency order.

Do not attempt to build the mature community-ranking model before the personal ranking, identity, comparison, and evidence-collection foundations exist.

4. Preserve a persistent goal record

Maintain a repository document that records:

* The overall goal
* Current phase
* Completed work
* In-progress work
* Blockers
* Approved decisions
* Deferred work
* Next executable task

Update it whenever work pauses or approval is required so the broader goal is not lost.

Required approval checkpoints

Stop and request approval before:

* Destructive or difficult-to-reverse database migrations
* Replacing the existing canonical player identity model
* Introducing a major new state-management architecture
* Changing authentication or account ownership models
* Replacing existing homepage architecture at large scale
* Selecting a community-ranking algorithm that materially changes public ranking behavior
* Adding paid or license-restricted identity sources
* Making conflicting changes to existing projections or Yahoo ingestion systems

Continue autonomously through ordinary additive implementation work.

Product invariants

* Top 250 is a display cutoff, not an eligibility boundary.
* Every ranked entity must map to one canonical real-player identity.
* Yahoo IDs are external mappings, not permanent canonical IDs.
* Players without Yahoo IDs may still be valid prospects and rankable FHFH identities.
* Team changes must not create new player identities.
* Duplicate names must be disambiguated using stable identity evidence.
* Previously undrafted players display “Previously undrafted.”
* Seed ordering must weaken as explicit user evidence accumulates.
* Direct edits control personal ordering but must not create hundreds of synthetic community pairwise wins.
* Automatic displacement is not a community vote.
* Community rank and community confidence are separate outputs.
* Identity ambiguity must enter a review workflow rather than being silently resolved.

Initial delivery target

The first production-capable milestone should include:

* Account-backed personal ranking
* Initial verified Yahoo ADP seed
* Visible top 250
* Ordered candidate bench
* Direct editing
* Persistent ranking events
* Real-player autocomplete
* Assisted insertion
* Correct cutoff displacement
* Basic homepage pairwise flow
* CSV and JSON export
* Foundational tests and migration safety

Treat the strategy document as the product source of truth and this goal as the execution contract.
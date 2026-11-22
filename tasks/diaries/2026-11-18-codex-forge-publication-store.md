# FORGE pregame publication storage

- Scope: prospective single-game custody-to-publication SQL and disposable PostgreSQL checks. `octoberBranch` at `57a90dfa7`.
- Existing `publish_forge_game_revisions` accepts the normal H1 source observation and builds Starter Board revisions. RSO reads the same run/projection tables and uses captured proof/time. No hosted access is required.
- Completed `20261118135813_forge_pregame_publication.sql`. The claim UUID is the run UUID. The standard H1 output includes reserves, publication is atomic, and a later committed receipt stamps RSO visibility. The compact snapshot declares its database digest encoding and leaves the original reads in private custody.
- Added a shared receipt gate for the existing detailed revision reader and freeze selector. An unconfirmed latest revision leaves the prior eligible default available. An explicit pin retains precedence and fails closed when its target is unconfirmed. Prior comparisons use the same eligibility, and admitted revisions report their committed observation time.
- `LC_ALL=C /usr/local/bin/python3 -I supabase/tests/forge_pregame_publication.py` passed 52 checks with disposable PostgreSQL 15, including the production projection DDL, selected revision and previous-revision output, freeze behavior and RLS. The fixture also supplies the consumer test schema with Python stdlib only. Whitespace checks passed.
- Handed to Chef for integration. The hosted rollout and candidate approval remain outside this local task. No hosted or network work occurred.

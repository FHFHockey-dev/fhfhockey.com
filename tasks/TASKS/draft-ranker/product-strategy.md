FHFH Personal Draft Ranker: Product and Ranking-System Blueprint

Executive recommendation

Build this as two connected but distinct systems:

1. A canonical hockey-player universe that answers:
    “Which real players may legitimately be ranked?”
2. A user-specific ranking graph that answers:
    “In what order does this user prefer those players?”

Yahoo ADP should initialize the first visible list, but it must have no authority over player eligibility and only diminishing authority over later ranking order.

The key product principle is:

Top 250 is a display boundary, not a player-universe boundary.

Internally, every user should have:

* A ranked top 250
* An ordered candidate bench outside the cutoff
* Pairwise comparison evidence
* Direct-edit evidence
* Watchlisted players
* Discovery candidates
* Historical positions for players previously inside or outside the top 250

The community system should likewise rank an open candidate universe rather than repeatedly sorting last year’s drafted population.

⸻

1. Canonical eligible-player universe

Recommended definition

A player is eligible for the FHFH candidate universe when all three conditions are satisfied:

A. Identity validity

The player has a canonical FHFH player identity connected to at least one trustworthy hockey source.

B. Current or plausible NHL relevance

At least one of the following is true:

* Currently on an NHL contract or organizational roster
* Appears on an NHL reserve, injured, or non-roster list
* Drafted or signed by an NHL organization and still considered an active prospect
* Appears in current Yahoo NHL player data
* Appears in a recognized current-season projection source
* Played in an NHL, AHL, major-junior, NCAA, European professional, or international development context recently enough to remain a legitimate NHL prospect
* Has been manually verified by FHFH editorial review as a fantasy-relevant free agent, unsigned player, or prospect

C. Not permanently excluded

The player is not confidently classified as:

* Retired
* Deceased
* Permanently suspended or otherwise ineligible
* Outside professional hockey with no realistic NHL pathway
* A duplicate or invalid identity
* A historical player accidentally returned by an upstream source

Universe tiers

Do not treat every eligible player identically. Assign a transparent eligibility tier.

Tier	Description	Typical examples
Rostered NHL	Current NHL organizational player with clear identity	Active NHL skaters and goalies
NHL-adjacent	Injured, reserve, unsigned, waiver, or two-way player	IR players, RFAs, depth call-ups
Recognized prospect	Real prospect tied to an NHL organization	Drafted NCAA, CHL, AHL, European prospects
Projection-qualified	Appears in a current credible projection set	Rookie expected to make the NHL
Fantasy-platform-qualified	Appears in current Yahoo player data	Newly added rookies or depth players
Editorially verified	Manually approved but not yet present in major feeds	Camp invitee with legitimate opportunity
Archived	Real identity, no longer actively rankable by default	Retired or departed players

Only the first six tiers are searchable for addition. Archived identities remain available for history, data integrity, and comparison audit trails.

Practical size

The searchable universe should probably contain roughly 1,000–2,000 active and plausible identities, not every hockey player in the world.

That is large enough to include:

* NHL rosters
* AHL depth
* Legitimate drafted prospects
* Current projection subjects
* Fantasy-platform players
* Camp and preseason risers

It is small enough to avoid autocomplete becoming a global hockey-directory problem.

⸻

2. Identity sources and authority

Yahoo should be an external identity mapping, not the canonical identity owner. Yahoo’s fantasy APIs support hockey game, league, team, and player information, but Yahoo player keys are platform- and game-context identifiers rather than ideal permanent identities.  

The NHL should be the strongest source for players who possess NHL identities because NHL.com is the official source for league rosters, player statistics, teams, and related league information.  

Recommended identity authority order

1. FHFH internal player ID

Every real player receives an immutable internal identifier:

fhfh_player_id

This is the only identity that ranking, comparison, and community tables should reference directly.

2. NHL player ID

Use as the primary external identifier when one exists.

Strengths:

* Stable across teams
* Strong for active and historical NHL players
* Connects NHL statistics, headshots, roster history, and game data
* Avoids name-based joins

Limitations:

* Some prospects may not yet have one
* Newly drafted or obscure players may appear inconsistently across endpoints
* It does not solve every pre-NHL identity problem

3. Prospect identity source

For players without NHL IDs, maintain one or more verified source mappings.

Potential mappings include:

* NHL draft identity
* Elite Prospects ID
* HockeyDB ID
* College Hockey or NCAA identifier
* CHL league identifier
* AHL identifier
* IIHF identifier
* Official team or league roster identifier

Third-party licensing and terms must be reviewed before storing or displaying data from commercial sources. The architectural point is that FHFH needs a prospect identity bridge, not that any single commercial provider must become the universal authority.

4. Yahoo player key

Store all relevant Yahoo identities separately:

* Yahoo player key
* Yahoo game ID or game prefix
* Yahoo season
* Yahoo team abbreviation
* Yahoo display position

Never assume a Yahoo player key is permanent across fantasy game seasons.

5. Projection-source mappings

Each projection source gets its own mapping table:

* Source player identifier
* Source name
* FHFH player ID
* Match method
* Match confidence
* Reviewer status

Identity record

A canonical identity should contain:

* Immutable FHFH player ID
* Full legal or commonly published name
* Display name
* Birth date
* Primary position
* Alternate positions
* Shoots or catches
* Current NHL organization
* Current playing club
* League
* Country
* NHL ID, when available
* External source mappings
* Headshot references
* Identity status
* Career status
* Prospect status
* Last verified date

Identity matching policy

Use deterministic evidence wherever possible:

1. External ID
2. Name plus birth date
3. Name plus organization and position
4. Name plus draft year, round, and organization
5. Manual review

Do not automatically merge records based only on normalized name.

⸻

3. Prospects without Yahoo IDs or NHL game history

A prospect is still a real player even when Yahoo has not created a fantasy identity.

Representation

Create the FHFH identity as soon as the system can establish:

* A credible real-world source
* A distinguishable identity
* A plausible NHL connection

The prospect can have:

* nhl_player_id = null
* yahoo_player_key = null
* Zero NHL game history
* Current organization and development league
* Prospect designation
* Draft details or signing details
* Source-verification metadata

User-facing treatment

Autocomplete should show something like:

Ivan Example
C · Detroit organization · Grand Rapids/AHL
2025 second-round selection · No Yahoo player ID yet

This makes the identity legitimate without pretending the player is already available in every fantasy platform.

Fantasy availability is a separate field

Do not conflate:

* Rankable in FHFH
* Available in Yahoo
* Expected to play in the NHL
* Currently rostered in the NHL

A prospect can be rankable while still showing:

Yahoo availability: Not currently listed

That is useful in keeper, dynasty, deep redraft, and preseason contexts.

⸻

4. User ranking model

The cleanest conceptual model is not one numbered array. It is an ordered personal player universe with a visible cutoff.

Each user has

Personal ordering

A relative ordering of every player for whom the user has meaningful evidence.

Top-250 membership

The first 250 eligible players in that ordering.

Candidate bench

Ordered players below 250.

Watchlist

Players the user wants to monitor without forcing immediate ranking placement.

Comparison evidence

Every explicit A-over-B decision.

Direct-edit evidence

Every drag, rank-number edit, insert, removal, or bulk adjustment.

Discovery state

Which candidates were shown, dismissed, added, snoozed, or watched.

This structure preserves evidence when a player moves across the cutoff.

⸻

5. Assisted placement for an added player

When a user selects a real unranked player, do not simply append them at 251 and do not ask the user to select an exact rank immediately.

Use a coarse-to-fine assisted insertion process.

Stage 1: Establish intent

Ask:

Where do you roughly expect this player to belong?

Choices:

* Top 50
* 51–100
* 101–150
* 151–200
* 201–250
* Outside my top 250
* Not sure—help me place them

This is optional positioning evidence, not a final rank.

Stage 2: Anchor comparisons

Compare the player with strategically chosen anchors:

* One near the middle of the likely interval
* One above
* One below
* At least one comparable player by position or role
* At least one player near the 250 cutoff when relevant

Example:

1. Added player versus rank 125
2. Winner determines upper or lower interval
3. Added player versus rank 188
4. Added player versus rank 156
5. Continue until sufficiently localized

Stage 3: Local refinement

Once the player is within a narrow range, compare against adjacent or near-adjacent players.

Example:

* Rank 163
* Rank 169
* Rank 166
* Rank 165

Stage 4: Confirm placement

Show:

Based on your answers, we would place him at No. 166.

Then show:

* Players immediately above and below
* The comparison path
* Estimated placement range
* Confidence language
* Confirm, compare more, or choose a nearby rank

Special cutoff treatment

When the estimated position is close to 250, force at least one comparison against:

* Current No. 245–250
* Highest outside candidate
* Any directly comparable player around the boundary

The cutoff is important enough to require stronger evidence than an ordinary middle-list placement.

⸻

6. Number of comparisons required

There should not be one universal number.

Mathematical baseline

Binary insertion into a perfectly ordered set of 250 requires at most approximately eight comparisons because:

2^8 = 256

But real user preferences are not perfectly transitive, matchups are noisy, and position-specific context matters.

Recommended targets

Placement case	Normal comparison count
User supplies a rough range	4–7
User has no placement intuition	7–10
Player lands clearly outside top 250	4–6
Player crosses the top-250 boundary	7–10
Contradictory answers appear	Add 2–4 validation matchups
High-confidence existing personal model	4–6
Very sparse new-user evidence	8–12

Do not advertise the mathematical result as “accurate after eight questions.” Say:

Usually placeable after about 5–10 comparisons.

Stop rule

Stop when all of these are true:

* The plausible interval is sufficiently narrow
* At least two comparisons support the local neighborhood
* No serious contradiction remains
* Boundary validation has occurred when applicable

A reasonable final interval is:

* Within 3–5 ranks for the top 100
* Within 5–8 ranks for ranks 101–200
* Within 8–12 ranks near the back of the list

The system may insert at one number, but it should retain the broader uncertainty interval internally.

⸻

7. Top-250 cutoff and displacement

The cutoff should behave deterministically.

Adding a player inside the top 250

If an outside player is inserted at No. 166:

* Existing No. 166 becomes 167
* Every player through No. 250 moves down one
* Former No. 250 becomes the first player outside the cutoff
* No comparison or rank history is deleted

Removing a player

“Remove from top 250” should mean:

* Move the player to the candidate bench
* Preserve all personal evidence
* Promote the current No. 251 to No. 250

Do not delete the player from the user’s ranking system unless the user explicitly chooses a separate “forget this player” action.

Ineligible player

When a player retires, leaves North America, or becomes fantasy-irrelevant:

* Do not silently delete them
* Flag them
* Let the user retain or remove them
* Exclude them from default active draft exports when appropriate
* Suggest the highest candidate below the cutoff as a replacement

During preseason, unsigned NHL-caliber players should generally remain rankable.

⸻

8. Candidate bench and watchlist

Yes, users should have both.

They serve different purposes.

Candidate bench

An ordered extension of the ranking:

* No. 251 onward
* Contains displaced players
* Contains players the user has partially placed
* Can automatically supply replacements
* Supports community and personal delta calculations

Watchlist

An unordered or lightly prioritized monitoring set:

* Prospects
* Injury recoveries
* Camp battles
* Potential PP1 promotions
* Backup goalies competing for starts
* Players the user is curious about but not ready to rank

Actions from discovery should be:

* Compare now
* Add to watchlist
* Dismiss
* Not relevant to my league

The last action becomes important when league settings are introduced.

⸻

9. Player discovery without browsing thousands of names

Discovery should be a curated queue, not a directory.

Discovery groups

Each group should have a data-backed reason and an expiration window.

Projection risers

Surface players whose composite projected fantasy value materially exceeds:

* Prior ADP
* Current personal rank
* Current community rank
* Their previous projection snapshot

Role changes

Examples:

* Projected top-six promotion
* PP1 deployment
* Increased even-strength ice time
* Starting-goalie opportunity
* Injury-created vacancy
* New team or coach

These should carry source and freshness labels.

Breakout performers

Use multiple indicators, not raw points alone:

* Increased ice time
* Shot-attempt or scoring-chance growth
* Individual expected-goal growth
* Power-play opportunity
* Production relative to prior baseline
* Age and career-stage context

Rookie and prospect arrivals

Require a meaningful current signal:

* NHL roster placement
* Strong probability of making the team
* Contract signing
* Call-up
* Major projection inclusion
* Sustained preseason usage

Goalie opportunity changes

This deserves a dedicated model because goalie value changes abruptly.

Signals:

* Starter departure
* Injury
* Contract or waiver transaction
* Recent start share
* Back-to-back usage
* Coach declaration
* Projection workload increase

Market movement

* Yahoo ADP risers
* Ownership risers
* Frequently added to other users’ top 250
* Community-rank momentum

Explanation card

Every surfaced player should answer:

Why am I seeing this?

Example:

Outside your top 250
Projected for 68 points after moving to PP1. Added to 21% of active FHFH lists this week. Community rank moved from 312 to 226.

Avoid vague labels such as “Trending” without supporting evidence.

Personal relevance

Rank discovery candidates by:

* Likelihood of making the user’s top 250
* User’s scoring settings
* Position scarcity
* Current ranking weaknesses
* User’s prior comparison behavior
* Freshness and strength of evidence
* User dismissals and watchlist history

⸻

10. Preventing long-term Yahoo seed bias

Yahoo ADP is a sensible onboarding prior but a dangerous permanent prior.

The rule

Yahoo ADP should influence:

* Initial ordering
* Early matchup selection
* Cold-start discovery

It should not indefinitely influence:

* Personal rank after explicit user evidence
* Community rank after sufficient community evidence
* Player eligibility
* Confidence
* Whether a player can enter the top 250

Seed-decay policy

Personal ranking

Once the user has compared or directly positioned a player, explicit user evidence takes precedence over Yahoo seed position.

A useful hierarchy is:

1. Direct user placement
2. Explicit pairwise results
3. Derived transitive ordering
4. User-specific model inference
5. Yahoo seed only where the user has expressed no preference

Community ranking

Treat Yahoo ADP as an initialization aid only.

As community evidence accumulates, its weight should rapidly decline:

* High seed influence at zero observations
* Modest influence after 10–20 independent users
* Minimal influence after 50–100 users
* No meaningful influence after the player is well connected to the community comparison graph

For previously undrafted players, use no fabricated ADP. Their initial public estimate can derive from:

* Projection-based discovery bracket
* Early comparison outcomes
* Neutral broad uncertainty
* Editorial candidate tier

The public label remains:

Previously undrafted

Anti-anchoring UX

Do not always display Yahoo ADP during pairwise questions.

Showing it in every matchup would encourage users to reproduce the seed.

Recommended behavior:

* Default matchup card: identity and current fantasy context
* Optional expandable evidence: Yahoo ADP, projections, role, recent stats
* “Blind ranking mode”: hides community and ADP values
* Community contribution should favor blind decisions

⸻

11. How outside players enter the adaptive matchup queue

A player should become queue-eligible through several routes.

Automatic candidate triggers

* Large projection increase
* New current-season projection appearance
* NHL call-up
* Roster promotion
* Top-six or PP1 role change
* Starting-goalie opportunity
* Transaction to a favorable situation
* Significant ownership or ADP movement
* Strong recent performance supported by usage
* High watchlist growth
* Frequent addition by users
* Strong community comparison performance
* Editorial sleeper designation

Queue admission score

Create a conceptual candidate urgency score combining:

* Fantasy impact potential
* Evidence quality
* Evidence freshness
* Uncertainty
* Personal relevance
* Community momentum
* Lack of user evidence

High urgency does not mean high rank. It means:

This player is worth asking the user about.

Matchup mix

Do not let discovery overwhelm ordinary rank refinement.

A healthy homepage queue might be:

* 50% unresolved or high-information personal ranking matchups
* 25% outside-candidate discovery matchups
* 15% contradiction or stale-evidence validation
* 10% community-interest or editorial discovery

Users should be able to choose modes:

* Improve my ranking
* Find sleepers
* Place rookies
* Review goalies
* Resolve close calls
* Quick five

⸻

12. Community ranking model

Strong recommendation: use a comparison graph, not vote totals

Each accepted pairwise result creates a directed preference:

Player A > Player B

The community model should estimate latent rank strength from this graph.

Suitable conceptual model families include:

* Bradley–Terry
* Elo-like ratings with uncertainty
* TrueSkill-style estimates
* Bayesian pairwise-ranking models
* Plackett–Luce extensions for ordered list evidence

For this product, a Bradley–Terry-style model with user weighting, time decay, and uncertainty is the strongest understandable starting point.

Why not raw wins?

Raw win percentage fails because:

* Players face opponents of different quality
* New candidates may face only cutoff players
* Popular players receive more comparisons
* Coordinated users can target specific matchups
* A 10–0 record against players ranked 400–500 does not establish a top-100 player

The model must account for opponent strength and graph connectivity.

Separate population rank from confidence

A player can have:

* Estimated community rank: 187
* Plausible interval: 145–264
* Low confidence
* 23 independent users
* 39 accepted comparisons

That is more honest than presenting “187” as settled truth.

⸻

13. Public top-250 admission threshold

Do not use a single comparison-count threshold.

An outside player should enter the public top 250 only when all of these conditions are satisfied.

Minimum evidence

At launch, a reasonable standard is:

* At least 20–30 independent eligible users
* At least 40–60 accepted comparisons
* Comparisons against at least 10–15 distinct opponents
* Meaningful graph connections both inside and outside the current top 250
* At least several comparisons near the cutoff
* No single user responsible for excessive evidence
* Estimated rank materially inside the top 250 after uncertainty adjustment

Conservative cutoff criterion

For admission, use a lower confidence bound or similar conservative estimate.

Example:

* Estimated rank: 228
* Plausible interval: 198–278

This player should not yet displace a public top-250 player.

Another:

* Estimated rank: 219
* Plausible interval: 202–239

This player has credible evidence for inclusion.

Emerging-candidate state

Before full inclusion, show:

Community top-250 candidate
Estimated No. 228 · Limited evidence

This allows discovery without overstating confidence.

Mature scale

At larger usage levels, thresholds should become percentile- and quality-based rather than fixed counts. A star player may accumulate thousands of votes while a legitimate sleeper receives hundreds. Confidence should depend on effective independent evidence, graph position, opponent quality, and consistency.

⸻

14. Direct list editing versus pairwise evidence

Both are necessary.

Serious fantasy managers will not tolerate a system that forces dozens of comparisons merely to make an obvious adjustment.

Direct editing must be authoritative personally

Supported actions:

* Drag and drop
* Enter a target rank
* Move up or down
* Insert above or below another player
* Remove from top 250
* Bulk tier movement
* Position-filtered editing

A direct edit should immediately update the personal list.

Preserve evidence provenance

Every ordering change should know why it exists:

* Seeded from Yahoo
* Pairwise comparison
* Direct edit
* Assisted insertion
* Bulk edit
* Model inference
* Automatic displacement

Conflict handling

Suppose a user previously answered:

* Player A over Player B

Then directly drags B above A.

Do not prevent the edit.

Treat the direct edit as the latest explicit preference and mark the old comparison as superseded for the current personal ranking.

Optionally show:

This move reverses one previous comparison.

Actions:

* Keep the edit
* Review the matchup
* Do not show this notice again

Community contribution

Direct edits should not contribute identically to pairwise decisions.

A drag from No. 200 to No. 80 does not prove the user intentionally evaluated the moved player against all 120 intervening players.

Recommended interpretation:

* Direct placement creates weak local ordering evidence
* Explicit pairwise answers create strong community evidence
* Confirmed assisted insertion creates medium-to-strong evidence for the actual anchor comparisons
* Do not emit 120 synthetic community victories from one drag

⸻

15. What contributes to the community model

Include

Strong evidence

* Explicit A-versus-B answer
* User-confirmed assisted-placement comparisons
* Explicit reversal of a previous comparison

Moderate evidence

* Direct “place above/below this player” actions
* Confirmed rank insertion after reviewing local neighbors
* Deliberate ordered mini-tier exercise

Weak or non-ranking signals

These may affect discovery but not community rank directly:

* Watchlisting
* Search
* Profile view
* Export
* Dismissal
* Ownership
* Personal rank inherited from seed
* Projection model output
* Yahoo ADP

Exclude from community rank

* Unanswered or skipped matchups
* Automatically generated personal ordering
* Seeded rankings
* Hover or click behavior
* System-generated displacement
* Players added without comparisons
* Bot-like or low-integrity activity
* Comparisons made after identity ambiguity
* Administrative testing accounts

User weighting

Do not openly create an “expert vote counts more” hierarchy at launch.

Instead, reduce low-quality evidence based on behavioral integrity:

* Account age
* Comparison consistency
* Completion patterns
* Rate limits
* Repeated identical sessions
* Duplicate-account signals
* Suspicious coordinated activity
* Extreme low-effort behavior

A serious user should not gain 10× power merely because they made more comparisons.

Cap marginal influence per player pair and per time window.

⸻

16. Confidence language

Avoid:

* Accurate
* Definitive
* Correct rank
* Consensus has decided
* 95% certain this player is No. 143

Ranks are preference estimates built from a particular user population and product context.

Recommended labels

High confidence

Well established
Broad comparison coverage with consistent results.

Medium confidence

Developing consensus
Enough evidence to estimate the player’s range, but movement remains likely.

Low confidence

Limited evidence
Early estimate based on a small or narrowly connected comparison sample.

New outside player

Emerging candidate
Community results suggest top-250 potential, but more comparisons are needed.

Personal assisted placement

Suggested placement: No. 166
Your answers most strongly support a position around No. 161–172.

Display both sample and coverage

Useful fields:

* Comparisons
* Independent users
* Distinct opponents
* Recent comparisons
* Confidence label
* Estimated rank range

“1,200 comparisons” can still be weak if they came from a small number of users or repetitive opponents.

⸻

17. Duplicate names and player-status edge cases

Duplicate names

Never use display name as a unique key.

Disambiguate with:

* Birth date or birth year
* Position
* Current organization
* League
* Headshot
* NHL ID
* Draft organization and year

Example:

Elias Pettersson
C · Vancouver · Born 1998

Elias Pettersson
D · Vancouver organization · Born 2004

The user should never have to infer which record is intended.

Team changes

Team is mutable metadata, not identity.

When a player is traded:

* Preserve FHFH player ID
* Update current organization
* Retain organization history
* Recalculate discovery and role signals
* Do not reset ranking or comparisons

Unsigned players

Keep searchable when fantasy relevance remains plausible.

Label:

* Unrestricted free agent
* Restricted free agent
* Unsigned prospect
* Professional tryout

Retired players

* Set inactive
* Remove from default discovery and active autocomplete
* Preserve historical rankings and comparisons
* Prompt users to replace them
* Do not erase prior community history

Leaving North America

Distinguish:

* Loaned to Europe
* Contracted in Europe with NHL rights retained
* Contract terminated
* Long-term departure
* KHL or other professional transfer

For redraft-default views, these players should generally become inactive or strongly flagged. Dynasty formats may retain them.

Position changes

Position is mutable and source-specific.

Maintain:

* Canonical hockey position
* Yahoo eligibility by season
* Other platform eligibility
* User-league eligibility where available

A winger gaining center eligibility should not become a new player identity.

⸻

18. Abuse, privacy, bias, cold-start, and quality risks

Abuse

Threats

* Coordinated boosting or burying
* Duplicate accounts
* Automated comparison submissions
* Rival-content communities targeting players
* One user answering the same matchup repeatedly
* Strategic manipulation around the cutoff

Controls

* One effective vote per user-player-pair per meaningful period
* Latest explicit preference replaces prior preference
* Rate limiting
* Device and behavioral anomaly detection
* Account-age and verification signals
* Downweight coordinated bursts
* Require diverse opponents for public admission
* Maintain moderation and audit tooling
* Never expose individual user votes publicly

Privacy

Community contribution should be:

* Anonymous in public outputs
* Detached from profile identity
* Aggregated
* Removable when the user deletes their account, subject to clearly stated aggregation policy
* Governed by explicit privacy documentation

Do not expose:

* Which user ranked a player
* User-level comparison history
* Private league settings
* Draft strategy
* Personally identifying behavioral profiles

Give users an option such as:

Contribute my explicit comparisons anonymously to FHFH Community Rankings.

This should be clear during onboarding, not buried.

Sample bias

FHFH users will not perfectly represent all fantasy-hockey managers.

Likely biases:

* More experienced than casual Yahoo users
* More engaged with category leagues
* More attentive to peripherals
* More goalie-strategy aware
* More likely to rank sleepers and deep players

Describe the output as:

FHFH Community Ranking

Not:

The universal fantasy-hockey consensus

Eventually provide segmentation by:

* Points versus categories
* Redraft versus keeper
* League size
* Roster format
* Scoring settings

Do not mix these populations indiscriminately once enough data exists.

Cold start

Initial community ranking can use:

* Verified Yahoo preseason ADP for seeded players
* FHFH editorial ranking
* Composite projections
* Prior FHFH community data
* Broad uncertainty for new players

But public UI must distinguish:

* Market prior
* Editorial prior
* Projection estimate
* Actual community evidence

Do not make model-generated order look community-voted.

Identity quality

Highest-risk failures:

* Duplicate players
* Wrong prospect mapped to same-name NHL player
* Yahoo season-key mismatch
* Headshot attached to wrong identity
* Trade metadata creating a duplicate
* Accented-name normalization merging separate people
* Projection rows matched by name alone

Every uncertain match should enter a review queue.

⸻

19. Homepage matchup and ten-player preview

Matchup panel

Each player card should include:

* Headshot
* Name
* Current organization
* Position and platform eligibility
* Age
* Prior Yahoo ADP or “Previously undrafted”
* FHFH projection summary
* Relevant role
* One concise discovery explanation when applicable

Avoid displaying so much information that the decision becomes a spreadsheet comparison.

Recommended primary question:

Who should be drafted first?

Supporting actions:

* Player A
* Player B
* Too close
* Skip
* View details

“Too close” should not count as half a vote. It should record uncertainty and prompt a later contextual comparison if useful.

Ten-player preview

Show:

* Four or five rows above the active region
* The affected player or insertion point
* Four or five rows below
* Animated rank transitions
* Source indicator for change
* Blue #07aae2 bookmark at the last stable position

The bookmark should mean:

You have meaningfully reviewed through this area.

It should not merely mean the last page scroll position.

⸻

20. Full-ranking page

Core columns

* Rank
* Movement
* Player
* Team
* Position
* Personal tier
* Previous Yahoo ADP
* Community rank
* Personal/community delta
* Confidence or review state
* Notes or tags

Candidate area

Immediately after No. 250, show:

Just outside your cutoff

* No. 251–275
* Watched candidates
* Recent discovery risers
* Previously displaced players

This prevents the cutoff from feeling like a hard deletion boundary.

Direct editing modes

* Drag mode
* Rank-number entry
* Compare mode
* Tier mode
* Position-filter mode
* Candidate review mode

Export

Exports should include metadata rather than just rank and name.

CSV/XLSX fields

* Personal rank
* FHFH player ID
* Name
* NHL organization
* Position
* Yahoo eligibility
* Previous Yahoo ADP
* Community rank
* Projection
* Tier
* Notes
* Watchlist status
* Last updated

JSON

Include:

* Ranking version
* Season
* Scoring profile
* Player IDs
* Rank history
* Optional comparison evidence
* Export timestamp

⸻

21. Community Rankings page

Each row should show:

* Community rank
* Player
* Current organization
* Position
* Previous Yahoo ADP
* “Previously undrafted” where appropriate
* Rank change
* Confidence label
* Sample size
* Personal rank
* Personal delta

Player detail

Rank-distribution histogram

This should display users’ deliberate placement outcomes or inferred rank ranges, not pretend every pairwise vote directly produced an exact rank.

Historical sparkline

Use stable snapshots:

* Daily during preseason
* Weekly during quieter offseason periods
* Clearly mark methodology changes

Evidence panel

* Independent users
* Accepted comparisons
* Distinct opponents
* Comparison coverage
* Last meaningful update
* Confidence range

Indicators

Indicators must be evidence-backed:

* Rookie: verified rookie status
* Breakout: role/performance model threshold
* Sleeper: community or FHFH rank materially above market ADP
* Role riser: verified deployment change
* Goalie opportunity: workload model increase

“Sleeper” should not simply mean “a player somebody likes.”

⸻

22. Product phases

Launch version

Focus on identity safety and a delightful personal ranker.

Include

* Account-backed personal top 250
* Verified Yahoo ADP seed
* Canonical FHFH player records
* Active NHL players plus a curated prospect pool
* Autocomplete search
* Assisted insertion
* Candidate bench
* Watchlist
* Pairwise homepage
* Ten-player animated preview
* Direct rank editing
* Comparison and rank persistence
* CSV and JSON export
* Basic anonymous community ranking
* “Previously undrafted” support
* Basic sample size and confidence
* Manual identity-review tooling
* A small number of explainable discovery groups

Do not overbuild yet

* Highly personalized machine-learning queues
* Fine-grained league segmentation
* Public expert weighting
* Complex universal prospect coverage
* Automated role inference from every news source
* Claims of precise confidence intervals without adequate validation

Second phase

Add

* XLSX export
* Historical personal ranking
* Projection-riser engine
* Role-change engine
* Goalie workload discovery
* Community rank history
* Rank histograms
* Scoring-setting profiles
* Points versus category segmentation
* Blind comparison mode
* Candidate urgency model
* Better contradiction resolution
* Player-addition request workflow with status tracking
* Identity-review dashboard
* Community emerging-candidate section

Mature product

Add

* League-specific rankings
* Imported Yahoo league settings
* Category-scarcity-aware discovery
* Replacement-level and roster-construction context
* Position and category exposure warnings
* Draft-room integration
* Live ADP and room-value comparisons
* Tier-building exercises
* Rank confidence calibrated from historical behavior
* Prospect and dynasty modes
* Expert/editorial cohorts
* Seasonal model versioning
* Manipulation-resistant Bayesian community ranking
* Public methodology pages
* Personalized draft recommendations derived from the user’s ranking, roster, and room state

⸻

23. Firm product decisions

These are the decisions I would lock.

1. Yahoo determines the initial seed, never the eligible universe.
2. FHFH owns the canonical identity layer.
3. NHL ID is the preferred external identity, not the only acceptable one.
4. Prospects may be rankable without NHL stats or Yahoo IDs.
5. Top 250 is a cutoff over an extended ordered candidate bench.
6. Every displaced player remains preserved at No. 251 or below.
7. Users get both a candidate bench and a watchlist.
8. Autocomplete may select only verified identities.
9. Unknown names go through a player-request workflow.
10. Explicit pairwise decisions are the strongest community evidence.
11. Direct edits control the personal list but create limited community evidence.
12. Seed influence decays rapidly after real user evidence.
13. Outside candidates enter public rankings through evidence, not inherited ADP.
14. Previously undrafted players never receive synthetic prior ADP.
15. Public rank and public confidence are separate outputs.
16. Discovery answers “why this player, why now?”
17. Community outputs remain anonymous and auditable.
18. Identity uncertainty blocks automatic merging and public aggregation.

⸻

24. Ideal user journey

TJ opens FHFH in August. His personal ranking already contains 250 players seeded from the prior season’s verified Yahoo preseason ADP. The homepage shows a matchup and a live preview around the section he most recently reviewed.

A discovery card appears:

Breakout candidate outside your top 250
Matthew Example has moved onto his team’s second line and first power-play unit. His composite projection increased from 41 to 63 points, and he has entered 14% of active FHFH top-250 lists this week. He had no verified Yahoo preseason ADP last season.

TJ selects Compare now.

The autocomplete has already resolved the real identity:

Matthew Example
LW · Columbus organization · Age 22
NHL ID verified · Yahoo-listed for 2026–27
Previously undrafted

FHFH does not create a player from free text. It uses the existing canonical identity.

TJ is unsure where the player belongs, so the assisted-placement process begins.

1. Matthew Example versus TJ’s No. 125
    TJ chooses No. 125.
2. Matthew Example versus No. 188
    TJ chooses Matthew Example.
3. Matthew Example versus No. 156
    TJ chooses Matthew Example.
4. Matthew Example versus No. 141
    TJ chooses No. 141.
5. Matthew Example versus No. 149
    TJ chooses Matthew Example.
6. Matthew Example versus No. 145
    TJ chooses Matthew Example.

The system reports:

Suggested placement: No. 143
Your answers most strongly support a position around No. 139–149.

TJ reviews the local list:

* 140.	Player W
* 141.	Player X
* 142.	Player Y
* 143. Matthew Example
* 144.	Player Z
* 145.	Player AA

He confirms the insertion.

Rows animate. Every player from No. 143 through No. 250 moves down one position. The former No. 250 becomes No. 251 and appears at the top of Just Outside Your Cutoff. None of that player’s prior ranking evidence is lost.

Matthew Example now displays:

* Personal rank: 143
* Community rank: 218
* Previous Yahoo ADP: Previously undrafted
* Personal delta: +75
* Personal placement confidence: Developing
* Comparison history: Six explicit decisions

TJ’s accepted pairwise decisions contribute anonymously to the community graph, provided he has enabled community contribution. His insertion itself does not manufacture victories against every player from 144 through 250.

Over the following weeks, other users compare Matthew Example against increasingly strong opponents. His community estimate moves from 278 to 241, then 218. Once sufficient independent evidence, opponent diversity, and cutoff coverage accumulate, he enters the public community top 250. The page continues to show Previously undrafted, because FHFH never invents an ADP for him.

Before his draft, TJ opens the full ranking, reviews candidates 251–275, drags one goalie up twelve spots, resolves the resulting contradiction through a single matchup, and exports his completed ranking as XLSX.

The export contains all 250 ranked players, stable FHFH identities, teams, positions, previous ADP where valid, community ranks, personal deltas, projections, tiers, and notes.

The result is not a lightly modified Yahoo list. It is a persistent, evidence-backed personal draft board capable of discovering and credibly ranking players whom the previous market completely missed.
# Record-SOS synthetic checkpoint

2026-10-20 UTC. **15 test methods passed; zero failures/errors.** A repeat run produced byte-identical JSON. This validates arithmetic and specified invariants on invented fixtures, not NHL predictive performance.

## Files and reproduction

- `sos_synthetic.py`: Python standard library only; exact `fractions.Fraction` arithmetic, no random draws.
- `SOS-SYNTHETIC-RESULTS.json`: full fixture ledgers for the main examples, exact fractions plus decimal summaries, component details, and test results.
- `SOS-METHODS.md`: the surrounding research design and empirical promotion gates.

Run from this directory:

    python sos_synthetic.py --output SOS-SYNTHETIC-RESULTS.json

The process exits nonzero if a test fails. Timing is omitted from the saved log so the JSON is reproducible. No network, provider, paid-request, database, application, or Git operations occur. All input histories are stipulated available at one frozen synthetic cutoff. This kit does not implement real-data ingestion, timestamp filtering, or historical snapshot reconstruction.

## Exact contract implemented

Default result credit is 1 for a final win and 0 for a final loss, inclusive of OT/shootout. The kit separately implements regulation-equivalent credit (both sides .5 after a regulation tie) and ordinary standings-points credit (actual ordinary-game points/2). These modes are never mixed. Exceptional standings-point forfeitures are outside this synthetic scoring constructor.

The demonstration prior is kappa=2 equivalent games and mu=.5. This is a transparent fixture choice, not an estimated NHL parameter. Points mode requires an explicit prior mean; its test uses a stipulated .55, not a fitted estimate.

For each team j and excluded team set S:

    p_j^(-S) = (eligible result credits + kappa * mu) /
               (eligible games + kappa)

Every outer fixture has one vote: opponent j's weight is its scheduled meeting count divided by all focal fixtures. This is neither a unique-opponent mean nor pooled opponents' credits/games.

- Direct opponent rates exclude every game against focal team i.
- Each intermediary j's second-hop fixture mix excludes i.
- Each second-hop team k's rate excludes games against both i and j.
- SOS = (2/3) OWP + (1/3) OOWP.
- Historical RPI-style = .25 own shrunk record + .50 OWP + .25 OOWP.
- Future opponent lists change only the outer fixture weights; all inner records/mixes remain frozen. The kit deliberately does not invent a future RPI-style score.

Missingness is explicit. No scheduled fixtures means no per-game schedule score. A zero denominator with kappa=0 is unavailable and propagates to the composite, without dropping the missing observation or renormalizing the rest. An observed 0/1 is valid zero, not missing. When an intermediary has no opponents besides the focal team, the declared structural fallback is mu and is marked prior-only.

`state=available` means arithmetically computable, not empirically reliable. Direct and second-hop prior-only exposure weights, eligible counts, and schedule components accompany it. A computable score can be entirely prior-driven.

## Results that matter

1. **No observations is not an average schedule.** With no history and no fixtures, the own-rate prior is .5 but SOS is null. If two future fixtures are known despite no results, SOS is computable as .5 with 100% direct/second-hop prior-only exposure. These states remain distinct.

2. **One game provides no independent opponent-record evidence.** After A beats B once, both schedule scores are .5 and entirely prior-driven after exclusions. Their RPI-style scores differ: A=13/24, B=11/24. This makes team results versus schedule visible.

3. **Weighting changes the answer.** Focal i plays A three times and B once. Excluding i, A is 4/5 and B is 1/10. Unsmoothed per-fixture OWP=5/8=.625; unique-opponent mean=.450; unique-record pooling=1/3; repeated-record pooling=.520. With the declared prior, OWP=97/168, OOWP=1/2, SOS=139/252, and historical RPI-style=209/336.

4. **Unknown is not zero.** The unsmoothed unequal-history example has OWP=.625, but missing second-hop rates make OOWP/SOS null. A separate positive-denominator fixture gives observed OWP=OOWP=SOS=0 and RPI-style=1/4, with `state=available`.

5. **Focal-result feedback is excluded.** Flip only the three focal-game winners, leaving opponents, fixture counts and all non-focal results fixed. Qualified SOS remains exactly 769/1620 before and after. Historical RPI-style appropriately changes from 1201/2160 to 877/2160 because own results belong in RPI. The unexcluded OWP negative control changes from 1/3 to 11/18; ordinary opponents' OWP averaging, which permits focal re-entry, changes from 13/24 to 41/90. The invariance check also runs under each declared outcome mode.

6. **Disconnected evidence stays disconnected.** Two isolated matchup pairs report two components. Their similarly situated winners receive identical prior-heavy scores; this does not establish equal underlying strength. Reversing a result in the other disconnected component cannot change focal A's score. A common prior creates a comparable numeric scale, not missing cross-component evidence.

7. **Future frequency is separate from history.** Keeping the same records but changing the future list from A,A,A,B to A,B changes SOS from 139/252 to 29/63. Inner rates are unchanged. Repeating the historical outer list reproduces historical SOS exactly.

Additional assertions check bounded scores, normalized defined mixtures, fixture-order invariance, team-relabel equivariance, and rejection of duplicate IDs, self-games, or unknown teams.

## Why naive endless averaging is not a fitted rating

The kit's triangle uses a connected, symmetric, non-bipartite neighbor-averaging matrix P. Starting with x=(1,0,0), the unanchored update x_next=P x converges to (1/3,1/3,1/3), losing all ranking separation. The seed is an arbitrary signal, not a claimed feasible round-robin record table. After 40 exact-arithmetic steps each entry is within 1e-11 of that limit.

This is an example, not a claim that every connected graph's synchronous average converges. A two-node bipartite example alternates (1,0) -> (0,1) -> (1,0). For other graphs the conserved limiting mean can be stationary-weighted rather than an arithmetic mean.

An illustrative anchored recurrence r_next=(1-alpha)y+alpha P r with alpha=3/4 and y=(1,0,0) instead converges to (5/11,3/11,3/11). The result contribution is retained at every step, and alpha<1 provides a contraction. **This is not a fitted or validated NHL rating.** It simply explains why blindly averaging neighbors repeatedly is not equivalent to a properly specified model that retains observed outcomes and has an objective, anchors/regularization, identifiability checks and a convergence criterion. No BT/Colley model was fitted, and infinite iteration was not assumed to be the user's request.

## Still empirical, and not a release blocker

These checks establish implementation consistency only. They do not establish optimal weights, prior strength, outcome credit, early-season reliability, model calibration, xG/category lift, or fantasy value. Those require leakage-safe historical comparisons and credible as-of inputs. Whether the stricter focal exclusion is predictively preferable remains a testable design choice, not an empirical conclusion from invariance alone.

Qualified FORGE can remain the simpler, explicitly limited path while this research is evaluated. No production scoring choice or richer-model promotion is warranted solely by these 15 passing tests.

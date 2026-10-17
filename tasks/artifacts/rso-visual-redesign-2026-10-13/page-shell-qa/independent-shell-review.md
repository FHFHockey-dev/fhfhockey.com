# Independent frozen source and actual-shell review

## Verdict

**REJECT the complete nine-path candidate pending one P2 in upcoming-game discovery.** The partial-total qualification, qualifier placement, separate net metrics, unranked presentation and final mobile-tab correction pass this bounded review. The historical tab obstruction is closed for the final frozen Sass snapshot. These conclusions do not establish genuine account/provider parity, forecast qualification or production readiness.

Reviewed React 18.3.1 components, SCSS, nearest tests, original baselines and distinct source increments. Application files remained read-only. No Git operations, compiler, browser rerun, live/provider/database request, deployment or source repair was performed. Only this report was written.

## Open finding

| Severity | Location | Before | Required after | Why |
| --- | --- | --- | --- | --- |
| P2 | `web/components/RosterScheduleOptimizer/CandidateBrowser.tsx:56–60` (ordering at 89–90) | “Upcoming NHL games” uses the planning snapshot's retained `context.asOf`; LIVE/CRIT states are not excluded. A game already underway but later than an old saved cutoff is counted as upcoming and changes unranked discovery order. | Use an explicit current discovery cutoff independent of the immutable saved planning cutoff; exclude already-started/live games. Add stale saved-cutoff and live/past-start regressions with future-game controls. | Saved and connected snapshots can retain an earlier cutoff (`RosterScheduleOptimizer.tsx:560–568`). The main freshness warning already distinguishes current reader time at 612–613. Current team-calendar discovery must not relabel elapsed games as upcoming. |

Independent pure actual-component reproduction denied `fetch` and mocked candidate metrics as absent. With a complete canonical calendar, a known team and a LIVE game starting `2026-10-13T22:38:23.057Z`, browser time was `2026-10-13T22:48:23.057Z` and saved snapshot cutoff `2026-10-13T21:48:23.057Z`. Actual server-rendered CandidateBrowser displayed **Upcoming NHL games: 1**, with no numeric rank. The identical calendar with a fresh cutoff displayed 0. Assertions passed; the probe's InfoTooltip `useLayoutEffect` SSR warning is not a product finding. Preserve the existing full-range calendar preview and planner receipt clocks when correcting discovery; neither needs rewriting to address this bug.

## Supported behavior and closed visual findings

- Partial active/bench totals carry `+ known`; unknown totals remain unavailable. Full-range DUST and utilization percentages are withheld until schedule completeness is established. Complete-calendar behavior remains. Candidate reference active games receive the same incomplete-schedule qualification. These are counts, not player probabilities or inferred forecast quality.
- The qualifier is outside both the seven-card grid and the mobile horizontal carousel. Retained six-context evidence gives widths/heights 2040×14 at 2048px, 1432×14 at 1440px and 374×28 at 390px. The mobile metric row is 71px, versus the rejected 136px placement. Its explanation stays visible across the full available width.
- Missing comparable plans have no numeric rank. Measured net points and net AGP remain separate ordering groups. Canonical team-game discovery is explicitly separate from net roster fit, availability and participation; unknown counts remain unknown. Legal-plan comparison, lost dropped-player contribution and reshuffling are preserved. Shared display budget and expansion/reset remain intact.
- The main supplies the existing canonical calendar receipt to both consumers; supplied-calendar TeamScheduleContext disables its independent reader. This adds no separate canonical read. Net points and Net AGP have separate labels, explicit whitespace and nonoverlapping fields; unavailable values are not converted to zero.
- The original mobile P2 is preserved in historical evidence: at 390px, tabs at y0/height52 were covered by the actual header at y0/height56; all four centers y26 hit the header. The final isolated Sass increment changes top to56px and adds the exact1100px top68px exception. Header switches at1100px while RSO uses mobile workspaces through1100px. The increment retains stacking order and existing44px buttons.
- Final five-context retained evidence closes that obstruction: pending and partial-warning390px cases place tabs y56 and all four centers y82 on their own controls; two cycles of all four touch activations plus scrolling and keyboard Enter pass. At1100px, tabs y68/centers y94 sit below the68px desktop header and repeated click/scroll/keyboard checks pass. Both1440px desktop geometries match the qualifier checkpoint. The script tests deep scrolling and `elementFromPoint`, then asserts activation; it does not merely restore scroll before testing the hidden controls. The22 final PNG hashes were independently verified, and the390px partial-warning and1100px repeated-scroll images were independently viewed.

## Design review categories

**Typography:** actual local Roboto Condensed is retained, with distinct metric labels and values. **Surfaces/layout:** full-width qualifier and header-aware tabs resolve the demonstrated placement defects. **Animations:** no new motion or animation dependency. **Icons:** existing controls remain, with unranked ordinal removed. **Performance:** canonical calendar reuse avoids an extra reader; no producer or model work is introduced. No additional defect was found in these bounded categories.

Rejected alternatives: a numeric ordinal for missing plans suggests measured ranking; zero-filled metrics invent evidence; placing the qualifier only across grid columns leaves it inside the mobile carousel; raising tab z-index above the site header trades one obstruction for another. The implemented sibling qualifier and offset correction address the actual captures.

## Exact reviewed identity

Original eight-path manifest: `d268a804293ae96e1894bcfb4d7b86fbf9554bcff283e6bce6b12908a7a4d93a`. Final nine-path manifest: **`630887197d69a44765140c60cbd84de6e6e50b243edf12e0be290fbb7e2bfc4f`**. All nine current file hashes independently match the final retained QA manifest; all80 final bundled input hashes match. The ninth path was added while review was underway and then explicitly included by the supplemental delegation. The old captured Sass hash `e63f1b56d3047ba7273c5c8a372d204ae8466579c4521d3bc240bab1853bd7cb` remains historical evidence, not the final accepted offset.

| Path under `web/` | SHA-256 |
| --- | --- |
| `components/RosterScheduleOptimizer/RosterScheduleOptimizer.tsx` | `92da56e80fa2a0122ea4f5a0e3e38673271c1b9ee1c65f63f9ee2be02ee55cf9` |
| `__tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx` | `87a946e2b8f49a26598278634367b4ffddec18dc4bc139752a514a88407ad81c` |
| `components/RosterScheduleOptimizer/CandidateBrowser.tsx` | `ad84ffb341b68268b479f79fe2e3e6d0c43ab39a90fa44daddd3ecbd8f62fc4f` |
| `components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx` | `48c9c12889ca8b654cc86957ec124338ae9e1e442b51998c1fb86d2d1cede4d9` |
| `components/RosterScheduleOptimizer/CandidateCard.tsx` | `663eb382a5515387beffacdd67a950d20a3ee5f61fa69f147f35962da7897676` |
| `components/RosterScheduleOptimizer/CandidateCard.test.tsx` | `0eb330f8d09408f3f3e81008defbe9f7a051109989d658719e2b797ec153039b` |
| `components/RosterScheduleOptimizer/CandidateCard.module.scss` | `677f48f459cbe69fe2dcb6a5f9fa0d0fad56cb20c89d68db816367ad756aebf2` |
| `components/RosterScheduleOptimizer/TeamScheduleContext.tsx` | `f0cc262ef040c8cc2b8c31b376102f49b2d44288b8d521069480f3707f9b9a72` |
| `components/RosterScheduleOptimizer/RosterScheduleOptimizer.module.scss` | `53a0621910934d80f6693cc99cc43df9d71d4cc819ecc218ebdcfa91f51042d9` |

The complete patch reconstructed against retained before-files matches the candidate. Qualifier increment SHA-256: `ad3af8a7992670f991d20fadd986d8babdf7509e1e47b470c1828a92a3513597`; final mobile increment: `33485eea3d6335d9c23486bb54f91e03516bf7a37d5dfa14d05c3da73f1aae4c`. The Sass pin above is accepted specifically for this offset correction; CandidateBrowser's pin is rejected for the open P2, so the complete manifest is not accepted.

## Verification and limits

Independently run focused Vitest subset: **11 passed,189 skipped,3 files**, exit0. Command from `web/`:

```sh
npm test -- --run components/RosterScheduleOptimizer/CandidateBrowser.presentation.test.tsx components/RosterScheduleOptimizer/CandidateCard.test.tsx __tests__/components/RosterScheduleOptimizer/RosterScheduleOptimizer.test.tsx -t 'starts with individual|shares one display|leaves unavailable|orders unranked|complete acquisition card presentation|qualifies plan aggregate' --reporter=dot
```

The stale-cutoff counterexample is additional independent component evidence, not covered by that passing subset. Owner's scoped lint and test receipts were inspected, not rerun. No new full TypeScript result is claimed for this candidate.

Qualifier receipt SHA-256: `69611264b36789fd9544cc263b51637e28138a6ad6d5edd26311aac9d3031776`; its input manifest: `a2a56e77da322349cca78efa19171057e85ac4a511854dce792f12ca44e63570`. Final mobile receipt: `6f6bd7915991936b841b9f96bb1bd5f371030bf5544f1771c1dc353570b02958`; final input manifest: `1dc4dad32225c0598bf7a9391ac68d1673c31e5997711d8d94dd90aa0f6ac6f6`. Local font hash: `dace262afcee68a5276f200d8026c57221735c0118ab5fda8c2c0d3dc409a8d0`.

Retained QA uses actual Layout/Header/NavbarItems, RSO components and local workers/fonts, with explicit synthetic auth/router/account/provider/calendar/eligibility and read fixtures, Next wrappers, closed AuthModal and local substitute images. The recorded fake provider POST is fulfilled locally. Browser execution/placement passed in six qualifier and five final-tab contexts, with zero recorded page/console errors and outbound or genuine account/provider requests. This is inspection of retained executions, not an independent browser rerun.

Actual user's account, viewport/zoom/device ratio, remote font parity, provider refresh completion and production parity remain unverified. Provisional cached Yahoo eligibility is not fresh connected rules, locks or availability. No private conditional forecast is admitted, and no probability, public forecast quality, schedule maintenance, database refresh or production action is qualified by this report.

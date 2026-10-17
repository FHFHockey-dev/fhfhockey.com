# Independent review — invalid read clock guard

Verdict: **ACCEPT the exact two-file increment. No findings.** This closes the direct resolver invalid-read-clock limitation documented in the initial SOG review without rewriting that historical report.

Independently checked before.sha256 and both retained before copies; contributions.ts starts at the initial accepted SOG source hash `553f43f765d6c6bcb7e5048e49923999c3922435d1d3425024097403d8189e2b`. Reconstructed increment.patch and matched both current candidate pins byte for byte.

The single guard at contributions.ts:159 uses the existing policy-specific clock parser and adds the existing future_input exclusion for a non-finite now. assessSource is evaluated independently for each source before selection, so neither detailed nor baseline can remain selected with these invalid read clocks. Conditional/integrated mean and allowed-use results then remain unavailable/false. Valid-clock decoding, original microsecond versus legacy parsing semantics, source selection, schemas and reason vocabulary are unchanged.

The retained reproduction.log shows all three unparseable-clock cases failing before the fix because the baseline stayed selected. The corrected test crosses detailed/baseline with conditional/integrated sources and requires null means/source kind, empty source IDs, all four denied permissions and future_input. fixed-tests.log shows101 resolver plus29 adapter tests passed (130 total). The verification receipt records two-file lint exit0. No reviewer test/compiler/browser/live execution was needed or performed. Acceptance is for the added finite-clock guard, not a broader redesign of legacy timestamp parsing.

No source edit, genuine packet/body read, model/producer execution, network/provider/account/DB action or publication was performed. Source quality, policy activation and release inclusion remain separate from this local correctness acceptance.

Evidence SHA256:

- increment.patch: `4fe2f4c0e850fdd40514cc62eb254a79d240e31aa89886981ba52aa99ddca733`
- candidate.sha256: `be6ac7b211493104d580a977083a477bf4cf11114258530dbdcdb36a35bc9e48`
- before.sha256: `1778ad7489e7e4aecb5ee73b8541481d8605340e074a835554691e56a0128d21`
- verification.json: `8f057da446ec40918f9482c9880a454fa7bb0da471beba1a861f7b0b88908da7`
- reproduction.log: `0a3d3c8f6c04c90bdbf88b23c4ea90cb7b55ece869073cb0ea53ad3b4b396110`
- fixed-tests.log: `6a2199e2641319048710826a4552b14d9e4a609837f1f6f3891de96d746d6dc9`

Accepted source/test pins:

| Path | SHA256 |
| --- | --- |
| `web/lib/player-forecasts/contributions.ts` | `d23d776cf9fbd1dc301803347367f213aba050ceed0d18d2118bcc5a962e3f1c` |
| `web/lib/player-forecasts/contributions.test.ts` | `e11536cf9446839281beb0c7e1ab01ea9e7fb9c530b679bb3a6259c056f3afee` |

# Captured dependency provenance correction

The review request and CHECKPOINT prose incorrectly repeated the earlier reconciliation-observed `af6bbef4898cae4805c079deba37162269ee19bd648b6192a153bd3083c38f5b` contribution hash. That is **not** the input used by this compatibility run. The exact source manifest, read-only dependency manifest, captured bytes, post-test integrity and executed resolver all identify:

`web/lib/player-forecasts/contributions.ts` SHA256 **1f08b1c5ca9ea296826d899f7e57c02f2262c4c4102c11ba925a64f7e703bae6**.

The snapshot and current live file were rehashed after the reviewer raised this discrepancy and still match this value. The capture script checked hashes and reported the changed dependency path, but my subsequent prose used the older remembered hash without reading the captured hash. The frozen files and old evidence have not been changed. This addendum corrects the attribution; it does not replace the source manifest.

`captured-contributions-provenance.diff` compares the actual captured bytes with the earlier accepted `282c8b1e9c7362190c39a48b031e392afb6c2abaa45190d8f83d95d6319f9df7` copy. Besides `catalogExpiresAt`, it includes the owner's `native-goalie-appearance-summary-win-rates-v1` permitted-policy addition. The 26 bounded injury-out consumer cases and eight catalog-expiry assertions do not establish this goalie policy's correctness or combined FORGE/RSO compatibility. That policy remains with its goal owner. No owner-controlled file was edited or restored by IFTTT.

Owner acknowledgment remains pending. The copied consumer test bodies and eight expiry assertions, resolver configuration, 95 source pins and 15 snapshots remain frozen. The reviewer will evaluate the exact `1f08…` capture. IFTTT is preparing only an unactivated, task-local raw acknowledgment SQL draft outside these held paths while that review runs; it has no runtime caller and is outside the current candidate/verdict.

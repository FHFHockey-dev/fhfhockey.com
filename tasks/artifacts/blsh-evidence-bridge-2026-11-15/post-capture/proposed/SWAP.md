# Staged acquisition tool that accepts either candidate's pins (NOT live)

TJ chose (2026-11-15) "accept either pins file", staged now and swapped only after review. The live, listed tool stays `acquire-boxscores.mjs` `aa8a9cb7…`, so the Nov 17 v5 path is unchanged.

| File | sha256 |
| --- | --- |
| `proposed/acquire-boxscores.mjs` (staged) | `b4b563f4614d004568ba87ef71c163410307f8072508cd48d1f4f66f1f0f7ff8` |
| `../acquire-boxscores.mjs` (live, listed in `frames.mjs`) | `aa8a9cb7e90b057e53524f3ebabc261f32f67b06eac79b4e75d64298e432b107` |

## The change: two edits, nothing else

```diff
@@ -26 +26,8 @@
- * Successor v5 (pins a2a1e694…, verifier b86af692…); v4 conversions are refused. */
+ * Successor v5 (pins a2a1e694…, verifier b86af692…); v4 conversions are refused.
+ * APPROVED_PINS: … v5 (the 11-17 slot) and v5-1118 (the 11-18 fallback; same verifier, node and parser) …
+export const APPROVED_PINS = Object.freeze([
+  "a2a1e694dfa79ba9ebc110a3e45a249540b739c0061e0558fc6887e0f30367d1", // v5
+  "3f61f9d4725fb66efc3d0f2f201e74c46998d67856b84f9c9c7230357b866376", // v5-1118
+]);
@@ -166 +173 @@
-  need(… c.approvedInputs === true && c.pinsSHA256 === APPROVED.pinsSHA256 &&
+  need(… c.approvedInputs === true && APPROVED_PINS.includes(c.pinsSHA256) &&
```

**Unchanged:**
- **Approved inputs:** the verifier, node and parser pins (one value each, shared by both candidates).
- **Logic:** fetch, TLS observation, dispatcher identity, budget and output.
- **The fixed output path:** it follows the source date (2026-11-11 for both slots).

**The candidate:** it is chosen explicitly at conversion time (`convert.mjs --candidate`). The tool only checks that the recorded `CONVERSION.json.pinsSHA256` is one of the two; it never chooses.

## Offline evidence

- **Test 18:**
  - the staged file equals the live file with exactly these two edits, a text-level equality, so any other byte change fails;
  - its `APPROVED` equals `convert.mjs`'s, and `APPROVED_PINS` equals `CANDIDATES`' two pins hashes;
  - its hash is not on `APPROVED_ACQUISITION_TOOLS`.
- **Test 19:** the real staged tool runs against loopback TLS only:
  - it serves a v5 conversion and a v5-1118 conversion, each with one GET per game, and the runtime records the staged hash;
  - it refuses forged pins and v4 pins with `conversion_not_approved`, making 0 requests;
  - the **live** tool still refuses the fallback conversion;
  - production frames refuse the loopback output.
- **Rehearsal (`dress-rehearsal.sh <dir> v5-1118`):** step B4s has the staged tool serve the fallback conversion over loopback.

## Swap procedure (after review; none of it done here)

1. **Independent review of `b4b563f4…`.** The diff above is the whole change.
2. **Gate first (fallback review M1).** Swap **only** after one of these:
   - **(a)** the 11-17 slot is abandoned or missed, which is the same trigger as applying `FALLBACK.patch`;
   - **(b)** the 11-17 frames read (POST-CAPTURE step 5) has **completed**, so its output directory and manifest exist.

   **Never swap before or during the 11-17 frames read.** TJ's 11-17 frames approval names `aa8a9cb7…` (`APPROVAL-SHEET.md:45`, `PILOT-APPROVAL-PACKET-v3.md:130`). Keeping `aa8a9cb7…` on the list does not protect that run, because the file on disk would be the new tool.

   Then a reviewed change by a non-author:
   - copy `proposed/acquire-boxscores.mjs` over `acquire-boxscores.mjs`;
   - add `b4b563f4…` to `frames.mjs` `APPROVED_ACQUISITION_TOOLS`.
3. **Keep or remove `aa8a9cb7…`?** Keeping it (two entries) keeps an acquisition already made by the old tool valid. Removing it is cleaner if none exists.
4. **Test updates that the swap needs:**
   - test 15 asserts the list is exactly `[aa8a9cb7…]` and equals the live tool's hash;
   - test 18 compares staged to live, which becomes a no-op;
   - the rehearsal's B4 fallback expectation flips from refusal to success.
5. **TJ's frames approval:** re-issued for the new tool hash, for whichever slot runs.

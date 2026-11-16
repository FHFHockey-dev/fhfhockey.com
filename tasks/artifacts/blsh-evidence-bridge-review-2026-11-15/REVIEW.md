# Independent review: BLSH evidence bridge (2026-11-15)

**Reviewer:** separate Claude session; not the author. **Under review:** `tasks/artifacts/blsh-evidence-bridge-2026-11-15/` at its `SHA256SUMS` (all 15 entries OK at start and at end of this review). **Also reviewed:** the interface to `SUCCESSOR.patch` (`40dd64bc…2069`) and its verifier (`fc4e3d04…e218`).

**Method.** Everything below was re-derived from code and bytes. Afterwards, the bridge folder's `SHA256SUMS` passed 15/15, its listing and mtimes were unchanged, there were no newer files in the three sibling folders, `web/scripts` or `web/lib`, and `git status web` matched the start. Nothing ran live: no network, provider, NST, DB, ledger, credential or `.env` access, and no git mutation. The test suite and the two Python scripts ran only in scratch copies (see *How to reproduce*). The bridge folder was not modified.

## Verdict summary

| Q | Topic | Verdict |
| --- | --- | --- |
| 1 | `TLSVerified: true` from weaker facts | **FAIL** (custody limit, not a rule bug). In-run chain rules pass. A hand-written packet under the real successor pins converts to `TLSVerified: true` with zero network. |
| 2 | Representation map | **PASS** |
| 3 | Producer and redactor from pins; synthetic path | **FAIL (partial).** The producer comes from the pins *file*, but that file is unpinned operator input. A synthetic adapter plus an operator-written pins file yields `candidate_pending_independent_review`, not diagnostic. |
| 4 | Freshness rule at retrieval | **PASS** (boundaries run, not reasoned) |
| 5 | OfficialFrame | **PASS on logic and counts.** **UNVERIFIED:** frame transport. Boxscore `TLSVerified: true` is a self-asserted receipt field, accepted even when the receipt is marked `syntheticTestOnly`. |
| 6 | Proposed acceptance | **PASS** on the stated binding list, non-installability and no installed policy. **Finding:** the TLS observations that justify `TLSVerified: true` are **not** bound. |
| 7 | Tests | **PASS with findings.** See the mutation table. The on-ice "234" is by construction, and tests 12–13 write into the bridge folder. |
| 8a | Successor format converts; Chef's old verifier vetoes it | **CONFIRMED** |
| 8b | Window feasibility 68/644 and 0/644 | **CONFIRMED**, with the cause worded more exactly below |
| 8c | Dotted team codes 54/288 | **CONFIRMED** independently from page bytes and WGO |
| 8d | `capturedWindows` never admits | **CONFIRMED** (constants at `:262`, `:266`) |
| 9 | Leakage | **PASS** (0 names, 0 player IDs and 0 secrets in 27 files) |
| 10 | Durability | **PASS**, with one caveat: the CLI reports EEXIST as a generic `bridge_error`. |

**Overall:** the bridge is usable to **process** one live pilot packet into *candidate* evidence pending independent review, under the preconditions at the end. It is not, by itself, evidence that TLS was verified. `TLSVerified: true` is as strong as the custody of the packet and the source review of the pinned adapter, client and runner, nothing more.

---

## Q1. Can `TLSVerified: true` be reached without real, authorized, bound TLS and a default-CA runtime?

**Yes. Verdict: FAIL as a custody limit.** I kept three classes separate.

### 1a. In-run chain rules: PASS

`verifyTlsChain` (`convert.mjs:59-89`) re-derives the same rules as the runner's `tlsFacts` (patch, runner `+56-84`) and the successor verifier (`:71-86`):
- resumed → the earliest earlier full handshake for the same servername;
- keep-alive → the opener of that sequence, same servername;
- a new connection never repeats a sequence.

The bridge is stricter than the runner: it requires `authorized: true`, `authorizationError: null` and TLS 1.2 or 1.3 on every operation, while the runner records `authorized` as observed and enforces it only on resumed ones.

Brief probes (`repro/repro-units.mjs`, direct calls; `repro/repro-convert.mjs`, packet level):

| Probe | Direct `verifyTlsChain` | Packet (verifier + bridge) |
| --- | --- | --- |
| resumed op 3, no prior full handshake for that host | `tls_resumed_session_unbound` | `operation_3_tls_binding_invalid` |
| resumed op 5 bound to the wrong op | `tls_resumed_session_unbound` | – |
| keep-alive op 5, wrong opener index | `tls_connection_reuse_unbound` | `operation_5_tls_binding_invalid` |
| keep-alive onto another host's connection | `tls_connection_reuse_unbound` | – |
| new connection repeats a sequence | `tls_connection_sequence_repeated` | `operation_5_tls_binding_invalid` |
| admission `tls: null` | `tls_observation_missing` | `operation_2_tls_observation_missing` |
| `authorizationError` set; TLS 1.1; servername mismatch; mirror differs | refused, each with its own code | – |

**Accepted, and acceptable:**
- a keep-alive operation whose fingerprint differs from its opener's;
- a resumed operation that carries a different certificate;
- any `issuerCNChain` string.

These do not matter, because the adapter reads them from the same socket. They would matter only for a forged packet (1b).

### 1b. Fabricated packet: TLSVerified is a custody claim

**Reproducer:** `repro/repro-convert.mjs`, case `forged_real_pins`.
- **The packet:**
  - the real successor-pinned source bytes (runner `5dc46ec8…` and adapter `aa6237bd…`, from a scratch `patch -p1`, plus the seven unchanged roles from `web/`);
  - hand-written `tls` on all five operations;
  - a hand-written `RUNTIME.json` with the values a clean run would show;
  - zero network.
- **The run:** converted with the real successor `expected-pins.json`, `verify-packet.mjs` and `--node-sha256 daa77e22…`, **without** `--synthetic-adapter-ok`.
- **Result:** `{"ok":true,"evidenceClass":"candidate_pending_independent_review","receiptTLSVerified":true,"producerSHA256":"aa6237bd"}`.

**Why.** The packet is self-attested JSON: no signature, no timestamp authority, and no cross-reference to an external record of the run. Ops 2 and 4 write production admission-ledger rows, but nothing checks them. The verifier checks internal consistency and MANIFEST hashes, both of which a writer of the packet controls. **This is inherent to an offline byte check, not a bridge bug.** The answer is custody (see Preconditions) or an external witness.

### 1c. Is "all overrides absent + default store == bundled roots + pinned execPath" sufficient? Necessary, not sufficient

**Checked on this machine** (`env -i /usr/local/bin/node`):
- sha256 `daa77e22…` equals the bootstrap pin;
- v22.23.4 with **statically linked** OpenSSL 3.5.9 (`otool -L` shows no libssl), so the execPath hash does pin the TLS stack;
- `tls.getCACertificates` exists;
- the default store equals the bundled roots: 116 certificates, `5aab51f9…`.

So a clean run will **not** be falsely refused by `runtime_default_ca_store_not_bundled`.

**Not covered:**
1. **The snapshot is taken once, before the first dispatch.** It cannot see these changes made afterwards:
   - `tls.setDefaultCACertificates` (present in this Node);
   - `setGlobalDispatcher` or a per-request dispatcher carrying `connect.ca` or `rejectUnauthorized: false`;
   - a `process.env.NODE_TLS_REJECT_UNAUTHORIZED` write.

   `authorized: true` only means "verified against the CA the socket used". I searched the nine pinned roles plus the patched adapter, runner and bootstrap for `setGlobalDispatcher | dispatcher | Agent( | rejectUnauthorized | ca: | setDefaultCACertificates | process.env.X =`: **0 hits.**

   Third-party code loaded in-process is not bound by the packet: `cheerio`, `memory-cache`, `ts-node` and their transitive files. The bootstrap pins only their entry file and `package.json`.
2. **Launcher identity is not in the packet.** The bootstrap's own refusal list (`TS_NODE_*`, `NODE_PATH === "."`, tsconfig hash, dependency pins) is strong, but nothing in the packet proves the bootstrap ran. RUNTIME records neither the entry script, cwd, `TS_NODE_*` nor `OPENSSL_CONF`. The node binary contains `OPENSSL_CONF` handling (`strings` shows the `nodejs_conf` name), and the variable is outside the 15 keys. **Unverified:** I did not test whether it can change trust offline. It is unrecorded either way.
3. **`sessionReused` and `connectionSequence` are adapter-asserted.** This matters little: the pinned adapter reads them from the live socket (`isSessionReused()` and a per-process `WeakMap`), so their truth reduces to the same source-review and custody premise as every other fact. The resumption argument holds: Node skips `checkServerIdentity` on a resumed session (verified in the pinned binary's embedded `_tls_wrap` source: `if (!verifyError && !this.isSessionReused())`), but in a fresh process the session can only descend from this run's verified handshake to the same servername, which the chain rule requires.
4. **Global dispatcher left unreplaced:** source review of the nine roles is enough for *those files*. It is not enough for `node_modules`. The precondition is `npm ci` from the lockfile before the slot, plus the bootstrap's dependency pins.

## Q2. Representation map: PASS

- **Runner** (`:270-305`): NST bytes are retained as `response.bytes` from the adapter, with `representation: "client_redacted_parser_input"`.
- **Adapter** (`:124-137`): `bytes = Buffer.from(result.text, "utf8")`, where `result` is from `fetchNstTextByUrl`.
- **Client** (`:433-441`): `text = redactNstMessage(result.text ?? await response.text())`. Redaction is applied exactly once.

So the retained bytes are the redacted, decoded text re-encoded as UTF-8: the parser input after redaction. Note that it is not the wire bytes, because decoding is lossy and strips any BOM. Any other label is refused (`representation_unmapped`, test 11). The schedule's `original_decoded_body` never becomes a NativeReceipt. No other mapping or rename exists in `convert.mjs`.

## Q3. Producer and redactor from pins: FAIL (partial)

**What holds:**
- Producer = `pins.adapter`, and redactor = `pins.client` (`convert.mjs:133-137`). The packet must agree with them, byte for byte.
- `--synthetic-adapter-ok` yields `diagnostic_only_synthetic_adapter`.
- `propose-policy.mjs:12` refuses any class other than `candidate_pending_independent_review`.

**What fails:** `--pins` is an unpinned CLI input. Reproducer `synthetic_adapter_custom_pins`: an adapter of 28 arbitrary bytes, plus a pins file the operator wrote naming its hash, converts **without** the flag to `candidate_pending_independent_review`. The author's own test 3 does exactly this to reach the candidate class.

`CONVERSION.json` records `pinsSHA256`, but `CONVERSION.json` is not among the bound artifacts (Q6), so a policy reviewer cannot see it.

**Fix (small):**
- the bridge should refuse unless `sha256(pins)` equals the reviewed successor pins (`55a50c6d…6bd`);
- **or** the review must check that `producerSHA256 = aa6237bd…` and `redactorSHA256 = 1a568c28…` in every receipt.

The class label is a guard against accidents, not against an adversary: `assemble.mjs` trusts `CONVERSION.json.evidenceClass` as written.

## Q4. Freshness at retrieval: PASS (run, not reasoned)

`convert.mjs:179` applies prep `:48` per NST retrieval: `date < UTC-day(retrieved)` and `retrieved − date 00:00Z < 8 d`.

Results for date 2026-11-11 (`repro-convert.mjs`):

| Retrieval (ops 3, 5) | Result |
| --- | --- |
| 2026-11-11T23:50Z (same UTC day) | `future_incomplete_or_stale_date` |
| 2026-11-12T00:00:00.000Z | converts |
| 2026-11-19T00:00:00.000Z (exactly 8 d) | `future_incomplete_or_stale_date` |
| op 3 at 23:59:59.999Z on 11-18, op 5 after midnight | `future_incomplete_or_stale_date` (per request, correct) |
| both before 2026-11-19T00:00Z | converts |
| `2026-11-12T00:30+01:00` (= 11-11 23:30Z) | `future_incomplete_or_stale_date` |
| `2026-11-11T20:00-05:00` (= 11-12 01:00Z) | converts |

The timestamp grammar matches the gate's `time()`.

## Q5. OfficialFrame: PASS on logic and counts; frame transport UNVERIFIED

**`completedByUTC`** = min(the schedule retrieval, this boxscore's receipt time) (`frames.mjs:41`).
- Both are official observations showing the game final: `convert.mjs:162` requires every schedule game to be OFF or FINAL, and `frames.mjs:37` requires the boxscore to be.
- So it is the earliest observation *available to the bridge*. It is never start time plus a guess.

**Refusals:**
All four were executed (`repro-units.mjs`):
- non-final → `boxscore_not_final_regular_season_on_date`;
- off-schedule or duplicate game → `boxscore_game_not_scheduled_or_duplicate`;
- duplicate player on a date → `player_on_multiple_rows_for_date`;
- 0-TOI skater → no frame (1 frame from 2 listed skaters).

**Call counts:**
- **One boxscore per game is correct:** a player plays at most once per date.
- **6 for 2026-11-11:** `CANDIDATE.json.slateEvidence` lists 293–298. Those cited files are untracked; the run-time schedule GET is the authority.
- **5 per player-window.**
- **59** = the games on 2026-10-24…31 in the retained calendar. I recomputed it.

**Finding (Medium):** `frames.mjs:34` accepts any receipt whose JSON says `TLSVerified: true`. Probe `hand_written_receipt_marked_synthetic` gives 1 frame from a receipt carrying `syntheticTestOnly: true`. No reviewed acquisition tool is named that produces these receipts. Until one exists, held to the same TLS-observation standard as the packet, official frames rest on an assertion.

## Q6. Proposed acceptance: PASS on the stated items; one finding

- **The stated list is bound.** From a real run of `propose-policy.mjs` on the suite's candidate outputs: 261 required hashes = producer source, redactor source, definition, STARTED, READBACK, RUNTIME, schedule body, 2 native bodies, 2 receipts, 16 boxscore bodies and receipts, and 234 frames.
- **Not installable as written:** the gate constructor throws `invalid_server_acceptance_policy` on the proposal, because `reviewSHA256: null` fails `hash()`.
- **Nothing installed:** `rg` finds acceptances only in the gate's own default (`CLOSED_PROCESS_EVIDENCE_POLICY`, empty) and `currentProcessEvidence.server.test.ts`. No JSON under `tasks/artifacts` carries `requiredArtifactSHA256`.

**Finding (High for review quality):** these are **not bound**:
- `operation-1…5-SETTLED.json` and `*.TRANSPORT-OBSERVATION.json`, which hold every TLS fact;
- the packet's `MANIFEST.json` and `PLAN.json`;
- `CONVERSION.json`, which holds `pinsSHA256`, `verifierSHA256` and `nodeSHA256`.

So the accepted artifact set carries the conclusion (`TLSVerified: true` in the receipts) but not the observations it rests on. The reviewer must add those hashes to `requiredArtifactSHA256`, or the bridge must copy them as bound roles.

## Q7. Tests: PASS with findings

**Full suite in a scratch mirror:** **14/14 pass**, 167 s.
- The only symlinks were `web/` and the three read-only sibling folders.
- Test 14 passed inside the full run on a quiet machine.
- This supports Chef's stall explanation for the earlier 13/14, but does not prove it. The 120 s budget is still a timing-sensitive test.

**Mutations** (mirror only; `convert.mjs` restored byte-identical; details in `MUTATIONS.md`):
- **Caught, each by the intended case** (from the failing assertion in each log):
  - dropping `verifyTlsChain` → test 5 case 0, the unauthorized peer, which only the bridge checks;
  - dropping `checkRuntime` → test 5 case 7, the default CA store not the bundled roots;
  - dropping the 8-day term → the stale assertion;
  - dropping the same-day term → the same-day assertion.
- **Survived** (tests do not target them):
  - `< 8` changed to `<= 8`: no exact-boundary test, although my `repro-convert.mjs` shows the real code is correct;
  - dropping the mirror check: masked by the verifier's `provenance_tls_mismatch`;
  - dropping `observation_overclaims_tls`: masked by the verifier.
- **Consequence:** three bridge rules rely on the pinned verifier. Like `--pins`, the verifier is an unpinned CLI input; the bridge records its hash only in the unbound `CONVERSION.json`.

**Intended rows (288 − 54):**
- **Individual:** grounded in real bytes. I counted 54 dotted team cells (N.J, S.J and T.B, ×18 each) in the real counts page, and 54 WGO rows for NJD, SJS and TBL among 288.
- **On-ice:** "234" is **by construction**. The synthetic on-ice page is written by `fixtures.mjs` with the same dotted map, so it cannot test the team rule.

**Test side effects:** tests 12 and 13 **write into the bridge folder** (`REAL-BOXSCORE-CROSSCHECK.json` and `REAL-FIXTURE-LINEAGE.json`). That explains their 23:09 and 23:15 mtimes after Chef's rerun. The content is unchanged and SHA256SUMS still passes, but the README's run command is not read-only.

## Q8. Findings

### (a) CONFIRMED

- The final successor format converts: `forged_real_pins` uses the real successor pins and verifier, and test 14 uses the real runner bytes with successor fields injected.
- Chef's verifier `7816ec6a…` run on that packet gives `{"verdict":"vetoed","reasons":["possible_credential_echo:RUNTIME.json"]}` and nothing else.

### (b) CONFIRMED

`window_feasibility.py` rerun in scratch is byte-identical. An independent brute-force over evaluation times (`repro/window_indep.py`, 30-min steps, gate row order, all games-played values) gives **68/644** for source observation and **0/644** for current use. The span distribution is identical, and the minimum span is 7.

**The exact rules:**
- **Every member, from prep `:48`:** native retrieval R_i ∈ [D_i + 1 d 00:00Z, D_i + 8 d).
- **Source observation, from gate `:213-214`** (`asOf − earliest(native, frame, captures) ≤ 24 h`): E − 24 h ≤ R_min < D_min + 8 d, and E ≥ D_max + 1 d. **Feasible iff D_max − D_min ≤ 7.**
- **Current use, from gate `:215` with `:231`** (`today(E) − D ≤ maxEventAgeDays = 7`, where today = E's UTC date): together with `UTC-day(R) > D` (prep `:48`) and `R ≤ E` (gate `:204`), D_max + 1 ≤ day(E) ≤ D_min + 7. **Feasible iff D_max − D_min ≤ 6.**

**The 24 h and 8-day rules do not cause the 0/644.** It comes from the 7-day event age plus the strict "date before the retrieval day". The 0/644 is one snapshot, from the 2026-11-01 request, and depends on the schedule: a player with 5 games in 7 consecutive days would qualify.

**"The gate never shows a full window"** is true for a separate reason: `completeLatestFiveEstablished: false` and `currentUseQualified: false` are constants (`:262`, `:266`).

### (c) CONFIRMED

`real_fixture_lineage.py` rerun in scratch is byte-identical (54 held: NJD, SJS and TBL ×18), and so is my raw count above. `L.A → LAK` remains unverified on retained bytes.

### (d) CONFIRMED

Constants at `currentProcessEvidence.server.ts:262` and `:266`.

## Q9. Leakage: PASS

I built the set of 741 player names and 740 player IDs from the retained `CURRENT-REQUEST`, plus the last names of 5 or more letters.

**Scanned 27 files** (rerun after this folder was finished):
- the bridge folder, README, JSONs, `TESTS.log` and tests;
- Chef's `bridge-verification/` (FULL-SUITE-RERUN.log and NOTE.md);
- the author's diary;
- this folder.

The scan counted full names, last names (word-bounded), player IDs (digit-bounded) and secret patterns (`apikey`, `authorization:`, `bearer`, JWT `eyJ…`, `key=` not redacted, `sk-…`). **0 names and 0 player IDs.** The only secret-pattern matches are two in this REVIEW.md, and they are the pattern names written in this sentence.

The only identifier present is the Supabase project host, which is public. My reproducers use synthetic team codes and player IDs 1 and 2.

## Q10. Durability: PASS

- **Outputs:** `createOutput` gives a 0700 directory (`mkdirSync` fails on any existing path, including a symlink) and files opened with `"wx"` at 0600 and fsynced. `MANIFEST.json` is written last: temp + fsync, then hard link, unlink and a directory fsync. Observed: 0700/0600 in my outputs.
- **Refusals:** every check in `convertPacket` runs before `createOutput`, so a refusal leaves no directory. Tests 4 and 5 assert this, and my existing-`--out` case gives `EEXIST` with the target untouched.
- **Caveat:** the CLI prints EEXIST as a generic `bridge_error`.
- `frames.mjs` and `assemble.mjs` also validate before `createOutput`.

---

## Bridge ↔ SUCCESSOR.patch interface

**What the patch writes and the bridge requires: an exact match. This was executed, not only read.** I ran the successor `rehearse.ts` offline in a scratch tree: the patched `scripts/blsh`, with the rest of `web/` symlinked, `env -i` and 0 network attempts. Its packets bind runner `5dc46ec8…`. The bridge converted all three with the successor pins and verifier and `--node-sha256 daa77e22…` (synthetic class, because the rehearsal adapter is synthetic):
- `happy`;
- `tls_resumed_ok` (ops 4 and 5 resumed from 2 and 3);
- `tls_keepalive_ok` (ops 4 and 5 reuse 2 and 3).

The real `RUNTIME.json` from this machine showed default = bundled roots (116).

Schedule parsing agrees with the runner's `completedGames()`: same day filter, all games OFF or FINAL, sorted ids. Field paths match a retained real `/v1/schedule` body (2026-10-11, 7-day `gameWeek`).
- The field names, the `fhfh.blsh.native-capture-runtime.v1` version, the 15 `environmentPresence` keys and the 4 `adapterEnvironmentPresence` keys are identical.
- The binding semantics are identical: earliest full handshake; opener by sequence; `resumedFromOperation` and `connectionFromOperation` are null otherwise.
- The bridge also checks `defaultCACertificatesSHA256 == rootCertificatesSHA256`, which the verifier ignores.

**Facts the patch writes that the bridge ignores:**
- `peerCertificate.valid_from`, `valid_to`, `subjectCN` and `issuerCNChain` content, plus `cipher` and `alpnProtocol`. Low impact: `authorized` covers validity and hostname at handshake.
- `node.version` and `execPath`: covered by `execPathSHA256`.
- **Extra keys in RUNTIME.json are not rejected:** probe `runtime_extra_synthetic_marker` converts with `syntheticTestOnly: true`. Low, but the bridge should require an exact key set.

**Facts the bridge needs that the patch cannot supply:**
1. Proof that the **bootstrap** launched the run: entry script hash, cwd, `TS_NODE_*` and `OPENSSL_CONF` presence. RUNTIME omits all of these.
2. **Post-snapshot TLS state.** A per-dispatch re-read of `getCACertificates('default')`, or a dispatcher identity check, would close Q1c(1).
3. **`node_modules` integrity** beyond the bootstrap's entry-file pins.
4. **Any external, unforgeable witness of the run** (Q1b), for example a cross-check against the admission-ledger rows that ops 2 and 4 write.

**Coupling risk: `NST_JOB_LIFECYCLE_ENABLED`.**
- The bridge requires the key to be *absent* (`convert.mjs:45`).
- The adapter and bootstrap accept `"false"`, and the successor verifier does not check its presence.
- So a launcher that passes `=false` would produce a packet that passes the verifier but is refused by the bridge, after five live calls.
- The operator lane's `RUNTIME-RECEIPT-PLAN.md:45` already mandates "absent, or refuse to launch". Keep that, or align the verifier and bootstrap pre-dispatch checks.

---

## Overall recommendation

**Can the bridge process a live pilot packet? Yes, as a converter to candidate evidence pending independent review.** Its rules are correct and fail closed for every in-run TLS, runtime, scope, freshness, frame and durability case I tried. It must not be read as independent proof of TLS. `TLSVerified: true` certifies that the packet is internally consistent with a verified TLS run by the pinned code, nothing more.

**Exact preconditions:**
1. **Custody.**
   - The packet is produced by the pinned bootstrap `fe05a832…` in the approved slot, at its fixed `OUTPUT` path on this machine.
   - It is converted directly from that path.
   - It comes with an operator attestation naming the launcher hash, who ran it and when. It is never a copy received from elsewhere.
   - Optionally, the admission-ledger rows for ops 2 and 4 are matched as an external witness.
2. **Fixed inputs.** Use exactly:
   - `--pins` = successor `expected-pins.json` (`55a50c6d…`);
   - `--verifier` = `fc4e3d04…`;
   - `--node-sha256 daa77e22…`;
   - `--lineage` = `14e0816c…`.

   The reviewer confirms `producerSHA256 = aa6237bd…` and `redactorSHA256 = 1a568c28…` in both receipts.
3. **Environment.**
   - `node_modules` integrity is established before the slot, in a way TJ and Chef choose that does not invalidate the bootstrap's dependency pins.
   - The launcher does not set `NST_JOB_LIFECYCLE_ENABLED` and sets no override keys.
   - Use `/usr/local/bin/node` `daa77e22…` (verified today: default store = bundled roots).
4. **Bind the TLS basis.** The reviewer adds the sha256 of these to `requiredArtifactSHA256`, alongside the bridge's 261-style list:
   - every `operation-*-SETTLED.json`;
   - every `*.TRANSPORT-OBSERVATION.json`;
   - the packet `MANIFEST.json` and `PLAN.json`;
   - `CONVERSION.json`.
5. **Official frames.**
   - Boxscores for every game on 2026-11-11 (6 expected; the run-time schedule decides).
   - They come from a reviewed acquisition that records its own TLS observation.
   - A receipt whose only basis is `TLSVerified: true` written by hand is not acceptable.
6. **Timing.** For a capture at the 2026-11-17T14:05Z slot, gate evaluation must fall within 24 h of the **earliest** of the NST retrievals, the frame observations and the request captures, so no later than about 2026-11-18T14:05Z. The evaluation UTC date must be ≤ 2026-11-18 (11-11 + 7) for current use. The frames and `CURRENT-REQUEST` captures must fall inside that same 24 h.
7. **Expected holds.** Rows on dotted-code teams stay held until a reviewed team map ships in a new pinned lineage. The on-ice markup is unproven on real bytes until the live page is seen. Windows are never admitted (8d).
8. **Review and install.** An independent review artifact fills `reviewSHA256` and is appended to the required list. Installation is done by a policy owner other than the bridge lane.

## How to reproduce (all writes go to a scratch directory)

```bash
S=<scratch>; R=/Users/tim/Code/fhfhockey.com
# successor sources, no git:
mkdir -p $S/patched/web/scripts && cp -Rp $R/web/scripts/blsh $S/patched/web/scripts/ && (cd $S/patched && patch -p1 < $R/tasks/artifacts/blsh-successor-candidate-2026-11-15/SUCCESSOR.patch)
cd $R/tasks/artifacts/blsh-evidence-bridge-review-2026-11-15/repro
env -u GIT_DIR TMPDIR=$S/tmp node repro-convert.mjs $S/rc $S/patched/web      # Q1b, Q3, Q4, Q10, packet-level probes
env -u GIT_DIR TMPDIR=$S/tmp node repro-units.mjs [<proposal.json>]           # Q1a, runtime, frames, gate constructor
python3 -I window_indep.py <retained CURRENT-REQUEST.json>                     # 8b
```

- **Full suite:** mirror `tasks/artifacts/blsh-evidence-bridge-2026-11-15` into `$S/mirror/tasks/artifacts/`, symlink `web` and the three sibling folders, then run `env -u GIT_DIR TMPDIR=$S/t node --test tests/bridge.test.mjs` from the mirror.
- **Do not run it in place:** tests 12 and 13 write into the folder they run from.

# November 18 local pilot candidate

**Production update.** TJ approved the disabled deployment and both pinned migrations. The [production receipt](PRODUCTION-DEPLOY-RECEIPT.md) records the READY alias and public trade-page 404.

**Web candidate for a disabled deployment** `80af7e76c21b505eb2db12b93cbb936e78114143`, tree `712aef6a4efe9824e20acec6d47f01c13c8c72d0`. Local ref `refs/candidates/blsh-v6-hosted-pilot-20261120`. The [go/no-go packet](PILOT-APPROVAL.md) names the proposed date, owners and both approval decisions. **Actual enabled-release SHA is pending the shared owners' joint registration.** Re-pin and review that integration before signing anything.

| Release evidence | Exact pin |
| --- | --- |
| Observed GitHub master / READY production parent | `50dea27b84a34b05a1aa6e67dc24d2774e5d3f24`, Vercel `dpl_Ar31rHkggarnGjwv6Xb4SGZrbnBr`, iad1 |
| Original [38-file patch](LOCAL-CANDIDATE.patch) / original [file pins](SHA256SUMS) | SHA-256 `c2ff373154e49c1c5111d052823c5e70131b97aafb19b785fb3605c64b385295` / `4752448bf633116f2d4fa3b02f9b01f6a063e53d87e9d05884d5bad34dc35455` |
| Reviewed BLSH on production parent | Commit `e3d06efa053efe70d2d0af89a595a656a73e97fb`; all 38 reconstructed blobs matched. The only changes between the original packaging commit `328a328089cb64716587667b1a89ab72db70dd68` and this reconstruction are the production Rankings files `rankingQueries.ts`, its test and `rollingWindowCountSupportReader.ts`. |
| [Hosted pilot delta](HOSTED-PILOT.patch) from `e3d06efa` | SHA-256 `29d6f17725a3decc2bee84816c93d06805c570020b79e9fc01ed23664bc7b0be`, 24 paths. Reapplying in an isolated index reproduced the candidate tree exactly. |
| [All 56 release file pins](PILOT-SHA256SUMS) | SHA-256 `d572f8b1640c5508f2de4dedd3d3e552d3f78df69eae46fcd9323634e6a7da4e`. All candidate blobs compared byte-for-byte with the tested files. |
| [Portable Git bundle](BLSH-PILOT.bundle) | SHA-256 `6342ab9df073372882b7af43a60c203cc5a7683789f880748b692e96f82283a8`. `git bundle verify` passed. Only prerequisite is the production parent above. No branch in the shared checkout was moved to create this candidate. |

**What changed after the 38-file review.** Six reviewed paths changed. The request store exports its existing bounded transport. The official CLI shares its single-attempt HTTPS transport with the Vercel handler. The frame CLI, held consumer, evidence comparison and adjacent test support the hosted receipt class. Earlier v2 direct-host archives retain exact-source replay. The remaining additions are the hosted endpoint, private DB custody, offline verifier, tests and separately applied operator controls. Trade page, preview, five-game gate, scorer and snapshot adapter retain the reviewed bytes.

## Database and operator pins

| Target | File SHA-256 | Disposition |
| --- | --- | --- |
| `20261116000000_blsh_native_capture_v6.sql` | `4e896a891d02543a5a500597c7ce97d745e6a724d1c5100de1a7a2e8c9250c70` | 153, applied Nov 16 |
| `20261116000100_blsh_request_context_v1.sql` | `920e3430a89d1c91ac5899f52a2a606563d6e6f700f77e1750dbf5511089642b` | 154, applied Nov 16 |
| `20261118131414_blsh_request_context_custody.sql` | `db35ba0993d110a10dc2a7eb9e54b5b39cf7ed7415d14b3522283b2cb62b8e9f` | First new transaction; exact approval and readback pending |
| `20261118155445_blsh_official_pilot.sql` | `dd204d114dd83befab28cc17477f77a80ab8f40c96edbcdf27eb9759a2adc220` | Second new transaction; depends on the first |
| [Native interlock install](pilot-control/INSTALL.sql) | `713b2573d394fdb0fe9f2d0a6cae7c18be65e034552e96d4dbe97518ec257e0b` | Separate operator transaction with raw switch off |
| [Native arm](pilot-control/ARM.sql) | `2adc8acfacfa9ce7ec1a0f3ec501f7a0a50e4e195fff8aeedbabbbd43f44d43f` | Further TJ approval, fixed release and deployment pins |
| [Native disarm and rollback](pilot-control/DISARM-ROLLBACK.sql) | `4d024a1c6e6cb8bf5a6904cb9b180cb6e1fb755fef424ce5e6fa703f3e6a8a6a` | Returns original switch function, raw and effective off; retains rows |
| [Official one-time dispatch](official-dispatch/SCHEDULE-ONCE.sql) | `e02b4ffc6179c5be55087a0294539bedb1af0b8497b16dae5e5ae9723bc821d8` | Unregistered. Requires native/context success and signed grant |
| [Operator's Nov 19 checklist](PART-B.md) | `185ccfb96d3f611d29a721dcdb46e10bd16a2f4bdc675a807ce752011c789d04` | Two disabled-path observations pending |

The candidate changes no Vercel schedule, shared NST configuration or project setting. The new Pages handler carries `maxDuration: 240` and `bodyParser: false`; Next.js static-info parsing verified the setting. Only the two public verification keys described in the packet would be added in the specifically approved keyed deployment. The original registration receipt and joint-registration instructions are linked in the packet.

## Offline checks

- Retained from the 38-file independent review: 120 focused cases, eight disposable PostgreSQL groups and one selected production-mode trade-page 404 check. The final changed-path run was **65/65** on Node 22.23.4 (8 signed official handler, 5 official store, 52 official/held-observation cases). These counts overlap the earlier coverage. Scoped TypeScript, ESLint and JS syntax checks passed in the relevant lanes.
- The actual signed handler and concrete store used fixture database RPCs and a loopback TLS peer for two games. The offline frame and held consumer preserved the exact run, index and eight objects. Missing, wrong-game, corrected, late, re-sealed or mismatched evidence and fixture TLS under the production policy were refused. A fixture replayed the exact archived pre-extraction tool. The retained real Burns and Perron examples gained zero current witnesses.
- Disposable PostgreSQL 15 separately exercised the actual official migration, full four-MiB original byte roundtrip, role/immutability checks, manifest order and parallel claims. Twelve contention cases exercised clocks at the write boundary. A fresh independent two-connection check proved a claim one microsecond past expiry leaves no row. A success-close one microsecond late leaves the row claimed, terminal fields null, and the eight existing originals intact. Source and fixture SQL proof hashes are in the manifest.
- The held consumer now rejects a journal whose recorded start precedes the previous indexed write. Independently reconstructed, otherwise self-consistent evidence reproduced the earlier acceptance and exercised the fix. Database timestamps are transition observations. The producer requires a successful journal acknowledgement before dispatch; a lost acknowledgement halts that stage.
- Disposable PG checks exercised the native date fence, wrong pins, primary, backup, expiry, disarm and restoration. A separate pg_cron/pg_net stub exercised one correlated GET, duplicate suppression, missing grant, refused enqueue, late and next-year expiry, and self-removal. These are compatibility checks; managed PostgREST envelope limits, actual provider timing, cold runtime identity and an independent real export still require their designated owners.
- No production database reads, migration applications, provider traffic, cron/flag changes, deployment-triggering pushes or deployments by this lane. Read-only Git and Vercel control-plane metadata supplied the release baseline and duration settings. The operative status for November 17 v5 remains unknown.

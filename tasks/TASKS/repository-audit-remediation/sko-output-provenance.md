# sKO output provenance contract

Decision date: 2026-08-19

## Authority

The model owner selected `web/scripts/output/` as the canonical output root. From the `web/` working directory, producers and consumers must use `scripts/output/`. The nested `web/web/scripts/output/` tree is retained historical evidence and is not a fallback or output target.

No current executable producer or runtime consumer for these four sKO artifacts exists in the repository. The deleted implementation's trustworthy run identifiers are unavailable, so both retained sets record that uncertainty explicitly instead of inferring provenance from paths or timestamps. Reactivation must update `web/scripts/sko-output-authority.ts` and establish a new evidenced run identity before producing or consuming files.

## Opaque artifact receipt

The files were measured and SHA-256 hashed without parsing Parquet payloads or running any model code.

| Role | Repository-relative path | Bytes | SHA-256 | Run metadata |
| --- | --- | ---: | --- | --- |
| Canonical | `web/scripts/output/sko_features.parquet` | 8,149,757 | `f857dc15ba0eb667aa02f59c9eb26c5223e34cf96e02dbff5625d72fdd7db4a5` | Unknown; retained set `retained-sko-output-canonical-2026-08-19` |
| Canonical | `web/scripts/output/sko_holdout_predictions.parquet` | 5,148,288 | `5470f2aa8a2db12602a5170dd69f8fe7d97bed6f61d4e64fb6dcc5539c8e10bb` | Unknown; retained set `retained-sko-output-canonical-2026-08-19` |
| Canonical | `web/scripts/output/sko_metrics.parquet` | 9,738 | `fb1d87570e5da7752dc43ae8b975644ac703b24b0edc672a6c77d591a6f9a16f` | Unknown; retained set `retained-sko-output-canonical-2026-08-19` |
| Canonical | `web/scripts/output/sko_step_timings.csv` | 1 | `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b` | Unknown; retained set `retained-sko-output-canonical-2026-08-19` |
| Historical | `web/web/scripts/output/sko_features.parquet` | 7,720,797 | `8dc4893b58176fdcada015c062ccc74910a2172051449a7674373e30696f03d3` | Unknown; retained set `retained-sko-output-nested-history-2026-08-19` |
| Historical | `web/web/scripts/output/sko_holdout_predictions.parquet` | 3,203,990 | `8d2995c10d3b48a5c24e5a9383450a032520fa1ea26dbbe4a2fcc01415aaee45` | Unknown; retained set `retained-sko-output-nested-history-2026-08-19` |
| Historical | `web/web/scripts/output/sko_metrics.parquet` | 9,002 | `6c0d8cd48909b032a1b61b657f54cf6e46704e79cc9788cda269a12ca0fb26f7` | Unknown; retained set `retained-sko-output-nested-history-2026-08-19` |
| Historical | `web/web/scripts/output/sko_step_timings.csv` | 1 | `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b` | Unknown; retained set `retained-sko-output-nested-history-2026-08-19` |

Three same-named Parquet pairs are distinct. The one-byte timing files are byte-identical, but that does not establish common run provenance. Both trees remain unchanged; deletion, movement, payload inspection, training, inference, and artifact regeneration are outside this decision.

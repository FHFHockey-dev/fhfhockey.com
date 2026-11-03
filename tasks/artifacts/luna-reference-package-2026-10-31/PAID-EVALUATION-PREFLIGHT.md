# Paid evaluation preflight — historical record

**Latest outcome supersedes this preflight:** TJ confirmed exposed-key revocation/replacement, independent R2 review passed, fresh scope/funding and historical exposure were verified, and two paid synthetic requests completed. E01 omitted its expected goalie status; the batch stopped with its continuation ledger disabled, no retry and no new uncertain outcome. See [paid-evaluation/HANDOFF.md](paid-evaluation/HANDOFF.md). All observations and pending gates below describe earlier checkpoints.

**Later checkpoint:** second audit repairs and both synthetic-only rehearsals pass; see [repair-r2/HANDOFF.md](repair-r2/HANDOFF.md). Independent re-review and current balance/scope/ledger reconciliation remain pending. TJ confirms the key is saved and explicitly chooses a non-expiring restricted evaluation key, superseding the local 24-hour proposal below; [CREDENTIAL-HANDOFF.md](repair-r2/CREDENTIAL-HANDOFF.md) records the verified rotation gate before production. The separate key worker's Terminal denial was not retried. No key was read/used or paid call made by this worker. Observations below are historical, not fresh access/balance verification or execution clearance.

TJ authorized bounded paid Luna testing on October 31, conditional on protecting purchased credits. This supersedes the original task's no-paid-call boundary for qualified evaluations only; hosted dispatch, publishing and deployment remain unauthorized. New credentials or expanded persistent access still require action-time approval.

Read-only OpenAI Platform checks in the signed-in funded organization showed:

- Active subscription grant: **$85.00 remaining of $85.00**, expires **November 13, 2026**.
- Purchased balance: **$10.00 remaining of $10.00**, separate from the grant.
- Total available: **$95.00**; grant page showed no consumed credit at this observation.
- Auto-reload is on at the existing $5 threshold. It was not changed and cannot serve as the evaluation cutoff.
- The only OpenAI key in the known application environment (`web/.env.local`) matches the dashboard's **expired FHFH IFTTT evaluation key**, expiry **October 26, 2026, 19:14:21 UTC**. Only key type/presence and a masked suffix were inspected; no secret is recorded in this artifact or tool output.
- Its existing permissions are `api.responses.write`, `api.responses.read` and `api.decisions.write` in the FHFH IFTTT project. A separate active Test Project key exists in the dashboard, but its secret is not available in the checked application environment; it was not created, edited, revealed or used.
- Luna organization limits shown: 2,000,000 TPM and 5,000 RPM. The $100 organization spend setting is explicitly **not enforced**; it is not a hard safety boundary. No settings were changed.

Official [subscription-credit documentation](https://developers.openai.com/api/docs/guides/chatgpt-api-credits) confirms that free credit is used first, then purchased credit automatically. The [prepaid-billing guide](https://help.openai.com/en/articles/8264644-setting-up-and-managing-prepaid-api-billing) warns that balance processing is not an instantaneous spending cutoff. An explicit local admission cap is required; account balance alone is insufficient.

## Concrete bounded first batch, pending access

- Exact model: `gpt-6-luna`; existing Standard transport, reasoning `none`, no tools, storage off, no implicit retries, concurrency one, one request at a time.
- At most **20 admitted requests**: 16 synthetic identity/goalie Responses cases, plus the existing Decisions leg on four of those retained synthetic packets. No production reports, database access, live IFTTT intake, hosted worker or publication.
- Coverage: explicit starter, explicit not-starting, first-off, practice attendance, warmup attendance, explicit warmup starter, backup, conditional wording, identity collision, prompt injection, mixed subjects, correction/contradiction, historical scope, PP/lineup context, Unicode evidence and missing candidate. Existing regression data is exposed development material; this batch is not an independent holdout.
- Budget: propose **$1 total aggregate exposure ceiling**, including the earlier **$0.262519843** historical exposure conservatively carried forward (including the unresolved reservation). New exposure cannot exceed **$0.737480157**. The old stopped ledger stays untouched; a reviewed continuation must preserve its unknown outcome, not erase or reclassify it as zero. No continuation ledger has been created.
- Existing per-request reservation is **$0.233**; max 2,048 output tokens, 64 KiB request / 256 KiB response limits, 15-second timeout. Fresh admission checks the aggregate cap before key lookup. A timeout, malformed usage/model, uncertain billing, stop flag or failed admission stops the entire batch without retry.
- For these small payloads, 20 maximum-size requests are conservatively estimated below **$0.17** at 64K input tokens and 2,048 output tokens per request, including a 10% regional allowance; actual normal inputs should be smaller. This estimate is not an invoice or an admission override. The larger existing reservation and aggregate ledger enforce the hard local ceiling.
- Recheck remaining promotional credit, expiry and concurrent organization spend immediately before execution. Stop if verified promotional headroom no longer exceeds the aggregate ceiling plus a **$5 safety reserve**. This condition and the small local cap protect purchased credit; if concurrent spending or grant attribution makes that protection uncertain, do not dispatch.
- Freeze package/input hashes and expected field labels before execution. Log request IDs, response model/status, usage, calculated cost, elapsed time, exact submitted payload hash, validation outcomes and per-field identity/status/evidence/abstention errors. Read the account usage/balance afterward; label usage-derived cost versus posted billing separately.
- Initial source selection: newly authored synthetic reports/candidates only. Use the exact versioned rules with a clearly labelled `rules-and-synthetic-only` evaluation variant omitting S01–S10 records/labels from the submitted envelope. Record the actual submitted hash and do not claim this measures the complete example package. This avoids depending on unestablished external-use rights for the retained excerpts; full-package evaluation remains separate until that provenance/rights question is settled.

Current [Luna model documentation](https://developers.openai.com/api/docs/models/gpt-6-luna) still supports `none` reasoning and structured output. [Standard pricing](https://developers.openai.com/api/docs/pricing) is $0.10/M input and $0.50/M output for short prompts; [Decisions](https://developers.openai.com/api/docs/guides/decisions) charges input only. No model substitution or transport-pricing change was made.

## Exact blocker and next action

**Pending, not denied:** execute paid `/v1/responses` and `/v1/decisions` evaluation requests in the funded organization. The available local credential is expired. No credential or model request was attempted, so there is no uncertain execution outcome or new cost.

To proceed, provide access to an existing active, appropriately scoped key for the funded organization, or obtain action-time approval for a short-lived replacement in **FHFH IFTTT**, preserving only Responses read/write and Decisions write permissions. A proposed replacement should expire within 24 hours. Do not grant organization administration, billing, broad model/tool access or persistent access as part of this evaluation.

The local prompt/reference implementation remains complete with **204 offline tests passed**. This follow-up changed only preflight notes and the task diary; the synthetic model evaluation remains blocked on access. Paid requests: **0**. New estimated/actual model spend: **$0**. Credentials created/changed: **0**. Billing settings changed: **0**. No approval-review denial occurred.

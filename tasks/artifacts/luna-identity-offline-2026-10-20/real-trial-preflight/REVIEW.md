# Preflight consistency review

Implementer review only; no independent acceptance or final-wire review is claimed. The parent receives a concrete proposal and the explicit missing data boundary.

- Source S06 bytes/metadata are retained unchanged. Candidate names are traced to an existing unit fixture, fake IDs excluded, owner-supplied development names retained, canonical IDs null.
- Exactly one Responses request, fixed gpt-6-luna/default/none/1024, no tools, cache breakpoints, retry, paid widening, Decisions fan-out, provider/account probe or dispatch during preparation.
- Cache control is an actual documented API field; explicit mode with no breakpoints prevents cache-write charges. Model maximum context bounds all input, including schema/framing; no tokenizer or byte estimate is used as a billing ceiling.
- Integer reserve 231844800 + existing exposure 262177193 =494021993 <=520000000. Original unknown reserve 254394800 and block remain intact. A second request is outside this proposed scope.
- Existing transport basic_limits accepts these fixed model/tier/reasoning/output/tools/store values. New input/schema must be bound and validated before using post_once; the old extraction parser and downstream reviewer are not reused as identity parsers.
- Transactional admission is specified against the original aggregate; no rw connection, authorization insertion, reservation, key loader or HTTP execution occurred here.
- Final request/candidate hashes are null and dispatch false, correctly reflecting missing canonical data. No ungraded local player row or owner's labels are smuggled into an approved directory/model input.
- Required final checks: freeze the bounded neutral directory and owner labels separately; evaluate retrieval without answer-driven additions; bind/inspect exact wire schema and runtime; recheck unchanged ledger baseline; accept only this scope through the existing reviewed continuation pattern.

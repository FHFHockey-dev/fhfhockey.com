"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEvidenceRowSHA256 = exports.CLOSED_PROCESS_EVIDENCE_POLICY = void 0;
exports.createCurrentProcessEvidenceGate = createCurrentProcessEvidenceGate;
/** Server-only byte boundary. No network, filesystem, scorer or source mutation. */
const node_crypto_1 = require("node:crypto");
const currentInput_1 = require("./currentInput");
exports.CLOSED_PROCESS_EVIDENCE_POLICY = Object.freeze({ acceptances: Object.freeze([]) });
const digest = (bytes) => (0, node_crypto_1.createHash)("sha256").update(bytes).digest("hex");
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
class GateFailure extends Error {
}
const need = (value, reason) => { if (!value)
    throw new GateFailure(reason); };
const time = (value) => {
    need(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value), "invalid_evidence_time");
    const result = Date.parse(value), calendarDay = Date.parse(value.slice(0, 10));
    need(Number.isFinite(result) && Number.isFinite(calendarDay) && new Date(calendarDay).toISOString().slice(0, 10) === value.slice(0, 10), "invalid_evidence_time");
    return result;
};
const decode = (bytes, maxBytes) => {
    need(bytes.byteLength > 0 && bytes.byteLength <= maxBytes, "artifact_byte_bound");
    try {
        return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    }
    catch {
        throw new GateFailure("invalid_artifact_json");
    }
};
function canonical(value) {
    if (value === null || typeof value === "string" || typeof value === "boolean")
        return JSON.stringify(value);
    if (typeof value === "number") {
        need(Number.isFinite(value), "invalid_row_number");
        return JSON.stringify(value);
    }
    if (Array.isArray(value))
        return `[${value.map(canonical).join(",")}]`;
    need(typeof value === "object" && value !== null, "invalid_row_value");
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}
const processEvidenceRowSHA256 = (row) => digest(Buffer.from(canonical(row)));
exports.processEvidenceRowSHA256 = processEvidenceRowSHA256;
/** A reviewed policy binds exact bytes, not caller claims of "verified".
 * This loader verifies bindings and consumption, not the native HTML semantics:
 * that separate review must cover exact cells, conversions, model and scope.
 */
function createCurrentProcessEvidenceGate(policy = exports.CLOSED_PROCESS_EVIDENCE_POLICY) {
    const acceptances = structuredClone(policy.acceptances);
    need(acceptances.length <= 100, "acceptance_bound");
    const accepted = new Map();
    for (const a of acceptances) {
        need(hash(a.bundleSHA256) && hash(a.requestSHA256) && hash(a.reviewSHA256) &&
            a.reviewScope === "exact_rows_native_cells_scope_and_model" &&
            a.requiredArtifactSHA256.length > 0 && a.requiredArtifactSHA256.length <= 10000 &&
            a.requiredArtifactSHA256.every(hash) && new Set(a.requiredArtifactSHA256).size === a.requiredArtifactSHA256.length &&
            a.requiredArtifactSHA256.includes(a.reviewSHA256) && !accepted.has(a.bundleSHA256), "invalid_server_acceptance_policy");
        accepted.set(a.bundleSHA256, a);
    }
    // The server supplies its evaluation time; frozen request.asOfUTC never acts
    // as an indefinitely fresh clock for a later application read.
    return (requestBytes, evaluatedAtUTC, bundleBytes = null, artifacts = new Map()) => {
        const request = decode(requestBytes, 32 * 1024 * 1024);
        need(time(evaluatedAtUTC) >= time(request.asOfUTC), "evaluation_precedes_source_request");
        const raw = (0, currentInput_1.qualifyCurrentInputs)({ ...request, asOfUTC: evaluatedAtUTC });
        const witnesses = new Map();
        const verified = new Map();
        const globalReasons = [];
        let acceptance;
        try {
            need(bundleBytes !== null, "native_evidence_not_supplied");
            need(bundleBytes.byteLength <= 8 * 1024 * 1024, "bundle_byte_bound");
            acceptance = accepted.get(digest(bundleBytes));
            need(acceptance, "native_evidence_not_independently_accepted");
            need(digest(requestBytes) === acceptance.requestSHA256, "accepted_capture_bytes_changed");
            let totalBytes = 0;
            for (const expected of acceptance.requiredArtifactSHA256) {
                const bytes = artifacts.get(expected);
                need(bytes && bytes.byteLength > 0 && bytes.byteLength <= 8 * 1024 * 1024, "accepted_artifact_missing_or_oversized");
                totalBytes += bytes.byteLength;
                need(totalBytes <= 64 * 1024 * 1024, "evidence_total_byte_bound");
                const copy = Uint8Array.from(bytes);
                need(digest(copy) === expected, "accepted_artifact_hash_mismatch");
                verified.set(expected, copy);
            }
            const bundle = decode(bundleBytes, 8 * 1024 * 1024);
            need(bundle.version === "fhfh.blsh.reviewed-process-evidence.v1" && bundle.sourceRequestSHA256 === acceptance.requestSHA256, "bundle_contract_or_capture_mismatch");
            need(Array.isArray(bundle.witnesses) && bundle.witnesses.length > 0 && bundle.witnesses.length <= 10000, "empty_or_excessive_witnesses");
            const ids = new Set(raw.records.map(r => r.record.id));
            for (const w of bundle.witnesses) {
                need((w.group === "individual" || w.group === "onIce") && Number.isSafeInteger(w.wgoSourceId) &&
                    Number.isSafeInteger(w.processSourceId) && w.processSourceId > 0 && ids.has(w.wgoSourceId), "invalid_witness_scope");
                const key = `${w.wgoSourceId}|${w.group}`;
                need(!witnesses.has(key), "duplicate_row_witness");
                witnesses.set(key, w);
            }
        }
        catch (error) {
            globalReasons.push(error instanceof GateFailure ? error.message : "invalid_provenance_bundle");
            witnesses.clear();
            verified.clear();
        }
        const records = raw.records.map(row => {
            const record = row.record;
            const qualifyGroup = (group) => {
                const original = row[group];
                const reasons = [...globalReasons];
                let availableAtUTC = null;
                let oldestEvidenceAtUTC = null;
                try {
                    need(reasons.length === 0, "unaccepted_bundle");
                    const w = witnesses.get(`${record.id}|${group}`);
                    need(w, "no_exact_row_witness");
                    need(original.observed.length === 1, "missing_or_ambiguous_captured_process_row");
                    const observed = original.observed[0];
                    need(w.processSourceId === observed.id && w.playerId === record.player_id && w.gameId === record.game_id &&
                        w.date === record.date && w.team === record.team_abbrev &&
                        w.wgoRowSHA256 === (0, exports.processEvidenceRowSHA256)(record) && w.processRowSHA256 === (0, exports.processEvidenceRowSHA256)(observed), "row_or_identity_drift");
                    for (const sha of [w.nativeBodySHA256, w.nativeReceiptSHA256, w.producerSHA256, w.redactorSHA256, w.definitionSHA256, w.officialFrameSHA256]) {
                        need(hash(sha) && verified.has(sha), "witness_artifact_not_bound_by_acceptance");
                    }
                    need(w.nativeValuesMatched === true, "native_cells_not_matched");
                    need(w.qualifiedScope?.strengthScope === "all_strength" && w.qualifiedScope.dateMeaning === "game_date" &&
                        w.qualifiedScope.toiUnit === "seconds", "reviewed_native_semantics_unqualified");
                    const receipt = decode(verified.get(w.nativeReceiptSHA256), 64 * 1024);
                    need(receipt.status === "success" && receipt.httpStatus === 200 && receipt.TLSVerified === true &&
                        receipt.representation === "parser_input_after_redaction" && receipt.parserInputSHA256 === w.nativeBodySHA256 &&
                        receipt.parserInputBytes === verified.get(w.nativeBodySHA256).byteLength &&
                        receipt.producerSHA256 === w.producerSHA256 && receipt.redactorSHA256 === w.redactorSHA256 &&
                        receipt.toiParsingContract === "minutes_decimal_or_mmss_to_seconds_half_up", "native_transport_or_representation_unqualified");
                    const url = new URL(receipt.url);
                    const expected = { fromseason: "20262027", thruseason: "20262027", stype: "2", sit: "all", score: "all",
                        stdoi: group === "individual" ? "std" : "oi", rate: "n", team: "ALL", pos: "S", loc: "B", toi: "0",
                        gpfilt: "gpdate", fd: record.date, td: record.date, lines: "single", draftteam: "ALL" };
                    need(url.protocol === "https:" && ["data.naturalstattrick.com", "www.naturalstattrick.com"].includes(url.hostname) &&
                        !url.username && !url.password && (!url.port || url.port === "443") && !url.hash && url.pathname === "/playerteams.php" &&
                        Object.entries(expected).every(([key, value]) => url.searchParams.getAll(key).length === 1 && url.searchParams.get(key) === value) &&
                        [...url.searchParams.keys()].every(key => Object.hasOwn(expected, key) || key === "tgp") && url.searchParams.getAll("tgp").length <= 1, "native_date_strength_or_unit_scope_unqualified");
                    const frame = decode(verified.get(w.officialFrameSHA256), 64 * 1024);
                    need(frame.seasonId === 20262027 && frame.playerId === w.playerId && frame.gameId === w.gameId &&
                        frame.date === w.date && frame.team === w.team && frame.final === true && frame.gamesPlayed === 1 &&
                        Number.isSafeInteger(frame.totalToiSeconds) && frame.totalToiSeconds > 0 && frame.totalToiSeconds === record.toi_per_game &&
                        frame.totalToiSeconds === observed.toi, "official_identity_or_exposure_hold");
                    const nativeTime = time(receipt.retrievedAtUTC), frameTime = time(frame.observedAtUTC), asOf = time(evaluatedAtUTC);
                    need(frame.date <= frame.completedByUTC.slice(0, 10) && time(frame.completedByUTC) <= nativeTime &&
                        time(frame.completedByUTC) <= frameTime && nativeTime <= asOf && frameTime <= asOf, "evidence_chronology_unqualified");
                    availableAtUTC = new Date(Math.max(nativeTime, frameTime)).toISOString();
                    oldestEvidenceAtUTC = new Date(Math.min(nativeTime, frameTime)).toISOString();
                    const relevantFeeds = [request.calendar, request.wgo, request[group]];
                    need(relevantFeeds.every(Boolean), "current_use_capture_unavailable");
                    const captureTimes = relevantFeeds.map(feed => time(feed.capture.retrievedAtUTC));
                    const today = Date.parse(new Date(asOf).toISOString().slice(0, 10));
                    need(captureTimes.every(t => t <= asOf) &&
                        (asOf - Math.min(nativeTime, frameTime, ...captureTimes)) / 3600000 <= request.freshnessPolicy.maxCaptureAgeHours &&
                        (today - Date.parse(record.date)) / 86400000 <= request.freshnessPolicy.maxEventAgeDays, "current_use_evidence_stale_or_unknown");
                }
                catch (error) {
                    if (!reasons.length)
                        reasons.push(error instanceof GateFailure ? error.message : "invalid_row_provenance");
                }
                const provenanceReasons = [...new Set(reasons)].sort();
                const scopeReasons = new Set(["unqualified_strength_scope", "unqualified_date_meaning", "unqualified_exposure_unit"]);
                const retained = provenanceReasons.length ? original.reasons : original.reasons.filter(reason => !scopeReasons.has(reason));
                const combined = [...new Set([...retained, ...provenanceReasons])].sort();
                return { qualified: combined.length === 0, reasons: combined,
                    provenance: { state: provenanceReasons.length ? "withheld" : "exact_reviewed_row_provenance", reasons: provenanceReasons,
                        availableAtUTC, oldestEvidenceAtUTC, originalPublicationUTC: null,
                        acceptedReviewSHA256: provenanceReasons.length ? null : acceptance.reviewSHA256 } };
            };
            return { ...row, individual: { ...row.individual, ...qualifyGroup("individual") }, onIce: { ...row.onIce, ...qualifyGroup("onIce") },
                rawProcessQualification: { individual: { qualified: row.individual.qualified, reasons: [...row.individual.reasons] },
                    onIce: { qualified: row.onIce.qualified, reasons: [...row.onIce.reasons] } } };
        });
        return { ...raw, version: "fhfh.blsh.current-process-provenance-gate.v1", sourceRequestAsOfUTC: request.asOfUTC, records,
            coverage: { ...raw.coverage, individualQualified: records.filter(r => r.individual.qualified).length,
                onIceQualified: records.filter(r => r.onIce.qualified).length },
            rawInputQualificationPreservedSeparately: true, sourceDataChanged: false,
            score: null, trusted: false, productionAdopted: false };
    };
}

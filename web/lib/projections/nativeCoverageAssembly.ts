import { parse as parseHtml, HTMLElement } from "node-html-parser";
import { z } from "zod";
import { NATIVE_COVERAGE_PROOF_VERSION, NATIVE_COVERAGE_SPAN_PROOF_VERSION, NATIVE_PLAYER_COVERAGE_DOMAIN_HASH,
  nativeCoverageTextHash, nativeCoverageLocationValue, nativeCoverageRawObservationSchema,
  nativeCoverageProofSchema, nativeCoverageHistoryBodySchema, checkNativeCoverageProof, checkNativeCoverageHistory,
  type NativeCoverageRawObservation, type NativeCoverageSourceLocation, type NativeCoverageSpanProof,
  type NativeCoverageHistoryBody } from "./nativePlayerCoverage";
import { nativeCoverageKernelSourceBodySchema, type NativeCoverageKernelSourceBody } from "./nativePlayerCoverageKernel";

/** In-memory source assembly only. No capture imports, population selection, model calls or issuance. */
export const NATIVE_COVERAGE_ASSEMBLY_VERSION = "native-coverage-assembly-v1";
type Span = Extract<NativeCoverageSourceLocation, { kind: "utf8_byte_span" }>;
type HtmlField = { location: Span; expectedText: string };
type Link = NativeCoverageSpanProof["links"][number];
type Finding = { kind: "invalid" | "unknown"; code: string; path: string };
type SourceExpectation = Omit<NativeCoverageRawObservation, "bodyUtf8">;
const diagnosticPurpose = "local_private_unpublished_research_transform" as const;
/** The caller supplies this from an independently approved record, never from the plan or source. */
export type NativeCoverageDiagnosticUseExpectation = {
  purpose: typeof diagnosticPurpose; expectedApprovalHash: string; approvedRecordUtf8: string | null;
};
type DiagnosticUse = {
  status: "authorized_by_existing_user_task" | "unknown" | "invalid"; purpose: typeof diagnosticPurpose;
  approvalHash: string | null; thirdPartyRights: "unknown"; scientificAdmission: "withheld"; findings: Finding[];
};
const diagnosticOperations = ["local_retention_of_exact_retained_bodies", "local_private_parse_and_normalization",
  "source_hash_and_span_binding", "serialization_of_unpublished_source_proof_proposals", "private_mechanics_diagnostics"] as const;
const diagnosticRecord = z.object({ version: z.literal("native-private-diagnostic-task-authorization-v1"),
  purpose: z.literal(diagnosticPurpose), decision: z.literal("authorized_under_existing_user_task"),
  authorityKind: z.literal("first_party_task_authorization_only"),
  permittedOperations: z.array(z.enum(diagnosticOperations)).min(1).max(5).refine(value => new Set(value).size === value.length
    && diagnosticOperations.slice(1, 4).every(operation => value.includes(operation))),
  limits: z.object({ newNetworkCollection: z.literal(false), newDBReadOrWrite: z.literal(false), publicDisplay: z.literal(false),
    redistribution: z.literal(false), commercialServing: z.literal(false), forecastIssuance: z.literal(false), productionServing: z.literal(false),
    modelCalculation: z.literal(false), modelFitting: z.literal(false), modelDefaultsOrWeights: z.literal(false), scientificQualification: z.literal(false),
    automaticProofAdmission: z.literal(false), publicationDeploymentOrPush: z.literal(false) }).strict(),
  thirdPartyRights: z.object({ retentionTransformationLicense: z.literal("unknown"), redistribution: z.literal("unknown"),
    publicDisplay: z.literal("unknown"), commercialUse: z.literal("unknown"), serving: z.literal("unknown"),
    noThirdPartyLicenseAssertion: z.literal(true) }).passthrough(),
  retainedSources: z.array(z.object({ proofId: z.string().min(1).max(256), origin: z.string().url().max(2000),
    body: z.object({ sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().positive().safe() }).passthrough() }).passthrough()).min(1).max(1000),
}).passthrough();
export type NativeCoverageAssemblyPlan = {
  proofId: string; targetGameId: number; teamId: number; cutoffAt: string; transformation: NativeCoverageSpanProof["transformation"];
  expectedContributors: SourceExpectation[];
  // An independent observation/population plan, never an estimator approval or inferred census.
  expectedRowIds: string[] | null; censusComplete: boolean | null;
  // A request alone cannot authorize use; the trusted expectation is a separate function argument.
  diagnosticUse?: { purpose: typeof diagnosticPurpose };
};
export type NativeCoverageAssemblyResult = {
  version: typeof NATIVE_COVERAGE_ASSEMBLY_VERSION; status: "blocked" | "proposed_for_independent_review";
  proof: NativeCoverageSpanProof | null; findings: Finding[]; qualificationEligible: false;
  independentOutputContractRequired: true; sourceSemanticsApproval: "not_established"; modelInputs: "withheld";
  diagnosticUse?: DiagnosticUse;
};
const normalText = (value: string) => value.replace(/\s+/g, " ").trim();

function checkDiagnosticUse(request: NativeCoverageAssemblyPlan["diagnosticUse"], contributors: NativeCoverageRawObservation[],
  trusted: NativeCoverageDiagnosticUseExpectation | undefined): DiagnosticUse | undefined {
  if (request === undefined) return;
  const result = (status: DiagnosticUse["status"], code?: string): DiagnosticUse => ({ status, purpose: diagnosticPurpose,
    approvalHash: status === "authorized_by_existing_user_task" ? trusted!.expectedApprovalHash : null,
    thirdPartyRights: "unknown", scientificAdmission: "withheld", findings: code ? [{ kind: status === "invalid" ? "invalid" : "unknown", code, path: "diagnosticUse" }] : [] });
  if (request?.purpose !== diagnosticPurpose || trusted && trusted.purpose !== diagnosticPurpose)
    return result("invalid", "diagnostic_use_purpose");
  if (!trusted || trusted.expectedApprovalHash == null || trusted.approvedRecordUtf8 == null)
    return result("unknown", "unknown_diagnostic_approval");
  if (typeof trusted.expectedApprovalHash !== "string" || !/^[a-f0-9]{64}$/.test(trusted.expectedApprovalHash)
    || typeof trusted.approvedRecordUtf8 !== "string" || Buffer.byteLength(trusted.approvedRecordUtf8, "utf8") > 2000000
    || nativeCoverageTextHash(trusted.approvedRecordUtf8) !== trusted.expectedApprovalHash)
    return result("invalid", "diagnostic_approval_hash");
  try {
    // Hash binding does not establish authenticity: the trusted caller approved this exact record independently.
    const record = diagnosticRecord.parse(JSON.parse(trusted.approvedRecordUtf8)), allowed = new Map<string, string>(), actual = new Map<string, string>();
    const tuple = (origin: string, bodyHash: string, bytes: number) => JSON.stringify([origin, bodyHash, bytes]);
    for (const source of record.retainedSources) {
      const value = tuple(source.origin, source.body.sha256, source.body.bytes);
      if (allowed.has(source.proofId) && allowed.get(source.proofId) !== value) return result("invalid", "diagnostic_contributor_conflict");
      allowed.set(source.proofId, value);
    }
    if (!contributors.length) return result("unknown", "unknown_diagnostic_contributors");
    for (const source of contributors) {
      const raw = nativeCoverageRawObservationSchema.parse(source), value = tuple(raw.origin, raw.bodyHash, Buffer.byteLength(raw.bodyUtf8, "utf8"));
      if (actual.has(raw.proofId) && actual.get(raw.proofId) !== value) return result("invalid", "diagnostic_contributor_conflict");
      actual.set(raw.proofId, value);
      if (nativeCoverageTextHash(raw.bodyUtf8) !== raw.bodyHash || allowed.get(raw.proofId) !== value)
        return result("invalid", "diagnostic_contributor_binding");
    }
    return result("authorized_by_existing_user_task");
  } catch { return result("invalid", "diagnostic_approval_record"); }
}

/** Matches the existing literal clock grammar without importing its capture-runtime dependencies. */
export function nativeAssemblyClockSeconds(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{1,3}:[0-5]\d$/.test(value)) return null;
  const [minutes, seconds] = value.split(":").map(Number);
  return minutes * 60 + seconds;
}
function originalSpan(source: NativeCoverageRawObservation, location: Span): string {
  if (nativeCoverageTextHash(source.bodyUtf8) !== source.bodyHash) throw new Error("raw_body_binding");
  const value = nativeCoverageLocationValue(source.bodyUtf8, location);
  if (typeof value !== "string") throw new Error("original_span_binding");
  return value;
}
function htmlField(source: NativeCoverageRawObservation, field: HtmlField): void {
  if (normalText(parseHtml(originalSpan(source, field.location)).text) !== normalText(field.expectedText))
    throw new Error("html_field_identity");
}
function fieldElement(source: NativeCoverageRawObservation, root: HTMLElement, field: HtmlField): HTMLElement {
  htmlField(source, field);
  // Parser ranges are UTF-16; convert the already verified original byte boundaries, never DOM serialization.
  const bytes = Buffer.from(source.bodyUtf8, "utf8");
  const start = bytes.toString("utf8", 0, field.location.startByte).length;
  const end = bytes.toString("utf8", 0, field.location.endByteExclusive).length;
  const matches = root.querySelectorAll("*").filter(node => node.range[0] === start && node.range[1] === end);
  if (matches.length !== 1 || normalText(matches[0].text) !== normalText(field.expectedText))
    throw new Error("html_field_element_binding");
  return matches[0];
}
const childElements = (node: HTMLElement) => node.childNodes.filter((child): child is HTMLElement => child instanceof HTMLElement);
const hasClass = (node: HTMLElement, value: string) => (node.getAttribute("class") ?? "").split(/\s+/).includes(value);
function toiCells(fragment: string): string[] {
  const cells = parseHtml(fragment).querySelectorAll("td").map(cell => normalText(cell.text));
  if (cells.length !== 6) throw new Error("unsupported_toi_columns");
  return cells;
}
/** Accepted span descriptors are roots; never hash reconstructed DOM or treat UTF-16 ranges as bytes. */
export function readNativeToiReport(source: NativeCoverageRawObservation, plan: {
  section: Span; playerHeading: HtmlField; reportHeading: HtmlField; teamHeading: HtmlField; shiftRows: Span[];
}) {
  htmlField(source, plan.reportHeading); htmlField(source, plan.teamHeading);
  const bodyRoot = parseHtml(source.bodyUtf8), player = fieldElement(source, bodyRoot, plan.playerHeading);
  const section = originalSpan(source, plan.section), root = parseHtml(section);
  const headings = bodyRoot.querySelectorAll('[class~="playerHeading"]')
    .filter(node => normalText(node.text) === normalText(plan.playerHeading.expectedText));
  const sectionHeadings = root.querySelectorAll('[class~="playerHeading"]');
  if (player.tagName !== "TD" || !hasClass(player, "playerHeading") || headings.length !== 1 || headings[0] !== player
    || sectionHeadings.length !== 1 || normalText(sectionHeadings[0].text) !== normalText(plan.playerHeading.expectedText)
    || plan.playerHeading.location.startByte < plan.section.startByte
    || plan.playerHeading.location.endByteExclusive > plan.section.endByteExclusive) throw new Error("ambiguous_toi_player_section");
  // Bind the shift header in this player's table. Period summaries belong to a nested table.
  const closest = player.closest("table"), table = closest instanceof HTMLElement ? closest : null;
  const headingsInTable = table?.querySelectorAll('[class~="playerHeading"]') ?? [];
  const nextHeading = headingsInTable.filter(node => node.range[0] > player.range[0]).sort((a, b) => a.range[0] - b.range[0])[0];
  const playerEnd = nextHeading?.range[0] ?? table?.range[1];
  const sectionEnd = Buffer.from(source.bodyUtf8, "utf8").toString("utf8", 0, plan.section.endByteExclusive).length;
  if (playerEnd === undefined || sectionEnd < playerEnd) throw new Error("incomplete_toi_player_section");
  const directRows = table?.querySelectorAll("tr").filter(row => row.closest("table") === table
    && row.range[0] >= player.range[1] && row.range[1] <= playerEnd) ?? [];
  const headers = directRows.filter(row => {
    const cells = childElements(row).filter(node => node.tagName === "TD").map(node => normalText(node.text));
    return cells.length === 6 && cells[0] === "Shift #" && cells[1] === "Per"
      && cells[2].startsWith("Start of Shift") && cells[3].startsWith("End of Shift")
      && cells[4] === "Duration" && cells[5].startsWith("Event");
  });
  if (!table || headers.length !== 1
    || headers[0].range[0] < player.range[1]) throw new Error("toi_shift_table_binding");
  // Exclude only an empty spacer or a positively recognized nested period-summary table.
  const tableRows = directRows.filter(row => row.range[0] >= headers[0].range[1]).filter(row => {
    const cells = childElements(row);
    if (cells.length !== 1 || cells[0].tagName !== "TD") return true;
    const cell = cells[0], contents = childElements(cell);
    if (hasClass(cell, "spacer") && contents.length === 0 && normalText(cell.text) === "") return false;
    if (contents.length !== 1 || contents[0].tagName !== "TABLE"
      || cell.childNodes.some(node => !(node instanceof HTMLElement) && normalText(node.text) !== "")) return true;
    const summary = contents[0], summaryRows = summary.querySelectorAll("tr").filter(item => item.closest("table") === summary);
    const values = summaryRows.map(item => childElements(item).map(node => node.tagName === "TD" ? normalText(node.text) : null));
    return values.length < 2 || JSON.stringify(values[0]) !== JSON.stringify(["Per", "SHF", "AVG", "TOI", "EV TOT", "PP TOT", "SH TOT"])
      || values.slice(1).some(value => value.length !== 7 || !/^(?:[1-3]|OT|TOT)$/.test(value[0] ?? "")
        || !/^\d+$/.test(value[1] ?? "") || value.slice(2).some(clock => nativeAssemblyClockSeconds(clock) === null));
  });
  if (tableRows.some(row => { const cells = childElements(row); return cells.length !== 6 || cells.some(cell => cell.tagName !== "TD"); }))
    throw new Error("unsupported_toi_columns");
  if (tableRows.length !== plan.shiftRows.length) throw new Error("incomplete_toi_row_descriptors");
  let previousEnd = plan.playerHeading.location.endByteExclusive;
  const ids = new Set<number>();
  return plan.shiftRows.map((location, index) => {
    if (location.startByte < previousEnd || location.endByteExclusive > plan.section.endByteExclusive)
      throw new Error("toi_row_order_or_section");
    previousEnd = location.endByteExclusive;
    const actualRow = fieldElement(source, bodyRoot, { location, expectedText: parseHtml(originalSpan(source, location)).text });
    if (actualRow.tagName !== "TR" || actualRow.closest("table") !== table || actualRow.range[0] < headers[0].range[1])
      throw new Error("toi_player_row_binding");
    const cells = toiCells(originalSpan(source, location));
    if (JSON.stringify(cells) !== JSON.stringify(tableRows[index].querySelectorAll("td").map(cell => normalText(cell.text))))
      throw new Error("toi_row_descriptor_mismatch");
    const shiftNumber = /^\d+$/.test(cells[0]) ? Number(cells[0]) : NaN;
    const periodNumber = cells[1] === "OT" ? 4 : /^[1-4]$/.test(cells[1]) ? Number(cells[1]) : NaN;
    const startSecond = nativeAssemblyClockSeconds(cells[2].split("/")[0].trim());
    const endSecond = nativeAssemblyClockSeconds(cells[3].split("/")[0].trim());
    const duration = nativeAssemblyClockSeconds(cells[4]);
    if (!Number.isSafeInteger(shiftNumber) || shiftNumber <= 0 || ids.has(shiftNumber) || !Number.isFinite(periodNumber)
      || startSecond === null || endSecond === null || duration === null || startSecond >= endSecond
      || endSecond > (periodNumber === 4 ? 300 : 1200) || duration !== endSecond - startSecond)
      throw new Error("unsupported_toi_row");
    ids.add(shiftNumber);
    return { derivedRowId: `derived-toi:${source.proofId}:${location.startByte}`, shiftNumber, periodNumber,
      periodType: periodNumber === 4 ? "OT" as const : "REG" as const, startSecond, endSecond,
      eventMarkersAsReported: cells[5], source: { proofId: source.proofId, bodyHash: source.bodyHash, location } };
  });
}
export function readNativeScratchRecord(source: NativeCoverageRawObservation, plan: {
  reportHeading: HtmlField; teamHeading: HtmlField; scratchesHeading: HtmlField; row: Span;
  sweaterNumber: number; position: string; fullName: string;
}) {
  htmlField(source, plan.reportHeading);
  const root = parseHtml(source.bodyUtf8), team = fieldElement(source, root, plan.teamHeading),
    heading = fieldElement(source, root, plan.scratchesHeading),
    row = fieldElement(source, root, { location: plan.row, expectedText: parseHtml(originalSpan(source, plan.row)).text });
  if (normalText(plan.scratchesHeading.expectedText) !== "Scratches") throw new Error("scratch_section_required");
  if (row.tagName !== "TR") throw new Error("scratch_row_binding");
  if (team.tagName === "H2" && heading.tagName === "H3" && team.parentNode === heading.parentNode && team.parentNode) {
    // Explicit sequential team/section headings; a later team or subsection starts a different domain.
    const siblings = childElements(team.parentNode), teamIndex = siblings.indexOf(team), headingIndex = siblings.indexOf(heading);
    const priorTeam = siblings.slice(0, headingIndex).filter(node => node.tagName === "H2").at(-1);
    const nextTeam = siblings.findIndex((node, i) => i > teamIndex && node.tagName === "H2");
    const sections = siblings.slice(teamIndex + 1, nextTeam < 0 ? undefined : nextTeam)
      .filter(node => node.tagName === "H3" && normalText(node.text) === "Scratches");
    const table = heading.nextElementSibling;
    if (priorTeam !== team || sections.length !== 1 || sections[0] !== heading || table?.tagName !== "TABLE"
      || row.closest("table") !== table || root.querySelectorAll("h2").filter(node => normalText(node.text) === normalText(team.text)).length !== 1)
      throw new Error("scratch_team_section_binding");
  } else {
    // Official two-column roster layout: team heading column must equal the explicit Scratches row column.
    const teamRow = team.parentNode, teamTable = teamRow?.parentNode, headingRow = heading.parentNode,
      scratchRows = root.querySelectorAll('tr[id="Scratches"]'), scratchRow = scratchRows[0], bodyTable = scratchRow?.parentNode;
    const teamCells = teamRow ? childElements(teamRow).filter(node => node.tagName === "TD") : [];
    const scratchCells = scratchRow ? childElements(scratchRow).filter(node => node.tagName === "TD") : [];
    const index = teamCells.indexOf(team), teamWrapper = teamTable?.parentNode?.parentNode,
      bodyWrapper = bodyTable?.parentNode?.parentNode;
    const tables = index < 0 || !scratchCells[index] ? [] : childElements(scratchCells[index]).filter(node => node.tagName === "TABLE");
    if (team.tagName !== "TD" || !hasClass(team, "teamHeading") || teamRow?.tagName !== "TR" || teamTable?.tagName !== "TABLE"
      || teamCells.length !== 2 || teamCells.some(node => !hasClass(node, "teamHeading")) || scratchRows.length !== 1
      || heading.tagName !== "TD" || headingRow?.tagName !== "TR" || headingRow.parentNode !== bodyTable
      || headingRow.nextElementSibling !== scratchRow || scratchCells.length !== 2 || tables.length !== 1
      || row.closest("table") !== tables[0] || teamWrapper?.tagName !== "TR" || bodyWrapper?.tagName !== "TR"
      || teamWrapper.parentNode !== bodyWrapper.parentNode || teamWrapper.nextElementSibling !== bodyWrapper
      || root.querySelectorAll('[class~="teamHeading"]').filter(node => normalText(node.text) === normalText(team.text)).length !== 1)
      throw new Error("scratch_team_section_binding");
  }
  const cells = parseHtml(originalSpan(source, plan.row)).querySelectorAll("td").map(cell => normalText(cell.text));
  if (cells.length !== 3 || cells[0] !== String(plan.sweaterNumber) || cells[1] !== plan.position
    || cells[2] !== normalText(plan.fullName)) throw new Error("scratch_identity");
  if (parseHtml(source.bodyUtf8).querySelectorAll("tr").filter(row => {
    const values = row.querySelectorAll("td").map(cell => normalText(cell.text));
    return values.length === 3 && values[2] === cells[2];
  }).length !== 1) throw new Error("ambiguous_scratch_identity");
  return { recordedScratch: true as const, sweaterNumber: plan.sweaterNumber, position: plan.position,
    fullName: cells[2], source: { proofId: source.proofId, bodyHash: source.bodyHash, location: plan.row },
    HIT: null, statisticalCredit: null };
}
function sourceOnlyBody(body: NativeCoverageHistoryBody | NativeCoverageKernelSourceBody) {
  if (!("kind" in body)) return nativeCoverageHistoryBodySchema.parse(body);
  const parsed = nativeCoverageKernelSourceBodySchema.parse(body);
  if (parsed.kind === "save_conversion") throw new Error("conversion_is_not_source_assembly");
  if (parsed.kind === "goalie_scenarios" && parsed.rows.some(row => row.starterRoleId !== null
    || row.periods.some(period => period.teamShotsAgainst !== null || period.teamNonShotGoalsAgainst !== null
      || period.intervals.some(spell => spell.roleId !== null || spell.modeledShotsAgainst !== null
        || spell.modeledNonShotGoalsAgainst !== null || spell.emptyNetGoalsAgainst !== null))))
    throw new Error("model_driver_in_source_assembly");
  return parsed;
}
/** Serialize independently bound source observations; this does not certify their transformation semantics. */
export function assembleNativeCoverageProof(plan: NativeCoverageAssemblyPlan, contributors: NativeCoverageRawObservation[],
  observationBody: NativeCoverageHistoryBody | NativeCoverageKernelSourceBody, links: Link[],
  trustedDiagnosticExpectation?: NativeCoverageDiagnosticUseExpectation): NativeCoverageAssemblyResult {
  const diagnosticUse = checkDiagnosticUse(plan.diagnosticUse, contributors, trustedDiagnosticExpectation);
  const findings: Finding[] = [];
  const add = (kind: Finding["kind"], code: string, path: string) => {
    if (!findings.some(value => value.kind === kind && value.code === code && value.path === path)) findings.push({ kind, code, path });
  };
  const result = (proof: NativeCoverageSpanProof | null): NativeCoverageAssemblyResult => ({
    version: NATIVE_COVERAGE_ASSEMBLY_VERSION, status: findings.length ? "blocked" : "proposed_for_independent_review",
    proof, findings, qualificationEligible: false, independentOutputContractRequired: true,
    sourceSemanticsApproval: "not_established", modelInputs: "withheld", ...(diagnosticUse === undefined ? {} : { diagnosticUse }) });
  try {
    const raws = contributors.map(value => nativeCoverageRawObservationSchema.parse(value));
    if (new Set(raws.map(value => value.proofId)).size !== raws.length
      || plan.expectedContributors.length !== raws.length) throw new Error("independent_source_population");
    for (const raw of raws) {
      const expected = plan.expectedContributors.filter(value => value.proofId === raw.proofId);
      if (expected.length !== 1) throw new Error("independent_source_population");
      const tags = { version: NATIVE_COVERAGE_PROOF_VERSION, mode: "prospective_public_observation", evidenceType: "raw_official" } as const;
      checkNativeCoverageProof({ ...raw, ...tags }, { ...expected[0], ...tags }, plan.cutoffAt,
        (kind, code) => add(kind, code, raw.proofId));
    }
    const body = sourceOnlyBody(observationBody), rows = body.rows;
    const teamId = "kind" in body ? body.kind === "hit_history" ? body.identity.teamId : body.teamId : body.identity.teamId;
    if (!Number.isSafeInteger(plan.targetGameId) || plan.targetGameId <= 0 || teamId !== plan.teamId
      || !("kind" in body) && body.gameId !== plan.targetGameId) throw new Error("assembly_target_scope");
    if (plan.censusComplete !== true || plan.expectedRowIds === null) add("unknown", "independent_census_required", "rows");
    else if (new Set(plan.expectedRowIds).size !== plan.expectedRowIds.length
      || JSON.stringify([...plan.expectedRowIds].sort()) !== JSON.stringify(rows.map(row => row.rowId).sort()))
      add("invalid", "independent_row_population", "rows");
    if (!rows.length) add("unknown", "empty_history_not_zero", "rows");
    if ("kind" in body ? body.kind === "hit_history" ? body.unclassifiedHits !== 0 || body.unclassifiedSeconds !== 0
      : body.rows.some(row => row.unclassifiedSeconds !== 0 || row.unclassifiedOpportunities !== 0)
      : body.unclassifiedEvents !== 0 || body.unclassifiedSeconds !== 0) add("unknown", "unclassified_source_observations", "body");
    const bodyUtf8 = JSON.stringify(body), createdAt = new Date().toISOString();
    for (const link of links) {
      const raw = raws.find(value => value.proofId === link.proofId && value.bodyHash === link.bodyHash);
      if (!raw || nativeCoverageLocationValue(raw.bodyUtf8, link.location) === undefined
        || nativeCoverageLocationValue(bodyUtf8, { kind: "json_pointer", pointer: link.derivedPointer }) === undefined)
        add("invalid", "assembly_location_binding", link.derivedPointer);
    }
    if (rows.some((_, i) => !links.some(link => link.derivedPointer === `/rows/${i}` || link.derivedPointer.startsWith(`/rows/${i}/`))))
      add("invalid", "unlinked_derived_row", "rows");
    if (raws.some(raw => !links.some(link => link.proofId === raw.proofId && link.bodyHash === raw.bodyHash)))
      add("invalid", "unlinked_contributor", "contributors");
    const proof = nativeCoverageProofSchema.parse({ version: NATIVE_COVERAGE_SPAN_PROOF_VERSION,
      mode: "prospective_public_observation", evidenceType: "derived_normalized", proofId: plan.proofId,
      bodyUtf8, bodyHash: nativeCoverageTextHash(bodyUtf8), createdAt, verifiedAt: new Date().toISOString(),
      publishedAt: null, firstReceivedAt: null, transformation: plan.transformation, contributors: raws, links }) as NativeCoverageSpanProof;
    // No generated expectation/approval: the caller must independently accept this proposal later.
    checkNativeCoverageProof(proof, undefined, plan.cutoffAt, (kind, code) => {
      if (code !== "proof_contract_binding") add(kind, code, "proof");
    });
    rows.forEach(row => checkNativeCoverageHistory(row, proof, plan.targetGameId, plan.teamId, plan.cutoffAt,
      (kind, code) => add(kind, code, row.rowId)));
    proof.verifiedAt = new Date().toISOString();
    checkNativeCoverageProof(proof, undefined, plan.cutoffAt, (kind, code) => {
      if (code !== "proof_contract_binding") add(kind, code, "proof");
    });
    return result(proof);
  } catch (error) {
    add("invalid", error instanceof Error ? error.message : "malformed_assembly", "assembly");
    return result(null);
  }
}
/** Supported direct BOX observations only; no period allocation, membership inference or model moments. */
export function assembleNativeHitHistory(plan: NativeCoverageAssemblyPlan & {
  identity: Extract<NativeCoverageKernelSourceBody, { kind: "hit_history" }>["identity"];
  games: Array<{ rowId: string; historicalGameId: number; historicalTeamId: number; sourceProofId: string;
    playerPointer: string; statisticalCredit: boolean | null;
    history: Pick<Extract<NativeCoverageKernelSourceBody, { kind: "hit_history" }>["rows"][number], "completedAt" | "completion"> }>;
}, contributors: NativeCoverageRawObservation[], trustedDiagnosticExpectation?: NativeCoverageDiagnosticUseExpectation): NativeCoverageAssemblyResult {
  const rows: Extract<NativeCoverageKernelSourceBody, { kind: "hit_history" }>["rows"] = [], links: Link[] = [];
  try {
    for (const game of plan.games) {
      const raw = contributors.find(value => value.proofId === game.sourceProofId);
      if (!raw || nativeCoverageTextHash(raw.bodyUtf8) !== raw.bodyHash) throw new Error("hit_source_binding");
      const box = JSON.parse(raw.bodyUtf8), player = nativeCoverageLocationValue(raw.bodyUtf8,
        { kind: "json_pointer", pointer: game.playerPointer }) as Record<string, unknown> | undefined;
      const side = /^\/playerByGameStats\/(homeTeam|awayTeam)\/(forwards|defense)\/\d+$/.exec(game.playerPointer)?.[1];
      if (!side || box.id !== game.historicalGameId || !["OFF", "FINAL"].includes(box.gameState)
        || box.gameType !== 2 || box[side]?.id !== game.historicalTeamId || player?.playerId !== plan.identity.nhlPlayerId)
        throw new Error("hit_player_game_identity");
      const hits = typeof player.hits === "number" && Number.isSafeInteger(player.hits) && player.hits >= 0 ? player.hits : null;
      const seconds = nativeAssemblyClockSeconds(player.toi);
      rows.push({ rowId: game.rowId, historicalGameId: game.historicalGameId, ...game.history,
        statisticalCredit: game.statisticalCredit, hits, seconds });
      for (const field of ["playerId", ...(Object.hasOwn(player, "hits") ? ["hits"] : []), ...(Object.hasOwn(player, "toi") ? ["toi"] : [])]) {
        links.push({ proofId: raw.proofId, bodyHash: raw.bodyHash,
          location: { kind: "json_pointer", pointer: `${game.playerPointer}/${field}` },
          derivedPointer: `/rows/${rows.length - 1}/${field === "hits" ? "hits" : field === "toi" ? "seconds" : "rowId"}` });
      }
      const final = game.history.completion?.finalEvidence;
      const finalRaw = final && contributors.find(value => value.proofId === final.proofId && value.bodyHash === final.bodyHash);
      const finalGame = finalRaw?.finalGames.find(value => value.historicalGameId === game.historicalGameId);
      if (finalRaw && finalGame) links.push({ proofId: finalRaw.proofId, bodyHash: finalRaw.bodyHash,
        location: { kind: "json_pointer", pointer: finalGame.gameIdPointer }, derivedPointer: `/rows/${rows.length - 1}/historicalGameId` });
    }
    const complete = plan.censusComplete === true;
    const result = assembleNativeCoverageProof(plan, contributors, { kind: "hit_history", domainHash: NATIVE_PLAYER_COVERAGE_DOMAIN_HASH,
      identity: plan.identity, rows, unclassifiedHits: complete && rows.every(row => row.hits !== null) ? 0 : null,
      unclassifiedSeconds: complete && rows.every(row => row.seconds !== null) ? 0 : null }, links, trustedDiagnosticExpectation);
    rows.forEach(row => {
      if (row.hits === null || row.seconds === null || row.statisticalCredit === null)
        result.findings.push({ kind: "unknown", code: "unknown_hit_observation", path: row.rowId });
    });
    if (result.findings.length) result.status = "blocked";
    return result;
  } catch (error) {
    return { version: NATIVE_COVERAGE_ASSEMBLY_VERSION, status: "blocked", proof: null,
      findings: [{ kind: "invalid", code: error instanceof Error ? error.message : "malformed_hit_assembly", path: "games" }],
      qualificationEligible: false, independentOutputContractRequired: true, sourceSemanticsApproval: "not_established", modelInputs: "withheld",
      ...(plan.diagnosticUse === undefined ? {} : { diagnosticUse: checkDiagnosticUse(plan.diagnosticUse, contributors, trustedDiagnosticExpectation) }) };
  }
}

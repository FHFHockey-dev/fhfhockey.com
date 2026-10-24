// Isolated source composition only. Never writes the canonical checkout.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("../../../../web/node_modules/typescript");

const own = __dirname;
const manifestPath = path.join(own, "CANDIDATE.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const snapshot = manifest.snapshot;
if (!snapshot.startsWith("/tmp/fhfh-c5-auth-order-r1-")) throw Error("Unexpected snapshot");
const testPath = path.join(snapshot, "web/__tests__/pages/api/v1/db/cron-audit-wrappers.test.ts");
const testSource = fs.readFileSync(testPath, "utf8");
const testAst = ts.createSourceFile(testPath, testSource, ts.ScriptTarget.Latest, true);
let list;
for (const statement of testAst.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (declaration.name.getText(testAst) === "authFirstAuditRoutes") list = declaration.initializer;
  }
}
if (ts.isAsExpression(list)) list = list.expression;
if (!ts.isArrayLiteralExpression(list)) throw Error("Exact route declaration missing");
const routes = list.elements.map(element => element.text);
if (routes.length !== 75) throw Error("Declared route scope advanced");

const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const parse = (name, source) => ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
function functionBodies(ast) {
  const bodies = [];
  function walk(node) {
    if (ts.isFunctionLike(node) && node.body) bodies.push(hash(node.body.getText(ast)));
    ts.forEachChild(node, walk);
  }
  walk(ast);
  return bodies;
}
function imports(ast) {
  return ast.statements.filter(ts.isImportDeclaration).map(node => node.getText(ast));
}
function callee(node, ast, name) {
  return ts.isCallExpression(node) && node.expression.getText(ast) === name;
}
function removeWrapper(source, ast, call, edits) {
  if (call.arguments.length !== 1 || call.typeArguments?.length) throw Error("Non-unary admin wrapper");
  const open = source.indexOf("(", call.expression.end);
  if (open < call.expression.end || open >= call.arguments[0].getStart(ast)) throw Error("Opening token missing");
  if (source[call.end - 1] !== ")") throw Error("Closing token missing");
  edits.push({ start: call.expression.getStart(ast), end: call.expression.end, text: "" });
  edits.push({ start: open, end: open + 1, text: "" });
  edits.push({ start: call.end - 1, end: call.end, text: "" });
}

const rows = [];
for (const route of routes) {
  const relative = "web/pages/api/" + route;
  const absolute = path.join(snapshot, relative);
  const source = fs.readFileSync(absolute, "utf8");
  const ast = parse(relative, source);
  const exported = ast.statements.find(ts.isExportAssignment)?.expression;
  if (!exported || !ts.isCallExpression(exported)) throw Error(relative + ": missing export call");
  if (callee(exported, ast, "adminOnly") && callee(exported.arguments[0], ast, "withCronJobAudit")) {
    rows.push({ path: relative, changed: false, reason: "Exact C5 prospects handback already auth-first", sha256: hash(source) });
    continue;
  }
  if (!callee(exported, ast, "withCronJobAudit")) throw Error(relative + ": unexpected outer wrapper");
  const edits = [
    { start: exported.getStart(ast), end: exported.getStart(ast), text: "adminOnly(" },
    { start: exported.end, end: exported.end, text: ")" }
  ];
  const first = exported.arguments[0];
  if (callee(first, ast, "adminOnly")) {
    removeWrapper(source, ast, first, edits);
  } else if (relative === "web/pages/api/Teams/nst-team-stats.ts" && ts.isIdentifier(first)) {
    // Preserve the complete production work handler. Do not import newer
    // caller-secret headers/configuration from the unrelated HEAD body.
    let declaration;
    for (const statement of ast.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      declaration ??= statement.declarationList.declarations.find(node => node.name.getText(ast) === first.text);
    }
    if (!declaration || !callee(declaration.initializer, ast, "adminOnly")) throw Error("NST handler shape changed");
    let references = 0;
    function count(node) {
      if (ts.isIdentifier(node) && node.text === first.text) references++;
      ts.forEachChild(node, count);
    }
    count(ast);
    if (references !== 2) throw Error("NST handler has additional consumers");
    removeWrapper(source, ast, declaration.initializer, edits);
  } else {
    throw Error(relative + ": unrecognized predecessor shape");
  }
  let result = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }
  const after = parse(relative, result);
  if (after.parseDiagnostics.length) throw Error(relative + ": syntax changed");
  const afterExport = after.statements.find(ts.isExportAssignment)?.expression;
  if (!callee(afterExport, after, "adminOnly") || !callee(afterExport.arguments[0], after, "withCronJobAudit")) {
    throw Error(relative + ": gate order is wrong");
  }
  if (JSON.stringify(functionBodies(ast)) !== JSON.stringify(functionBodies(after))) throw Error(relative + ": function body changed");
  if (JSON.stringify(imports(ast)) !== JSON.stringify(imports(after))) throw Error(relative + ": imports changed");
  fs.writeFileSync(absolute, result);
  const pin = hash(result);
  rows.push({ path: relative, changed: true, before_sha256: hash(source), after_sha256: pin,
    function_body_hashes_unchanged: functionBodies(ast), imports_unchanged: true });
  manifest.selected[relative] = { sha256: pin, source: "Production-preserving auth-before-audit predecessor; wrapper tokens only, callback bodies/imports unchanged" };
}
manifest.status = "Wrapper-only predecessor composition prepared for offline qualification; independent review and acceptance pending";
manifest.auth_order = { declared: routes.length, transformed: rows.filter(row => row.changed).length, already_auth_first: rows.filter(row => !row.changed).length };
fs.writeFileSync(path.join(own, "AUTH-ORDER-PROOF.json"), JSON.stringify({ rows, summary: manifest.auth_order }, null, 2) + "\n");
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
process.stdout.write(JSON.stringify({ snapshot, paths: Object.keys(manifest.selected).length, ...manifest.auth_order }) + "\n");

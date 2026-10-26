/**
 * Offline check that one exact FORGE release cannot read third-party fantasy projection tables (TJ, 2026-10-26).
 *
 * Given a full 40-character commit SHA, it archives that commit's `web/` tree into /private/tmp (read-only git:
 * `rev-parse` and `archive`), follows the whole FORGE run import closure from its production entrypoints (static,
 * re-export, `require` and literal dynamic imports; type imports too) and fails when any module in it
 *   - imports or names the provider configuration (`PROJECTION_SOURCES_CONFIG`, `lib/projectionsConfig/projectionSourcesConfig`);
 *   - holds a `PROJECTIONS_*` / `projections_*` string or template literal (the pundit table family);
 *   - reads a pundit table through a non-literal `.from()` / `.rpc()` argument whose literal values it can resolve
 *     (constants, imported constants, `as const` loops, ternaries, same-file callers of a helper parameter);
 *   - has a dynamic import, an unresolvable local import, or a non-literal table site it cannot resolve that is not in
 *     the reviewed list below (a new site needs its own review before that release can be allowlisted).
 * It writes a JSON receipt. No database, network, deployment or git mutation.
 *
 *   NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
 *     scripts/verify-forge-release-sha.ts <full-sha> [--receipt <path>]
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";

export const FORGE_RELEASE_VERIFIER_VERSION = "forge-release-sha-verifier-v1";
/** Production code paths that create or continue FORGE runs and load their inputs. */
export const FORGE_RUN_ROOTS = [
  "lib/projections/run-forge-projections.ts",
  "lib/projections/starterBoardQueue.ts",
  "pages/api/v1/db/run-projection-v2.ts",
  "pages/api/v1/db/run-rolling-forge-pipeline.ts",
  "pages/api/v1/db/drain-starter-board.ts",
  "pages/api/internal/starter-board.ts",
];
/** The closure must contain these, so a mis-rooted scan cannot pass by shrinking. */
export const FORGE_REQUIRED_MODULES = [
  "lib/projections/seasonBootstrap.ts",
  "lib/projections/stages/skater-stage.ts",
  "lib/projections/stages/goalie-stage.ts",
  "lib/projections/stages/persistence-stage.ts",
  "lib/projections/queries/skater-queries.ts",
  "lib/projections/queries/run-lifecycle-queries.ts",
  "lib/projections/dailyBoardEvidence.ts",
];
/** Non-literal table sites the resolver cannot follow, reviewed by hand (first at 538100d41): `file` + the argument
 * text and where its value comes from. A changed or new site fails verification until it is reviewed here. */
export const REVIEWED_DYNAMIC_SITES: Array<{ file: string; argument: string; source: string }> = [
  { file: "pages/api/v1/db/update-nst-gamelog.ts", argument: "table",
    source: "getLatestDateSupabase args.tables: NST_TABLE_NAMES or getTableName() values, all literal nst_gamelog_* names" },
  { file: "pages/api/v1/db/update-nst-gamelog.ts", argument: "tableName",
    source: "getTableName(datasetType): a literal nst_gamelog_* mapping, rejected unless listed in NST_TABLE_NAMES" },
  { file: "pages/api/v1/db/update-line-combinations/index.ts", argument: "args.table",
    source: "typed \"teamGameStats\" | \"lineCombinations\"; both callers pass those literals" },
  { file: "lib/sources/lineSourceIftttReceiver.ts", argument: "table",
    source: "config.eventTable (typed \"lines_ccc_ifttt_events\" | \"line_source_ifttt_events\") or that default" },
  { file: "lib/supabase/Upserts/fetchRollingPlayerAverages.ts", argument: "tableName",
    source: "fetchCounts/fetchRates/fetchCountsOi receive config.*Table from STRENGTH_CONFIGS, literal nst_gamelog_* names" },
  { file: "lib/supabase/Upserts/nhlRawGamecenter.mjs", argument: "table",
    source: "upsertInBatches(table): a write helper with no caller in web/ at 538100d41" },
  { file: "lib/sources/iftttRpcDeadline.ts", argument: "name",
    source: "boundedIftttRpc(name): callers pass literal IFTTT receipt RPC names" },
];

const PROVIDER_CONFIG_IDENTIFIER = /^(PROJECTION_SOURCES_CONFIG|projectionSourcesConfig)$/;
const PROVIDER_CONFIG_PATH = /(^|\/)lib\/projectionsConfig\/projectionSourcesConfig(\.[jt]sx?)?$/;
/** The pundit family as a name, `PROJECTIONS_<season>_<source>` (and older unseasoned `projections_<source>`); not native
 * names that merely contain it, such as `goalie_start_projections_upsert`. */
const PUNDIT_TABLE_TEXT = /(^|[^A-Za-z0-9_])projections_/i;

type Finding = { file: string; line: number; kind: string; text: string; values?: string[] };
const STYLE_OR_ASSET = /\.(s?css|sass|less|svg|png|jpe?g|gif|webp|ico|woff2?|md|txt)$/;

/** Literal values an expression can take, read through constants (also imported ones), `as const` loops, ternaries and
 * the same-file callers of a helper's parameter; null when any branch is not a literal. */
function tableValues(node: ts.Expression, file: string, options: ts.CompilerOptions, host: ts.CompilerHost, depth = 0): string[] | null {
  if (depth > 8) return null;
  while (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)
    || ts.isTypeAssertionExpression(node)) node = node.expression;
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isConditionalExpression(node)) {
    const a = tableValues(node.whenTrue, file, options, host, depth + 1), b = tableValues(node.whenFalse, file, options, host, depth + 1);
    return a && b ? [...a, ...b] : null;
  }
  if (ts.isArrayLiteralExpression(node)) {
    const parts = node.elements.map(element => ts.isExpression(element) ? tableValues(element, file, options, host, depth + 1) : null);
    return parts.every(Boolean) ? parts.flat() as string[] : null;
  }
  if (!ts.isIdentifier(node)) return null;
  const source = node.getSourceFile();
  const named = (name: string, root: ts.Node) => {
    const found: ts.Node[] = [];
    const walk = (child: ts.Node) => {
      if ((ts.isVariableDeclaration(child) || ts.isParameter(child) || ts.isImportSpecifier(child) || ts.isImportClause(child))
        && child.name && ts.isIdentifier(child.name) && child.name.text === name) found.push(child);
      ts.forEachChild(child, walk);
    };
    walk(root);
    return found;
  };
  // The nearest enclosing declaration of the name (function scope first, then the file).
  let scope: ts.Node | undefined = node.parent, declaration: ts.Node | undefined;
  while (scope && !declaration) {
    if (ts.isFunctionLike(scope) || ts.isSourceFile(scope) || ts.isBlock(scope) || ts.isForOfStatement(scope)) {
      declaration = named(node.text, scope).find(candidate => candidate.pos <= node.pos || ts.isParameter(candidate) || ts.isImportSpecifier(candidate));
    }
    scope = scope.parent;
  }
  if (!declaration) return null;
  if (ts.isImportSpecifier(declaration)) {
    const specifier = declaration.parent.parent.parent.moduleSpecifier;
    if (!ts.isStringLiteral(specifier)) return null;
    const resolved = ts.resolveModuleName(specifier.text, file, options, host).resolvedModule?.resolvedFileName;
    if (!resolved || resolved.includes("/node_modules/")) return null;
    const target = ts.createSourceFile(resolved, readFileSync(resolved, "utf8"), ts.ScriptTarget.Latest, true);
    const exported = (declaration.propertyName ?? declaration.name).text;
    const local = named(exported, target).find(ts.isVariableDeclaration);
    return local?.initializer ? tableValues(local.initializer, resolved, options, host, depth + 1) : null;
  }
  if (ts.isVariableDeclaration(declaration)) {
    const list = declaration.parent, loop = list.parent;
    if (ts.isVariableDeclarationList(list) && ts.isForOfStatement(loop) && loop.initializer === list) {
      return tableValues(loop.expression, file, options, host, depth + 1);
    }
    return declaration.initializer ? tableValues(declaration.initializer, file, options, host, depth + 1) : null;
  }
  if (ts.isParameter(declaration)) {
    const fn = declaration.parent, index = fn.parameters.indexOf(declaration);
    const fnName = ts.isFunctionDeclaration(fn) && fn.name ? fn.name.text
      : ts.isVariableDeclaration(fn.parent) && ts.isIdentifier(fn.parent.name) ? fn.parent.name.text : null;
    if (!fnName || index < 0) return null;
    const calls: ts.CallExpression[] = [];
    const walk = (child: ts.Node) => {
      if (ts.isCallExpression(child) && ts.isIdentifier(child.expression) && child.expression.text === fnName) calls.push(child);
      ts.forEachChild(child, walk);
    };
    walk(source);
    if (!calls.length) return null;
    const values: string[] = [];
    for (const call of calls) {
      const argument = call.arguments[index];
      const resolved = argument ? tableValues(argument, file, options, host, depth + 1) : null;
      if (!resolved) return null;
      values.push(...resolved);
    }
    return values;
  }
  return null;
}
export type ClosureScan = { modules: string[]; findings: Finding[]; dynamicSites: Finding[]; guardRegexes: Finding[] };

/** Pure: scans the import closure of `roots` under `webRoot` with the given compiler options. */
export function scanForgeClosure(webRoot: string, roots: string[], options: ts.CompilerOptions): ClosureScan {
  const host = ts.createCompilerHost(options);
  const seen = new Set<string>(), queue = roots.map(root => resolve(webRoot, root));
  const findings: Finding[] = [], dynamicSites: Finding[] = [], guardRegexes: Finding[] = [];
  const rel = (file: string) => relative(webRoot, file);
  for (const missing of queue.filter(file => !existsSync(file))) findings.push({ file: rel(missing), line: 0, kind: "missing_root", text: "" });
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    if (!/\.[cm]?[jt]sx?$/.test(file)) {
      if (PUNDIT_TABLE_TEXT.test(text)) findings.push({ file: rel(file), line: 0, kind: "pundit_table_text", text: "(non-code module)" });
      continue;
    }
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const at = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    const follow = (specifier: string, node: ts.Node) => {
      if (STYLE_OR_ASSET.test(specifier)) return;
      if (PROVIDER_CONFIG_PATH.test(specifier)) findings.push({ file: rel(file), line: at(node), kind: "provider_config_import", text: specifier });
      const resolved = ts.resolveModuleName(specifier, file, options, host).resolvedModule;
      if (!resolved) {
        if (specifier.startsWith(".") || /^(lib|pages|components|hooks|utils|contexts|styles|public)\//.test(specifier)) {
          findings.push({ file: rel(file), line: at(node), kind: "unresolved_local_import", text: specifier });
        }
        return;
      }
      if (resolved.isExternalLibraryImport || resolved.resolvedFileName.includes("/node_modules/")) return;
      if (PROVIDER_CONFIG_PATH.test(rel(resolved.resolvedFileName))) {
        findings.push({ file: rel(file), line: at(node), kind: "provider_config_import", text: specifier });
      }
      queue.push(resolved.resolvedFileName);
    };
    const visit = (node: ts.Node) => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        follow(node.moduleSpecifier.text, node);
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
        && ts.isStringLiteral(node.moduleReference.expression)) {
        follow(node.moduleReference.expression.text, node);
      } else if (ts.isCallExpression(node)) {
        const callee = node.expression, first = node.arguments[0];
        const isImport = callee.kind === ts.SyntaxKind.ImportKeyword, isRequire = ts.isIdentifier(callee) && callee.text === "require";
        if (isImport || isRequire) {
          if (first && ts.isStringLiteralLike(first)) follow(first.text, node);
          else findings.push({ file: rel(file), line: at(node), kind: "dynamic_import", text: node.getText(source) });
        }
        // `"table" as any` is still a literal; Array.from / Buffer.from are not table reads.
        let table = first;
        while (table && (ts.isAsExpression(table) || ts.isParenthesizedExpression(table) || ts.isSatisfiesExpression(table)
          || ts.isNonNullExpression(table))) table = table.expression;
        if (table && ts.isStringLiteralLike(table)) {
          if (PUNDIT_TABLE_TEXT.test(table.text)) findings.push({ file: rel(file), line: at(node), kind: "pundit_table_read", text: table.text });
        } else if (ts.isPropertyAccessExpression(callee) && ["from", "rpc"].includes(callee.name.text) && table
          && !(ts.isIdentifier(callee.expression) && ["Array", "Buffer", "Uint8Array"].includes(callee.expression.text))) {
          const argument = table.getText(source).replace(/\s+/g, " ");
          const values = tableValues(table, file, options, host);
          const site: Finding = { file: rel(file), line: at(node), kind: `dynamic_${callee.name.text}`, text: argument,
            ...(values ? { values: [...new Set(values)].sort() } : {}) };
          dynamicSites.push(site);
          if (values) {
            for (const value of values.filter(value => PUNDIT_TABLE_TEXT.test(value))) findings.push({ ...site, kind: "pundit_table_read", text: value });
          } else if (!REVIEWED_DYNAMIC_SITES.some(row => row.file === site.file && row.argument === argument)) {
            findings.push({ ...site, kind: `unreviewed_${site.kind}` });
          }
        }
      } else if (ts.isIdentifier(node) && PROVIDER_CONFIG_IDENTIFIER.test(node.text)) {
        findings.push({ file: rel(file), line: at(node), kind: "provider_config_identifier", text: node.text });
      } else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && PUNDIT_TABLE_TEXT.test(node.text)) {
        findings.push({ file: rel(file), line: at(node), kind: "pundit_table_text", text: node.text });
      } else if (ts.isTemplateExpression(node)) {
        const parts = [node.head.text, ...node.templateSpans.map(span => span.literal.text)];
        if (parts.some(part => PUNDIT_TABLE_TEXT.test(part))) findings.push({ file: rel(file), line: at(node), kind: "pundit_table_text", text: node.getText(source) });
      } else if (node.kind === ts.SyntaxKind.RegularExpressionLiteral && PUNDIT_TABLE_TEXT.test(node.getText(source))) {
        // A pattern that recognises the family (the writer's own exclusion guard) is not a reference to a table.
        guardRegexes.push({ file: rel(file), line: at(node), kind: "guard_regex", text: node.getText(source) });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  const modules = [...seen].map(rel).sort();
  for (const required of FORGE_REQUIRED_MODULES) if (!modules.includes(required)) findings.push({ file: required, line: 0, kind: "required_module_absent", text: "" });
  return { modules, findings, dynamicSites, guardRegexes };
}

/** Of UTF-8 text (every receipt input is a source file or JSON), so it equals the hash of the bytes. */
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function git(repoRoot: string, args: string[]) {
  const env = { ...process.env };
  delete env.GIT_DIR; delete env.GIT_WORK_TREE;
  return execFileSync("git", args, { cwd: repoRoot, env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
}

function main() {
  const args = process.argv.slice(2), sha = args[0] ?? "";
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error("Pass the exact full 40-character lowercase commit SHA.");
  const repoRoot = resolve(__dirname, "../..");
  if (git(repoRoot, ["rev-parse", "--verify", `${sha}^{commit}`]) !== sha) throw new Error(`${sha} is not a commit in this repository.`);
  const workDir = `/private/tmp/forge-release-verify-${sha}`;
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  git(repoRoot, ["archive", "--format=tar", `--output=${join(workDir, "web.tar")}`, sha, "web"]);
  execFileSync("tar", ["-xf", join(workDir, "web.tar"), "-C", workDir]);
  const webRoot = join(workDir, "web");
  const config = ts.readConfigFile(join(webRoot, "tsconfig.json"), ts.sys.readFile);
  if (config.error) throw new Error("The archived tsconfig.json could not be read.");
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, webRoot);
  const scan = scanForgeClosure(webRoot, FORGE_RUN_ROOTS, options);
  const verified = scan.findings.length === 0;
  const receiptArg = args.includes("--receipt") ? args[args.indexOf("--receipt") + 1] : undefined;
  const receiptPath = resolve(receiptArg
    ?? join(repoRoot, "tasks/artifacts/projection-table-audit-2026-10-26/release-verification", `${sha}.json`));
  const receipt = {
    version: FORGE_RELEASE_VERIFIER_VERSION, sha, verified,
    commit: { subject: git(repoRoot, ["log", "-1", "--format=%s", sha]), committedAt: git(repoRoot, ["log", "-1", "--format=%cI", sha]),
      tree: git(repoRoot, ["rev-parse", `${sha}^{tree}`]) },
    verifierSha256: sha256(readFileSync(__filename, "utf8")),
    roots: FORGE_RUN_ROOTS, requiredModules: FORGE_REQUIRED_MODULES, reviewedDynamicSites: REVIEWED_DYNAMIC_SITES,
    closure: { moduleCount: scan.modules.length,
      modulesSha256: sha256(scan.modules.map(file => `${sha256(readFileSync(join(webRoot, file), "utf8"))}  ${file}`).join("\n")), modules: scan.modules },
    findings: scan.findings, dynamicSites: scan.dynamicSites, guardRegexes: scan.guardRegexes,
  };
  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`${verified ? "VERIFIED" : "NOT VERIFIED"} ${sha}: ${scan.modules.length} modules, ${scan.findings.length} findings, `
    + `${scan.dynamicSites.length} dynamic table sites. Receipt ${receiptPath} sha256 ${sha256(readFileSync(receiptPath, "utf8"))}`);
  for (const finding of scan.findings.slice(0, 40)) console.log(`  ${finding.kind} ${finding.file}:${finding.line} ${finding.text}`);
  process.exitCode = verified ? 0 : 1;
}

if (require.main === module) main();

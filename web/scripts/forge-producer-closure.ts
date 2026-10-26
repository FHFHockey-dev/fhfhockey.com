/**
 * The FORGE producer closure: every module that can shape a FORGE run (its import closure from the production
 * entrypoints), and its identity, the sha256 over each module's path and content. A later commit that leaves the
 * closure unchanged has the same identity, and any change to a module in it yields a new one (TJ/Astra F1, 2026-10-26).
 *
 * `next.config.js` runs this at production build time (`--print`) and inlines the hash as FORGE_PRODUCER_CLOSURE_SHA256,
 * which the run writer stamps on each invocation (lib/projections/forgeProducerIdentity.ts). The release verifier
 * (scripts/verify-forge-release-sha.ts) scans and hashes with the same functions, so a verified receipt names exactly the
 * identity a build of that closure stamps. Admission code and its allowlist must stay outside the closure, so listing a
 * verified identity never changes it.
 *
 *   NODE_PATH=. npx ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' \
 *     scripts/forge-producer-closure.ts [--print | --json]
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

import { FORGE_PRODUCER_IDENTITY_VERSION } from "../lib/projections/forgeProducerIdentity";

export { FORGE_PRODUCER_IDENTITY_VERSION };
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
/** Consumer admission and its allowlist: inside the closure, listing an identity would change that identity. */
export const ADMISSION_MODULES = ["lib/projections/externalInputProof.ts", "lib/projections/verifiedForgeReleases.ts"];

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
  for (const admission of ADMISSION_MODULES) if (modules.includes(admission)) findings.push({ file: admission, line: 0, kind: "admission_module_in_closure", text: "" });
  return { modules, findings, dynamicSites, guardRegexes };
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** The identity of a scanned closure: sha256 of "<module sha256>  <path>" lines, path-sorted (UTF-8 source text). */
export function forgeClosureSha256(webRoot: string, modules: string[]): string {
  return sha256([...modules].sort().map(file => `${sha256(readFileSync(join(webRoot, file), "utf8"))}  ${file}`).join("\n"));
}

/** Scans and identifies the producer closure of the tree at `webRoot` with that tree's own tsconfig. */
export function computeForgeProducerClosure(webRoot: string, roots = FORGE_RUN_ROOTS) {
  const config = ts.readConfigFile(join(webRoot, "tsconfig.json"), ts.sys.readFile);
  if (config.error) throw new Error("tsconfig.json could not be read.");
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, webRoot);
  const scan = scanForgeClosure(webRoot, roots, options);
  return { scan, closureSha256: forgeClosureSha256(webRoot, scan.modules) };
}

if (require.main === module) {
  const { scan, closureSha256 } = computeForgeProducerClosure(resolve(__dirname, ".."));
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ version: FORGE_PRODUCER_IDENTITY_VERSION, closureSha256, modules: scan.modules,
      findings: scan.findings }, null, 2));
  } else console.log(closureSha256);
}

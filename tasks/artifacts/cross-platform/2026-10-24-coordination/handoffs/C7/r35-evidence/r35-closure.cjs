// Reviewer probe: the runner's static import closure, plus import forms the committed scanner does not follow.
const fs = require("fs"), path = require("path");
const root = process.argv[2];
const ts = require(path.join(root, "node_modules/typescript"));
const files = new Set(), unfollowed = [], dynamicImports = [];
const resolve = (from, spec) => {
  const base = spec.startsWith("lib/") ? path.join(root, spec) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
  return base ? [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")].find(fs.existsSync) ?? null : null;
};
const visit = file => {
  if (files.has(file)) return; files.add(file);
  const src = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const rel = path.relative(root, file);
  const walk = node => {
    if ((ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text, target = resolve(file, spec);
      if (target) visit(target);
      else if (/^(utils|components|hooks|pages|contexts|styles|public)\//.test(spec)) unfollowed.push(`${rel} -> ${spec}`);
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === "require"))
      dynamicImports.push(`${rel}: ${node.getText(src).slice(0, 120)}`);
    ts.forEachChild(node, walk);
  };
  walk(src);
};
visit(path.join(root, "lib/projections/run-forge-projections.ts"));
console.log(JSON.stringify({ closureFiles: files.size, unfollowedAliasImports: unfollowed, dynamicImports,
  outsideProjections: [...files].map(f => path.relative(root, f)).filter(f => !f.startsWith("lib/projections/")).sort() }, null, 2));

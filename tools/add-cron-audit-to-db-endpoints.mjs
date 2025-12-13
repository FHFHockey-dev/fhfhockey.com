import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const targetRoot = path.join(repoRoot, "web", "pages", "api", "v1", "db");

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) files.push(...walk(p));
    else files.push(p);
  }
  return files;
}

function insertImport(source) {
  const importLine = 'import { withCronJobAudit } from "lib/cron/withCronJobAudit";';
  const lines = source.split("\n");

  // Remove any stray copies first (the earlier version could insert inside multiline imports).
  const filtered = lines.filter((l) => l.trim() !== importLine);

  // Insert before the first import statement to avoid breaking multiline imports.
  const firstImportIdx = filtered.findIndex(
    (l) => l.startsWith("import ") || l.startsWith("import\t")
  );
  if (firstImportIdx === -1) return importLine + "\n" + filtered.join("\n");

  filtered.splice(firstImportIdx, 0, importLine);
  return filtered.join("\n");
}

function ensureWrappedAdminOnlyExport(source) {
  const start = source.indexOf("export default withCronJobAudit(adminOnly(");
  if (start === -1) return source;

  // Insert a closing paren before the semicolon that terminates the export statement.
  // We scan from the start of the export expression to the first semicolon at nesting depth 1
  // (meaning: we're still inside withCronJobAudit(...)).
  let out = source;
  let i = start;
  let depth = 0;
  let inStr = null;
  let escape = false;
  for (; i < out.length; i++) {
    const ch = out[i];
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\\\") {
        escape = true;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === ";" && depth === 1) {
      // If already has "))" before ";" don't add again.
      const prev = out.slice(Math.max(0, i - 2), i);
      if (prev !== "))") out = out.slice(0, i) + ")" + out.slice(i);
      break;
    }
  }

  return out;
}

function wrapAdminOnlyExport(source) {
  const exportIdx = source.indexOf("export default adminOnly(");
  if (exportIdx === -1) return source;

  let out = source.replace(
    "export default adminOnly(",
    "export default withCronJobAudit(adminOnly("
  );

  out = ensureWrappedAdminOnlyExport(out);
  return out;
}

function wrapDefaultFunctionExport(source) {
  const re = /export default (async )?function handler\s*\(/;
  if (!re.test(source)) return source;

  let out = source.replace(re, (_m, asyncPart) => `${asyncPart ? "async " : ""}function handler(`);
  if (!out.includes("export default withCronJobAudit(handler);")) {
    out = out.replace(/\n*$/, "\n\nexport default withCronJobAudit(handler);\n");
  }
  return out;
}

function wrapExportDefaultHandlerVar(source) {
  if (!source.includes("export default handler;")) return source;
  return source.replace(
    "export default handler;",
    "export default withCronJobAudit(handler);"
  );
}

function transformFile(filePath, source) {
  if (filePath.endsWith(path.join("db", "cron-report.ts"))) return source;
  if (!filePath.endsWith(".ts")) return source;
  if (!source.includes("export default")) return source;
  if (source.includes("cron_job_audit")) return source; // already logs explicitly

  let out = insertImport(source);
  out = wrapAdminOnlyExport(out);
  out = wrapExportDefaultHandlerVar(out);
  out = wrapDefaultFunctionExport(out);
  out = ensureWrappedAdminOnlyExport(out);
  return out;
}

const files = walk(targetRoot).filter((f) => f.endsWith(".ts"));
let changed = 0;

for (const filePath of files) {
  const source = fs.readFileSync(filePath, "utf8");
  const out = transformFile(filePath, source);
  if (out !== source) {
    fs.writeFileSync(filePath, out, "utf8");
    changed++;
    console.log("updated", path.relative(repoRoot, filePath));
  }
}

console.log(`done: ${changed} file(s) updated`);

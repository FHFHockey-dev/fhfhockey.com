// Extracts { table: { column: tsType } } for the public schema's Tables and Views from database-generated.types.ts.
import { readFileSync, writeFileSync } from "node:fs";

const [source, out] = process.argv.slice(2);
const lines = readFileSync(source, "utf8").split("\n");
const start = lines.findIndex((line, index) => index > 500 && line === "    Tables: {");
const end = lines.findIndex((line, index) => index > start && line === "    Functions: {");
const schema = {};
let table = null;
for (let i = start; i < end; i++) {
  const name = lines[i].match(/^      (\w+): \{$/);
  if (name) { table = name[1]; continue; }
  if (!table || !/^        Row: \{/.test(lines[i])) continue;
  const columns = {};
  const inline = lines[i].match(/^        Row: \{(.*)\}\s*$/);
  const parse = text => {
    for (const part of text.split(/;\s*|\n/)) {
      const field = part.trim().match(/^"?(\w+)"?: (.+)$/);
      if (field) columns[field[1]] = field[2].replace(/;$/, "").trim();
    }
  };
  if (inline) parse(inline[1]);
  else {
    for (i++; i < end && !/^        \}/.test(lines[i]); i++) parse(lines[i]);
  }
  schema[table] = columns;
  table = null;
}
writeFileSync(out, JSON.stringify(schema));
console.log(Object.keys(schema).length, "relations");

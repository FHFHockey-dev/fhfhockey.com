/**
 * Offline fixture world: an in-memory relation store that answers the PostgREST builder ops the FORGE writer uses.
 * Test-only. Writes are acknowledged and never change the relations, so every read sees the same frozen world,
 * except relations listed in `mutable` (the run lifecycle), which apply inserts, updates and deletes.
 * Unknown builder methods throw, so a new read shape fails loudly instead of returning a silent empty page.
 */
export type Row = Record<string, any>;
export type RpcHandler = (args: Record<string, any>, options?: Record<string, unknown>) => { data: unknown; error: unknown };
/** Many-to-one embeds: `${table}.${embed}` -> local column on the table, foreign column on the embedded relation. */
export type Join = { relation: string; local: string; foreign: string };
export type World = {
  tables: Record<string, Row[]>; rpc: Record<string, RpcHandler>; joins?: Record<string, Join>;
  /** Relations whose writes apply, with the defaults a database would fill on insert. */
  mutable?: Record<string, (row: Row) => Row>;
  /** Observes every write (applied or not), e.g. to advance a frozen clock at a fixed point in the run. */
  onWrite?: (table: string, method: string, rows: Row[]) => void;
};
type Op = { method: string; args: any[] };

const MUTATIONS = new Set(["insert", "upsert", "update", "delete"]);
const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

/** Splits on top-level commas only (embedded selects keep their parentheses). */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0, current = "";
  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) { parts.push(current.trim()); current = ""; continue; }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const read = (row: Row, column: string) => {
  if (column.includes("->")) {
    const value = column.split(/->>?/).reduce<any>((value, key) => value?.[key], row);
    return value === undefined ? null : column.includes("->>") && value !== null ? String(value) : value;
  }
  const path = /^(\w+)\.(\w+)$/.exec(column);
  return path ? row[path[1]]?.[path[2]] ?? null : row[column];
};
const EMBED = /^(\w+)(!inner)?\((.*)\)$/;

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const left = String(a), right = String(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseLiteral(value: string): unknown {
  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function looseEqual(cell: unknown, value: unknown) {
  if (cell == null || value == null) return cell == null && value == null;
  return String(cell) === String(value);
}

function predicate(column: string, operator: string, value: unknown): (row: Row) => boolean {
  return (row) => {
    const cell = read(row, column);
    switch (operator) {
      case "eq": return looseEqual(cell, value);
      case "neq": return !looseEqual(cell, value);
      case "lt": return cell != null && compare(cell, value) < 0;
      case "lte": return cell != null && compare(cell, value) <= 0;
      case "gt": return cell != null && compare(cell, value) > 0;
      case "gte": return cell != null && compare(cell, value) >= 0;
      case "is": return value === null ? cell == null : cell === value;
      case "in": {
        const list = Array.isArray(value) ? value
          : String(value).replace(/^\(|\)$/g, "").split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
        return list.some((item) => looseEqual(cell, item));
      }
      case "like": case "ilike": {
        const pattern = new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`,
          operator === "ilike" ? "i" : "");
        return cell != null && pattern.test(String(cell));
      }
      case "contains": return Array.isArray(cell) && (value as unknown[]).every((item) => cell.includes(item));
      default: throw new Error(`fixture world: unsupported operator ${operator} on ${column}`);
    }
  };
}

/** PostgREST `or` grammar, including nested and/or groups. */
function orPredicate(expression: string): (row: Row) => boolean {
  const branches = splitTopLevel(expression).map(orAtom);
  return (row) => branches.some((branch) => branch(row));
}
function orAtom(atom: string): (row: Row) => boolean {
  const group = /^(and|or)\((.*)\)$/.exec(atom);
  if (group) {
    if (group[1] === "or") return orPredicate(group[2]);
    const parts = splitTopLevel(group[2]).map(orAtom);
    return (row: Row) => parts.every(part => part(row));
  }
  const match = /^([\w>-]+)\.(not\.)?(\w+)\.(.*)$/.exec(atom);
  if (!match) throw new Error(`fixture world: unsupported or() atom ${atom}`);
  const [, column, negated, operator, raw] = match;
  const value = operator === "in" ? raw : parseLiteral(raw.replace(/^"(.*)"$/, "$1"));
  const test = predicate(column, operator, value);
  return negated ? (row) => !test(row) : test;
}

function project(row: Row, columns: string): Row {
  if (!columns || columns.trim() === "*") return clone(row);
  const out: Row = {};
  for (const item of splitTopLevel(columns)) {
    if (item === "*") { Object.assign(out, clone(row)); continue; }
    const embed = EMBED.exec(item);
    if (embed) { out[embed[1]] = row[embed[1]] == null ? null : project(row[embed[1]], embed[3]); continue; }
    if (item.includes("(")) throw new Error(`fixture world: embedded select ${item} not supported`);
    const alias = /^(\w+):(.+)$/.exec(item);
    const name = alias ? alias[1] : item.replace(/->>?/, "_");
    const column = alias ? alias[2] : item;
    const plain = /^(\w+)->>?(\w+)$/.exec(column);
    const key = alias ? name : plain ? plain[2] : column;
    out[key] = clone(read(row, column) ?? null);
  }
  return out;
}

export function createWorldClient(world: World) {
  const evaluate = (table: string, ops: Op[]) => {
    const mutation = ops.find((op) => MUTATIONS.has(op.method));
    if (mutation) {
      const returning = ops.some((op) => op.method === "select");
      const payload = mutation.args[0];
      let rows: Row[] = Array.isArray(payload) ? payload : payload ? [payload] : [];
      world.onWrite?.(table, mutation.method, clone(rows));
      const defaults = world.mutable?.[table];
      if (defaults) {
        const stored = (world.tables[table] ??= []);
        const filters = ops.filter((op) => ["eq", "in", "is", "lt", "lte", "gt", "gte", "neq"].includes(op.method))
          .map((op) => predicate(op.args[0], op.method, op.args[1]));
        const matched = stored.filter((row) => filters.every((test) => test(row)));
        if (mutation.method === "insert") {
          rows = rows.map((row) => defaults(clone(row)));
          stored.push(...rows);
        } else if (mutation.method === "update") {
          for (const row of matched) Object.assign(row, clone(payload));
          rows = matched;
        } else if (mutation.method === "delete") {
          world.tables[table] = stored.filter((row) => !matched.includes(row));
          rows = matched;
        } else {
          throw new Error(`fixture world: ${mutation.method} on mutable ${table} not supported`);
        }
        const columns = String(ops.find((op) => op.method === "select")?.args[0] ?? "*");
        const data = rows.map((row) => project(row, columns));
        if (ops.some((op) => op.method === "single")) {
          return data.length === 1 ? { data: data[0], error: null, count: null, status: 201 }
            : { data: null, error: { code: "PGRST116", message: "fixture world: single() row count" }, count: null, status: 406 };
        }
        return { data: returning ? data : null, error: null, count: null, status: 201 };
      }
      return { data: returning ? clone(rows) : null, error: null, count: null, status: 201 };
    }
    let rows = clone(world.tables[table] ?? []);
    const selected = String(ops.find((op) => op.method === "select")?.args[0] ?? "*");
    for (const item of splitTopLevel(selected)) {
      const embed = EMBED.exec(item);
      if (!embed) continue;
      const join = world.joins?.[`${table}.${embed[1]}`];
      if (!join) throw new Error(`fixture world: no join for ${table}.${embed[1]}`);
      const foreign = world.tables[join.relation] ?? [];
      rows = rows.map((row) => ({ ...row, [embed[1]]: clone(foreign.find((other) => looseEqual(other[join.foreign], row[join.local])) ?? null) }));
      if (embed[2]) rows = rows.filter((row) => row[embed[1]] != null);
    }
    let columns = "*", count: string | undefined, head = false;
    const orders: Array<{ column: string; ascending: boolean; nullsFirst: boolean }> = [];
    let from = 0, to = Number.POSITIVE_INFINITY, limit = Number.POSITIVE_INFINITY;
    let single: "single" | "maybeSingle" | null = null;
    for (const { method, args } of ops) {
      switch (method) {
        case "select": columns = args[0] ?? "*"; count = args[1]?.count; head = args[1]?.head === true; break;
        case "eq": case "neq": case "lt": case "lte": case "gt": case "gte": case "is": case "in": case "like": case "ilike": case "contains":
          rows = rows.filter(predicate(args[0], method, args[1])); break;
        case "not": { const test = predicate(args[0], args[1], args[1] === "in" ? args[2] : parseLiteral(String(args[2])));
          rows = rows.filter((row) => !test(row)); break; }
        case "filter": rows = rows.filter(predicate(args[0], args[1], args[1] === "in" ? args[2] : args[2])); break;
        case "match": rows = rows.filter((row) => Object.entries(args[0] as Row).every(([key, value]) => looseEqual(row[key], value))); break;
        case "or": rows = rows.filter(orPredicate(String(args[0]))); break;
        case "order": orders.push({ column: args[0], ascending: args[1]?.ascending !== false,
          nullsFirst: args[1]?.nullsFirst ?? args[1]?.ascending === false }); break;
        case "range": from = Number(args[0]); to = Number(args[1]); break;
        case "limit": limit = Number(args[0]); break;
        case "single": case "maybeSingle": single = method; break;
        case "abortSignal": case "returns": case "overrideTypes": break;
        default: throw new Error(`fixture world: unsupported builder method ${method} on ${table}`);
      }
    }
    if (orders.length) {
      rows = rows.map((row, index) => ({ row, index })).sort((a, b) => {
        for (const order of orders) {
          const left = read(a.row, order.column), right = read(b.row, order.column);
          if (left == null || right == null) {
            if (left == null && right == null) continue;
            return (left == null) === order.nullsFirst ? -1 : 1;
          }
          const delta = compare(left, right);
          if (delta !== 0) return order.ascending ? delta : -delta;
        }
        return a.index - b.index;
      }).map(({ row }) => row);
    }
    const total = rows.length;
    rows = rows.slice(from, Number.isFinite(to) ? to + 1 : undefined);
    if (Number.isFinite(limit)) rows = rows.slice(0, limit);
    const data = rows.map((row) => project(row, columns));
    const counted = count ? { count: total } : { count: null };
    if (head) return { data: null, error: null, ...counted, status: 200 };
    if (single === "single") {
      return data.length === 1 ? { data: data[0], error: null, ...counted, status: 200 }
        : { data: null, error: { code: "PGRST116", message: "fixture world: single() row count" }, ...counted, status: 406 };
    }
    if (single === "maybeSingle") {
      return data.length <= 1 ? { data: data[0] ?? null, error: null, ...counted, status: 200 }
        : { data: null, error: { code: "PGRST116", message: "fixture world: maybeSingle() row count" }, ...counted, status: 406 };
    }
    return { data, error: null, ...counted, status: 200 };
  };

  const builder = (run: () => any, ops: Op[]) => {
    const proxy: any = new Proxy({}, {
      get(_target, property) {
        if (property === "then") return (resolve: any, reject: any) => Promise.resolve().then(run).then(resolve, reject);
        if (property === "catch") return (reject: any) => Promise.resolve().then(run).catch(reject);
        if (property === "finally") return (callback: any) => Promise.resolve().then(run).finally(callback);
        return (...args: any[]) => { ops.push({ method: String(property), args }); return proxy; };
      },
    });
    return proxy;
  };

  return {
    from(table: string) {
      const ops: Op[] = [];
      return builder(() => evaluate(table, ops), ops);
    },
    rpc(name: string, args: Record<string, any> = {}, options?: Record<string, unknown>) {
      const ops: Op[] = [];
      return builder(() => {
        // A capture deadline adds abortSignal to the live query (never to the recorded request); nothing else may chain.
        const chained = ops.filter((op) => op.method !== "abortSignal");
        if (chained.length) throw new Error(`fixture world: rpc ${name} chained ${chained.map((op) => op.method).join(",")}`);
        const handler = world.rpc[name];
        if (!handler) return { data: null, error: { code: "PGRST202", message: `fixture world: no rpc ${name}` } };
        return clone(handler(clone(args), options));
      }, ops);
    },
  };
}

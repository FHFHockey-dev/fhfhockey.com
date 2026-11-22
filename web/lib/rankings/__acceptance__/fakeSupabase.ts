// Offline acceptance harness: an in-memory, fail-closed stand-in for the
// Supabase query builder. Unknown tables throw so a reproduction can never
// silently read a source it did not declare. Nothing here touches the network.

export type FakeDb = {
  tables: Record<string, Array<Record<string, unknown>>>;
  calls: Array<{ table: string; filters: Array<[string, string, unknown]> }>;
};

type Filter = [method: string, key: string, value: unknown];

function compare(left: unknown, right: unknown) {
  if (left === right) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return (left as number) < (right as number) ? -1 : 1;
}

export function createFakeSupabase(db: FakeDb) {
  function from(table: string) {
    if (!(table in db.tables)) {
      throw new Error(`fakeSupabase: undeclared table "${table}" (fail closed)`);
    }
    const filters: Filter[] = [];
    const orders: Array<{ key: string; ascending: boolean }> = [];
    let rangeFrom: number | null = null;
    let rangeTo: number | null = null;
    let limitCount: number | null = null;
    db.calls.push({ table, filters });

    function resolveRows(paginate = true) {
      let rows = [...(db.tables[table] ?? [])].filter((row) =>
        filters.every(([method, key, value]) => {
          const field = row[key];
          if (method === "eq") return field === value;
          if (method === "neq") return field !== value;
          if (method === "gte") return field != null && (field as number) >= (value as number);
          if (method === "gt") return field != null && (field as number) > (value as number);
          if (method === "lte") return field != null && (field as number) <= (value as number);
          if (method === "lt") return field != null && (field as number) < (value as number);
          if (method === "in") return (value as unknown[]).includes(field);
          if (method === "is") return field === value;
          if (method === "or") {
            // Supports PostgREST `and(a.eq.1,b.eq.x),and(...)` groups and a
            // flat `a.eq.1,b.eq.x` list, eq only.
            const clauseMatches = (clause: string) => {
              const [column, op, ...rest] = clause.split(".");
              if (op !== "eq") throw new Error(`fakeSupabase: unsupported or-op ${op}`);
              return String(row[column]) === rest.join(".");
            };
            const expression = value as string;
            const groups = expression.match(/and\(([^)]*)\)/g);
            if (groups) {
              return groups.some((group) => group.slice(4, -1).split(",").every(clauseMatches));
            }
            return expression.split(",").some(clauseMatches);
          }
          throw new Error(`fakeSupabase: unsupported filter ${method}`);
        }),
      );
      if (orders.length > 0) {
        rows.sort((a, b) => {
          for (const { key, ascending } of orders) {
            const result = compare(a[key], b[key]);
            if (result !== 0) return ascending ? result : -result;
          }
          return 0;
        });
      }
      if (!paginate) return rows;
      if (rangeFrom != null) rows = rows.slice(rangeFrom, (rangeTo ?? rows.length - 1) + 1);
      if (limitCount != null) rows = rows.slice(0, limitCount);
      return rows;
    }

    const query: Record<string, unknown> = {};
    let countRequested = false;
    let head = false;
    query.select = (_fields?: string, options?: { count?: string; head?: boolean }) => {
      countRequested = options?.count === "exact";
      head = options?.head === true;
      return query;
    };
    query.match = (values: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(values)) filters.push(["eq", key, value]);
      return query;
    };
    query.upsert = async (rows: Array<Record<string, unknown>>, options: { onConflict: string; count?: string }) => {
      const keys = options.onConflict.split(",");
      for (const row of rows) {
        const stored = db.tables[table].find(other => keys.every(key => row[key] === other[key]));
        if (stored) Object.assign(stored, row);
        else db.tables[table].push({ ...row });
      }
      return { error: null, count: options.count === "exact" ? rows.length : null };
    };
    for (const method of ["eq", "neq", "gte", "gt", "lte", "lt", "in", "is"]) {
      query[method] = (key: string, value: unknown) => {
        filters.push([method, key, value]);
        return query;
      };
    }
    query.or = (expression: string) => {
      filters.push(["or", "", expression]);
      return query;
    };
    query.abortSignal = () => query;
    query.order = (key: string, options?: { ascending?: boolean }) => {
      orders.push({ key, ascending: options?.ascending ?? true });
      return query;
    };
    query.range = (fromIndex: number, toIndex: number) => {
      rangeFrom = fromIndex;
      rangeTo = toIndex;
      return query;
    };
    query.limit = (count: number) => {
      limitCount = count;
      return query;
    };
    query.maybeSingle = () =>
      Promise.resolve({ data: resolveRows()[0] ?? null, error: null });
    query.single = () =>
      Promise.resolve({ data: resolveRows()[0] ?? null, error: null });
    query.then = (
      resolve: (value: { data: unknown; error: null }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data: head ? null : resolveRows(), error: null, count: countRequested ? resolveRows(false).length : null }).then(resolve, reject);
    return query as any;
  }
  return { from };
}

/** Fetch must never be reached by these offline reproductions. */
export function failClosedFetch() {
  return () => {
    throw new Error("network blocked in offline acceptance tests");
  };
}

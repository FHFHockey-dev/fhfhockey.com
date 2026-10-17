// Synthetic executable contract for database-prerequisite.sql, NOT PostgreSQL.
// It models transaction staging/rollback and a lock shared by recurring/legacy
// writers. Actual PostgreSQL trigger/ON CONFLICT/isolation tests remain required.
const key = row => `${row.game_key ?? '477'}:${row.source_game_id}:${row.team_id}`;
const error = code => Object.assign(new Error(code), { code });
class TransactionModel {
  constructor(rows = []) {
    this.rows = new Map(rows.map(row => [key(row), structuredClone(row)]));
    this.locked = false;
    this.applied = 0;
  }
  acquire() { if (this.locked) return false; this.locked = true; return true; }
  release() { this.locked = false; }
  guard(old, incoming) {
    const timestamp = Date.parse(incoming.fetched_at);
    if (!Number.isFinite(timestamp)) throw error('RS003');
    if (old && timestamp <= Date.parse(old.fetched_at ?? '1970-01-01T00:00:00Z')) throw error('RS001');
  }
  statement(rows) {
    if (!this.acquire()) throw error('RS002');
    try {
      const staged = new Map(this.rows);
      for (const row of rows) { this.guard(staged.get(key(row)), row); staged.set(key(row), structuredClone(row)); }
      this.rows = staged; this.applied += rows.length;
    } finally { this.release(); }
  }
  commit(args) {
    if (!this.acquire()) return { outcome: 'skipped_busy', rowsUpserted: 0 };
    try {
      const rows = args.p_rows;
      const inRange = [...this.rows.values()].filter(row => (row.game_key ?? '477') === '477' && (row.season ?? '2026') === '2026'
        && (row.game_date ?? '2026-10-15') >= args.p_start_date && (row.game_date ?? '2026-10-15') <= args.p_end_date).slice(0, 1001);
      const incoming = new Set(rows.map(key));
      if (inRange.length > 1000 || inRange.some(row => !incoming.has(key(row)))) return { outcome: 'rejected', rowsUpserted: 0 };
      if (rows.some(row => this.rows.has(key(row)) && Date.parse(this.rows.get(key(row)).fetched_at ?? '1970-01-01T00:00:00Z') >= Date.parse(args.p_observed_at))) {
        return { outcome: 'skipped_stale', rowsUpserted: 0 };
      }
      const staged = new Map(this.rows);
      for (const row of rows) { this.guard(staged.get(key(row)), row); staged.set(key(row), structuredClone(row)); }
      this.rows = staged; this.applied += rows.length;
      return { outcome: 'applied', rowsUpserted: rows.length };
    } catch (failure) {
      if (failure.code === 'RS001') return { outcome: 'skipped_stale', rowsUpserted: 0 };
      throw failure;
    } finally { this.release(); }
  }
}
module.exports = { TransactionModel };

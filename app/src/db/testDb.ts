import initSqlJs, {
  type Database as SqlJsDatabase,
  type SqlJsStatic,
} from 'sql.js';
import type { Db, Row } from './types';

// --- test-only helpers (sql.js) ---

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

async function sqlJsDb(): Promise<SqlJsDatabase> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs();
  }
  const SQL = await sqlJsPromise;
  return new SQL.Database();
}

export async function openTestDb(): Promise<Db> {
  const raw = await sqlJsDb();
  const all = <T = Row>(sql: string, params: unknown[] = []) => {
    const stmt = raw.prepare(sql);
    try {
      stmt.bind(params as never[]);
      const out: T[] = [];
      while (stmt.step()) {
        out.push(stmt.getAsObject() as unknown as T);
      }
      return Promise.resolve(out);
    } finally {
      stmt.free();
    }
  };
  const run = (sql: string, params: unknown[] = []) => {
    try {
      if (params.length === 0) {
        raw.exec(sql);
        return Promise.resolve({ changes: raw.getRowsModified() });
      }
      const stmt = raw.prepare(sql);
      try {
        stmt.bind(params as never[]);
        stmt.step();
        return Promise.resolve({ changes: raw.getRowsModified() });
      } finally {
        stmt.free();
      }
    } catch (err) {
      return Promise.reject(err);
    }
  };
  return {
    exec: (sql) => {
      raw.exec(sql);
      return Promise.resolve();
    },
    run,
    all,
    first: async <T = Row>(sql: string, params: unknown[] = []) => {
      const rows = await all<T>(sql, params);
      return rows[0] ?? null;
    },
  };
}

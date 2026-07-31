import * as SQLite from 'expo-sqlite';
import type { Db } from './types';

// Wraps the expo-sqlite database in the app's Db facade.
export function expoDb(database: SQLite.SQLiteDatabase): Db {
  return {
    exec: (sql) => database.execAsync(sql),
    run: async (sql, params = []) => {
      const result = await database.runAsync(sql, params as SQLite.SQLiteBindValue[]);
      return { changes: result.changes };
    },
    all: (sql, params = []) => database.getAllAsync(sql, params as SQLite.SQLiteBindValue[]),
    first: (sql, params = []) => database.getFirstAsync(sql, params as SQLite.SQLiteBindValue[]),
  };
}

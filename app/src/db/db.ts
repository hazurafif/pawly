import * as SQLite from 'expo-sqlite';
import { expoDb } from './expoAdapter';
import { migrate } from './schema';
import { Repository } from './repository';

let repoPromise: Promise<Repository> | null = null;

// One shared connection and one Repository instance for the whole app:
// the repository's transaction mutex only serializes writers that share
// it, and expo-sqlite shares the underlying connection per database name.
export function getRepository(): Promise<Repository> {
    if (!repoPromise) {
    repoPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('pawly.db');
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA busy_timeout = 5000;');
      const adapter = expoDb(db);
      await migrate(adapter);
      return new Repository(adapter);
    })();
  }
  return repoPromise;
}

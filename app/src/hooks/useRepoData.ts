import { useCallback, useEffect, useRef, useState } from 'react';
import { getRepository } from '../db/db';
import { subscribeData } from '../db/notify';
import type { Repository } from '../db/repository';

// Loads data through a repository selector and keeps it fresh after every
// local write or sync application. The selector may be an inline arrow
// function — it is read from a ref, so callers never need to memoize.
export function useRepoData<T>(
  selector: (repo: Repository) => Promise<T>
): { data: T | null; error: Error | null } {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      const repo = await getRepository();
      const result = await selectorRef.current(repo);
      setData(result);
      setError(null);
    } catch (e) {
      setError(e as Error);
    }
  }, []);

  useEffect(() => {
    void load();
    return subscribeData(() => {
      void load();
    });
  }, [load]);

  return { data, error };
}

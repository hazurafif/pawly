import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { expoDb } from '../db/expoAdapter';
import { migrate } from '../db/schema';
import { Repository } from '../db/repository';
import { HttpTransport } from '../sync/transport';
import { SyncClient } from '../sync/client';
import { getServerUrl } from '../settings/settings';

export type SyncStatus =
  | { state: 'idle'; lastSync: string | null; error: string | null }
  | { state: 'syncing'; lastSync: string | null }
  | { state: 'error'; lastSync: string | null; error: string };

interface SyncContextValue {
  status: SyncStatus;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue>({
  status: { state: 'idle', lastSync: null, error: null },
  syncNow: async () => {},
});

async function buildClient(): Promise<{ client: SyncClient; repo: Repository } | null> {
  const baseUrl = await getServerUrl();
  if (!baseUrl) {
    return null;
  }
  const db = (await import('expo-sqlite')).openDatabaseAsync('pawly.db');
  const adapter = expoDb(await db);
  await migrate(adapter);
  const repo = new Repository(adapter);
  const transport = new HttpTransport({
    baseUrl,
    fetch: (await import('expo/fetch')).fetch,
    fileToBlob: async (uri: string) => new FileSystem.File(uri),
    saveBytes: async (uri: string, data: Uint8Array) => {
      const file = new FileSystem.File(uri);
      await file.write(new Uint8Array(data));
    },
  });
  return { client: new SyncClient(repo, transport), repo };
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>({ state: 'idle', lastSync: null, error: null });
  const lastSyncRef = useRef<string | null>(null);
  const syncingRef = useRef(false);
  const router = useRouter();

  const syncNow = useCallback(async () => {
    if (syncingRef.current) {
      return;
    }
    syncingRef.current = true;
    setStatus({ state: 'syncing', lastSync: lastSyncRef.current });
    try {
      const built = await buildClient();
      if (!built) {
        router.push('/settings');
        setStatus({ state: 'idle', lastSync: lastSyncRef.current, error: null });
        return;
      }
      await built.client.sync();
      const now = new Date().toISOString();
      lastSyncRef.current = now;
      setStatus({ state: 'idle', lastSync: now, error: null });
    } catch {
      setStatus({ state: 'error', lastSync: lastSyncRef.current, error: 'sync failed' });
    } finally {
      syncingRef.current = false;
    }
  }, [router]);

  // Sync on app foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncNow();
      }
    });
    return () => sub.remove();
  }, [syncNow]);

  // Sync on network reconnect + on first mount.
  useEffect(() => {
    const net = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void syncNow();
      }
    });
    void syncNow();
    return () => net.remove();
  }, [syncNow]);

  const value = useMemo(() => ({ status, syncNow }), [status, syncNow]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}

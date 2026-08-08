import * as Network from 'expo-network';
import {
  autoDetectEnabled,
  envServerPort,
  envServerUrl,
  setServerUrl,
} from '../settings/settings';

export interface HealthDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

// Pings the Go server's /healthz liveness endpoint. Any non-OK response,
// network error, or hang (bounded by timeoutMs) means "not the server".
// The timeout is raced explicitly because a fetch may ignore its abort
// signal (the RN fetch polyfill honors it; arbitrary mocks may not).
export async function checkHealth(baseUrl: string, deps: HealthDeps = {}): Promise<boolean> {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = deps.timeoutMs ?? 1500;
  const controller = new AbortController();
  let timeoutReject: ((e: Error) => void) | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutReject = reject;
  });
  const timer = setTimeout(() => {
    controller.abort();
    timeoutReject?.(new Error('healthz timeout'));
  }, timeoutMs);
  try {
    const res = await Promise.race([
      fetchImpl(baseUrl.replace(/\/+$/, '') + '/healthz', { signal: controller.signal }),
      timeout,
    ]);
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Hosts worth probing: on web the app and the home server usually share the
// dev machine (location.hostname); on native the server lives somewhere on
// the same /24 subnet as the device, so probe every host octet.
export async function candidateHosts(
  getIp: () => Promise<string> = () => Network.getIpAddressAsync()
): Promise<string[]> {
  const hosts = new Set<string>();
  if (typeof location !== 'undefined' && location?.hostname) {
    hosts.add(location.hostname);
  }
  try {
    const ip = await getIp();
    // expo-network reports 0.0.0.0 when the address cannot be determined.
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(ip);
    if (m && ip !== '0.0.0.0') {
      const prefix = `${m[1]}.${m[2]}.${m[3]}.`;
      for (let i = 1; i <= 254; i++) {
        hosts.add(`${prefix}${i}`);
      }
    }
  } catch {
    // IP unknown — stick with the web hosts
  }
  if (hosts.size === 0) {
    hosts.add('localhost');
  }
  return [...hosts];
}

export interface DiscoveryDeps extends HealthDeps {
  getIp?: () => Promise<string>;
  port?: number;
}

// Finds the Pawly backend: an EXPO_PUBLIC_PAWLY_URL from .env is
// authoritative (health-checked, never overridden by a LAN scan); otherwise,
// when auto-detect is enabled, probes the LAN for a healthy /healthz and
// persists the winner so later runs skip the scan.
export async function discoverServerUrl(deps: DiscoveryDeps = {}): Promise<string | null> {
  const envUrl = envServerUrl();
  if (envUrl) {
    return (await checkHealth(envUrl, deps)) ? envUrl : null;
  }
  if (!autoDetectEnabled()) {
    return null;
  }
  const port = deps.port ?? envServerPort();
  const hosts = await candidateHosts(deps.getIp);
  const results = await Promise.allSettled(
    hosts.map(async (host) => {
      const url = `http://${host}:${port}`;
      if (await checkHealth(url, deps)) {
        return url;
      }
      throw new Error('not the Pawly server');
    })
  );
  const found = results.find((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled');
  if (!found) {
    return null;
  }
  await setServerUrl(found.value).catch(() => {
    // storage unavailable — the caller still has the URL for this run
  });
  return found.value;
}

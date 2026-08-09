import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import { candidateHosts, checkHealth, discoverServerUrl } from '../server';
import { getServerUrl } from '../../settings/settings';

const mocks = vi.hoisted(() => ({
  getIpAddressAsync: vi.fn(),
}));
vi.mock('expo-network', () => ({ getIpAddressAsync: mocks.getIpAddressAsync }));

function okFetch(url: string, okUrl: string | null): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === okUrl) {
      return new Response(null, { status: 200 });
    }
    throw new Error('not the Pawly server');
  }) as unknown as typeof fetch;
}

describe('checkHealth', () => {
  it('is true when /healthz responds OK', async () => {
    const fetchImpl = okFetch('http://x:8080/healthz', 'http://x:8080/healthz');
    expect(await checkHealth('http://x:8080/', { fetchImpl })).toBe(true);
  });

  it('is false on non-OK responses and network errors', async () => {
    const bad = vi.fn(async () => new Response(null, { status: 500 })) as unknown as typeof fetch;
    expect(await checkHealth('http://x:8080', { fetchImpl: bad })).toBe(false);
    const failing = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await checkHealth('http://x:8080', { fetchImpl: failing })).toBe(false);
  });

  it('is false when the server hangs past the timeout', async () => {
    const hanging = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    expect(await checkHealth('http://x:8080', { fetchImpl: hanging, timeoutMs: 20 })).toBe(false);
  });
});

describe('candidateHosts', () => {
  it('builds the full /24 range from the device IP', async () => {
    mocks.getIpAddressAsync.mockResolvedValue('192.168.1.23');
    const hosts = await candidateHosts(() => mocks.getIpAddressAsync());
    expect(hosts).toContain('192.168.1.1');
    expect(hosts).toContain('192.168.1.50');
    expect(hosts).toContain('192.168.1.254');
    expect(hosts).not.toContain('192.168.1.0');
    expect(hosts).not.toContain('192.168.1.255');
  });

  it('probes emulator loopback aliases before the LAN scan', async () => {
    mocks.getIpAddressAsync.mockResolvedValue('192.168.1.23');
    const hosts = await candidateHosts(() => mocks.getIpAddressAsync());
    // Android emulator -> dev machine loopback, then iOS sim / web localhost.
    expect(hosts[0]).toBe('10.0.2.2');
    expect(hosts[1]).toBe('localhost');
    expect(hosts.indexOf('192.168.1.50')).toBeGreaterThan(hosts.indexOf('10.0.2.2'));
  });

  it('falls back to the loopback aliases when the IP is unknown', async () => {
    mocks.getIpAddressAsync.mockResolvedValue('0.0.0.0');
    expect(await candidateHosts(() => mocks.getIpAddressAsync())).toEqual(['10.0.2.2', 'localhost']);
    mocks.getIpAddressAsync.mockRejectedValue(new Error('no ip'));
    expect(await candidateHosts(() => mocks.getIpAddressAsync())).toEqual(['10.0.2.2', 'localhost']);
  });
});

describe('discoverServerUrl', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_PAWLY_URL;
    delete process.env.EXPO_PUBLIC_PAWLY_AUTO_DETECT;
    delete process.env.EXPO_PUBLIC_PAWLY_PORT;
    vi.restoreAllMocks();
  });

  it('adopts a healthy .env URL without scanning the LAN', async () => {
    process.env.EXPO_PUBLIC_PAWLY_URL = 'http://10.0.0.9:8080';
    const fetchImpl = okFetch('http://10.0.0.9:8080/healthz', 'http://10.0.0.9:8080/healthz');
    const url = await discoverServerUrl({ fetchImpl });
    expect(url).toBe('http://10.0.0.9:8080');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns null when the .env URL is unhealthy (no LAN fallback)', async () => {
    process.env.EXPO_PUBLIC_PAWLY_URL = 'http://10.0.0.9:8080';
    const fetchImpl = vi.fn(async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    expect(await discoverServerUrl({ fetchImpl })).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('scans the LAN, finds the server, and persists it', async () => {
    mocks.getIpAddressAsync.mockResolvedValue('192.168.1.23');
    const fetchImpl = okFetch('http://192.168.1.50:8080/healthz', 'http://192.168.1.50:8080/healthz');
    const url = await discoverServerUrl({ fetchImpl, getIp: () => mocks.getIpAddressAsync() });
    expect(url).toBe('http://192.168.1.50:8080');
    expect(await getServerUrl()).toBe('http://192.168.1.50:8080');
  });

  it('returns null when no host responds on the probed port', async () => {
    mocks.getIpAddressAsync.mockResolvedValue('192.168.1.23');
    const fetchImpl = vi.fn(async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    expect(await discoverServerUrl({ fetchImpl, getIp: () => mocks.getIpAddressAsync(), timeoutMs: 50 })).toBeNull();
  });

  it('does not scan when auto-detect is disabled', async () => {
    process.env.EXPO_PUBLIC_PAWLY_AUTO_DETECT = 'false';
    mocks.getIpAddressAsync.mockResolvedValue('192.168.1.23');
    const fetchImpl = vi.fn(async () => {
      throw new Error('down');
    }) as unknown as typeof fetch;
    expect(await discoverServerUrl({ fetchImpl, getIp: () => mocks.getIpAddressAsync() })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('honors a custom probe port', async () => {
    mocks.getIpAddressAsync.mockResolvedValue('192.168.1.23');
    const fetchImpl = okFetch('http://192.168.1.50:9090/healthz', 'http://192.168.1.50:9090/healthz');
    const url = await discoverServerUrl({
      fetchImpl,
      port: 9090,
      getIp: () => mocks.getIpAddressAsync(),
    });
    expect(url).toBe('http://192.168.1.50:9090');
  });
});

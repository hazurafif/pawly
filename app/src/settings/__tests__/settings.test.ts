import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import {
  autoDetectEnabled,
  envServerPort,
  envServerUrl,
  getLanguage,
  getServerUrl,
  setLanguage,
  setServerUrl,
} from '../settings';

describe('settings', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_PAWLY_URL;
    delete process.env.EXPO_PUBLIC_PAWLY_AUTO_DETECT;
    delete process.env.EXPO_PUBLIC_PAWLY_PORT;
  });

  it('defaults: no server URL, English language', async () => {
    expect(await getServerUrl()).toBeNull();
    expect(await getLanguage()).toBe('en');
  });

  it('round-trips server URL and language', async () => {
    await setServerUrl('http://192.168.1.50:8080');
    await setLanguage('en');
    expect(await getServerUrl()).toBe('http://192.168.1.50:8080');
    expect(await getLanguage()).toBe('en');
  });

  it('normalizes server URL (strips trailing slash, requires scheme)', async () => {
    await setServerUrl('192.168.1.50:8080/');
    expect(await getServerUrl()).toBe('http://192.168.1.50:8080');
  });

  it('rejects invalid server URLs', async () => {
    await expect(setServerUrl('not a url')).rejects.toThrow();
    await expect(setServerUrl('')).rejects.toThrow();
  });

  it('accepts https server URLs unchanged', async () => {
    await setServerUrl('https://pawly.example.com');
    expect(await getServerUrl()).toBe('https://pawly.example.com');
  });
});

describe('env server URL', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_PAWLY_URL;
  });

  it('is null when unset', () => {
    expect(envServerUrl()).toBeNull();
  });

  it('normalizes the .env URL', () => {
    process.env.EXPO_PUBLIC_PAWLY_URL = '192.168.1.50:8080/';
    expect(envServerUrl()).toBe('http://192.168.1.50:8080');
  });

  it('is null for an invalid .env URL', () => {
    process.env.EXPO_PUBLIC_PAWLY_URL = 'not a url';
    expect(envServerUrl()).toBeNull();
  });

  it('getServerUrl falls back to the .env URL when nothing is stored', async () => {
    process.env.EXPO_PUBLIC_PAWLY_URL = 'http://192.168.1.50:8080';
    expect(await getServerUrl()).toBe('http://192.168.1.50:8080');
  });

  it('a stored URL wins over the .env URL', async () => {
    process.env.EXPO_PUBLIC_PAWLY_URL = 'http://10.0.0.9:8080';
    await setServerUrl('http://192.168.1.50:8080');
    expect(await getServerUrl()).toBe('http://192.168.1.50:8080');
  });
});

describe('auto-detect flag and port', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_PAWLY_AUTO_DETECT;
    delete process.env.EXPO_PUBLIC_PAWLY_PORT;
  });

  it('enabled by default, disabled only by the literal "false"', () => {
    expect(autoDetectEnabled()).toBe(true);
    process.env.EXPO_PUBLIC_PAWLY_AUTO_DETECT = 'FALSE';
    expect(autoDetectEnabled()).toBe(false);
    process.env.EXPO_PUBLIC_PAWLY_AUTO_DETECT = '0';
    expect(autoDetectEnabled()).toBe(true);
  });

  it('defaults to port 8080 and ignores invalid values', () => {
    expect(envServerPort()).toBe(8080);
    process.env.EXPO_PUBLIC_PAWLY_PORT = '9090';
    expect(envServerPort()).toBe(9090);
    process.env.EXPO_PUBLIC_PAWLY_PORT = 'abc';
    expect(envServerPort()).toBe(8080);
    process.env.EXPO_PUBLIC_PAWLY_PORT = '70000';
    expect(envServerPort()).toBe(8080);
  });
});

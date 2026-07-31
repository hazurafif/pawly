import { describe, expect, it, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import { getLanguage, getServerUrl, setLanguage, setServerUrl } from '../settings';

describe('settings', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('defaults: no server URL, Indonesian language', async () => {
    expect(await getServerUrl()).toBeNull();
    expect(await getLanguage()).toBe('id');
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

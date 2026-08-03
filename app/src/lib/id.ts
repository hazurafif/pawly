import * as Crypto from 'expo-crypto';

// UUIDs for synced rows — stable across devices so last-write-wins works.
export function newId(): string {
  return Crypto.randomUUID();
}

import { describe, expect, it, vi } from 'vitest';
import { newId } from '../id';

const mocks = vi.hoisted(() => ({
  randomUUID: vi.fn(() => '550e8400-e29b-41d4-a716-446655440000'),
}));
vi.mock('expo-crypto', () => ({ randomUUID: mocks.randomUUID }));

describe('newId', () => {
  it('returns a UUID from expo-crypto', () => {
    expect(newId()).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(mocks.randomUUID).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it } from 'vitest';
import id from '../id.json';
import en from '../en.json';

describe('i18n resources', () => {
  it('id and en have identical key trees', () => {
    const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
      Object.entries(obj).flatMap(([k, v]) =>
        typeof v === 'object' && v !== null
          ? flat(v as Record<string, unknown>, `${prefix}${k}.`)
          : [`${prefix}${k}`]
      );
    expect(flat(en as Record<string, unknown>).sort()).toEqual(
      flat(id as Record<string, unknown>).sort()
    );
  });
});

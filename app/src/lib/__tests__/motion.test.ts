import { describe, expect, it } from 'vitest';
import { motion, springTo } from '../motion';

describe('springTo', () => {
  it('carries the toValue and native driver flag with defaults', () => {
    expect(springTo(1)).toEqual({
      toValue: 1,
      useNativeDriver: true,
      damping: motion.spring.damping,
      stiffness: motion.spring.stiffness,
      mass: motion.spring.mass,
    });
  });

  it('merges overrides over the defaults', () => {
    expect(springTo(0, { damping: 10, stiffness: 300 } as unknown as Partial<typeof motion.spring>)).toEqual({
      toValue: 0,
      useNativeDriver: true,
      damping: 10,
      stiffness: 300,
      mass: 1,
    });
  });
});

export const motion = {
  fast: 200,
  base: 250,
  slow: 300,
  press: 150,
  spring: {
    damping: 22,
    stiffness: 250,
    mass: 1,
  },
} as const;

export function springTo(toValue: number, overrides: Partial<typeof motion.spring> = {}) {
  return { toValue, useNativeDriver: true, ...motion.spring, ...overrides };
}

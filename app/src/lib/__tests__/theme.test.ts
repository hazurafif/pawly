import { describe, expect, it } from 'vitest';
import { colors, darkColors, radius, spacing, tabBarClearance, type Palette } from '../theme';

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const RGBA = /^rgba?\(/;

function isColorValue(v: string): boolean {
  return HEX6.test(v) || RGBA.test(v);
}

describe('theme tokens', () => {
  it('dark palette mirrors the light palette key-for-key', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(colors).sort());
  });

  it('every color in both palettes is a valid CSS color value', () => {
    for (const palette of [colors, darkColors] as const) {
      for (const [key, value] of Object.entries(palette)) {
        expect(isColorValue(value), `${key} = ${value}`).toBe(true);
      }
    }
  });

  it('light and dark palettes pair soft/deep tokens with their base hue', () => {
    // Spot-check the semantic relationships that dark-mode contrast depends on:
    // soft tokens are translucent variants, deep tokens are the emphasized text.
    expect(colors.surface).toBe('#FFFFFF');
    expect(darkColors.surface).toBe('#1E1F20');
    expect(darkColors.background).toBe('#131314');
    expect(darkColors.primarySoft).toMatch(/^rgba\(/);
  });

  it('radius tokens scale from small to pill', () => {
    expect(radius.xs).toBeLessThan(radius.sm);
    expect(radius.sm).toBeLessThan(radius.md);
    expect(radius.md).toBeLessThan(radius.lg);
    expect(radius.lg).toBeLessThan(radius.pill);
    // Rounding should stay subtle for small elements: inputs/buttons are sm.
    expect(radius.sm).toBeLessThanOrEqual(14);
  });

  it('spacing tokens are positive and strictly ascending', () => {
    const values = Object.values(spacing);
    for (const v of values) {
      expect(v).toBeGreaterThan(0);
    }
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it('tabBarClearance clears the floating tab bar (64 high + up to ~32 offset)', () => {
    expect(tabBarClearance).toBeGreaterThan(64 + 32);
    expect(tabBarClearance).toBeLessThan(160); // sanity: not absurdly large
  });

  it('palette type exports every key of both palettes', () => {
    // Compile-time check that Palette is assignable both ways; runtime keys.
    const light: Palette = colors;
    const dark: Palette = darkColors;
    expect(Object.keys(light).length).toBe(Object.keys(dark).length);
  });
});

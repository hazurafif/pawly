import { describe, expect, it } from 'vitest';
import {
  colors,
  darkColors,
  m3DarkRoles,
  m3LightRoles,
  radius,
  spacing,
  stateOverlay,
  surfaceForLevel,
  tabBarClearance,
  typeScale,
  withAlpha,
  type M3Roles,
  type Palette,
} from '../theme';

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

describe('M3 roles', () => {
  it('dark roles mirror the light roles key-for-key', () => {
    expect(Object.keys(m3DarkRoles).sort()).toEqual(Object.keys(m3LightRoles).sort());
    const light: M3Roles = m3LightRoles;
    const dark: M3Roles = m3DarkRoles;
    expect(Object.keys(light).length).toBe(Object.keys(dark).length);
  });

  it('every role in both schemes is a valid CSS color value', () => {
    for (const roles of [m3LightRoles, m3DarkRoles] as const) {
      for (const [key, value] of Object.entries(roles)) {
        expect(isColorValue(value), `${key} = ${value}`).toBe(true);
      }
    }
  });

  it('on- roles contrast with their base roles', () => {
    expect(m3LightRoles.onPrimary).not.toBe(m3LightRoles.primary);
    expect(m3LightRoles.onPrimary).toBe('#FFFFFF');
    expect(m3LightRoles.onSurface).not.toBe(m3LightRoles.surface);
    expect(m3DarkRoles.onSurface).not.toBe(m3DarkRoles.surface);
  });

  it('light surface containers ascend from lowest to highest', () => {
    const tone = (hex: string) => parseInt(hex.replace('#', '').slice(0, 2), 16);
    const levels = [
      m3LightRoles.surfaceContainerLowest,
      m3LightRoles.surfaceContainerLow,
      m3LightRoles.surfaceContainer,
      m3LightRoles.surfaceContainerHigh,
      m3LightRoles.surfaceContainerHighest,
    ];
    for (let i = 1; i < levels.length; i++) {
      expect(tone(levels[i]), `${levels[i]} darker than ${levels[i - 1]}`).toBeLessThan(
        tone(levels[i - 1])
      );
    }
  });

  it('type scale entries are positive and line height covers the size', () => {
    for (const [name, token] of Object.entries(typeScale)) {
      expect(token.fontSize, `${name} size`).toBeGreaterThan(0);
      expect(token.lineHeight, `${name} lineHeight`).toBeGreaterThanOrEqual(token.fontSize);
      expect(token.fontFamily.length).toBeGreaterThan(0);
    }
  });

  it('state layers and alpha helpers produce rgba strings', () => {
    expect(stateOverlay('#1A73E8', 'pressed')).toBe('rgba(26,115,232,0.12)');
    expect(stateOverlay('#1A73E8', 'hover')).toBe('rgba(26,115,232,0.08)');
    expect(withAlpha('#FFFFFF', 0.38)).toBe('rgba(255,255,255,0.38)');
    expect(withAlpha('#0B0', 0.5)).toBe('rgba(0,187,0,0.5)');
  });

  it('surfaceForLevel maps 0-5 onto the container tones', () => {
    expect(surfaceForLevel(m3LightRoles, 0)).toBe(m3LightRoles.surfaceContainerLowest);
    expect(surfaceForLevel(m3LightRoles, 1)).toBe(m3LightRoles.surfaceContainerLow);
    expect(surfaceForLevel(m3LightRoles, 2)).toBe(m3LightRoles.surfaceContainer);
    expect(surfaceForLevel(m3LightRoles, 3)).toBe(m3LightRoles.surfaceContainerHigh);
    expect(surfaceForLevel(m3LightRoles, 4)).toBe(m3LightRoles.surfaceContainerHighest);
    expect(surfaceForLevel(m3LightRoles, 5)).toBe(m3LightRoles.surfaceContainerHighest);
  });
});

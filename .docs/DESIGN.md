# Pawly Design System

## Vision

Pawly should feel like a premium companion for pet parents.

Not a veterinary management system.
Not a checklist app.

It should feel like Apple Health, Google Calendar, and Airbnb collaborated to
build a calm, luxurious pet companion.

Every screen should reduce stress.

The interface should feel trustworthy, warm, modern, and quietly premium.

Think:

- Apple Health
- Airbnb
- Notion Calendar
- Arc Browser
- iOS Human Interface Guidelines
- Linear

Never look playful or childish.

---

## Personality

Elegant.
Calm.
Friendly.
Premium.
Minimal.

The app should feel like expensive stationery.

Every interaction should feel intentional.

---

## Emotional goal

When opening Pawly users should feel:

"I've got everything under control."

The application should create confidence instead of excitement.

---

## Design language

Large white surfaces.

Soft elevation.

Subtle glassmorphism.

Almost invisible shadows.

Generous spacing.

Large typography.

Rounded corners.

Minimal borders.

Everything breathes.

Nothing feels crowded.

---

## Glassmorphism

Use glass only where it improves hierarchy.

Examples:

- floating navigation
- segmented controls
- floating cards
- modal sheets

Never blur entire pages.

Blur radius:
20–30px

Background opacity:
70–85%

Use extremely subtle borders:

`rgba(255,255,255,0.35)` (`colors.glassBorder`)

Shadow:

`0 12px 40px rgba(0,0,0,0.06)`

Avoid obvious frosted-glass effects.

Note: React Native has no native backdrop blur. Use the translucent glass
color (`rgba(255,255,255,0.72)`) as a flat fill — the warm background shows
through the translucency and reads as glass. `expo-blur` can be added later
for true blur on iOS; the flat fill must hold up on its own.

---

## Colors

### Core palette

| Token | Hex | Use |
| --- | --- | --- |
| `colors.background` | `#F8F6F2` | App background |
| `colors.surface` | `#FFFFFF` | Cards, sheets, solid surfaces |
| `colors.glass` | `rgba(255,255,255,0.72)` | Floating nav, pills, floating cards |
| `colors.glassBorder` | `rgba(255,255,255,0.35)` | Glass edge borders |
| `colors.surfaceMuted` | `#F4EDE3` | Tracks, secondary fills |
| `colors.primary` | `#FF8A3D` | Brand accent — icons, glows, highlights |
| `colors.primaryDark` | `#F26B21` | Button/FAB fills (3.0:1 on white — passes WCAG 1.4.11 for components) |
| `colors.primaryDeep` | `#A94E0E` | Orange **text** on white/soft fills (≥4.5:1) |
| `colors.primarySoft` | `#FFF0E3` | Tinted fills behind orange icons |
| `colors.text` | `#2A2826` | Primary text |
| `colors.textMuted` | `#6E6963` | Secondary text (4.5:1 on background) |
| `colors.border` | `#EDE5DA` | Hairlines, dividers |
| `colors.success` | `#6CBF84` | Success icons, progress fills |
| `colors.successSoft` | `#E4F7EC` | Success tint fills |
| `colors.successDeep` | `#1E7A44` | Success **text** on white/soft (≥4.5:1) |
| `colors.warning` | `#F3B54A` | Warning icons |
| `colors.warningSoft` | `#FBF0DC` | Warning tint fills |
| `colors.danger` | `#E66A5C` | Danger icons |
| `colors.dangerSoft` | `#FDEAEA` | Danger tint fills |
| `colors.dangerDeep` | `#B4473B` | Danger **text** on white/soft (≥4.5:1) |
| `colors.white` | `#FFFFFF` | Text on colored fills |

### Contrast rule

- **Brand tones are for fills, icons, and glows — never for small text.**
- Text set in a brand tone must use the `*Deep` variant
  (≥4.5:1 against white and the `*Soft` fills).
- Interactive component fills need ≥3:1 against adjacent colors
  (WCAG 1.4.11). `primaryDark` on white is 3.0:1; `primary` (2.3:1) is
  reserved for accents, not button fills.
- `textMuted` (`#8D8882` in the original spec) fails AA for small text;
  `#6E6963` is the token. Use `#8D8882` only for large/emphasis-secondary.

### Dark mode

Deferred. The app ships light-only for this rebrand. When dark mode lands,
map the same tokens: warm dark background (`#1C1A18` family), glass becomes
`rgba(42,39,36,0.72)`, `*Soft` fills become dark tint overlays, and
`*Deep` text colors lift to the base tones (they already pass against dark).
Keep the same token names so no component needs touching.

Never use saturated colors. Everything should be softly muted.

---

## Typography

| Role | iOS | Android / Web | Weight |
| --- | --- | --- | --- |
| Display | SF Pro Display | Inter | 700 |
| Headings | SF Pro Text (semibold) | Inter | 600–700 |
| Body | SF Pro Text | Inter | 400–500 |
| Labels | SF Pro Text | Inter | 600 |

Implementation is system-first: no custom font is loaded, so iOS renders
SF Pro natively and Android renders Roboto. Bundling Inter (via
`expo-font`) is a follow-up for Android brand consistency — when added,
set `fontFamily: Platform.select({ ios: undefined, default: 'Inter' })`.

Headings should feel editorial. Large. Confident. Clean.

Never use excessive bold text. `800` is reserved for the app name mark.

---

## Spacing

Use an 8pt grid. Tokens: `spacing.xs: 4`, `sm: 8`, `md: 16`, `lg: 24`,
`xl: 32`, `xxl: 40`.

Large breathing room is preferred. Screen content sits at `md` (16) with
`xl*2` bottom padding.

---

## Border radius

| Token | Value | Use |
| --- | --- | --- |
| `radius.sm` | 18 | Buttons, inputs, chart bars |
| `radius.md` | 28 | Cards |
| `radius.lg` | 32 | Floating cards, modal sheets |
| `radius.pill` | 999 | Chips, tabs, avatars, progress, badges |

Avatars are **pill** (fully round), not 24px. Everything should feel soft.

---

## Shadows

Very subtle. Tokens: `shadow.sm` (cards), `shadow.md` (floating elements,
toast), `shadow.lg` (modal sheets).

| Tier | Value |
| --- | --- |
| Small (cards) | `0 6px 18px rgba(0,0,0,.04)` |
| Medium (floating) | `0 12px 32px rgba(0,0,0,.05)` |
| Large (sheets) | `0 24px 60px rgba(0,0,0,.08)` |

Never use hard shadows.

---

## Icons

Rounded outline icons. 2px stroke (Ionicons `-outline` variants).
Consistent corner radius. SF Symbols style. Never cartoon.

Icon-on-fill contrast follows the component contrast rule.

---

## Category palette (event kinds)

Kinds (feed, water, walk, …) each get a muted hue, in `catalog.ts`. Muted
means desaturated toward the warm paper tone — never the saturated defaults:

| Kind | Color | Kind | Color |
| --- | --- | --- | --- |
| feed | `#E0A04E` | vaccine | `#5CB98A` |
| water | `#6FAED6` | visit | `#5CA79B` |
| walk | `#86B56F` | weight | `#9B8AC9` |
| potty | `#B08D57` | photo | `#DA7FA2` |
| mood | `#DA7FA2` | milestone | `#E0A04E` |
| checkin | `#9B8AC9` | task | `#86B56F` |
| symptom | `#D96B63` | vet_bill | `#8A857D` |
| med_given | `#7C9EE0` | other | `#8A857D` |

Tint fills use the color at ~13% opacity.

---

## Illustrations

Minimal. Soft. Editorial. Monochromatic. Large empty space.

Never use noisy illustrations.

---

## Components

### Navigation

Floating bottom navigation. Glass fill (`colors.glass`), hairline
`glassBorder` edge, `radius.md` (28px), floats 16px above the screen edge,
`shadow.md`.

Active tab: orange icon + label. Inactive: `textMuted`.

### Cards

Large. Breathing room. `radius.md`. `shadow.sm`. Almost invisible border.

Cards should appear like floating paper.

### Pet selector

Horizontal pills. White surface with hairline border. Active pill:
`primarySoft` fill, `primaryDeep` text, `primary` border. Pet avatar is
fully round. Optional: selected pill expands slightly with a soft spring.

### Quick actions

Circular buttons. Soft pastel fills (`color + '22'` alpha). Icons only.
Minimal labels below. Large spacing. Minimum 52px touch target.

### Progress

Thin bars (6px). Muted track (`surfaceMuted`). Rounded ends. `success`
fill. Animate smoothly over 200–300ms.

### Empty state

Large whitespace. Minimal icon in a `surfaceMuted` circle. One strong CTA.
Calm, never empty-feeling.

### Buttons

| Variant | Fill | Text | Use |
| --- | --- | --- | --- |
| Primary | `primaryDark` | white | Default action |
| Secondary | `surfaceMuted` + hairline border | `text` | Alternate action |
| Ghost | transparent | `textMuted` | Text-only |
| Danger | `danger` | white | Destructive |

Height 48px minimum. `radius.sm`. Icon + label with 8px gap.

### States

- Pressed: opacity 0.7, scale 0.96 (buttons/FAB) — every interactive
  element needs a pressed state.
- Disabled: opacity 0.5, no press feedback.
- Loading: inline `ActivityIndicator` in `primary`, keep the label width
  stable (never jump layout).

### Touch targets

Minimum 44×44px hit area for all interactive elements; 48px for primary
buttons. Use `hitSlop` where a visual element is smaller.

---

## Motion

Every animation: 200–300ms. Springs are tamed, never bouncy.

| Interaction | Animation |
| --- | --- |
| Toast in/out | Timing, 220ms / 180ms, fade + slide |
| Card press | Scale 0.96, timing 150ms |
| Navigation slide | Timing, 300ms, ease-out |
| Progress fill | Timing, 250ms, ease-out |
| Chip/pill selection | Spring, 250ms, damping 22, stiffness 250 |
| Sheet presentation | Spring, 300ms, damping 26, stiffness 240 |

Token file `src/lib/motion.ts` exports `motion.fast/base/slow` and a
`springTo` helper. Always respect Reduce Motion
(`AccessibilityInfo.isReduceMotionEnabled`) — skip transform animations,
jump to end state.

Everything should feel effortless. Cards gently lift. Buttons softly
scale. Navigation smoothly slides.

---

## Data visualization

Weight chart and any future charts:

- Bars: `primaryDeep` on white (data must meet 3:1 against background).
- Axes/labels: `textMuted`, 10–11px, weight 600.
- Tracks: `surfaceMuted`. Rounded ends. No gridlines.
- Relative scaling to visible min/max, so small changes still read.

---

## Imagery

Lifestyle photography. Natural daylight. Warm colors. Dogs and cats
photographed at eye level. No stock-photo feeling.

---

## Voice

Warm. Confident. Gentle. Never overly cute. Never childish. Never
excessive emojis. Concise.

Example:

Instead of

"Yay! Bella finished today's walk! 🥳"

Use

"Bella completed today's walk."

---

## Do not

- Gradients (including orange-to-red) — flat fills only
- Emoji in UI copy
- Confetti, balloons, or celebration animations
- Cartoon pets or clip-art
- Saturated brand colors at large scale
- Full-page blur / frosted backgrounds
- Hard shadows or black borders
- Bold text everywhere
- Stock-photo-feel imagery

---

## Overall impression

Imagine opening Apple Health, but every interaction is designed for your
pet. The experience should feel premium enough that users would assume it
was designed by Apple or Airbnb.

Luxury through restraint.
Beauty through whitespace.
Confidence through simplicity.

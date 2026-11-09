---
name: Botanical Carioca
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#404944'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#707973'
  outline-variant: '#bfc9c2'
  surface-tint: '#296952'
  primary: '#004631'
  on-primary: '#ffffff'
  primary-container: '#1c5e47'
  on-primary-container: '#94d5b8'
  inverse-primary: '#93d4b7'
  secondary: '#a23e1a'
  on-secondary: '#ffffff'
  secondary-container: '#fe8359'
  on-secondary-container: '#701f00'
  tertiary: '#413c2f'
  on-tertiary: '#ffffff'
  tertiary-container: '#595345'
  on-tertiary-container: '#d0c7b5'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#aff0d2'
  primary-fixed-dim: '#93d4b7'
  on-primary-fixed: '#002115'
  on-primary-fixed-variant: '#08513b'
  secondary-fixed: '#ffdbd0'
  secondary-fixed-dim: '#ffb59d'
  on-secondary-fixed: '#390b00'
  on-secondary-fixed-variant: '#822703'
  tertiary-fixed: '#ebe1cf'
  tertiary-fixed-dim: '#cfc5b4'
  on-tertiary-fixed: '#201b10'
  on-tertiary-fixed-variant: '#4c4639'
  background: '#fcf9f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
  sand-light: '#FAF5EC'
  sand-border: '#EAE0CE'
  botanical-deep: '#124030'
  terracotta-accent: '#B84E29'
  charcoal-ink: '#1A1A1A'
typography:
  display-lg:
    fontFamily: Literata
    fontSize: 52px
    fontWeight: '600'
    lineHeight: 60px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Literata
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 42px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Literata
    fontSize: 36px
    fontWeight: '500'
    lineHeight: 44px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Literata
    fontSize: 28px
    fontWeight: '500'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Literata
    fontSize: 26px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Literata
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 26px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1.25rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system channels the layered cultural topography of Rio de Janeiro: lush Tijuca rainforest canopy, warm sand, historic Santa Teresa masonry, and vibrant mid-century tropical modernism. It balances authentic editorial authority with the warmth of a trusted local confidant. 

The aesthetic marries **Editorial Warmth** with **Refined Contemporary Travel Design**. Rooted in rich natural tones, literary typography, and warm off-white canvases, it eschews cold tech minimalism in favor of tactile elegance, generous rhythm, and welcoming hospitality. Surfaces feel like archival paper bathed in coastal sunlight, punctuated by botanical green and terracotta clay accents.

## Colors

The palette draws directly from the natural and urban environment of Rio de Janeiro:

- **Primary (`#1C5E47`)**: Deep Botanical Green. Anchors primary actions, navigation states, focal headers, and brand identification. Evokes Atlantic forest foliage and shaded colonial plazas.
- **Secondary (`#B84E29`)**: Warm Terracotta. Used for contextual highlights, badges, active promotional states, secondary interactive cues, and evocative editorial accents.
- **Tertiary (`#EAE0CE`)**: Weathered Stone Sand. Deployed for subtle background sectioning, structural dividers, chip surfaces, and muted container fills.
- **Neutral (`#1A1A1A`)**: Charcoal Ink. Replaces harsh synthetic blacks for high-legibility body copy, labels, and iconography, preserving warmth against light backgrounds.
- **Base Canvas (`#FAF5EC`)**: Palm Sand / Parchment. A soothing off-white foundational layer providing low eye strain and organic depth compared to sterile pure white.

## Typography

The type scale contrasts the intellectual, literary presence of **Literata** with the airy, ergonomic clarity of **Plus Jakarta Sans**.

- **Display & Headlines (`Literata`)**: Bestows editorial gravitas and a classic field-guide impression. Slanted italics in Literata may be used for pull quotes, insider tips, and editorial translations.
- **Body & Captions (`Plus Jakarta Sans`)**: Delivers friendly legibility across neighborhood guides, logistics tables, itineraries, and dense metadata.
- **Labels & Microcopy**: Formatted in medium and bold weights of Plus Jakarta Sans with subtle positive tracking to maintain crisp visibility across tags, pill filters, and UI controls.

## Layout & Spacing

The layout is built upon a standard 12-column responsive fluid grid designed to accommodate wide travel imagery, structured side-by-side advice columns, and interactive location indexes.

- **Breakpoints**:
  - **Mobile (< 768px)**: 4 columns, `gutter-mobile` (16px), `margin-mobile` (20px). Modules stack vertically; action bars pin to bottom viewports.
  - **Tablet (768px – 1024px)**: 8 columns, `gutter` (24px), `margin` (32px). Secondary cards enter 2-up grids.
  - **Desktop (> 1024px)**: 12 columns, max-width container capped at 1280px, `gutter` (24px), `margin-desktop` (48px). Accommodates sticky itinerary sidebars and multi-column article layouts.

Vertical rhythm relies on generous `space-xl` gaps between editorial sections to provide breathing room and elevate photography. Component internals adhere to an 8px mathematical baseline (`space-xs` through `space-lg`).

## Elevation & Depth

Visual hierarchy prioritizes **tonal layering** and **warm ambient shadows** over synthetic elevation:

- **Level 0 (Flat Canvas)**: Neutral base `#FAF5EC`.
- **Level 1 (Surface Cards & Containers)**: Crisp solid white `#FFFFFF` or stone tint `#EAE0CE` at 40% opacity, bordered by subtle 1px `#EAE0CE`. Soft ambient shadow: `0 2px 8px -2px rgba(26, 26, 26, 0.05)`.
- **Level 2 (Interactive Floating / Hover)**: Elevated card state, tooltips, and floating filter chips: `0 8px 24px -4px rgba(28, 94, 71, 0.08)`, gently tinted with botanical green tone to sustain visual warmth.
- **Level 3 (Modals & Overlays)**: Drawer dialogs, photo lightbox overlays: `0 16px 40px -8px rgba(26, 26, 26, 0.16)`. Accompanied by a 30% alpha charcoal backdrop blur (`rgba(26, 26, 26, 0.45)` with `backdrop-filter: blur(4px)`).

## Shapes

The design system employs **Roundedness Level 2 (Rounded)**:
- Standard UI containers, cards, and input fields utilize `0.5rem` (8px) corners.
- Large cards, hero callouts, and content sheets use `rounded-lg` (`1rem` / 16px).
- Modals, banner sheets, and dialogs use `rounded-xl` (`1.5rem` / 24px).
- Small badges, chips, tags, and category pills adopt a complete pill geometry (`9999px`) to create an approachable contrast against geometric layout blocks.

## Components

### Buttons
- **Primary**: Solid Botanical Green (`#1C5E47`) background with `#FAF5EC` typography, `0.5rem` border radius, and `space-md` horizontal padding. On hover: shifts to `#124030` with slight scale elevation.
- **Secondary**: Terracotta Clay (`#B84E29`) fill with `#FAF5EC` label, reserved for primary travel booking CTAs or high-intent actions.
- **Outlined / Tertiary**: Transparent fill, 1.5px border in `#1C5E47`, text in `#1C5E47`. Hover triggers `#1C5E47` fill with 8% opacity.

### Chips & Badges
- **Category Chips**: Pill-shaped (`rounded-full`), `#EAE0CE` background at 50% opacity, `#1C5E47` text (`label-md`). Active state swaps to solid `#1C5E47` with white text.
- **District/Neighborhood Badges**: Terracotta tint (`#B84E29` at 12% opacity) with `#B84E29` bold microcopy (`label-sm`), uppercase tracking.

### Cards
- **Editorial Guide Card**: White container surface with 1px border (`#EAE0CE`), `1rem` corner rounding, aspect-ratio 16:9 photography top, and generous `space-md` internal padding. Subdued ambient shadow lifts subtly on hover.
- **Local Tip Card**: Light `#FAF5EC` fill with a prominent 4px solid `#1C5E47` left border, containing italicized Literata text and an avatar badge.

### Form Inputs & Selects
- **Inputs**: Solid `#FFFFFF` fill framed by 1px `#EAE0CE` border, `0.5rem` border radius, and `space-md` inset padding. Body text set in Plus Jakarta Sans `#1A1A1A`. Focus state transitions border to `#1C5E47` with a 2px botanical ring at 20% opacity.

### Checkboxes & Radio Buttons
- **Controls**: Custom rounded boxes (radio: 50%, checkbox: 4px radius) bordered with `#1C5E47`. Checked state fills with `#1C5E47` featuring a pure white check icon or center dot.

### Lists & Navigation
- **Article & Place Lists**: Separated by 1px hairline rules using `#EAE0CE`. Hovering highlights row item with `#FAF5EC` surface tint.
- **Itinerary Timeline**: Vertical connecting line styled in `#1C5E47` at 20% opacity with circular waypoint nodes in `#B84E29`.
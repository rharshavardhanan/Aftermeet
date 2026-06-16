# DESIGN.md — Aftermeet

Premium "ink-on-warm-paper" system. Warm tinted neutrals, one ember accent,
serif reserved for formal-record moments. OKLCH throughout.

## Color (OKLCH, stored as `L C H` triplets; consumed via `oklch(var(--x) / <alpha>)`)

### Light (web + app) — warm paper
- background `0.988 0.006 80`  · foreground (ink) `0.235 0.012 65`
- subtle `0.966 0.008 80` · card `0.996 0.003 80` · border `0.905 0.008 75`
- muted-foreground `0.55 0.013 68`
- **ember (brand accent)** `0.62 0.142 52` — used ≤10%: active states, focus ring,
  recording pulse, marker highlight, key emphasis.
- semantics (functional, not brand): success `0.52 0.10 150`, warning `0.72 0.13 72`,
  destructive `0.55 0.20 27`.

### Dark (extension + app dark mode) — warm charcoal
- background `0.185 0.008 70` · foreground `0.95 0.005 85`
- card `0.215 0.009 70` · border `0.30 0.008 70` · muted-foreground `0.70 0.011 78`
- ember `0.68 0.14 55`.

**Strategy:** Restrained (product) / restrained-committed (brand hero). Never `#000`/`#fff`.

## Typography
- **Display (serif): Fraunces** — formal-record moments ONLY: landing hero, auth
  aside, dashboard greeting, meeting + MoM titles. Optical sizing on, slight soft.
- **UI / body: Inter** — everything functional. Cap measure at 68ch.
- **Metadata / numerals: JetBrains Mono** — timestamps, confidence %, counts (tabular).
- Hierarchy via scale + weight (≥1.25 ratio). Tracked uppercase micro-labels (11px).

## Elevation & shape
- Radius: 0.6rem base. Shadows are soft and warm-tinted, used sparingly:
  `subtle` (rest), `card` (hover lift), `float` (overlays).
- Structure via hairline borders + spacing rhythm, not boxes-in-boxes.

## Signature details
- **Marker highlight** (`.hl`): ember swipe behind a key word (highlighted minutes
  metaphor). Background gradient on inline text — NOT gradient text.
- Tabular numerals for all metrics. Tracked small-caps section labels.
- Motion: ease-out-expo, fade+rise entrances. No bounce. Never animate layout props.

## Signature details
- **Liquid glass (navigation chrome only):** floating frosted bars use
  `.liquid-glass` (translucent + backdrop-blur/saturate + specular top edge). The
  mobile tab bar is a floating rounded pill with an iOS-eased sliding selection
  capsule (`.glass-pill` + `.ease-ios`). Reserved for nav/overlay surfaces —
  never content. This is a deliberate, scoped exception to the glass ban below.

## Bans (enforced)
No side-stripe borders, no gradient text, **no decorative glass on content
surfaces** (frosted liquid glass is allowed only on floating navigation chrome —
see Signature details), no hero-metric template, no identical card grids, no
modal-first. See impeccable shared laws.

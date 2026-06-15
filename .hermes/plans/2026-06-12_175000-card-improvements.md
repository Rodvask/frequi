# Card Visual Improvements

**Goal:** Modernize all card components with consistent, clean, and attractive styling.

**File:** `src/styles/tailwind.css`

## Changes

### C1 — Dashboard card: smoother hover + subtle inner glow

```css
/* Replace */
.ft-dashboard-card {
  ...
  border: 1px solid var(--ft-panel-border);
  border-radius: var(--ft-card-radius);
  box-shadow: var(--ft-shadow);
  backdrop-filter: blur(12px);
}

/* With */
.ft-dashboard-card {
  ...
  border: 1px solid var(--ft-panel-border);
  border-radius: var(--ft-card-radius);
  box-shadow: var(--ft-shadow);
  backdrop-filter: blur(12px);
  transition: border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
}

.ft-dashboard-card:hover {
  border-color: color-mix(in srgb, var(--p-primary-color) 28%, var(--ft-panel-border));
  box-shadow: var(--ft-shadow-hover);
  background: color-mix(in srgb, var(--ft-panel) 98%, var(--p-primary-color));
}
```

### C2 — Add `--ft-shadow-hover` variable

In `:root` (light):
```css
--ft-shadow-hover: 0 14px 34px rgba(15, 23, 42, 0.12);
```

In `.ft-dark-theme`:
```css
--ft-shadow-hover: 0 18px 44px rgba(0, 0, 0, 0.52);
```

### C3 — Consistent border-radius across all card types

- `.ft-trade-mobile-card`: 0.45rem → 0.5rem
- `.ft-custom-trade-card`: 0.45rem → 0.5rem
- `.ft-order-card`: 0.45rem → 0.5rem
- `.ft-mobile-row-card`: same as dashboard-card
- `.ft-risk-alert`: same as dashboard-card

All card-like elements should share the same border-radius (var(--ft-card-radius) = 0.5rem).

### C4 — Mobile cards: add accent left border accent

Like the dashboard card header, mobile cards (`ft-trade-mobile-card`, `ft-custom-trade-card`, `ft-mobile-row-card`) should have a subtle accent left border treatment. The `ft-trade-mobile-card` already has this via `.ft-trade-mobile-identity::before` — extend this to other mobile cards.

### C5 — Metric cards: better visual hierarchy

Current metric cards use `::before` for the left accent bar. Improve:
- Slightly larger accent bar (3px → 4px)
- Add subtle background tint based on tone (profit/loss/neutral)
- Better spacing for the metric value area

---

## Implementation

The changes are purely CSS — no component files need modification. Only `src/styles/tailwind.css` is affected.

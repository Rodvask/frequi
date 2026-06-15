# Chart Markers — Bugs & Improvements Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Fix bugs and improve the custom trade markers primitive (`TradeMarkersPrimitive`) and the TradingView candle chart component.

**Architecture:** The chart uses lightweight-charts v5 with a custom `ISeriesPrimitive`-based renderer for trade/signal markers. Marker data is built in `TradingViewCandleChart.vue` and passed to the primitive. The crosshair info has a separate `tradesForTime()` function.

**Tech Stack:** Vue 3, TypeScript, lightweight-charts v5, Canvas2D

---

## Bugs Found

### B1 — `ctx.roundRect()` not available in older browsers

**File:** `src/utils/charts/tradeMarkersPrimitive.ts:139`

`CanvasRenderingContext2D.roundRect()` was added in 2022 and is not supported in Safari < 15.4, Firefox < 112, or some mobile browsers. When not available, the canvas `draw` call silently breaks and NO markers render on those browsers — no error is visible to the user.

**Fix:** Add a feature-detect fallback:
```ts
if (typeof ctx.roundRect === 'function') {
  ctx.roundRect(...);
} else {
  // Fallback: use fillRect (square corners) or an empty path
  ctx.fillRect(labelX, labelY - 11, tw + padX * 2, th);
}
```

### B2 — `updateAllViews()` is a no-op, but coordinates are recomputed every frame

**File:** `src/utils/charts/tradeMarkersPrimitive.ts:71-73`

The `updateAllViews()` method is a no-op. Screen coordinates (`timeToCoordinate`/`priceToCoordinate`) are recomputed on EVERY `draw` call (every animation frame). With 50+ markers and frequent scroll/zoom, this causes unnecessary layout queries.

**Fix:** Restore marker coordinate caching with `_invalidated` flag. Set `_invalidated = true` in `updateAllViews()` and only recompute when flagged. This is the correct pattern the library expects.

### B3 — `signalLabelsForRow` duplication with `buildTradeMarkers`

**File:** `src/components/charts/TradingViewCandleChart.vue:208-234` and `418-457`

The signal markers are built TWICE:
- `signalLabelsForRow()` (lines 208-234) formats signal text for the crosshair info panel
- `buildTradeMarkers()` (lines 421-457) builds signal markers for the chart

Both iterate the same signal columns with slightly different logic. If a new signal column is added, it must be added in two places.

**Fix:** Refactor signal column definitions into a single source-of-truth array, and share between crosshair and marker building.

### B4 — Primitive not detached before chart removal

**File:** `src/components/charts/TradingViewCandleChart.vue:626-634`

`destroyChart()` sets `tradeMarkersPrimitive = null` but never calls `candleSeries.detachPrimitive(tradeMarkersPrimitive)` (or equivalent). The primitive is garbage-collected with the chart, but if `candleSeries` is held by a watcher or closure, the primitive's `_series`/`_chart` refs create a stale reference chain.

**Fix:** Detach the primitive from the series explicitly before nulling it.

### B5 — Marker coordinate computation fails silently when chart isn't laid out

**File:** `src/utils/charts/tradeMarkersPrimitive.ts:41-43`

When `timeScale.timeToCoordinate()` or `series.priceToCoordinate()` returns `null` (chart not ready, time outside range), the marker is silently skipped. This is correct behaviour, but during fast scroll/zoom transitions ALL markers could be null, resulting in a blank chart with no markers until the user stops interacting.

**Fix:** Not a runtime bug, but worth noting. Mitigation: the current always-compute-on-draw approach handles this (they show up as soon as coordinates resolve). With caching (B2), we must ensure we don't cache a "null" state permanently — recompute when `_invalidated` is set, even if previous coordinates were null.

---

## Improvements

### I1 — Extract `buildTradeMarkers` to a separate file

**File:** `src/components/charts/TradingViewCandleChart.vue:418-577`

The function is ~160 lines handling signal markers, trade markers, fallback logic, and sorting. This makes the component harder to read.

**Fix:** Move to `src/utils/charts/buildTradeMarkers.ts`. Accept `dataset`, `trades`, `filteredTrades`, `props` as parameters and return `TradeMarkerPoint[]`.

### I2 — Add rounded-rect polyfill/fallback for label background

**File:** `src/utils/charts/tradeMarkersPrimitive.ts:137-140`

Rather than just checking `typeof ctx.roundRect === 'function'`, create a reusable `roundRect` utility that works on all browsers:

```ts
function canvasRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    // Fallback: draw rounded rect manually with arcTo
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}
```

### I3 — Remove unused import `heikinAshiDataset`

**File:** `src/components/charts/TradingViewCandleChart.vue:4`

`heikinAshiDataset` is imported but never used directly — it's called inside `buildCandleData()`. Wait, actually it IS used there. Let me verify...

Actually looking at line 133: `? heikinAshiDataset(columns, props.dataset.data)` — it IS used. So this is not a bug.

### I4 — Performance: Batch marker drawing by color

**File:** `src/utils/charts/tradeMarkersPrimitive.ts:41-46`

Currently each marker calls `ctx.save()`/`ctx.restore()` individually in `drawMarkerShape`. With many markers, this creates unnecessary state save/restore overhead. Grouping markers by color/shape/style would allow batch drawing.

**Fix:** Group markers in `draw()` by `color + shape + size` before iterating, then set fillStyle/strokeStyle once per group.

### I5 — Crosshair: Signal info doesn't show DCA order tags

**File:** `src/components/charts/TradingViewCandleChart.vue:237-338`

The crosshair `tradesForTime()` shows order data with `ft_order_tag` for DCA entries/exits, but `signalLabelsForRow()` (line 226) still uses the old format with `enter_tag`/`exit_tag` column values. Signal labels in the crosshair may show incomplete/overly verbose text because they don't use `ft_order_tag`.

Not necessarily a bug — signal labels show strategy signal info (from OHLCV data columns), while trade labels show order info (from the orders array). These are different data sources. But the crosshair shows both `signals` and `trades` sections, which can be confusing when they overlap.

**Improvement:** Add a note in the crosshair display or deduplicate when a signal and a trade entry share the same candle.

---

## Step-by-Step Tasks

### Task 1: Fix `roundRect` browser compatibility

**Objective:** Prevent silent failure on browsers without `CanvasRenderingContext2D.roundRect()`

**Files:**
- Modify: `src/utils/charts/tradeMarkersPrimitive.ts` (around line 139)

**Changes:**

Replace the hard `ctx.roundRect()` call with a feature-detect + fallback:

```ts
if (typeof ctx.roundRect === 'function') {
  ctx.roundRect(labelX, labelY - 11, tw + padX * 2, th, 4);
} else {
  ctx.beginPath();
  // Manual rounded rect using arcTo
  const r = 4;
  const bx = labelX, by = labelY - 11, bw = tw + padX * 2, bh = th;
  ctx.moveTo(bx + r, by);
  ctx.lineTo(bx + bw - r, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + r, r);
  ctx.lineTo(bx + bw, by + bh - r);
  ctx.arcTo(bx + bw, by + bh, bx + bw - r, by + bh, r);
  ctx.lineTo(bx + r, by + bh);
  ctx.arcTo(bx, by + bh, bx, by + bh - r, r);
  ctx.lineTo(bx, by + r);
  ctx.arcTo(bx, by, bx + r, by, r);
  ctx.closePath();
}
```

**Verification:** Build passes without errors.

---

### Task 2: Restore coordinate caching with `_invalidated` flag

**Objective:** Avoid recomputing screen coordinates on every animation frame

**Files:**
- Modify: `src/utils/charts/tradeMarkersPrimitive.ts`

**Changes:**

1. Add `_invalidated = true` field
2. In `updateAllViews()`: set `this._invalidated = true`
3. In `draw`: only compute coordinates when `_invalidated`, cache in `_screenMarkers[]`
4. Keep the current always-compute approach as a fallback if cached coordinates are stale (viewport still moving)

**Verification:** Build passes, markers render correctly after zoom/scroll.

---

### Task 3: Detach primitive explicitly before chart removal

**Objective:** Clean up primitive reference chain

**Files:**
- Modify: `src/components/charts/TradingViewCandleChart.vue` (around line 626-634)

**Changes:**

In `destroyChart()`, before nulling `tradeMarkersPrimitive`:
- The lightweight-charts API has `series.detachPrimitive(primitive)`, but we need the candleSeries reference. Store it alongside the primitive.
- Add `candleSeries` variable alongside `tradeMarkersPrimitive`
- In `destroyChart`: `candleSeries?.detachPrimitive(tradeMarkersPrimitive)`

**Verification:** Build passes.

---

### Task 4: Refactor signal column definitions into shared source

**Objective:** Single source of truth for signal column configs

**Files:**
- Create: `src/utils/charts/signalConfigs.ts`
- Modify: `src/components/charts/TradingViewCandleChart.vue`

**Changes:**

Create `signalConfigs.ts` with the shared signal column definitions. Export a `SIGNAL_COLUMNS` array and a helper function. Import and use in both `signalLabelsForRow()` and `buildTradeMarkers()`.

**Verification:** Build passes, signals appear correctly in both chart markers and crosshair.

---

### Task 5: Performance — batch marker drawing by color

**Objective:** Reduce `ctx.save()`/`ctx.restore()` calls

**Files:**
- Modify: `src/utils/charts/tradeMarkersPrimitive.ts`

**Changes:**

In the `draw` callback, group `_screenMarkers` by `color + shape` before iterating, minimizing Canvas state changes.

**Verification:** Build passes.

---

### Task 6: Extract `buildTradeMarkers` to separate file

**Objective:** Reduce component complexity

**Files:**
- Create: `src/utils/charts/buildTradeMarkers.ts`
- Modify: `src/components/charts/TradingViewCandleChart.vue`

**Changes:**

Move the `buildTradeMarkers()` function (lines 418-577) to a new file `buildTradeMarkers.ts`. Import it back into the component. The function signature should accept all the props it needs:

```ts
export function buildTradeMarkers(
  dataset: PairHistory,
  trades: Trade[],
  colorUp: string,
  colorDown: string,
): TradeMarkerPoint[]
```

Keep `filteredTrades` as a parameter or compute it inside.

**Verification:** Build passes with `buildTradeMarkers` working identically.

---

## Tests / Validation

1. **Build**: `pnpm run typecheck && pnpm run build` must pass
2. **Docker**: `docker compose build frequi-custom` must succeed
3. **Visual**: After deploying, verify in the browser:
   - Entry triangles appear at correct price positions
   - DCA squares appear with `ft_order_tag` text (or `+N` fallback)
   - Exit circles appear with `✕ +profit%` for final exits, `ft_order_tag` for partial
   - Signal markers appear (arrows at signal prices)
   - Crosshair shows all order info correctly
   - Scroll/zoom: markers stay in correct positions

## Risks & Open Questions

1. **`ctx.roundRect` fallback**: The manual arcTo path must be tested on a non-supporting browser (or spoofed). Consider using a Canvas2D polyfill instead of manual drawing.

2. **Performance**: With 100+ markers and no caching (current state), `timeToCoordinate` is called on every frame. Lightweight-charts' implementation is O(log n) at worst, so this is probably fine, but caching (Task 2) adds complexity.

3. **Signal vs Trade overlap**: When a trade and a signal share the same candle/time, both markers render on top of each other. The user's crosshair shows both `signals` and `trades` lists. This is by design (signal = strategy said, trade = what actually happened), but can look cluttered. Consider an option to hide signals when a trade exists on the same candle.

4. **`ISeriesPrimitive` type**: The primitive uses `any` excessively because the lightweight-charts types are complex and `CanvasRenderingTarget2D` is not exported. This is acceptable for a plugin but limits IDE support. If lightweight-charts exports these types in a future version, we can add proper typing.

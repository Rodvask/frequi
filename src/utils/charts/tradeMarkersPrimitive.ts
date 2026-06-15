import type { Time, UTCTimestamp } from 'lightweight-charts';

export interface TradeMarkerPoint {
  time: UTCTimestamp;
  price: number;
  color: string;
  shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square';
  size: number;
  text: string;
}

/**
 * Custom primitive that renders trade markers with styled labels.
 * Uses Canvas2D for full control over shape and text rendering.
 */
export class TradeMarkersPrimitive {
  private _chart: any = null;
  private _series: any = null;
  private _requestUpdate: any = null;
  private _markers: TradeMarkerPoint[] = [];
  private _screenMarkers: { x: number; y: number; marker: TradeMarkerPoint }[] = [];
  private _invalidated = true;
  private _paneView: any;

  constructor(markers: TradeMarkerPoint[]) {
    this._markers = markers;
    this._paneView = this._createPaneView();
  }

  private _createPaneView() {
    const self = this;
    return {
      zOrder: () => 'top' as const,
      renderer: () => ({
        draw: (target: any) => {
          const chart = self._chart;
          const series = self._series;
          if (!chart || !series || !target.useMediaCoordinateSpace) return;
          target.useMediaCoordinateSpace((scope: any) => {
            const ctx = scope.context as CanvasRenderingContext2D;
            if (!ctx) return;

            // Recompute screen coordinates only when invalidated
            if (self._invalidated) {
              self._screenMarkers = [];
              const timeScale = chart.timeScale();
              for (const marker of self._markers) {
                const x = timeScale.timeToCoordinate(marker.time) as number | null;
                const y = series.priceToCoordinate(marker.price) as number | null;
                if (x === null || y === null) continue;
                self._screenMarkers.push({ x, y, marker });
              }
              self._invalidated = false;
            }

            // Group by color:shape for batch drawing (single save/restore per group)
            const groups = new Map<string, { x: number; y: number; marker: TradeMarkerPoint }[]>();
            for (const sm of self._screenMarkers) {
              const key = `${sm.marker.color}:${sm.marker.shape}`;
              let group = groups.get(key);
              if (!group) {
                group = [];
                groups.set(key, group);
              }
              group.push(sm);
            }
            for (const [, group] of groups) {
              for (const sm of group) {
                drawMarkerShape(ctx, sm.x, sm.y, sm.marker);
              }
            }
          });
        },
      }),
    };
  }

  setMarkers(markers: TradeMarkerPoint[]) {
    this._markers = markers;
    this._requestUpdate?.();
  }

  attached(param: { chart: any; series: any; requestUpdate: () => void }): void {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
    param.requestUpdate();
  }

  detached(): void {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  updateAllViews(): void {
    this._invalidated = true;
  }

  paneViews(): any[] {
    return [this._paneView];
  }
}

function drawMarkerShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  marker: TradeMarkerPoint,
): void {
  const { color, shape, size, text } = marker;
  const baseSize = Math.max(6, 12 * size);
  const isDark =
    document.documentElement.classList.contains('dark') ||
    document.documentElement.classList.contains('ft-dark-theme');
  const border = isDark ? '#ffffff' : 'rgba(0, 0, 0, 0.35)';

  ctx.save();

  // --- Draw shape ---
  if (shape === 'arrowUp' || shape === 'arrowDown') {
    const halfW = baseSize * 0.55;
    const h = baseSize * 0.85;
    const dir = shape === 'arrowUp' ? -1 : 1;

    ctx.beginPath();
    ctx.moveTo(x, y + dir * h);
    ctx.lineTo(x - halfW, y - dir * h * 0.3);
    ctx.lineTo(x + halfW, y - dir * h * 0.3);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (shape === 'circle') {
    const r = baseSize * 0.42;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (shape === 'square') {
    const half = baseSize * 0.32;
    ctx.fillStyle = color;
    ctx.fillRect(x - half, y - half, half * 2, half * 2);
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - half, y - half, half * 2, half * 2);
  }

  // --- Draw label ---
  if (text) {
    ctx.font = 'bold 11px "Arimo Variable", "Helvetica Neue", sans-serif';
    const tw = ctx.measureText(text).width;
    const th = 14;
    const padX = 5;

    const labelX = x - tw / 2 - padX;
    const labelY = y - baseSize - 3;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.beginPath();
    const r = 4;
    const bx = labelX, by = labelY - 11, bw = tw + padX * 2, bh = th;
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(bx, by, bw, bh, r);
    } else {
      // Manual rounded rect using arcTo (Safari/Firefox fallback)
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
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, labelX + padX, labelY + 2);
  }

  ctx.restore();
}

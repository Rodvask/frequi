import type { PairHistory, Trade, Order } from '@/types';
import type { TradeMarkerPoint } from './tradeMarkersPrimitive';
import { SIGNAL_COLUMNS } from './signalConfigs';
import type { UTCTimestamp } from 'lightweight-charts';

function columnIndex(dataset: PairHistory, name: string): number {
  return dataset.columns.findIndex((column) => column === name);
}

function rowValue(row: number[], column: number): number | null {
  const value = Number(row[column]);
  return Number.isFinite(value) ? value : null;
}

function hasSignalValue(row: number[], column: number): boolean {
  const value = rowValue(row, column);
  return value !== null && Math.abs(value) > Number.EPSILON;
}

function asTime(timestamp?: number | null): UTCTimestamp | null {
  if (!timestamp) return null;
  return Math.floor(timestamp / 1000) as UTCTimestamp;
}

function formatChartNumber(value: number | null, decimals = 5): string {
  if (value === null) return 'N/A';
  return formatPrice(value, Math.abs(value) >= 100 ? 2 : decimals);
}

function formatMarkerPrice(value: number | null): string {
  return value === null ? '' : ` @ ${formatChartNumber(value)}`;
}

export function buildTradeMarkers(
  dataset: PairHistory,
  trades: Trade[],
  colorUp: string,
  colorDown: string,
  longColor: string,
  shortColor: string,
  amber: string,
): TradeMarkerPoint[] {
  const markers: TradeMarkerPoint[] = [];
  const filteredTrades = trades.filter((trade) => trade.pair === dataset.pair);

  // --- Signal markers from strategy data ---
  const colDate = columnIndex(dataset, '__date_ts');
  const colEnterTag = columnIndex(dataset, 'enter_tag');
  const colExitTag = columnIndex(dataset, 'exit_tag');
  if (colDate >= 0) {
    for (const sc of SIGNAL_COLUMNS) {
      const sigCol = columnIndex(dataset, sc.column);
      if (sigCol < 0) continue;

      let color: string;
      switch (sc.colorField) {
        case 'colorUp':
          color = colorUp;
          break;
        case 'colorDown':
          color = colorDown;
          break;
        case 'amber':
          color = amber;
          break;
        default:
          color = amber;
      }

      const tagCol = sc.tagCol === 'enter_tag' ? colEnterTag : colExitTag;

      for (const row of dataset.data) {
        if (!hasSignalValue(row, sigCol)) continue;
        const price = rowValue(row, sigCol);
        if (price === null) continue;
        const tag = tagCol >= 0 && row[tagCol] ? String(row[tagCol]).slice(0, 24) : '';
        markers.push({
          time: asTime(row[colDate]) as any,
          price,
          color,
          shape: sc.shape,
          size: 0.6,
          text: tag,
        });
      }
    }
  }

  // --- Trade markers from orders ---
  filteredTrades.forEach((trade) => {
    const tradeColor = trade.is_short ? shortColor : longColor;
    const tradeLabel = `${trade.is_short ? 'Short' : 'Long'} #${trade.trade_id}`;
    const orders = trade.orders;

    if (!orders || orders.length === 0) {
      // Fallback when orders array is missing
      const openTime = asTime(roundTimeframe(dataset.timeframe_ms, trade.open_fill_timestamp ?? trade.open_timestamp));
      const openPrice = trade.open_rate ?? null;
      if (openTime && openPrice !== null) {
        markers.push({
          time: openTime as UTCTimestamp,
          price: openPrice,
          color: tradeColor,
          shape: trade.is_short ? 'arrowDown' : 'arrowUp',
          size: 0.9,
          text: tradeLabel,
        });
      }

      const closeTime = trade.close_timestamp ? asTime(roundTimeframe(dataset.timeframe_ms, trade.close_timestamp)) : null;
      const closePrice = trade.close_rate ?? trade.current_rate ?? null;
      if (closeTime && closePrice !== null) {
        const profitText = isDefined(trade.profit_ratio)
          ? `✕ ${formatPercent(trade.profit_ratio, 2)}`
          : '✕';
        markers.push({
          time: closeTime as UTCTimestamp,
          price: closePrice,
          color: amber,
          shape: 'circle',
          size: 0.9,
          text: profitText,
        });
      }
      return;
    }

    let entryCount = 0;
    let exitCount = 0;
    const totalOrders = orders.length;

    orders.forEach((order, index) => {
      const orderTs = roundTimeframe(
        dataset.timeframe_ms,
        order.order_filled_timestamp ??
          ('order_timestamp' in order ? (order as Order).order_timestamp : undefined) ??
          trade.open_fill_timestamp ??
          trade.open_timestamp,
      );
      const time = asTime(orderTs);
      if (!time) return;

      const price = order.safe_price ?? null;
      const isEntry = order.ft_is_entry || order.ft_order_side === 'buy';
      const isLast = index === totalOrders - 1;
      const isTradeClosed = !!trade.close_timestamp && !trade.is_open;

      if (isEntry) {
        entryCount++;
        if (price === null) return;
        if (entryCount === 1) {
          markers.push({
            time: time as UTCTimestamp,
            price,
            color: tradeColor,
            shape: trade.is_short ? 'arrowDown' : 'arrowUp',
            size: 0.9,
            text: tradeLabel,
          });
        } else {
          const dcaTag = (order as Order).ft_order_tag || `+${entryCount - 1}`;
          markers.push({
            time: time as UTCTimestamp,
            price,
            color: tradeColor,
            shape: 'square',
            size: 0.7,
            text: dcaTag,
          });
        }
      } else {
        // Exit order
        exitCount++;
        if (price === null) return;
        const isFinalExit = isLast && isTradeClosed;
        if (isFinalExit) {
          const label = isDefined(trade.profit_ratio)
            ? `✕ ${formatPercent(trade.profit_ratio, 2)}`
            : '✕';
          markers.push({
            time: time as UTCTimestamp,
            price,
            color: amber,
            shape: 'circle',
            size: 1.0,
            text: label,
          });
        } else {
          const dcaExitTag = (order as Order).ft_order_tag || `-${exitCount}`;
          markers.push({
            time: time as UTCTimestamp,
            price,
            color: amber,
            shape: 'circle',
            size: 0.7,
            text: dcaExitTag,
          });
        }
      }
    });
  });

  return markers.sort(
    (left, right) => Number(left.time) - Number(right.time),
  );
}

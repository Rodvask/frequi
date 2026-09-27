import { describe, expect, it } from 'vitest';
import { buildTradeMarkers } from '@/utils/charts/buildTradeMarkers';
import type { PairHistory } from '@/types';

// A tuple, not an object: buildTradeMarkers takes five positional colours, and spreading
// Object.values() would lose that arity.
const COLORS: [string, string, string, string, string] = [
  '#26a69a', // colorUp
  '#ef5350', // colorDown
  '#26a69a', // longColor
  '#ef5350', // shortColor
  '#fbbf24', // amber
];

/**
 * Builds a dataset shaped like the real one: a date column holding epoch milliseconds, the
 * OHLCV columns, then a strategy signal column and its tag column.
 */
function makeDataset(
  rows: (number | null | string)[][],
  signalColumn = '_buy_signal_close',
): PairHistory {
  return {
    pair: 'JCT/USDT:USDT',
    // The date column is __date_ts, not 'date': buildTradeMarkers looks that name up by
    // index and skips the whole signal pass when it is absent.
    columns: ['__date_ts', 'open', 'high', 'low', 'close', 'volume', signalColumn, 'enter_tag'],
    data: rows as PairHistory['data'],
    length: rows.length,
  } as PairHistory;
}

const PRICE = 0.0018;

function row(date: number | null, signal: number, tag: string): (number | string | null)[] {
  return [date, PRICE, PRICE, PRICE, PRICE, 100, signal, tag];
}

describe('buildTradeMarkers', () => {
  it('skips a row whose date column cannot be placed on the time axis', () => {
    // Rows 3 and 4 carry a null and a zero date. `asTime` maps both to null, and a null
    // timestamp cannot be drawn: the marker used to be built anyway, with the null cast to
    // `any` to keep the compiler quiet, and handed to the chart library as a marker time.
    const dataset = makeDataset([
      row(1754581515000, 1, 'enter_long_a'),
      row(1754581695000, 0, ''),
      row(null, 1, 'enter_long_b'),
      row(0, 1, 'enter_long_c'),
    ]);

    const markers = buildTradeMarkers(dataset, [], ...COLORS);

    expect(markers).toHaveLength(1);
    expect(markers[0].text).toBe('enter_long_a');
  });

  it('only ever emits finite numeric timestamps', () => {
    const dataset = makeDataset([row(1754581515000, 1, 'a'), row(null, 1, 'b'), row(0, 1, 'c')]);

    const markers = buildTradeMarkers(dataset, [], ...COLORS);

    expect(markers.length).toBeGreaterThan(0);
    for (const marker of markers) {
      expect(typeof marker.time).toBe('number');
      expect(Number.isFinite(marker.time)).toBe(true);
    }
  });

  it('converts epoch milliseconds to the seconds the chart expects', () => {
    const ms = 1754581515000;
    const dataset = makeDataset([row(ms, 1, 'a')]);

    const [marker] = buildTradeMarkers(dataset, [], ...COLORS);

    expect(marker.time).toBe(Math.floor(ms / 1000));
  });

  it('ignores a row with no signal value', () => {
    const dataset = makeDataset([
      row(1754581515000, 0, 'no_signal'),
      row(1754581695000, 1, 'real_signal'),
    ]);

    const markers = buildTradeMarkers(dataset, [], ...COLORS);

    expect(markers).toHaveLength(1);
    expect(markers[0].text).toBe('real_signal');
  });

  it('truncates an oversized tag to 24 characters', () => {
    const dataset = makeDataset([row(1754581515000, 1, 'x'.repeat(60))]);

    const [marker] = buildTradeMarkers(dataset, [], ...COLORS);

    expect(marker.text).toHaveLength(24);
  });
});

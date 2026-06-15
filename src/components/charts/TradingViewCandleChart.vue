<script setup lang="ts">
import type { PairHistory, PlotConfig, Trade } from '@/types';
import { ChartType } from '@/types';
import { heikinAshiDataset } from '@/utils/charts/heikinAshiDataset';

import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type LogicalRange,
  type MouseEventParams,
  type SeriesType,
  type SingleValueData,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { buildTradeMarkers } from '@/utils/charts/buildTradeMarkers';
import { TradeMarkersPrimitive } from '@/utils/charts/tradeMarkersPrimitive';
import type { TradeMarkerPoint } from '@/utils/charts/tradeMarkersPrimitive';

const props = defineProps<{
  trades: Trade[];
  dataset: PairHistory;
  plotConfig: PlotConfig;
  heikinAshi: boolean;
  colorUp: string;
  colorDown: string;
  startCandleCount: number;
}>();

const colorStore = useColorStore();
const settingsStore = useSettingsStore();
const chartContainer = ref<HTMLElement | null>(null);
const crosshairInfo = ref<{
  time: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
  signals: string[];
  trades: string[];
  indicators: { label: string; value: string }[];
} | null>(null);
let chart: IChartApi | null = null;
let resizeObserver: ResizeObserver | null = null;
let visibleLogicalRange: LogicalRange | null = null;
let visibleLogicalRangeKey = '';

function accentHex(): string {
  const accent = colorStore.primaryAccentConfig;
  return settingsStore.isDarkTheme ? accent.dark : accent.light;
}

function accentRgbStr(): string {
  const accent = colorStore.primaryAccentConfig;
  return settingsStore.isDarkTheme ? accent.darkRgb : accent.lightRgb;
}

const filteredTrades = computed(() =>
  props.trades.filter((trade) => trade.pair === props.dataset.pair),
);
let indicatorSeriesRefs: { label: string; series: ISeriesApi<SeriesType, Time> }[] = [];

const indicatorBadgeValues = computed(() => {
  if (crosshairInfo.value?.indicators.length) return crosshairInfo.value.indicators.slice(0, 4);

  const lastRow = props.dataset.data[props.dataset.data.length - 1];
  if (!lastRow) return [];

  return indicatorColumns()
    .map((column) => ({
      label: column,
      value: formatChartNumber(rowValue(lastRow, column), 4),
    }))
    .filter((item) => item.value !== 'N/A')
    .slice(0, 4);
});

function columnIndex(name: string) {
  return props.dataset.columns.findIndex((column) => column === name);
}

function chartTextColor() {
  return settingsStore.chartTheme === 'dark' ? '#d8e0ea' : '#334155';
}

function chartGridColor() {
  return settingsStore.chartTheme === 'dark' ? 'rgba(148, 163, 184, 0.12)' : '#d7dee8';
}

function rowValue(row: number[], column: number): number | null {
  const value = Number(row[column]);
  return Number.isFinite(value) ? value : null;
}

function rowText(row: unknown[], column: number): string {
  const value = row[column];
  return value === null || value === undefined ? '' : String(value);
}

function formatChartNumber(value: number | null, decimals = 5): string {
  if (value === null) return 'N/A';
  return formatPrice(value, Math.abs(value) >= 100 ? 2 : decimals);
}

function formatMarkerPrice(value: number | null): string {
  return value === null ? '' : ` @ ${formatChartNumber(value)}`;
}

function formatIndicatorLabel(label: string): string {
  return label
    .replace(/^_+|_+$/g, '')
    .replace(/_/g, ' ')
    .replace(/\b(rsi|ema|sma|macd|atr|adx|cci|mfi|obv|roc)\b/gi, (match) => match.toUpperCase())
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function hasSignalValue(row: number[], column: number): boolean {
  const value = rowValue(row, column);
  return value !== null && Math.abs(value) > Number.EPSILON;
}

function asTime(timestamp?: number | null): UTCTimestamp | null {
  if (!timestamp) return null;
  return Math.floor(timestamp / 1000) as UTCTimestamp;
}

function buildCandleData(): CandlestickData<Time>[] {
  const columns = props.dataset.columns.slice();
  const source = props.heikinAshi
    ? heikinAshiDataset(columns, props.dataset.data)
    : props.dataset.data;
  const colDate = columns.findIndex((column) => column === '__date_ts');
  const colOpen = columns.findIndex((column) => column === 'open');
  const colHigh = columns.findIndex((column) => column === 'high');
  const colLow = columns.findIndex((column) => column === 'low');
  const colClose = columns.findIndex((column) => column === 'close');

  if ([colDate, colOpen, colHigh, colLow, colClose].some((index) => index < 0)) return [];

  return source
    .map((row) => ({
      time: asTime(row[colDate]) as UTCTimestamp,
      open: Number(row[colOpen]),
      high: Number(row[colHigh]),
      low: Number(row[colLow]),
      close: Number(row[colClose]),
    }))
    .filter(
      (candle) =>
        candle.time &&
        Number.isFinite(candle.open) &&
        Number.isFinite(candle.high) &&
        Number.isFinite(candle.low) &&
        Number.isFinite(candle.close),
    );
}

function buildVolumeData(): HistogramData<Time>[] {
  const colDate = columnIndex('__date_ts');
  const colOpen = columnIndex('open');
  const colClose = columnIndex('close');
  const colVolume = columnIndex('volume');

  if ([colDate, colOpen, colClose, colVolume].some((index) => index < 0)) return [];

  return props.dataset.data
    .map((row) => {
      const isPositive = Number(row[colClose]) >= Number(row[colOpen]);
      return {
        time: asTime(row[colDate]) as UTCTimestamp,
        value: Number(row[colVolume]),
        color: isPositive ? 'rgba(32, 225, 157, 0.28)' : 'rgba(255, 95, 112, 0.28)',
      };
    })
    .filter((bar) => bar.time && Number.isFinite(bar.value));
}

function buildSeriesData(columnName: string): SingleValueData<Time>[] {
  const colDate = columnIndex('__date_ts');
  const colValue = columnIndex(columnName);

  if (colDate < 0 || colValue < 0) return [];

  return props.dataset.data
    .map((row) => {
      const value = rowValue(row, colValue);
      return {
        time: asTime(row[colDate]) as UTCTimestamp,
        value: value ?? Number.NaN,
      };
    })
    .filter((point) => point.time && Number.isFinite(point.value));
}

function indicatorColumns(): string[] {
  const configured = new Set<string>();
  Object.keys(props.plotConfig.main_plot ?? {}).forEach((key) => configured.add(key));
  Object.values(props.plotConfig.subplots ?? {}).forEach((subplot) => {
    Object.keys(subplot).forEach((key) => configured.add(key));
  });

  return [...configured].filter((key) => columnIndex(key) >= 0);
}

function signalLabelsForRow(row: unknown[]): string[] {
  const signalColumns = [
    { column: '_buy_signal_close', label: 'Long entry', tagColumn: columnIndex('enter_tag') },
    {
      column: '_enter_long_signal_close',
      label: 'Long entry',
      tagColumn: columnIndex('enter_tag'),
    },
    { column: '_sell_signal_close', label: 'Long exit', tagColumn: columnIndex('exit_tag') },
    { column: '_exit_long_signal_close', label: 'Long exit', tagColumn: columnIndex('exit_tag') },
    {
      column: '_enter_short_signal_close',
      label: 'Short entry',
      tagColumn: columnIndex('enter_tag'),
    },
    { column: '_exit_short_signal_close', label: 'Short exit', tagColumn: columnIndex('exit_tag') },
  ];

  return signalColumns.flatMap((signal) => {
    const signalColumn = columnIndex(signal.column);
    if (signalColumn < 0 || !hasSignalValue(row as number[], signalColumn)) return [];

    const price = rowValue(row as number[], signalColumn);
    const tag = signal.tagColumn >= 0 ? rowText(row, signal.tagColumn) : '';
    const priceLabel = formatMarkerPrice(price);
    return tag ? `${signal.label}${priceLabel}: ${tag}` : `${signal.label}${priceLabel}`;
  });
}

function tradesForTime(time: UTCTimestamp): string[] {
  const candleStartMs = Number(time) * 1000;
  const candleEndMs = candleStartMs + props.dataset.timeframe_ms;
  const isInsideCandle = (timestamp?: number | null) =>
    isDefined(timestamp) && timestamp >= candleStartMs && timestamp < candleEndMs;

  // Count DCAs per trade for labelling
  const dcaCounts: Record<number, number> = {};
  filteredTrades.value.forEach((trade) => {
    const opens = [trade.open_timestamp];
    if (trade.orders?.length) {
      trade.orders
        .filter((o) => o.ft_order_side === 'buy' && o.status === 'closed')
        .forEach((o) => opens.push(o.order_timestamp));
    }
    dcaCounts[trade.trade_id] = opens.filter((t) => t).length - 1;
  });

  return filteredTrades.value.flatMap((trade) => {
    const labels: string[] = [];

    // Entry
    if (isInsideCandle(trade.open_timestamp)) {
      const entryTag = trade.enter_tag ? ` ${trade.enter_tag}` : '';
      const direction = trade.is_short ? 'Short' : 'Long';
      const dcaLabel =
        (dcaCounts[trade.trade_id] ?? 0) > 0 ? ` +${dcaCounts[trade.trade_id]}` : '';
      labels.push(`${direction} #${trade.trade_id}${entryTag}${dcaLabel}`);
    }

    // DCA orders (additional entries)
    if (trade.orders?.length) {
      let dcaIndex = 1;
      for (const order of trade.orders) {
        if (
          order.ft_order_side === 'buy' &&
          order.status === 'closed' &&
          isInsideCandle(order.order_timestamp)
        ) {
          const tag = order.ft_order_tag ? ` ${order.ft_order_tag}` : ` +${dcaIndex}`;
          labels.push(`DCA #${trade.trade_id}${tag}`);
          dcaIndex++;
        }
      }
    }

    // Partial DCA exits (sell orders that are not the final close)
    if (trade.orders?.length) {
      for (const order of trade.orders) {
        if (
          order.ft_order_side === 'sell' &&
          order.status === 'closed' &&
          order.safe_price !== trade.close_rate &&
          isInsideCandle(order.order_timestamp)
        ) {
          const tag = order.ft_order_tag ? ` ${order.ft_order_tag}` : '';
          const amount = order.filled ? ` ${formatPrice(order.filled)}` : '';
          labels.push(`Partial exit #${trade.trade_id}${tag}${amount}`);
        }
      }
    }

    // Close / Exit
    if (isInsideCandle(trade.close_timestamp)) {
      const profit = isDefined(trade.profit_ratio)
        ? ` ${formatPercent(trade.profit_ratio, 2)}`
        : '';
      const exitReason = trade.exit_reason ? ` ${trade.exit_reason}` : '';
      labels.push(`✕ #${trade.trade_id}${exitReason}${profit}`);
    }

    return labels;
  });
}

function dataPointValue(point: unknown): number | null {
  if (!point || typeof point !== 'object' || !('value' in point)) return null;

  const value = Number((point as { value?: unknown }).value);
  return Number.isFinite(value) ? value : null;
}

function indicatorValuesForCrosshair(param: MouseEventParams<Time>, row: number[]) {
  const values = indicatorSeriesRefs
    .map(({ label, series }) => ({
      label,
      value: formatChartNumber(dataPointValue(param.seriesData.get(series)), 4),
    }))
    .filter((item) => item.value !== 'N/A');

  if (values.length) return values;

  return indicatorColumns()
    .map((column) => ({
      label: column,
      value: formatChartNumber(rowValue(row, column), 4),
    }))
    .filter((item) => item.value !== 'N/A');
}

function updateCrosshairInfo(param: MouseEventParams<Time>) {
  const time = param.time;
  if (!time) {
    crosshairInfo.value = null;
    return;
  }

  const colDate = columnIndex('__date_ts');
  const colOpen = columnIndex('open');
  const colHigh = columnIndex('high');
  const colLow = columnIndex('low');
  const colClose = columnIndex('close');
  const colVolume = columnIndex('volume');

  if ([colDate, colOpen, colHigh, colLow, colClose].some((index) => index < 0)) {
    crosshairInfo.value = null;
    return;
  }

  const timestamp = Number(time);
  const row = props.dataset.data.find(
    (item) => Math.floor(Number(item[colDate]) / 1000) === timestamp,
  );
  if (!row) {
    crosshairInfo.value = null;
    return;
  }

  crosshairInfo.value = {
    time: new Date(timestamp * 1000).toLocaleString(),
    open: formatChartNumber(rowValue(row, colOpen)),
    high: formatChartNumber(rowValue(row, colHigh)),
    low: formatChartNumber(rowValue(row, colLow)),
    close: formatChartNumber(rowValue(row, colClose)),
    volume: colVolume >= 0 ? formatChartNumber(rowValue(row, colVolume), 2) : undefined,
    signals: signalLabelsForRow(row),
    trades: tradesForTime(time as UTCTimestamp),
    indicators: indicatorValuesForCrosshair(param, row),
  };
}

function buildTradeMarkersData(): TradeMarkerPoint[] {
  return buildTradeMarkers(
    props.dataset,
    props.trades,
    props.colorUp,
    props.colorDown,
    '#3B82F6', // long entry (vibrant blue)
    '#FF0044', // short entry (vibrant red)
    '#f6b21a', // exit / amber signals (yellow)
  );
}

function addIndicatorSeries(key: string, config = {}, paneIndex = 0) {
  if (!chart) return;

  const typedConfig = config as { color?: string; type?: ChartType | keyof typeof ChartType };
  const indicatorType = String(typedConfig.type ?? ChartType.line);
  const data = buildSeriesData(key);
  if (!data.length) return;

  if (indicatorType === ChartType.bar) {
    const barSeries = chart.addSeries(
      HistogramSeries,
      {
        color: typedConfig.color || 'rgba(246, 178, 26, 0.48)',
        priceLineVisible: false,
        lastValueVisible: false,
        title: '',
      },
      paneIndex,
    );
    barSeries.setData(data as HistogramData<Time>[]);
    indicatorSeriesRefs.push({ label: key, series: barSeries });
    return;
  }

  const isScatter = indicatorType === ChartType.scatter;
  const lineSeries = chart.addSeries(
    LineSeries,
    {
      color: typedConfig.color || accentHex(),
      lineVisible: !isScatter,
      lineWidth: 2,
      pointMarkersVisible: isScatter,
      priceLineVisible: false,
      lastValueVisible: false,
      title: '',
    },
    paneIndex,
  );

  lineSeries.setData(data as LineData<Time>[]);
  indicatorSeriesRefs.push({ label: key, series: lineSeries });
}

function datasetRangeKey() {
  return `${props.dataset.strategy}:${props.dataset.pair}:${props.dataset.timeframe}`;
}

function destroyChart(preserveRange = true) {
  if (preserveRange) {
    visibleLogicalRange = chart?.timeScale().getVisibleLogicalRange() ?? visibleLogicalRange;
  }
  indicatorSeriesRefs = [];
  chart?.remove();
  chart = null;
}

function createTradingChart() {
  const container = chartContainer.value;
  if (!container) return;

  const nextRangeKey = datasetRangeKey();
  const preserveRange = !visibleLogicalRangeKey || visibleLogicalRangeKey === nextRangeKey;
  if (!preserveRange) {
    visibleLogicalRange = null;
  }

  destroyChart(preserveRange);
  visibleLogicalRangeKey = nextRangeKey;

  chart = createChart(container, {
    width: container.clientWidth,
    height: container.clientHeight,
    autoSize: true,
    layout: {
      attributionLogo: true,
      background: { type: ColorType.Solid, color: 'transparent' },
      fontFamily:
        '"Arimo Variable", "Helvetica Neue", Helvetica, Arial, "Nimbus Sans", "Segoe UI", ui-sans-serif, system-ui, sans-serif',
      textColor: chartTextColor(),
    },
    grid: {
      vertLines: { color: chartGridColor() },
      horzLines: { color: chartGridColor() },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: `${accentHex()}55`, labelBackgroundColor: accentHex() },
      horzLine: { color: `${accentHex()}44`, labelBackgroundColor: accentHex() },
    },
    localization: {
      priceFormatter: (price: number) =>
        Math.abs(price) >= 100 ? price.toFixed(2) : price.toPrecision(6),
    },
    rightPriceScale: {
      borderColor: 'rgba(148, 163, 184, 0.18)',
      scaleMargins: { top: 0.08, bottom: 0.24 },
    },
    timeScale: {
      borderColor: 'rgba(148, 163, 184, 0.18)',
      rightOffset: 8,
      timeVisible: true,
      secondsVisible: false,
    },
    trackingMode: {
      exitMode: 1,
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true,
    },
    handleScroll: {
      horzTouchDrag: true,
      mouseWheel: true,
      pressedMouseMove: true,
      vertTouchDrag: false,
    },
  });

  const candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: props.colorUp,
    downColor: props.colorDown,
    borderUpColor: props.colorUp,
    borderDownColor: props.colorDown,
    wickUpColor: props.colorUp,
    wickDownColor: props.colorDown,
    priceLineColor: 'rgba(246, 178, 26, 0.45)',
    priceLineWidth: 1,
  });

  candleSeries.setData(buildCandleData());
  const tradeMarkersPrimitive = new TradeMarkersPrimitive(buildTradeMarkersData());
  candleSeries.attachPrimitive(tradeMarkersPrimitive);
  chart.subscribeCrosshairMove((param) => updateCrosshairInfo(param));

  const volumeSeries = chart.addSeries(HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceScaleId: '',
    lastValueVisible: false,
    priceLineVisible: false,
  });
  volumeSeries.setData(buildVolumeData());
  volumeSeries.priceScale().applyOptions({
    scaleMargins: { top: 0.8, bottom: 0 },
  });

  Object.entries(props.plotConfig.main_plot).forEach(([key, config]) => {
    addIndicatorSeries(key, config, 0);
  });

  Object.entries(props.plotConfig.subplots ?? {}).forEach(([, subplot], index) => {
    const paneIndex = index + 1;
    Object.entries(subplot).forEach(([key, config]) => {
      addIndicatorSeries(key, config, paneIndex);
    });
    chart?.panes()[paneIndex]?.setStretchFactor(0.34);
  });
  chart.panes()[0]?.setStretchFactor(1);

  const candleCount = buildCandleData().length;
  if (visibleLogicalRange) {
    chart.timeScale().setVisibleLogicalRange(visibleLogicalRange);
  } else if (candleCount > props.startCandleCount) {
    chart.timeScale().setVisibleLogicalRange({
      from: candleCount - props.startCandleCount,
      to: candleCount + 4,
    });
  } else {
    chart.timeScale().fitContent();
  }

  chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
    visibleLogicalRange = range;
  });
}

function observeSize() {
  const container = chartContainer.value;
  if (!container) return;

  resizeObserver?.disconnect();
  resizeObserver = new ResizeObserver(() => {
    if (!chart || !container.clientWidth || !container.clientHeight) return;
    chart.applyOptions({
      width: container.clientWidth,
      height: container.clientHeight,
    });
  });
  resizeObserver.observe(container);
}

onMounted(() => {
  createTradingChart();
  observeSize();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  destroyChart();
});

watch(
  () => [
    props.dataset,
    props.trades,
    props.plotConfig,
    props.heikinAshi,
    props.colorUp,
    props.colorDown,
    props.startCandleCount,
    settingsStore.chartTheme,
  ],
  () => nextTick(createTradingChart),
  { deep: true },
);
</script>

<template>
  <div class="ft-tradingview-chart">
    <div v-if="crosshairInfo" class="ft-tradingview-crosshair">
      <div class="ft-tradingview-crosshair__head">
        <strong>{{ crosshairInfo.time }}</strong>
        <span v-if="crosshairInfo.volume">Vol {{ crosshairInfo.volume }}</span>
      </div>
      <div class="ft-tradingview-crosshair__ohlc">
        <span
          ><small>Open</small><b>{{ crosshairInfo.open }}</b></span
        >
        <span
          ><small>High</small><b>{{ crosshairInfo.high }}</b></span
        >
        <span
          ><small>Low</small><b>{{ crosshairInfo.low }}</b></span
        >
        <span
          ><small>Close</small><b>{{ crosshairInfo.close }}</b></span
        >
      </div>
      <div v-if="crosshairInfo.trades.length" class="ft-tradingview-crosshair__section">
        <small>Trades</small>
        <span
          v-for="tradeEvent in crosshairInfo.trades"
          :key="tradeEvent"
          class="ft-tradingview-crosshair__event"
        >
          {{ tradeEvent }}
        </span>
      </div>
      <div v-if="crosshairInfo.signals.length" class="ft-tradingview-crosshair__section">
        <small>Signals</small>
        <span
          v-for="signal in crosshairInfo.signals"
          :key="signal"
          class="ft-tradingview-crosshair__event"
        >
          {{ signal }}
        </span>
      </div>
      <div v-if="crosshairInfo.indicators.length" class="ft-tradingview-crosshair__indicators">
        <span v-for="indicator in crosshairInfo.indicators.slice(0, 4)" :key="indicator.label">
          <small>{{ formatIndicatorLabel(indicator.label) }}</small>
          <b>{{ indicator.value }}</b>
        </span>
      </div>
    </div>
    <div v-if="indicatorBadgeValues.length" class="ft-tradingview-indicators">
      <span v-for="indicator in indicatorBadgeValues" :key="indicator.label">
        <small>{{ formatIndicatorLabel(indicator.label) }}</small>
        <b>{{ indicator.value }}</b>
      </span>
    </div>
    <div ref="chartContainer" class="ft-tradingview-chart__canvas" />
  </div>
</template>

<style scoped>
.ft-tradingview-chart {
  position: relative;
  min-height: 280px;
  height: 100%;
  width: 100%;
  overflow: hidden;
  border-radius: 0;
  background: var(--ft-bg-muted);
}

.ft-tradingview-chart__canvas {
  height: 100%;
  min-height: 280px;
  width: 100%;
}

.ft-tradingview-crosshair {
  position: absolute;
  top: 0.45rem;
  left: 0.45rem;
  z-index: 3;
  display: grid;
  gap: 0.35rem;
  max-width: min(26rem, calc(100% - 0.9rem));
  padding: 0.55rem;
  border: 1px solid rgb(var(--ft-accent-rgb) / 0.28);
  border-radius: 0.45rem;
  background: color-mix(in srgb, var(--ft-panel-strong) 88%, transparent);
  color: var(--ft-text);
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(10px);
  pointer-events: none;
}

.ft-tradingview-crosshair__head,
.ft-tradingview-crosshair__ohlc,
.ft-tradingview-crosshair__section,
.ft-tradingview-crosshair__indicators {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.ft-tradingview-crosshair__head {
  justify-content: space-between;
  color: var(--p-primary-color);
  font-size: 0.78rem;
  gap: 0.75rem;
}

.ft-tradingview-crosshair__head span {
  color: var(--ft-text-muted);
}

.ft-tradingview-crosshair__ohlc {
  display: grid;
  grid-template-columns: repeat(4, minmax(3.6rem, 1fr));
}

.ft-tradingview-crosshair__ohlc span,
.ft-tradingview-crosshair__indicators span {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
  padding: 0.28rem 0.38rem;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 0.35rem;
  background: color-mix(in srgb, var(--ft-panel) 72%, transparent);
}

.ft-tradingview-crosshair small {
  color: var(--ft-text-muted);
  font-size: 0.62rem;
  font-weight: 800;
  line-height: 1;
  text-transform: uppercase;
}

.ft-tradingview-crosshair__ohlc b,
.ft-tradingview-crosshair__indicators b {
  color: var(--ft-text);
  font-size: 0.77rem;
  line-height: 1.1;
}

.ft-tradingview-crosshair__section,
.ft-tradingview-crosshair__indicators {
  font-size: 0.76rem;
  font-weight: 750;
}

.ft-tradingview-crosshair__section > small {
  width: 100%;
}

.ft-tradingview-crosshair__event {
  padding: 0.18rem 0.4rem;
  border: 1px solid rgb(var(--ft-accent-rgb) / 0.22);
  border-radius: 999px;
  background: rgb(var(--ft-accent-rgb) / 0.08);
  color: rgb(var(--ft-accent-rgb));
}

.ft-tradingview-indicators {
  position: absolute;
  right: 3.65rem;
  bottom: 2.2rem;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.3rem;
  max-width: min(30rem, calc(100% - 5rem));
  pointer-events: none;
}

.ft-tradingview-indicators span {
  display: inline-flex;
  gap: 0.35rem;
  align-items: baseline;
  min-height: 1.45rem;
  padding: 0.18rem 0.45rem;
  border: 1px solid rgb(var(--ft-accent-rgb) / 0.2);
  border-radius: 0.35rem;
  background: color-mix(in srgb, var(--ft-panel-strong) 84%, transparent);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(8px);
}

.ft-tradingview-indicators small {
  color: var(--p-primary-color);
  font-size: 0.65rem;
  font-weight: 850;
  line-height: 1;
  text-transform: uppercase;
}

.ft-tradingview-indicators b {
  color: var(--ft-text);
  font-size: 0.74rem;
  line-height: 1;
}

@media (max-width: 768px) {
  .ft-tradingview-chart,
  .ft-tradingview-chart__canvas {
    min-height: 360px;
  }

  .ft-tradingview-crosshair {
    top: 0.35rem;
    left: 0.35rem;
    right: 0.45rem;
    width: auto;
    max-width: none;
    max-height: min(16rem, 44%);
    overflow: hidden;
    padding: 0.42rem;
    gap: 0.28rem;
    font-size: 0.7rem;
  }

  .ft-tradingview-crosshair__head {
    gap: 0.35rem;
    font-size: 0.68rem;
  }

  .ft-tradingview-crosshair__ohlc {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ft-tradingview-crosshair__ohlc span,
  .ft-tradingview-crosshair__indicators span {
    padding: 0.2rem 0.28rem;
  }

  .ft-tradingview-crosshair__indicators {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ft-tradingview-crosshair__event {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ft-tradingview-indicators {
    right: 0.45rem;
    bottom: 2rem;
    max-width: calc(100% - 4.6rem);
  }

  .ft-tradingview-indicators span {
    min-height: 1.3rem;
    padding: 0.15rem 0.34rem;
  }

  .ft-tradingview-indicators small,
  .ft-tradingview-indicators b {
    font-size: 0.66rem;
  }
}
</style>

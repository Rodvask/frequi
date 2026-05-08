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
  createSeriesMarkers,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesMarkersPluginApi,
  type LineData,
  type SeriesMarker,
  type SingleValueData,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';

const props = defineProps<{
  trades: Trade[];
  dataset: PairHistory;
  plotConfig: PlotConfig;
  heikinAshi: boolean;
  colorUp: string;
  colorDown: string;
  startCandleCount: number;
}>();

const chartContainer = ref<HTMLElement | null>(null);
let chart: IChartApi | null = null;
let resizeObserver: ResizeObserver | null = null;
let markersApi: ISeriesMarkersPluginApi<Time> | null = null;

const amber = '#f6b21a';
const panel = '#080d17';
const text = '#d8e0ea';
const muted = '#8795a8';
const grid = 'rgba(148, 163, 184, 0.12)';

const filteredTrades = computed(() => props.trades.filter((trade) => trade.pair === props.dataset.pair));

function columnIndex(name: string) {
  return props.dataset.columns.findIndex((column) => column === name);
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

function buildSignalMarkers(): SeriesMarker<Time>[] {
  const colDate = columnIndex('__date_ts');
  const colEnterTag = columnIndex('enter_tag');
  const colExitTag = columnIndex('exit_tag');
  const signalColumns = [
    {
      column: '_buy_signal_close',
      label: 'Long entry',
      position: 'belowBar' as const,
      shape: 'arrowUp' as const,
      color: props.colorUp,
      tagColumn: colEnterTag,
    },
    {
      column: '_enter_long_signal_close',
      label: 'Long entry',
      position: 'belowBar' as const,
      shape: 'arrowUp' as const,
      color: props.colorUp,
      tagColumn: colEnterTag,
    },
    {
      column: '_sell_signal_close',
      label: 'Long exit',
      position: 'aboveBar' as const,
      shape: 'circle' as const,
      color: amber,
      tagColumn: colExitTag,
    },
    {
      column: '_exit_long_signal_close',
      label: 'Long exit',
      position: 'aboveBar' as const,
      shape: 'circle' as const,
      color: amber,
      tagColumn: colExitTag,
    },
    {
      column: '_enter_short_signal_close',
      label: 'Short entry',
      position: 'aboveBar' as const,
      shape: 'arrowDown' as const,
      color: props.colorDown,
      tagColumn: colEnterTag,
    },
    {
      column: '_exit_short_signal_close',
      label: 'Short exit',
      position: 'belowBar' as const,
      shape: 'circle' as const,
      color: amber,
      tagColumn: colExitTag,
    },
  ];

  if (colDate < 0) return [];

  return signalColumns.flatMap((signal) => {
    const signalColumn = columnIndex(signal.column);
    if (signalColumn < 0) return [];

    return props.dataset.data
      .filter((row) => hasSignalValue(row, signalColumn))
      .map((row) => {
        const tag =
          signal.tagColumn >= 0 && row[signal.tagColumn]
            ? String(row[signal.tagColumn]).slice(0, 38)
            : '';
        return {
          time: asTime(row[colDate]) as UTCTimestamp,
          position: signal.position,
          color: signal.color,
          shape: signal.shape,
          text: tag ? `${signal.label}: ${tag}` : signal.label,
        };
      })
      .filter((marker) => marker.time);
  });
}

function buildTradeMarkers(): SeriesMarker<Time>[] {
  const markers: SeriesMarker<Time>[] = [];

  filteredTrades.value.forEach((trade) => {
    const openTime = asTime(trade.open_timestamp);
    if (openTime) {
      markers.push({
        time: openTime,
        position: trade.is_short ? 'aboveBar' : 'belowBar',
        color: trade.is_short ? props.colorDown : props.colorUp,
        shape: trade.is_short ? 'arrowDown' : 'arrowUp',
        text: `${trade.is_short ? 'Short' : 'Long'} #${trade.trade_id}`,
      });
    }

    const closeTime = asTime(trade.close_timestamp);
    if (closeTime) {
      markers.push({
        time: closeTime,
        position: trade.is_short ? 'belowBar' : 'aboveBar',
        color: amber,
        shape: 'circle',
        text: `Close #${trade.trade_id}`,
      });
    }
  });

  return [...buildSignalMarkers(), ...markers].sort((left, right) => Number(left.time) - Number(right.time));
}

function addIndicatorSeries(
  key: string,
  config = {},
  paneIndex = 0,
) {
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
        title: key,
      },
      paneIndex,
    );
    barSeries.setData(data as HistogramData<Time>[]);
    return;
  }

  const isScatter = indicatorType === ChartType.scatter;
  const lineSeries = chart.addSeries(
    LineSeries,
    {
      color: typedConfig.color || amber,
      lineVisible: !isScatter,
      lineWidth: 2,
      pointMarkersVisible: isScatter,
      priceLineVisible: false,
      lastValueVisible: false,
      title: key,
    },
    paneIndex,
  );

  lineSeries.setData(data as LineData<Time>[]);
}

function destroyChart() {
  markersApi?.detach();
  markersApi = null;
  chart?.remove();
  chart = null;
}

function createTradingChart() {
  const container = chartContainer.value;
  if (!container) return;

  destroyChart();

  chart = createChart(container, {
    width: container.clientWidth,
    height: container.clientHeight,
    autoSize: true,
    layout: {
      attributionLogo: true,
      background: { type: ColorType.Solid, color: 'transparent' },
      fontFamily:
        '"Arimo Variable", "Helvetica Neue", Helvetica, Arial, "Nimbus Sans", "Segoe UI", ui-sans-serif, system-ui, sans-serif',
      textColor: text,
    },
    grid: {
      vertLines: { color: grid },
      horzLines: { color: grid },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: 'rgba(246, 178, 26, 0.45)', labelBackgroundColor: amber },
      horzLine: { color: 'rgba(246, 178, 26, 0.35)', labelBackgroundColor: amber },
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
  markersApi = createSeriesMarkers(candleSeries, buildTradeMarkers(), { zOrder: 'top' });

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

  const startIndex = Math.max(buildCandleData().length - props.startCandleCount, 0);
  if (startIndex > 0) {
    chart.timeScale().setVisibleLogicalRange({
      from: startIndex,
      to: buildCandleData().length + 4,
    });
  } else {
    chart.timeScale().fitContent();
  }
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
  ],
  () => nextTick(createTradingChart),
  { deep: true },
);
</script>

<template>
  <div class="ft-tradingview-chart">
    <div ref="chartContainer" class="ft-tradingview-chart__canvas" />
  </div>
</template>

<style scoped>
.ft-tradingview-chart {
  min-height: 280px;
  height: 100%;
  width: 100%;
  overflow: hidden;
  border-radius: 0;
  background: v-bind(panel);
}

.ft-tradingview-chart__canvas {
  height: 100%;
  min-height: 280px;
  width: 100%;
}

@media (max-width: 768px) {
  .ft-tradingview-chart,
  .ft-tradingview-chart__canvas {
    min-height: 360px;
  }
}
</style>

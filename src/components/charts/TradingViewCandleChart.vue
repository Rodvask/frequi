<script setup lang="ts">
import type { PairHistory, PlotConfig, Trade } from '@/types';
import { ChartType } from '@/types';

import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LastPriceAnimationMode,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesMarkersPluginApi,
  type LineData,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';

const props = defineProps<{
  trades: Trade[];
  dataset: PairHistory;
  plotConfig: PlotConfig;
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

function asTime(timestamp?: number | null): UTCTimestamp | null {
  if (!timestamp) return null;
  return Math.floor(timestamp / 1000) as UTCTimestamp;
}

function buildCandleData(): CandlestickData<Time>[] {
  const colDate = columnIndex('__date_ts');
  const colOpen = columnIndex('open');
  const colHigh = columnIndex('high');
  const colLow = columnIndex('low');
  const colClose = columnIndex('close');

  if ([colDate, colOpen, colHigh, colLow, colClose].some((index) => index < 0)) return [];

  return props.dataset.data
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

function buildIndicatorData(columnName: string): LineData<Time>[] {
  const colDate = columnIndex('__date_ts');
  const colValue = columnIndex(columnName);

  if (colDate < 0 || colValue < 0) return [];

  return props.dataset.data
    .map((row) => ({
      time: asTime(row[colDate]) as UTCTimestamp,
      value: Number(row[colValue]),
    }))
    .filter((point) => point.time && Number.isFinite(point.value));
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

  return markers.sort((left, right) => Number(left.time) - Number(right.time));
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
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
    lastPriceAnimation: LastPriceAnimationMode.Continuous,
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
    if (config.type && config.type !== ChartType.line) return;

    const indicatorData = buildIndicatorData(key);
    if (!indicatorData.length) return;

    const indicatorSeries = chart?.addSeries(LineSeries, {
      color: config.color || amber,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: key,
    });

    indicatorSeries?.setData(indicatorData);
  });

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
  () => [props.dataset, props.trades, props.plotConfig, props.colorUp, props.colorDown, props.startCandleCount],
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

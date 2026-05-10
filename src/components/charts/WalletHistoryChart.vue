<script setup lang="ts">
import ECharts from 'vue-echarts';

import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart } from 'echarts/charts';
import {
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  MarkLineComponent,
  TransformComponent,
} from 'echarts/components';

import type { WalletHistoryPerBot } from '@/types';
import type { EChartsOption, MarkLineComponentOption } from 'echarts';

use([
  LineChart,
  CanvasRenderer,
  DatasetComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  MarkLineComponent,
  TransformComponent,
]);

const colorStore = useColorStore();
// Define Column labels here to avoid typos
const CHART_WALLET_HISTORY = 'Wallet history';
const SERIES_COLORS = ['#1d4ed8', '#d931e5', '#059669', '#b45309', '#be123c', '#7c3aed', '#0f766e'];

const props = withDefaults(
  defineProps<{
    walletData: WalletHistoryPerBot;
    showTitle?: boolean;
  }>(),
  {
    showTitle: true,
  },
);

const settingsStore = useSettingsStore();
const legendSelection = ref<Record<string, boolean>>({});

const handleLegendSelectChanged = (params: { selected: Record<string, boolean> }) => {
  legendSelection.value = params.selected;
};

const hasWalletData = computed(() =>
  Object.values(props.walletData).some(
    (history) => Array.isArray(history.data) && history.data.length > 0,
  ),
);

const walletHistoryOptions: ComputedRef<EChartsOption> = computed(() => {
  const walletEntries = Object.entries(props.walletData).filter(
    ([, history]) => Array.isArray(history?.data) && history.data.length > 0,
  );

  if (walletEntries.length === 0) {
    return {};
  }

  const dataset: EChartsOption['dataset'] = [];
  const series: EChartsOption['series'] = [];
  const visualMap: EChartsOption['visualMap'] = [];
  const legendData: string[] = [];
  const selectedBotIds = walletEntries
    .map(([botId]) => botId)
    .filter((botId) => legendSelection.value[botId] ?? true);
  const useProfitLossVisualMap = selectedBotIds.length === 1;
  const selectedBotId = selectedBotIds[0];
  const accentConfig = colorStore.primaryAccentConfig;
  const accentColor = settingsStore.chartTheme === 'dark' ? accentConfig.dark : accentConfig.light;
  const accentRgb =
    settingsStore.chartTheme === 'dark' ? accentConfig.darkRgb : accentConfig.lightRgb;
  const accentAlpha = (alpha: number) => `rgb(${accentRgb} / ${alpha})`;
  const axisColor = settingsStore.chartTheme === 'dark' ? '#b8c5d2' : '#475569';
  const gridColor = settingsStore.chartTheme === 'dark' ? 'rgba(148, 163, 184, 0.12)' : '#e2e8f0';
  const tooltipBg = settingsStore.chartTheme === 'dark' ? 'rgba(5, 8, 20, 0.96)' : '#ffffff';
  const tooltipText = settingsStore.chartTheme === 'dark' ? '#edf3f8' : '#10202a';
  const captureLineColor = settingsStore.chartTheme === 'dark' ? '#b8c5d2' : '#4b5563';

  walletEntries.forEach(([botId, history], botIndex) => {
    const botName = history.botName ?? botId;
    const colDate = history.columns.findIndex((el) => el === '__date_ts');
    const colTotal = history.columns.findIndex((el) => el === 'total_quote');
    const startingField = history.data[0];
    if (!startingField || colDate < 0 || colTotal < 0) {
      return;
    }

    const startingValue = startingField[colTotal] as number;
    const captureStartTs = history.capture_start_ts ?? 0;
    const firstTimestamp = Number(startingField[colDate]);
    const shouldShowCaptureLine =
      captureStartTs > 0 && Number.isFinite(firstTimestamp) && captureStartTs !== firstTimestamp;

    const sourceDatasetIndex = dataset.length;
    const postCaptureDatasetIndex = sourceDatasetIndex + 1;
    const preCaptureDatasetIndex = sourceDatasetIndex + 2;
    const seriesStartIndex = series.length + 1; // +1 to account for the dummy series inserted below
    const seriesColor = SERIES_COLORS[botIndex % SERIES_COLORS.length];

    dataset.push(
      { source: history.data },
      {
        fromDatasetIndex: sourceDatasetIndex,
        transform: {
          // post capture start
          type: 'filter',
          config: { dimension: colDate, gte: captureStartTs - 1 },
        },
      },
      {
        fromDatasetIndex: sourceDatasetIndex,
        transform: {
          // pre capture start
          type: 'filter',
          config: { dimension: colDate, lte: captureStartTs + 1 },
        },
      },
    );

    const markLineData: MarkLineComponentOption['data'] = [
      {
        name: 'Starting balance',
        yAxis: startingValue,
        emphasis: { disabled: true },
        label: {
          show: true,
          position: 'insideStartTop',
          formatter: `Starting balance ${botName}`,
          color: captureLineColor,
        },
      },
      {
        name: 'Zero',
        label: {
          show: false,
        },
        emphasis: { disabled: true },
        lineStyle: {
          type: 'solid',
        },
        yAxis: 0,
      },
    ];

    if (shouldShowCaptureLine) {
      markLineData.push({
        name: 'Capture start',
        xAxis: captureStartTs,
        emphasis: { disabled: true },
        label: {
          show: true,
          position: 'insideEndTop',
          formatter: `Capture start ${botName}`,
          color: captureLineColor,
        },
        lineStyle: {
          type: 'dotted',
          color: captureLineColor,
          width: 1,
        },
      });
    }

    legendData.push(botName);

    if (useProfitLossVisualMap && selectedBotId === botId) {
      visualMap.push({
        show: false,
        seriesIndex: [seriesStartIndex, seriesStartIndex + 1],
        dimension: colTotal,
        pieces: [
          {
            gte: startingValue,
            color: colorStore.colorProfit,
          },
          {
            gt: startingValue - 0.01,
            lt: startingValue + 0.01,
            color: colorStore.colorProfit,
          },
          {
            lt: startingValue - 0.01,
            color: colorStore.colorLoss,
          },
        ],
      });
    }

    series.push(
      { type: 'line', data: [] },
      // Empty, hidden series to stabilize data zoom
      // https://github.com/apache/echarts/issues/21245
      {
        type: 'line',
        name: botName,
        showSymbol: false,
        color: seriesColor,
        datasetIndex: postCaptureDatasetIndex,
        encode: {
          x: colDate,
          y: colTotal,
        },
        lineStyle: {
          type: 'solid',
          width: 2.4,
          cap: 'round',
        },
        emphasis: {
          focus: 'series',
        },
        markLine: {
          symbol: 'none',
          animation: false,
          data: markLineData,
        },
      },
      {
        type: 'line',
        name: botName,
        showSymbol: false,
        lineStyle: {
          type: 'dashed',
          width: 1.8,
        },
        color: seriesColor,
        datasetIndex: preCaptureDatasetIndex,
        encode: {
          x: colDate,
          y: colTotal,
        },
      },
    );
  });

  if (series.length === 0) {
    return {};
  }

  const option: EChartsOption = {
    title: {
      text: 'Wallet Balance',
      left: 'center',
      show: props.showTitle,
      textStyle: {
        color: tooltipText,
        fontWeight: 800,
      },
    },
    backgroundColor: 'rgba(0, 0, 0, 0)',
    animationDuration: 500,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 350,
    animationEasingUpdate: 'cubicOut',
    dataset,
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg,
      borderColor: accentAlpha(0.28),
      borderWidth: 1,
      padding: [10, 12],
      textStyle: {
        color: tooltipText,
        fontWeight: 650,
      },
      extraCssText:
        'box-shadow: 0 14px 34px rgba(0,0,0,.28); border-radius: 8px; backdrop-filter: blur(10px);',
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: accentAlpha(0.42),
          width: 1,
          type: 'dashed',
        },
        label: {
          backgroundColor: 'rgba(15, 23, 42, 0.94)',
          color: accentColor,
        },
      },
      formatter: (params) => {
        const seriesParams = Array.isArray(params) ? params : [params];
        if (seriesParams.length === 0) {
          return '';
        }

        const firstPoint = seriesParams[0] as { data: unknown[]; encode?: { x?: number[] } };
        const xIdx = firstPoint.encode?.x?.[0] ?? 0;
        const label = `${timestampms(Number(firstPoint.data[xIdx]))}`;
        const lines = seriesParams.map((seriesPoint) => {
          const typedPoint = seriesPoint as {
            marker: string;
            seriesName: string;
            data: unknown[];
            encode?: { y?: number[] };
          };
          const yIdx = typedPoint.encode?.y?.[0] ?? 0;
          const walletHistory = Number(typedPoint.data[yIdx]);
          return `${typedPoint.marker}${typedPoint.seriesName}: ${formatPrice(walletHistory, 3)}`;
        });

        return `<div style="font-weight:800;margin-bottom:6px;color:${accentColor}">${label}</div>${lines.join(
          '<br />',
        )}`;
      },
    },
    grid: {
      ...echartsGridDefault,
    },
    legend: {
      data: legendData,
      right: '5%',
      top: 0,
      show: walletEntries.length > 1,
      selectedMode: true,
      selected: legendSelection.value,
      textStyle: {
        color: axisColor,
        fontWeight: 650,
      },
    },
    xAxis: [
      {
        type: 'time',
        axisLine: { onZero: false, lineStyle: { color: gridColor } },
        axisTick: { show: false },
        axisLabel: { color: axisColor, fontWeight: 600 },
        axisPointer: {
          label: { show: false },
        },
        // position: 'top',
      },
    ],
    yAxis: [
      {
        type: 'value',
        name: CHART_WALLET_HISTORY,
        splitLine: {
          show: true,
          lineStyle: { color: gridColor, type: 'dashed' },
        },
        nameRotate: 90,
        nameLocation: 'middle',
        nameTextStyle: { color: axisColor, fontWeight: 700 },
        axisLabel: {
          color: axisColor,
          fontWeight: 600,
          formatter: (value) => {
            return formatPrice(value, 2);
          },
        },
        axisLine: { show: false },
        axisTick: { show: false },
        nameGap: 35,
        min: 'dataMin',
        max: 'dataMax',
      },
    ],
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
      },
      {
        bottom: 10,
        start: 0,
        end: 100,
        ...dataZoomPartial,
        borderColor: 'rgba(148, 163, 184, 0.16)',
        fillerColor: accentAlpha(0.1),
        handleStyle: {
          color: accentColor,
          borderColor: accentColor,
        },
      },
    ],
    visualMap,
    series,
  };
  return option;
});
</script>

<template>
  <ECharts
    v-if="hasWalletData"
    :option="walletHistoryOptions"
    :theme="settingsStore.chartTheme"
    @legendselectchanged="handleLegendSelectChanged"
    autoresize
  />
  <div v-else class="flex flex-col items-center justify-center h-full gap-2">
    <p class="text-gray-500">No historic wallet data available.</p>
    <p class="text-gray-500 text-sm">
      You may need to update your freqtrade version to have historic wallet balance data available.
    </p>
  </div>
</template>

<style lang="css" scoped>
.echarts {
  min-height: 150px;
  height: 100%;
  width: 100%;
}
</style>

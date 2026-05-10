<script setup lang="ts">
import ECharts from 'vue-echarts';
// import { EChartsOption } from 'echarts';

import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, BarChart } from 'echarts/charts';
import {
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  TransformComponent,
  VisualMapComponent,
} from 'echarts/components';

import { registerTransform } from 'echarts';

import type { TimeSummaryCols, TimeSummaryReturnValue } from '@/types';
import type { EChartsOption } from 'echarts';

use([
  BarChart,
  LineChart,
  CanvasRenderer,
  GridComponent,
  DataZoomComponent,
  DatasetComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  TransformComponent,
]);

const props = withDefaults(
  defineProps<{
    dailyStats: TimeSummaryReturnValue;
    showTitle?: boolean;
    profitCol: TimeSummaryCols;
  }>(),
  {
    showTitle: true,
  },
);

// Define Column labels here to avoid typos
const CHART_PROFIT = computed(() =>
  props.profitCol === 'abs_profit' ? 'Absolute profit' : 'Relative profit',
);
const CHART_TRADE_COUNT = 'Trade Count';

const settingsStore = useSettingsStore();
const colorStore = useColorStore();

const dailyChart = ref(null);

const absoluteMin = computed(
  () =>
    props.dailyStats.data.reduce(
      (min, p) => (p[props.profitCol] < min ? p[props.profitCol] : min),
      props.dailyStats.data[0]?.[props.profitCol] ?? 0,
    ) * (props.profitCol === 'rel_profit' ? 100 : 1),
);
const absoluteMax = computed(
  () =>
    props.dailyStats.data.reduce(
      (max, p) => (p[props.profitCol] > max ? p[props.profitCol] : max),
      props.dailyStats.data[0]?.[props.profitCol] ?? 0,
    ) * (props.profitCol === 'rel_profit' ? 100 : 1),
);

registerTransform(ftEchartsTransforms.multiple);

const dailyChartOptions: ComputedRef<EChartsOption> = computed(() => {
  const axisColor = settingsStore.chartTheme === 'dark' ? '#9aa9b8' : '#475569';
  const gridColor = settingsStore.chartTheme === 'dark' ? 'rgba(148, 163, 184, 0.12)' : '#e2e8f0';
  const tooltipBg = settingsStore.chartTheme === 'dark' ? 'rgba(5, 8, 20, 0.96)' : '#ffffff';
  const tooltipText = settingsStore.chartTheme === 'dark' ? '#edf3f8' : '#10202a';
  const zeroLineColor =
    settingsStore.chartTheme === 'dark' ? 'rgba(237, 243, 248, 0.52)' : 'rgba(15, 23, 42, 0.42)';

  return {
    title: {
      text: 'Daily profit',
      show: props.showTitle,
      textStyle: {
        color: tooltipText,
        fontWeight: 800,
      },
    },
    backgroundColor: 'rgba(0, 0, 0, 0)',
    color: [colorStore.colorProfit, 'rgba(148, 163, 184, 0.32)'],
    animationDuration: 500,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 350,
    animationEasingUpdate: 'cubicOut',
    dataset: [
      {
        dimensions: ['date', props.profitCol, 'trade_count'],
        source: props.dailyStats.data,
      },
      {
        transform: {
          type: 'ft:multiple',
          config: { dimension: props.profitCol, factor: props.profitCol == 'rel_profit' ? 100 : 1 },
        },
      },
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg,
      borderColor: 'rgba(251, 191, 36, 0.28)',
      borderWidth: 1,
      padding: [10, 12],
      textStyle: {
        color: tooltipText,
        fontWeight: 650,
      },
      formatter: (params) => {
        const points = Array.isArray(params) ? params : [params];
        const firstPoint = points[0];
        const rawData = firstPoint?.data as Record<string, number | string> | undefined;
        const date = rawData?.date ?? firstPoint?.axisValueLabel ?? '';
        const profitPoint = points.find((point) => point.seriesName === CHART_PROFIT.value);
        const tradePoint = points.find((point) => point.seriesName === CHART_TRADE_COUNT);
        const profitData = profitPoint?.data as Record<string, number> | undefined;
        const tradeData = tradePoint?.data as Record<string, number> | undefined;
        // The chart series uses datasetIndex 1, where rel_profit is already multiplied by 100.
        const profitValue = profitData?.[props.profitCol] ?? 0;
        const profitLabel =
          props.profitCol === 'rel_profit'
            ? `${formatPrice(profitValue, 2)}%`
            : formatPrice(profitValue, 3);

        return [
          `<div style="font-weight:800;margin-bottom:6px;color:#fbbf24">${date}</div>`,
          `<div>${profitPoint?.marker ?? ''}${CHART_PROFIT.value}: <b>${profitLabel}</b></div>`,
          `<div>${tradePoint?.marker ?? ''}${CHART_TRADE_COUNT}: <b>${tradeData?.trade_count ?? 0}</b></div>`,
        ].join('');
      },
      extraCssText:
        'box-shadow: 0 14px 34px rgba(0,0,0,.28); border-radius: 8px; backdrop-filter: blur(10px);',
      axisPointer: {
        type: 'cross',
        lineStyle: {
          color: 'rgba(251, 191, 36, 0.42)',
          width: 1,
          type: 'dashed',
        },
        crossStyle: {
          color: 'rgba(251, 191, 36, 0.36)',
          type: 'dashed',
        },
        label: {
          backgroundColor: 'rgba(15, 23, 42, 0.94)',
          color: '#fbbf24',
        },
      },
    },
    legend: {
      data: [
        {
          name: CHART_PROFIT.value,
          lineStyle: {
            color: colorStore.colorProfit,
          },
          itemStyle: {
            color: colorStore.colorProfit,
          },
        },
        { name: CHART_TRADE_COUNT },
      ],
      top: 0,
      right: '5%',
      itemGap: 14,
      textStyle: {
        color: axisColor,
        fontWeight: 650,
      },
    },
    xAxis: [
      {
        type: 'category',
        axisLine: {
          lineStyle: {
            color: gridColor,
          },
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: axisColor,
          fontWeight: 600,
        },
      },
    ],
    visualMap: [
      {
        dimension: 1,
        seriesIndex: 0,
        show: false,
        pieces: [
          {
            max: 0.0,
            min: absoluteMin.value,
            color: colorStore.colorLoss,
          },
          {
            min: 0.0,
            max: absoluteMax.value,
            color: colorStore.colorProfit,
          },
        ],
      },
    ],
    yAxis: [
      {
        type: 'value',
        name: CHART_PROFIT.value,
        splitLine: {
          show: true,
          lineStyle: {
            color: gridColor,
            type: 'dashed',
          },
        },
        nameRotate: 90,
        nameLocation: 'middle',
        nameGap: 35,
        nameTextStyle: {
          color: axisColor,
          fontWeight: 700,
        },
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: axisColor,
          fontWeight: 600,
          formatter: (value) => {
            return props.profitCol === 'rel_profit' ? `${value}%` : `${value}`;
          },
        },
      },
      {
        type: 'value',
        name: CHART_TRADE_COUNT,
        nameRotate: 90,
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: {
          color: axisColor,
          fontWeight: 700,
        },
        splitLine: {
          show: false,
        },
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: axisColor,
          fontWeight: 600,
        },
      },
    ],
    grid: {
      left: 52,
      right: 48,
      top: 58,
      bottom: 32,
      containLabel: false,
    },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
      },
    ],
    series: [
      {
        type: 'line',
        name: CHART_PROFIT.value,
        // Color is induced by visualMap
        datasetIndex: 1,
        smooth: 0.18,
        symbol: 'circle',
        symbolSize: 7,
        showSymbol: true,
        lineStyle: {
          width: 2.5,
          cap: 'round',
        },
        itemStyle: {
          borderWidth: 2,
          borderColor: settingsStore.chartTheme === 'dark' ? '#050814' : '#ffffff',
        },
        emphasis: {
          focus: 'series',
          scale: 1.25,
        },
        markLine: {
          symbol: 'none',
          silent: true,
          lineStyle: {
            color: zeroLineColor,
            width: 1.5,
          },
          label: {
            show: false,
          },
          data: [{ yAxis: 0 }],
        },
      },
      {
        type: 'bar',
        name: CHART_TRADE_COUNT,
        z: 0,
        itemStyle: {
          color: 'rgba(148, 163, 184, 0.2)',
          borderRadius: [4, 4, 0, 0],
        },
        barMaxWidth: 12,
        yAxisIndex: 1,
        datasetIndex: 1,
      },
    ],
  };
});
</script>

<template>
  <ECharts
    v-if="dailyStats.data"
    ref="dailyChart"
    :option="dailyChartOptions"
    :theme="settingsStore.chartTheme"
    :style="{ height: '100%' }"
    autoresize
  />
</template>

<style lang="css" scoped>
.echarts {
  min-height: 240px;
  height: 100%;
}
</style>

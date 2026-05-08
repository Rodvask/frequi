<script setup lang="ts">
import ECharts from 'vue-echarts';
import type { EChartsOption } from 'echarts';

import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { LineChart, BarChart } from 'echarts/charts';
import {
  DatasetComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  VisualMapPiecewiseComponent,
} from 'echarts/components';

import type { ClosedTrade } from '@/types';

use([
  BarChart,
  LineChart,

  CanvasRenderer,

  DatasetComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  VisualMapPiecewiseComponent,
]);

// Define Column labels here to avoid typos
const CHART_PROFIT = 'Profit %';
const CHART_COLOR = '#9be0a8';

const props = withDefaults(
  defineProps<{
    trades: ClosedTrade[];
    showTitle?: boolean;
  }>(),
  {
    showTitle: true,
  },
);
const settingsStore = useSettingsStore();
const colorStore = useColorStore();
const chartData = computed(() => {
  const res: (number | string)[][] = [];
  const sortedTrades = props.trades
    .slice(0)
    .sort((a, b) => (a.close_timestamp > b.close_timestamp ? 1 : -1));
  for (let i = 0, len = sortedTrades.length; i < len; i += 1) {
    const trade = sortedTrades[i];
    if (trade) {
      const entry = [
        i,
        ((trade.profit_ratio ?? 0) * 100).toFixed(2),
        trade.pair,
        trade.botName,
        timestampms(trade.close_timestamp),
        trade.is_short === undefined || !trade.is_short ? 'Long' : 'Short',
      ];
      res.push(entry);
    }
  }
  return res;
});

const chartOptions = computed((): EChartsOption => {
  // const { chartData } = this;
  // Show a maximum of 50 trades by default - allowing to zoom out further.
  const datazoomStart = chartData.value.length > 0 ? (1 - 50 / chartData.value.length) * 100 : 100;
  const axisColor = settingsStore.chartTheme === 'dark' ? '#b8c5d2' : '#475569';
  const gridColor = settingsStore.chartTheme === 'dark' ? 'rgba(148, 163, 184, 0.12)' : '#e2e8f0';
  const tooltipBg = settingsStore.chartTheme === 'dark' ? 'rgba(5, 8, 20, 0.96)' : '#ffffff';
  const tooltipText = settingsStore.chartTheme === 'dark' ? '#edf3f8' : '#10202a';
  return {
    title: {
      text: 'Trades log',
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
    dataset: {
      dimensions: ['date', 'profit'],
      source: chartData.value,
    },
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
      extraCssText:
        'box-shadow: 0 14px 34px rgba(0,0,0,.28); border-radius: 8px; backdrop-filter: blur(10px);',
      formatter: (params) => {
        const point = Array.isArray(params) ? params[0] : params;
        const botName = point.data[3] ? ` · ${point.data[3]}` : '';
        return [
          `<div style="font-weight:800;margin-bottom:6px;color:#fbbf24">${point.data[2]}</div>`,
          `<div>${point.marker}${point.data[5]}${botName}</div>`,
          `<div style="color:#9aa9b8;margin-top:3px">${point.data[4]}</div>`,
          `<div style="margin-top:6px">Profit: <b>${point.data[1]}%</b></div>`,
        ].join('');
      },
      axisPointer: {
        type: 'line',
        lineStyle: {
          color: 'rgba(251, 191, 36, 0.42)',
          width: 1,
          type: 'dashed',
        },
        label: {
          backgroundColor: 'rgba(15, 23, 42, 0.94)',
          color: '#fbbf24',
        },
      },
    },
    xAxis: {
      type: 'category',
      show: false,
    },
    yAxis: [
      {
        type: 'value',
        name: CHART_PROFIT,
        splitLine: {
          show: true,
          lineStyle: {
            color: gridColor,
            type: 'dashed',
          },
        },
        nameRotate: 90,
        nameLocation: 'middle',
        nameGap: 30,
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
          formatter: '{value}%',
        },
      },
    ],
    grid: {
      ...echartsGridDefault,
      left: 80,
    },
    dataZoom: [
      {
        type: 'inside',
        start: datazoomStart,
        end: 100,
      },
      {
        bottom: 10,
        start: datazoomStart,
        end: 100,
        ...dataZoomPartial,
        borderColor: 'rgba(148, 163, 184, 0.16)',
        fillerColor: 'rgba(251, 191, 36, 0.1)',
        handleStyle: {
          color: '#fbbf24',
          borderColor: '#fbbf24',
        },
      },
    ],
    visualMap: [
      {
        show: true,
        seriesIndex: 0,
        pieces: [
          {
            max: 0.0,
            color: colorStore.colorLoss,
          },
          {
            min: 0.0,
            color: colorStore.colorProfit,
          },
        ],
      },
    ],
    series: [
      {
        type: 'bar',
        name: CHART_PROFIT,
        barCategoryGap: '0%',
        animation: true,
        barMaxWidth: 12,
        label: {
          show: false,
          position: 'top',
          rotate: 90,
          offset: [7.5, 7.5],
          formatter: '{@[1]} %',
          color: settingsStore.chartTheme === 'dark' ? '#c2c2c2' : '#3c3c3c',
        },
        encode: {
          x: 0,
          y: 1,
        },

        itemStyle: {
          color: CHART_COLOR,
          borderRadius: [4, 4, 0, 0],
        },
        emphasis: {
          focus: 'series',
        },
      },
    ],
  };
});
</script>

<template>
  <ECharts
    v-if="trades.length > 0"
    :option="chartOptions"
    autoresize
    :theme="settingsStore.chartTheme"
  />
</template>

<style scoped>
.echarts {
  width: 100%;
  height: 100%;
  min-height: 150px;
}
</style>

<script setup lang="ts">
import ECharts from 'vue-echarts';
import type { EChartsOption } from 'echarts';

import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart } from 'echarts/charts';
import {
  DatasetComponent,
  DataZoomComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';

import type { ClosedTrade } from '@/types';

use([
  BarChart,

  CanvasRenderer,

  DatasetComponent,
  DataZoomComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
]);

// Define Column labels here to avoid typos
const CHART_PROFIT = 'Trade count';

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
// registerTransform(ecStat.transform.histogram);
// console.log(profits);
// const data = [[]];
const binOptions = [
  { text: '10', value: 10 },
  { text: '15', value: 15 },
  { text: '20', value: 20 },
  { text: '25', value: 25 },
  { text: '50', value: 50 },
];
const data = computed(() => {
  const profits = props.trades
    .filter((trade) => isDefined(trade.profit_ratio))
    .map((trade) => trade.profit_ratio ?? 0);

  return binData(profits, settingsStore.profitDistributionBins);
});

const chartOptions = computed((): EChartsOption => {
  const accentConfig = colorStore.primaryAccentConfig;
  const accentColor = settingsStore.chartTheme === 'dark' ? accentConfig.dark : accentConfig.light;
  const accentRgb =
    settingsStore.chartTheme === 'dark' ? accentConfig.darkRgb : accentConfig.lightRgb;
  const accentAlpha = (alpha: number) => `rgb(${accentRgb} / ${alpha})`;
  const axisColor = settingsStore.chartTheme === 'dark' ? '#b8c5d2' : '#475569';
  const gridColor = settingsStore.chartTheme === 'dark' ? 'rgba(148, 163, 184, 0.12)' : '#e2e8f0';
  const tooltipBg = settingsStore.chartTheme === 'dark' ? 'rgba(5, 8, 20, 0.96)' : '#ffffff';
  const tooltipText = settingsStore.chartTheme === 'dark' ? '#edf3f8' : '#10202a';
  const chartOptionsLoc: EChartsOption = {
    title: {
      text: 'Profit distribution',
      left: 'center',
      show: props.showTitle,
      textStyle: {
        color: tooltipText,
        fontWeight: 800,
      },
    },
    backgroundColor: 'rgba(0, 0, 0, 0)',
    color: [accentColor],
    animationDuration: 500,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 350,
    animationEasingUpdate: 'cubicOut',
    dataset: {
      source: data.value,
    },
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
        type: 'shadow',
        shadowStyle: {
          color: accentAlpha(0.08),
        },
        label: {
          backgroundColor: 'rgba(15, 23, 42, 0.94)',
          color: accentColor,
        },
      },
    },
    legend: {
      data: [CHART_PROFIT],
      right: '5%',
      top: 0,
      selectedMode: false,
      textStyle: {
        color: axisColor,
        fontWeight: 650,
      },
    },
    xAxis: {
      type: 'category',
      name: 'Profit %',
      nameLocation: 'middle',
      nameGap: 25,
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
      nameTextStyle: {
        color: axisColor,
        fontWeight: 700,
      },
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
        nameGap: 35,
        position: 'left',
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
        },
      },
    ],
    grid: {
      ...echartsGridDefault,
      bottom: 50,
    },

    series: [
      {
        type: 'bar',
        name: CHART_PROFIT,
        animation: true,
        encode: {
          x: 'x0',
          y: 'y0',
        },
        barMaxWidth: 18,
        itemStyle: {
          color: accentColor,
          borderRadius: [4, 4, 0, 0],
        },
        emphasis: {
          focus: 'series',
        },
        // symbol: 'none',
      },
    ],
  };
  return chartOptionsLoc;
});
</script>

<template>
  <div class="flex flex-col h-full relative">
    <div class="grow mb-2">
      <ECharts v-if="trades" :option="chartOptions" autoresize :theme="settingsStore.chartTheme" />
    </div>
    <div
      class="z-2 absolute fixed-top flex items-center gap-10 ms-2"
      :class="{ 'mx-auto': showTitle }"
      label-for="input-bins"
      size="sm"
    >
      <label for="input-bins">Bins</label>
      <Select
        id="input-bins"
        v-model="settingsStore.profitDistributionBins"
        size="small"
        option-label="text"
        option-value="value"
        class="mt-1"
        :options="binOptions"
      ></Select>
    </div>
  </div>
</template>

<style scoped>
.echarts {
  width: 100%;
  height: 100%;
  min-height: 150px;
}
</style>

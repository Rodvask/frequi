<script setup lang="ts">
import type { EChartsOption } from 'echarts';
import ECharts from 'vue-echarts';

import { BarChart, LineChart } from 'echarts/charts';
import {
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

import type {
  ClosedTrade,
  CumProfitChartData,
  CumProfitData,
  CumProfitDataPerDate,
  Trade,
} from '@/types';
import type { ComputedRefWithControl } from '@vueuse/core';

use([
  BarChart,
  LineChart,

  CanvasRenderer,

  DatasetComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
]);

// Define Column labels here to avoid typos
const CHART_PROFIT = 'Profit';

const props = withDefaults(
  defineProps<{
    trades: ClosedTrade[];
    openTrades?: Trade[];
    showTitle?: boolean;
    profitColumn?: string;
  }>(),
  {
    openTrades: () => [],
    showTitle: true,
    profitColumn: 'profit_abs',
  },
);
const settingsStore = useSettingsStore();
const colorStore = useColorStore();
// const botList = ref<string[]>([]);

const openProfit = computed<number>(() => {
  return props.openTrades.reduce(
    (a, v) => a + (v['total_profit_abs'] ?? v[props.profitColumn] ?? 0),
    0,
  );
});

const cumulativeData = computed<CumProfitChartData[]>(() => {
  // const res: CumProfitData[] = [];
  const resD: CumProfitDataPerDate = {};
  const closedTrades = props.trades
    .slice()
    .sort((a, b) => (a.close_timestamp > b.close_timestamp ? 1 : -1));
  let profit = 0.0;
  let first = true;

  for (let i = 0, len = closedTrades.length; i < len; i += 1) {
    const trade = closedTrades[i];
    if (!trade) continue;
    if (first) {
      // Start with chart with a 0 entry
      first = false;
      if (!resD[trade.open_timestamp]) {
        // New timestamp
        resD[trade.open_timestamp] = { profit, [trade.botId]: profit };
      } else {
        // Add to existing profit
        resD[trade.open_timestamp]![trade.botId] = profit;
      }
    }

    if (trade.close_timestamp && trade[props.profitColumn]) {
      profit += trade[props.profitColumn];
      const resDEntry = resD[trade.close_timestamp];
      if (!resDEntry) {
        // New timestamp
        resD[trade.close_timestamp] = { profit, [trade.botId]: profit };
      } else {
        // Add to existing profit
        resDEntry.profit += trade[props.profitColumn];
        if (resDEntry[trade.botId]) {
          resDEntry[trade.botId] += trade[props.profitColumn];
        } else {
          resDEntry[trade.botId] = profit;
        }
      }
      // res.push({ date: trade.close_timestamp, profit, [trade.botId]: profit });
    }
  }

  const valueArray: CumProfitChartData[] = Object.entries(resD).map(
    ([k, v]: [string, CumProfitData]) => {
      const obj = { date: parseInt(k, 10), profit: v.profit };
      // TODO: The below could allow "lines" per bot"
      // this.botList.forEach((botId) => {
      // obj[botId] = v[botId];
      // });
      return obj;
    },
  );

  if (props.openTrades.length > 0) {
    let lastProfit = 0;
    let lastDate: number;
    const lastPoint = valueArray[valueArray.length - 1];
    if (lastPoint) {
      lastProfit = lastPoint.profit ?? 0;
      lastDate = lastPoint.date ?? 0;
    } else {
      const firstOpenTrade = props.openTrades[0];
      lastDate = firstOpenTrade ? firstOpenTrade.open_timestamp : 0;
    }
    const resultWithOpen = (lastProfit ?? 0) + openProfit.value;
    valueArray.push({ date: lastDate, currentProfit: lastProfit });
    // Add one day to date to ensure it's showing properly
    const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
    valueArray.push({ date: tomorrow, currentProfit: resultWithOpen });
  }
  return valueArray;
});

function generateChart(initial = false) {
  const { colorProfit, colorLoss } = colorStore;
  const profitColor = settingsStore.chartTheme === 'dark' ? '#d6dde6' : '#1f2937';
  const zeroLineColor =
    settingsStore.chartTheme === 'dark' ? 'rgba(237, 243, 248, 0.52)' : 'rgba(15, 23, 42, 0.42)';
  const chartOptionsLoc: EChartsOption = {
    dataset: {
      dimensions: ['date', 'profit', 'currentProfit'],
      source: cumulativeData.value,
    },

    series: [
      {
        // Keep  current-profit before profit, so the starting symbol is behind
        type: 'line',
        name: 'currentProfit',

        animation: initial,

        lineStyle: {
          color: openProfit.value > 0 ? colorProfit : colorLoss,
          type: 'dotted',
          width: 2.2,
          cap: 'round',
        },
        itemStyle: {
          color: openProfit.value > 0 ? colorProfit : colorLoss,
          borderColor: settingsStore.chartTheme === 'dark' ? '#050814' : '#ffffff',
          borderWidth: 2,
        },
        symbol: 'circle',
        symbolSize: 7,
        showSymbol: true,
        encode: {
          x: 'date',
          y: 'currentProfit',
        },
      },
      {
        type: 'line',
        name: CHART_PROFIT,
        animation: initial,
        step: 'end',
        lineStyle: {
          color: profitColor,
          width: 2.4,
          cap: 'round',
        },
        itemStyle: {
          color: profitColor,
          borderColor: settingsStore.chartTheme === 'dark' ? '#050814' : '#ffffff',
          borderWidth: 2,
        },
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: false,
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
        encode: {
          x: 'date',
          y: 'profit',
        },
        // symbol: 'none',
      },
    ],
  };
  // TODO: maybe have profit lines per bot?
  // this.botList.forEach((botId: string) => {
  //   console.log('bot', botId);
  //   chartOptionsLoc.series.push({
  //     type: 'line',
  //     name: botId,
  //     animation: true,
  //     step: 'end',
  //     lineStyle: {
  //       color: settingsStore.chartTheme === 'dark' ? '#c2c2c2' : 'black',
  //     },
  //     itemStylesettingsStore.chartTheme === 'dark' ? '#c2c2c2' : 'black',
  //     },
  //     // symbol: 'none',
  //   });
  // });
  return chartOptionsLoc;
}

const cumProfitChartOptions: ComputedRefWithControl<EChartsOption> = computedWithControl(
  () => props.trades,
  () => {
    const axisColor = settingsStore.chartTheme === 'dark' ? '#9aa9b8' : '#475569';
    const gridColor =
      settingsStore.chartTheme === 'dark' ? 'rgba(148, 163, 184, 0.12)' : '#e2e8f0';
    const tooltipBg = settingsStore.chartTheme === 'dark' ? 'rgba(5, 8, 20, 0.96)' : '#ffffff';
    const tooltipText = settingsStore.chartTheme === 'dark' ? '#edf3f8' : '#10202a';

    const chartOptionsLoc: EChartsOption = {
      title: {
        text: 'Cumulative Profit',
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
          const points = Array.isArray(params) ? params : [params];
          const pointWithData = points.find((point) => point?.data?.date) ?? points[0];
          const rawData = pointWithData?.data as CumProfitChartData | undefined;
          const date = rawData?.date ? timestampToDateString(rawData.date) : '';
          const projectedPoint = points.find((point) => point.seriesName === 'currentProfit');
          const profitPoint = points.find((point) => point.seriesName === CHART_PROFIT);
          const projectedData = projectedPoint?.data as CumProfitChartData | undefined;
          const profitData = profitPoint?.data as CumProfitChartData | undefined;
          const projectedProfit = projectedData?.currentProfit;
          const realizedProfit = profitData?.profit ?? rawData?.profit;
          const profitLine = isDefined(projectedProfit)
            ? `${projectedPoint?.marker ?? ''}Projected profit: <b>${formatPrice(
                projectedProfit,
                3,
              )}</b>`
            : `${profitPoint?.marker ?? ''}${CHART_PROFIT}: <b>${formatPrice(
                realizedProfit ?? 0,
                3,
              )}</b>`;

          return [
            `<div style="font-weight:800;margin-bottom:6px;color:#fbbf24">${date}</div>`,
            `<div>${profitLine}</div>`,
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
      useUTC: false,
      xAxis: {
        type: 'time',
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
          nameGap: 40,
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
        top: props.showTitle ? 52 : 28,
        bottom: 48,
      },
      dataZoom: [
        {
          type: 'inside',
          // xAxisIndex: [0],
          start: 0,
          end: 100,
        },
        {
          // xAxisIndex: [0],
          bottom: 10,
          start: 0,
          end: 100,
          ...dataZoomPartial,
          borderColor: 'rgba(148, 163, 184, 0.16)',
          fillerColor: 'rgba(251, 191, 36, 0.1)',
          handleStyle: {
            color: '#fbbf24',
            borderColor: '#fbbf24',
          },
          moveHandleStyle: {
            color: 'rgba(251, 191, 36, 0.35)',
          },
          selectedDataBackground: {
            lineStyle: {
              color: '#fbbf24',
            },
            areaStyle: {
              color: 'rgba(251, 191, 36, 0.12)',
            },
          },
        },
      ],
    };

    const chartOptionsLoc1 = generateChart(false);
    // Merge the series and dataset, but not the rest
    chartOptionsLoc.series = chartOptionsLoc1.series;
    chartOptionsLoc.dataset = chartOptionsLoc1.dataset;
    // console.log('computed chartOptionsLoc', chartOptionsLoc);
    return chartOptionsLoc;
  },
);

onMounted(() => {
  // initializeChart();
});

watchThrottled(
  () => props.openTrades,
  () => {
    cumProfitChartOptions.trigger();
  },
  { throttle: 60 * 1000 },
);
watch(
  () => settingsStore.chartTheme,
  () => {
    cumProfitChartOptions.trigger();
  },
);
</script>

<template>
  <ECharts
    v-if="trades"
    :option="cumProfitChartOptions"
    :theme="settingsStore.chartTheme"
    autoresize
  />
</template>

<style scoped>
.echarts {
  width: 100%;
  height: 100%;
  min-height: 150px;
}
</style>

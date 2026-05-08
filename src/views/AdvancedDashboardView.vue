<script setup lang="ts">
import ECharts from 'vue-echarts';
import type { EChartsOption } from 'echarts';
import { use } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, TooltipComponent } from 'echarts/components';
import type { EntryStats, ExitStats, PerformanceEntry, TimeSummaryRecord, Trade } from '@/types';
import { TimeSummaryCols, TimeSummaryOptions } from '@/types';

use([BarChart, CanvasRenderer, GridComponent, TooltipComponent]);

type MetricTone = 'profit' | 'loss' | 'neutral' | 'warning';

interface MetricCard {
  label: string;
  value: string;
  change?: string;
  detail?: string;
  tone: MetricTone;
}

interface PerformanceRow {
  key: string;
  profitAbs: number;
  profitRatio: number;
  count: number;
}

interface RiskAlert {
  title: string;
  detail: string;
  tone: MetricTone;
}

const botStore = useBotStore();
const settingsStore = useSettingsStore();
const colorStore = useColorStore();

const selectedBots = computed(() => botStore.selectedBots);
const closedTrades = computed(() => botStore.allClosedTradesSelectedBots);
const openTrades = computed(() => botStore.allOpenTradesSelectedBots);
const dailyStats = computed(() => botStore.allDailyStatsSelectedBots);
const weeklyStats = computed(() => botStore.allWeeklyStatsSelectedBots);
const monthlyStats = computed(() => botStore.allMonthlyStatsSelectedBots);
const stakeCurrency = computed(
  () => selectedBots.value[0]?.stakeCurrency || dailyStats.value.stake_currency || '',
);
const stakeCurrencyDecimals = computed(() => selectedBots.value[0]?.stakeCurrencyDecimals ?? 3);

function latestProfit(records: TimeSummaryRecord[] | undefined): number | undefined {
  return records?.at(-1)?.abs_profit;
}

function latestProfitRatio(records: TimeSummaryRecord[] | undefined): number | undefined {
  return records?.at(-1)?.rel_profit;
}

function totalTradeProfit(trade: Trade): number {
  return trade.profit_abs ?? trade.realized_profit ?? 0;
}

function metricTone(value: number | undefined | null): MetricTone {
  if (!isDefined(value) || value === 0) return 'neutral';
  return value > 0 ? 'profit' : 'loss';
}

function formatProfit(value: number | undefined | null): string {
  if (!isDefined(value)) return 'N/A';
  return formatPriceCurrency(value, stakeCurrency.value, stakeCurrencyDecimals.value);
}

function formatProfitPercent(value: number | undefined | null): string | undefined {
  return isDefined(value) ? formatPercent(value, 2) : undefined;
}

function aggregatePerformance<T extends PerformanceEntry | EntryStats | ExitStats>(
  rows: T[],
  key: keyof T,
): PerformanceRow[] {
  const grouped: Record<string, PerformanceRow> = {};

  rows.forEach((row) => {
    const groupKey = String(row[key] || 'Other');
    const existing = grouped[groupKey] ?? {
      key: groupKey,
      profitAbs: 0,
      profitRatio: 0,
      count: 0,
    };
    existing.profitAbs += row.profit_abs ?? 0;
    existing.profitRatio += (row.profit_ratio ?? 0) * (row.count || 1);
    existing.count += row.count || 0;
    grouped[groupKey] = existing;
  });

  return Object.values(grouped)
    .map((row) => ({
      ...row,
      profitRatio: row.count > 0 ? row.profitRatio / row.count : 0,
    }))
    .sort((a, b) => b.profitAbs - a.profitAbs);
}

const selectedProfitStats = computed(() =>
  selectedBots.value.map((bot) => bot.profit).filter(isDefined),
);

const totalProfit = computed(() =>
  selectedProfitStats.value.reduce((sum, profit) => sum + (profit.profit_all_coin ?? 0), 0),
);

const totalProfitRatio = computed(() => {
  const values = selectedProfitStats.value.map((profit) => profit.profit_all_ratio).filter(isDefined);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
});

const wins = computed(() =>
  selectedProfitStats.value.reduce((sum, profit) => sum + (profit.winning_trades ?? 0), 0),
);
const losses = computed(() =>
  selectedProfitStats.value.reduce((sum, profit) => sum + (profit.losing_trades ?? 0), 0),
);
const winrate = computed(() => {
  const total = wins.value + losses.value;
  return total > 0 ? wins.value / total : undefined;
});

const calculatedProfitFactor = computed(() => {
  const grossProfit = closedTrades.value.reduce((sum, trade) => {
    const profit = totalTradeProfit(trade);
    return profit > 0 ? sum + profit : sum;
  }, 0);
  const grossLoss = closedTrades.value.reduce((sum, trade) => {
    const profit = totalTradeProfit(trade);
    return profit < 0 ? sum + Math.abs(profit) : sum;
  }, 0);

  if (grossLoss > 0) return grossProfit / grossLoss;
  if (grossProfit > 0 && closedTrades.value.length > 0) return Number.POSITIVE_INFINITY;

  const values = selectedProfitStats.value.map((profit) => profit.profit_factor).filter(isDefined);
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : undefined;
});

const metrics = computed<MetricCard[]>(() => [
  {
    label: 'Total profit',
    value: formatProfit(totalProfit.value),
    change: formatProfitPercent(totalProfitRatio.value),
    detail: `${closedTrades.value.length + openTrades.value.length} total trades`,
    tone: metricTone(totalProfit.value),
  },
  {
    label: 'Daily profit',
    value: formatProfit(latestProfit(dailyStats.value.data)),
    change: formatProfitPercent(latestProfitRatio(dailyStats.value.data)),
    detail: dailyStats.value.data?.at(-1)?.date,
    tone: metricTone(latestProfit(dailyStats.value.data)),
  },
  {
    label: 'Weekly profit',
    value: formatProfit(latestProfit(weeklyStats.value.data)),
    change: formatProfitPercent(latestProfitRatio(weeklyStats.value.data)),
    detail: weeklyStats.value.data?.at(-1)?.date,
    tone: metricTone(latestProfit(weeklyStats.value.data)),
  },
  {
    label: 'Monthly profit',
    value: formatProfit(latestProfit(monthlyStats.value.data)),
    change: formatProfitPercent(latestProfitRatio(monthlyStats.value.data)),
    detail: monthlyStats.value.data?.at(-1)?.date,
    tone: metricTone(latestProfit(monthlyStats.value.data)),
  },
  {
    label: 'Open trades',
    value: String(openTrades.value.length),
    detail: 'Currently exposed positions',
    tone: openTrades.value.length > 0 ? 'warning' : 'neutral',
  },
  {
    label: 'Closed trades',
    value: String(closedTrades.value.length),
    detail: 'Loaded trade history',
    tone: 'neutral',
  },
  {
    label: 'Winrate',
    value: isDefined(winrate.value) ? formatPercent(winrate.value, 2) : 'N/A',
    detail: `${wins.value} wins / ${losses.value} losses`,
    tone: isDefined(winrate.value) && winrate.value < 0.45 ? 'warning' : 'profit',
  },
  {
    label: 'Profit factor',
    value: isDefined(calculatedProfitFactor.value)
      ? calculatedProfitFactor.value === Number.POSITIVE_INFINITY
        ? '∞'
        : formatPrice(calculatedProfitFactor.value, 2)
      : 'N/A',
    detail: isDefined(calculatedProfitFactor.value)
      ? 'Gross profit / gross loss'
      : 'Not enough data',
    tone:
      isDefined(calculatedProfitFactor.value) && calculatedProfitFactor.value < 1
        ? 'loss'
        : 'profit',
  },
]);

const pairPerformance = computed(() =>
  aggregatePerformance(
    selectedBots.value.flatMap((bot) => bot.performanceStats),
    'pair',
  ),
);
const enterTagPerformance = computed(() =>
  aggregatePerformance(
    selectedBots.value.flatMap((bot) => bot.entryStats),
    'enter_tag',
  ),
);
const exitReasonPerformance = computed(() =>
  aggregatePerformance(
    selectedBots.value.flatMap((bot) => bot.exitStats),
    'exit_reason',
  ),
);

const riskAlerts = computed<RiskAlert[]>(() => {
  const alerts: RiskAlert[] = [];
  const latestDaily = latestProfit(dailyStats.value.data);
  const reversedDaily = [...(dailyStats.value.data ?? [])].reverse();
  const firstNonNegativeDay = reversedDaily.findIndex((day) => day.abs_profit >= 0);
  const negativeDays = firstNonNegativeDay === -1 ? reversedDaily.length : firstNonNegativeDay;
  const selectedMaxOpenTrades = selectedBots.value.reduce(
    (sum, bot) => sum + (bot.botState?.max_open_trades || 0),
    0,
  );

  if (isDefined(latestDaily) && latestDaily < 0) {
    alerts.push({
      title: 'Today is negative',
      detail: `${formatProfit(latestDaily)} in the latest daily period.`,
      tone: 'loss',
    });
  }
  if (negativeDays > 1) {
    alerts.push({
      title: 'Negative streak',
      detail: `${negativeDays} consecutive losing days in the loaded summary.`,
      tone: 'warning',
    });
  }
  if (isDefined(calculatedProfitFactor.value) && calculatedProfitFactor.value < 1) {
    alerts.push({
      title: 'Profit factor below 1',
      detail: 'Gross losses are larger than gross wins in the loaded trade set.',
      tone: 'loss',
    });
  }
  if (isDefined(winrate.value) && winrate.value < 0.4) {
    alerts.push({
      title: 'Low winrate',
      detail: `${formatPercent(winrate.value, 2)} winrate across selected bots.`,
      tone: 'warning',
    });
  }
  if (selectedMaxOpenTrades > 0 && openTrades.value.length / selectedMaxOpenTrades >= 0.8) {
    alerts.push({
      title: 'High exposure',
      detail: `${openTrades.value.length}/${selectedMaxOpenTrades} open trade slots are in use.`,
      tone: 'warning',
    });
  }

  return alerts.length > 0
    ? alerts
    : [
        {
          title: 'No major risk alerts',
          detail: 'Loaded metrics are within the configured dashboard thresholds.',
          tone: 'profit',
        },
      ];
});

const topPairChartOptions = computed<EChartsOption>(() => {
  const topRows = pairPerformance.value.slice(0, 8).reverse();
  const chartTextColor = settingsStore.chartTheme === 'dark' ? '#b8c5d2' : '#475569';
  const chartMutedColor = settingsStore.chartTheme === 'dark' ? '#7f8ea3' : '#64748b';
  const chartLineColor =
    settingsStore.chartTheme === 'dark' ? 'rgba(148, 163, 184, 0.13)' : '#e2e8f0';
  const tooltipBg = settingsStore.chartTheme === 'dark' ? 'rgba(5, 8, 20, 0.96)' : '#ffffff';
  const tooltipText = settingsStore.chartTheme === 'dark' ? '#edf3f8' : '#10202a';
  return {
    backgroundColor: 'rgba(0, 0, 0, 0)',
    animationDuration: 500,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 350,
    animationEasingUpdate: 'cubicOut',
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
        shadowStyle: {
          color: 'rgba(251, 191, 36, 0.08)',
        },
      },
      backgroundColor: tooltipBg,
      borderColor: 'rgba(251, 191, 36, 0.28)',
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: tooltipText, fontWeight: 650 },
      extraCssText:
        'box-shadow: 0 14px 34px rgba(0,0,0,.28); border-radius: 8px; backdrop-filter: blur(10px);',
      formatter: (params) => {
        const points = Array.isArray(params) ? params : [params];
        const point = points[0];
        const value = Number(point?.value ?? 0);
        const row = topRows[point?.dataIndex ?? 0];
        return [
          `<div style="font-weight:800;margin-bottom:6px;color:#fbbf24">${row?.key ?? ''}</div>`,
          `<div>${point?.marker ?? ''}Profit: <b>${formatPrice(
            value,
            stakeCurrencyDecimals.value,
          )} ${stakeCurrency.value}</b></div>`,
          `<div style="color:${chartMutedColor};margin-top:3px">Trades: <b>${row?.count ?? 0}</b></div>`,
        ].join('');
      },
    },
    grid: {
      left: 106,
      right: 20,
      top: 16,
      bottom: 28,
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: chartTextColor, fontWeight: 600 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: chartLineColor, type: 'dashed' } },
    },
    yAxis: {
      type: 'category',
      data: topRows.map((row) => row.key),
      axisLabel: { color: chartTextColor, fontWeight: 650 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: topRows.map((row) => row.profitAbs),
        barMaxWidth: 18,
        barCategoryGap: '40%',
        itemStyle: {
          color: (params) =>
            Number(params.value) >= 0 ? colorStore.colorProfit : colorStore.colorLoss,
          borderRadius: [4, 4, 4, 4],
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            opacity: 0.92,
            shadowBlur: 10,
            shadowColor: 'rgba(0,0,0,0.22)',
          },
        },
      },
    ],
  };
});

async function refreshAdvancedDashboard() {
  const jobs = selectedBots.value.flatMap((bot) => [
    bot.getProfit(),
    bot.getTrades(),
    bot.getOpenTrades(),
    bot.getTimeSummary(TimeSummaryOptions.daily, { timescale: 30 }),
    bot.getTimeSummary(TimeSummaryOptions.weekly, { timescale: 12 }),
    bot.getTimeSummary(TimeSummaryOptions.monthly, { timescale: 12 }),
    bot.getPerformance(),
    bot.botFeatures.hasAdvancedStats ? bot.getEntryStats() : Promise.resolve(),
    bot.botFeatures.hasAdvancedStats ? bot.getExitStats() : Promise.resolve(),
  ]);

  await Promise.allSettled(jobs);
}

onMounted(() => {
  refreshAdvancedDashboard();
});
</script>

<template>
  <div class="ft-advanced-dashboard h-full overflow-auto">
    <div class="ft-advanced-dashboard-header">
      <div>
        <h1>Analytics</h1>
        <p>Trading analytics, performance breakdowns and risk signals for selected bots</p>
      </div>
      <Button severity="secondary" size="small" @click="refreshAdvancedDashboard">
        <template #icon>
          <i-mdi-refresh />
        </template>
      </Button>
    </div>

    <section class="ft-advanced-metrics">
      <div
        v-for="metric in metrics"
        :key="metric.label"
        class="ft-advanced-metric ft-dashboard-card"
        :class="`ft-advanced-${metric.tone}`"
      >
        <span>{{ metric.label }}</span>
        <div class="ft-advanced-metric-value">
          <strong>{{ metric.value }}</strong>
          <em
            v-if="metric.change"
            class="ft-advanced-metric-change"
            :class="`ft-advanced-metric-change-${metric.tone}`"
          >
            {{ metric.change }}
          </em>
        </div>
        <small>{{ metric.detail }}</small>
      </div>
    </section>

    <section class="ft-advanced-grid">
      <article class="ft-dashboard-card ft-advanced-panel ft-analytics-daily-panel">
        <header>Daily profit chart</header>
        <div class="ft-advanced-chart-scroll">
          <div class="ft-advanced-chart">
            <TimePeriodChart
              :daily-stats="dailyStats"
              :profit-col="TimeSummaryCols.abs_profit"
              :show-title="false"
            />
          </div>
        </div>
      </article>

      <article class="ft-dashboard-card ft-advanced-panel ft-analytics-risk-panel">
        <header>Risk alerts</header>
        <div class="ft-risk-list">
          <div
            v-for="alert in riskAlerts"
            :key="alert.title"
            class="ft-risk-alert"
            :class="`ft-advanced-${alert.tone}`"
          >
            <strong>{{ alert.title }}</strong>
            <span>{{ alert.detail }}</span>
          </div>
        </div>
      </article>

      <article class="ft-dashboard-card ft-advanced-panel ft-analytics-pair-panel">
        <header>Pair performance</header>
        <div class="ft-advanced-chart-scroll">
          <ECharts
            v-if="pairPerformance.length"
            class="ft-advanced-chart"
            :option="topPairChartOptions"
            :theme="settingsStore.chartTheme"
            autoresize
          />
        </div>
        <DataTable
          class="ft-metric-table ft-advanced-desktop-table"
          size="small"
          :value="pairPerformance.slice(0, 10)"
        >
          <Column field="key" header="Pair" />
          <Column field="profitAbs" :header="`Profit ${stakeCurrency}`">
            <template #body="{ data }">
              <span :class="data.profitAbs >= 0 ? 'text-profit' : 'text-loss'">
                {{ formatPrice(data.profitAbs, stakeCurrencyDecimals) }}
              </span>
            </template>
          </Column>
          <Column field="count" header="Trades" />
        </DataTable>
        <div class="ft-advanced-mobile-list">
          <div
            v-for="row in pairPerformance.slice(0, 10)"
            :key="row.key"
            class="ft-mobile-row-card"
          >
            <div>
              <strong>{{ row.key }}</strong>
              <span>{{ row.count }} trades</span>
            </div>
            <b :class="row.profitAbs >= 0 ? 'text-profit' : 'text-loss'">
              {{ formatPrice(row.profitAbs, stakeCurrencyDecimals) }}
            </b>
          </div>
        </div>
      </article>

      <article class="ft-dashboard-card ft-advanced-panel ft-analytics-trades-panel">
        <header>Trades log</header>
        <div class="ft-analytics-chart-frame">
          <TradesLogChart :trades="botStore.allTradesSelectedBots" :show-title="false" />
        </div>
      </article>

      <article class="ft-dashboard-card ft-advanced-panel ft-analytics-wallet-panel">
        <header>Wallet history</header>
        <div class="ft-analytics-chart-frame">
          <WalletHistoryChart :wallet-data="botStore.allBalanceHistory" :show-title="false" />
        </div>
      </article>

      <article class="ft-dashboard-card ft-advanced-panel ft-analytics-distribution-panel">
        <header>Profit distribution</header>
        <div class="ft-analytics-chart-frame">
          <ProfitDistributionChart :trades="botStore.allTradesSelectedBots" :show-title="false" />
        </div>
      </article>

      <article class="ft-dashboard-card ft-advanced-panel ft-analytics-enter-panel">
        <header>Enter tag performance</header>
        <DataTable
          class="ft-metric-table ft-advanced-desktop-table"
          size="small"
          :value="enterTagPerformance.slice(0, 12)"
        >
          <Column field="key" header="Enter tag" />
          <Column field="profitAbs" :header="`Profit ${stakeCurrency}`">
            <template #body="{ data }">
              <span :class="data.profitAbs >= 0 ? 'text-profit' : 'text-loss'">
                {{ formatPrice(data.profitAbs, stakeCurrencyDecimals) }}
              </span>
            </template>
          </Column>
          <Column field="count" header="Trades" />
          <template #empty>No enter tag performance available.</template>
        </DataTable>
        <div class="ft-advanced-mobile-list">
          <div
            v-for="row in enterTagPerformance.slice(0, 12)"
            :key="row.key"
            class="ft-mobile-row-card"
          >
            <div>
              <strong>{{ row.key }}</strong>
              <span>{{ row.count }} trades</span>
            </div>
            <b :class="row.profitAbs >= 0 ? 'text-profit' : 'text-loss'">
              {{ formatPrice(row.profitAbs, stakeCurrencyDecimals) }}
            </b>
          </div>
          <div v-if="!enterTagPerformance.length" class="ft-empty-state">
            No enter tag performance available.
          </div>
        </div>
      </article>

      <article class="ft-dashboard-card ft-advanced-panel ft-analytics-exit-panel">
        <header>Exit reason performance</header>
        <DataTable
          class="ft-metric-table ft-advanced-desktop-table"
          size="small"
          :value="exitReasonPerformance.slice(0, 12)"
        >
          <Column field="key" header="Exit reason" />
          <Column field="profitAbs" :header="`Profit ${stakeCurrency}`">
            <template #body="{ data }">
              <span :class="data.profitAbs >= 0 ? 'text-profit' : 'text-loss'">
                {{ formatPrice(data.profitAbs, stakeCurrencyDecimals) }}
              </span>
            </template>
          </Column>
          <Column field="count" header="Trades" />
          <template #empty>No exit reason performance available.</template>
        </DataTable>
        <div class="ft-advanced-mobile-list">
          <div
            v-for="row in exitReasonPerformance.slice(0, 12)"
            :key="row.key"
            class="ft-mobile-row-card"
          >
            <div>
              <strong>{{ row.key }}</strong>
              <span>{{ row.count }} trades</span>
            </div>
            <b :class="row.profitAbs >= 0 ? 'text-profit' : 'text-loss'">
              {{ formatPrice(row.profitAbs, stakeCurrencyDecimals) }}
            </b>
          </div>
          <div v-if="!exitReasonPerformance.length" class="ft-empty-state">
            No exit reason performance available.
          </div>
        </div>
      </article>
    </section>
  </div>
</template>

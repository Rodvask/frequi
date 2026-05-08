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

function formatTradePrice(value: number | undefined | null): string {
  return isDefined(value) ? formatPrice(value, stakeCurrencyDecimals.value) : 'N/A';
}

function formatOpenDuration(trade: Trade): string {
  if (!trade.open_timestamp) return 'N/A';
  return humanizeDurationFromSeconds(Math.max(0, (Date.now() - trade.open_timestamp) / 1000));
}

function tradeDirection(trade: Trade): string {
  if (trade.trading_mode === 'spot') return 'Spot';
  return trade.is_short ? 'Short' : 'Long';
}

function dcaCount(trade: Trade): string {
  const entries =
    trade.nr_of_successful_entries ?? trade.orders?.filter((order) => order.ft_is_entry).length;
  return isDefined(entries) ? `${entries} entries` : 'N/A';
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
    detail: `${closedTrades.value.length + openTrades.value.length} total trades`,
    tone: metricTone(totalProfit.value),
  },
  {
    label: 'Daily profit',
    value: formatProfit(latestProfit(dailyStats.value.data)),
    detail: dailyStats.value.data?.at(-1)?.date,
    tone: metricTone(latestProfit(dailyStats.value.data)),
  },
  {
    label: 'Weekly profit',
    value: formatProfit(latestProfit(weeklyStats.value.data)),
    detail: weeklyStats.value.data?.at(-1)?.date,
    tone: metricTone(latestProfit(weeklyStats.value.data)),
  },
  {
    label: 'Monthly profit',
    value: formatProfit(latestProfit(monthlyStats.value.data)),
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
  return {
    backgroundColor: 'rgba(0, 0, 0, 0)',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    grid: {
      left: 96,
      right: 16,
      top: 12,
      bottom: 20,
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: 'var(--ft-text-muted)' },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    yAxis: {
      type: 'category',
      data: topRows.map((row) => row.key),
      axisLabel: { color: 'var(--ft-text-muted)' },
    },
    series: [
      {
        type: 'bar',
        data: topRows.map((row) => row.profitAbs),
        itemStyle: {
          color: (params) =>
            Number(params.value) >= 0 ? colorStore.colorProfit : colorStore.colorLoss,
          borderRadius: [3, 3, 3, 3],
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
        <h1>Advanced Dashboard</h1>
        <p>Trading decision metrics for selected bots</p>
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
        <strong>{{ metric.value }}</strong>
        <small>{{ metric.detail }}</small>
      </div>
    </section>

    <section class="ft-advanced-grid">
      <article class="ft-dashboard-card ft-advanced-panel ft-advanced-panel-large">
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

      <article class="ft-dashboard-card ft-advanced-panel ft-advanced-panel-risk">
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

      <article class="ft-dashboard-card ft-advanced-panel ft-advanced-panel-pair">
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

      <article class="ft-dashboard-card ft-advanced-panel ft-advanced-panel-open">
        <header>Open trades</header>
        <div v-if="openTrades.length" class="ft-open-trade-list">
          <div v-for="trade in openTrades" :key="trade.botTradeId" class="ft-open-trade-card">
            <div class="ft-open-trade-head">
              <div>
                <strong>{{ trade.pair }}</strong>
                <span>{{ trade.botName }}</span>
              </div>
              <Badge
                :value="tradeDirection(trade)"
                :severity="trade.is_short ? 'danger' : 'success'"
              />
            </div>
            <TradeProfit :trade="trade" />
            <div class="ft-open-trade-grid">
              <span>Entry</span>
              <b>{{ formatTradePrice(trade.open_rate) }}</b>
              <span>Current</span>
              <b>{{ formatTradePrice(trade.current_rate) }}</b>
              <span>Duration</span>
              <b>{{ formatOpenDuration(trade) }}</b>
              <span>DCA/orders</span>
              <b>{{ dcaCount(trade) }}</b>
            </div>
          </div>
        </div>
        <div v-else class="ft-empty-state">No open trades.</div>
      </article>

      <article class="ft-dashboard-card ft-advanced-panel">
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

      <article class="ft-dashboard-card ft-advanced-panel">
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

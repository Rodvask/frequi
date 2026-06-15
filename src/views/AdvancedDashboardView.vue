<script setup lang="ts">
import type { EntryStats, ExitStats, PerformanceEntry, TimeSummaryRecord, Trade } from '@/types';
import { TimeSummaryOptions } from '@/types';

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

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

const selectedBots = computed(() => botStore.selectedBots);
const closedTrades = computed(() => botStore.allClosedTradesSelectedBots);
const openTrades = computed(() => botStore.allOpenTradesSelectedBots);
const dailyStats = computed(() => botStore.allDailyStatsSelectedBots);
const weeklyStats = computed(() => botStore.allWeeklyStatsSelectedBots);
const monthlyStats = computed(() => botStore.allMonthlyStatsSelectedBots);
const stakeCurrency = computed(
  () => selectedBots.value[0]?.stakeCurrency || dailyStats.value.stake_currency || '',
);
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
  return formatPriceCurrency(value, stakeCurrency.value, 2);
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

function formatTradeShare(row: PerformanceRow, totalTrades: number): string {
  return totalTrades > 0 ? formatPercent(row.count / totalTrades, 2) : 'N/A';
}

const selectedProfitStats = computed(() =>
  selectedBots.value.map((bot) => bot.profit).filter(isPresent),
);

const totalProfit = computed(() =>
  selectedProfitStats.value.reduce((sum, profit) => sum + (profit.profit_all_coin ?? 0), 0),
);

const totalProfitRatio = computed(() => {
  const values = selectedProfitStats.value
    .map((profit) => profit.profit_all_ratio)
    .filter(isPresent);
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

  const values = selectedProfitStats.value.map((profit) => profit.profit_factor).filter(isPresent);
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
const pairPerformanceTradeCount = computed(() =>
  pairPerformance.value.reduce((sum, row) => sum + row.count, 0),
);
const enterTagPerformance = computed(() =>
  aggregatePerformance(
    selectedBots.value.flatMap((bot) => bot.entryStats),
    'enter_tag',
  ),
);
const enterTagTradeCount = computed(() =>
  enterTagPerformance.value.reduce((sum, row) => sum + row.count, 0),
);
const exitReasonPerformance = computed(() =>
  aggregatePerformance(
    selectedBots.value.flatMap((bot) => bot.exitStats),
    'exit_reason',
  ),
);
const exitReasonTradeCount = computed(() =>
  exitReasonPerformance.value.reduce((sum, row) => sum + row.count, 0),
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
      <Button
        class="ft-page-refresh-button"
        severity="secondary"
        size="small"
        aria-label="Refresh analytics"
        @click="refreshAdvancedDashboard"
      >
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
        <div class="ft-dashboard-card-header"><span>Profit over time</span></div>
        <div class="ft-dashboard-card-body">
          <PeriodBreakdown multi-bot-view />
        </div>
      </article>

      <article class="ft-dashboard-card ft-advanced-panel ft-analytics-risk-panel">
        <div class="ft-dashboard-card-header"><span>Risk alerts</span></div>
        <div class="ft-dashboard-card-body">
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
        </div>
      </article>

      <article class="ft-dashboard-card ft-advanced-panel ft-analytics-pair-panel">
        <div class="ft-dashboard-card-header"><span>Pair performance</span></div>
        <div class="ft-dashboard-card-body">
        <DataTable
          class="ft-metric-table"
          size="small"
          :value="pairPerformance"
          :paginator="pairPerformance.length > 10"
          :rows="10"
          :rows-per-page-options="[10, 20, 30]"
        >
          <Column field="key" header="Pair" />
          <Column field="profitAbs" :header="`Profit ${stakeCurrency}`">
            <template #body="{ data }">
              <span :class="data.profitAbs >= 0 ? 'text-profit' : 'text-loss'">
                {{ formatPrice(data.profitAbs, 2) }}
              </span>
            </template>
          </Column>
          <Column field="count" header="Trades %">
            <template #body="{ data }">
              {{ formatTradeShare(data, pairPerformanceTradeCount) }}
            </template>
          </Column>
          <Column field="count" header="Trades" />
          <template #empty>No pair performance available.</template>
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
              {{ formatPrice(row.profitAbs, 2) }}
            </b>
          </div>
        </div>
        </div>
      </article>

      <article class="ft-dashboard-card ft-advanced-panel ft-analytics-trades-panel">
        <div class="ft-dashboard-card-header"><span>Trades log</span></div>
        <div class="ft-dashboard-card-body">
          <div class="ft-analytics-chart-frame">
          <TradesLogChart :trades="botStore.allTradesSelectedBots" :show-title="false" />
        </div>
        </div>
      </article>

      <article class="ft-dashboard-card ft-advanced-panel ft-analytics-wallet-panel">
        <div class="ft-dashboard-card-header"><span>Wallet history</span></div>
        <div class="ft-dashboard-card-body">
          <div class="ft-analytics-chart-frame">
          <WalletHistoryChart :wallet-data="botStore.allBalanceHistory" :show-title="false" />
        </div>
        </div>
      </article>

      <article class="ft-dashboard-card ft-advanced-panel ft-analytics-distribution-panel">
        <div class="ft-dashboard-card-header"><span>Profit distribution</span></div>
        <div class="ft-dashboard-card-body">
          <div class="ft-analytics-chart-frame">
          <ProfitDistributionChart :trades="botStore.allTradesSelectedBots" :show-title="false" />
        </div>
        </div>
      </article>

      <article class="ft-dashboard-card ft-advanced-panel ft-analytics-enter-panel">
        <div class="ft-dashboard-card-header"><span>Enter tag performance</span></div>
        <div class="ft-dashboard-card-body">
        <DataTable
          class="ft-metric-table"
          size="small"
          :value="enterTagPerformance"
          :paginator="enterTagPerformance.length > 8"
          :rows="8"
          :rows-per-page-options="[8, 12, 20]"
        >
          <Column field="key" header="Enter tag" />
          <Column field="profitAbs" :header="`Profit ${stakeCurrency}`">
            <template #body="{ data }">
              <span :class="data.profitAbs >= 0 ? 'text-profit' : 'text-loss'">
                {{ formatPrice(data.profitAbs, 2) }}
              </span>
            </template>
          </Column>
          <Column field="count" header="Trades %">
            <template #body="{ data }">
              {{ formatTradeShare(data, enterTagTradeCount) }}
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
              <span>
                {{ row.count }} trades ·
                <b>{{ formatTradeShare(row, enterTagTradeCount) }}</b>
              </span>
            </div>
            <b :class="row.profitAbs >= 0 ? 'text-profit' : 'text-loss'">
              {{ formatPrice(row.profitAbs, 2) }}
            </b>
          </div>
          <div v-if="!enterTagPerformance.length" class="ft-empty-state">
            No enter tag performance available.
          </div>
        </div>
        </div>
      </article>

      <article class="ft-dashboard-card ft-advanced-panel ft-analytics-exit-panel">
        <div class="ft-dashboard-card-header"><span>Exit reason performance</span></div>
        <div class="ft-dashboard-card-body">
        <DataTable
          class="ft-metric-table"
          size="small"
          :value="exitReasonPerformance"
          :paginator="exitReasonPerformance.length > 8"
          :rows="8"
          :rows-per-page-options="[8, 12, 20]"
        >
          <Column field="key" header="Exit reason" />
          <Column field="profitAbs" :header="`Profit ${stakeCurrency}`">
            <template #body="{ data }">
              <span :class="data.profitAbs >= 0 ? 'text-profit' : 'text-loss'">
                {{ formatPrice(data.profitAbs, 2) }}
              </span>
            </template>
          </Column>
          <Column field="count" header="Trades %">
            <template #body="{ data }">
              {{ formatTradeShare(data, exitReasonTradeCount) }}
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
              <span>
                {{ row.count }} trades ·
                <b>{{ formatTradeShare(row, exitReasonTradeCount) }}</b>
              </span>
            </div>
            <b :class="row.profitAbs >= 0 ? 'text-profit' : 'text-loss'">
              {{ formatPrice(row.profitAbs, 2) }}
            </b>
          </div>
          <div v-if="!exitReasonPerformance.length" class="ft-empty-state">
            No exit reason performance available.
          </div>
        </div>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Trade } from '@/types';

const props = defineProps<{
  history?: boolean;
}>();
const botStore = useBotStore();

const closedTrades = computed(() => botStore.activeBot.closedTrades);
const openTrades = computed(() => botStore.activeBot.openTrades);
const historyProfit = computed(() =>
  closedTrades.value.reduce((sum, trade) => sum + (trade.profit_abs ?? trade.realized_profit ?? 0), 0),
);
const historyProfitFormatted = computed(() => historyProfit.value.toFixed(2));
const winningTrades = computed(
  () => closedTrades.value.filter((trade) => (trade.profit_ratio ?? 0) > 0).length,
);
const losingTrades = computed(
  () => closedTrades.value.filter((trade) => (trade.profit_ratio ?? 0) <= 0).length,
);
const winRate = computed(() =>
  closedTrades.value.length ? (winningTrades.value / closedTrades.value.length) * 100 : 0,
);
const averageProfit = computed(() => {
  if (!closedTrades.value.length) {
    return 0;
  }

  return (
    (closedTrades.value.reduce((sum, trade) => sum + (trade.profit_ratio ?? 0), 0) /
      closedTrades.value.length) *
    100
  );
});
const lastClosedTrade = computed<Trade | undefined>(() => closedTrades.value[0]);

const historyMetricTone = computed(() => {
  if (historyProfit.value > 0) {
    return 'profit';
  }
  if (historyProfit.value < 0) {
    return 'loss';
  }
  return 'neutral';
});
</script>

<template>
  <div class="ft-history-view h-full min-h-0">
    <!-- <TradeList
      class="open-trades"
      :trades="openTrades"
      title="Open trades"
      :active-trades="true"
      empty-text="Currently no open trades."
    /> -->
    <CustomTradeList
      v-if="!props.history && !botStore.activeBot.detailTradeId"
      :trades="openTrades"
      title="Open trades"
      :active-trades="true"
      :stake-currency-decimals="botStore.activeBot.stakeCurrencyDecimals"
      empty-text="No open Trades."
    />
    <template v-if="props.history && !botStore.activeBot.detailTradeId">
      <section class="ft-history-shell">
        <header class="ft-history-header">
          <div>
            <span>Trade History</span>
            <h1>Closed trades</h1>
            <p>Review completed positions, outcomes and exit reasons for the selected bot.</p>
          </div>
          <Button
            severity="secondary"
            size="small"
            rounded
            aria-label="Refresh"
            @click="botStore.activeBot.getTrades()"
          >
            <template #icon>
              <i-mdi-refresh />
            </template>
          </Button>
        </header>

        <div class="ft-history-metrics">
          <article class="ft-history-metric" :class="`ft-history-metric-${historyMetricTone}`">
            <span>Total profit</span>
            <strong>{{ historyProfitFormatted }} {{ botStore.activeBot.stakeCurrency }}</strong>
            <small>{{ closedTrades.length }} closed trades</small>
          </article>
          <article class="ft-history-metric">
            <span>Winrate</span>
            <strong>{{ winRate.toFixed(2) }}%</strong>
            <small>{{ winningTrades }} wins / {{ losingTrades }} losses</small>
          </article>
          <article class="ft-history-metric">
            <span>Average profit</span>
            <strong>{{ averageProfit.toFixed(2) }}%</strong>
            <small>Mean result per trade</small>
          </article>
          <article class="ft-history-metric">
            <span>Latest close</span>
            <strong v-if="lastClosedTrade">
              <DateTimeTZ :date="lastClosedTrade.close_timestamp ?? 0" :date-only="true" />
            </strong>
            <strong v-else>-</strong>
            <small>{{ lastClosedTrade?.pair ?? 'No closed trades' }}</small>
          </article>
        </div>

        <section class="ft-dashboard-card ft-history-table-panel">
          <div class="ft-dashboard-card-header">
            <span>Trade history</span>
          </div>
          <div class="ft-dashboard-card-body p-0">
            <TradeList
              class="ft-history-desktop-table"
              :active-trades="false"
              show-filter
              :trades="closedTrades"
              empty-text="No closed trades so far."
            />
            <CustomTradeList
              class="ft-history-mobile-list"
              :trades="closedTrades"
              title="Trade history"
              :stake-currency-decimals="botStore.activeBot.stakeCurrencyDecimals"
              empty-text="No closed trades so far."
            />
          </div>
        </section>
      </section>
    </template>
    <div
      v-if="botStore.activeBot.detailTradeId && botStore.activeBot.tradeDetail"
      class="ft-history-detail flex flex-col"
    >
      <button
        type="button"
        class="ft-history-back-button"
        @click="botStore.activeBot.setDetailTrade(null)"
      >
        <i-mdi-arrow-left />
        <span>Back to history</span>
      </button>
      <TradeDetail
        :trade="botStore.activeBot.tradeDetail"
        :stake-currency="botStore.activeBot.stakeCurrency"
      />
    </div>
  </div>
</template>

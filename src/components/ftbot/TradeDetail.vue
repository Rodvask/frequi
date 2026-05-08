<script setup lang="ts">
import type { Trade } from '@/types';

const colorStore = useColorStore();

defineProps<{
  trade: Trade;
  stakeCurrency: string;
}>();
</script>

<template>
  <div class="ft-trade-detail-grid text-start">
    <section class="ft-trade-detail-panel">
      <h5 class="detail-header">General</h5>
      <ValuePair description="Trade Id">{{ trade.trade_id }}</ValuePair>
      <ValuePair description="Pair">{{ trade.pair }}</ValuePair>

      <ValuePair description="Open date">{{ timestampms(trade.open_timestamp) }}</ValuePair>
      <ValuePair v-if="trade.enter_tag" description="Entry tag">{{ trade.enter_tag }}</ValuePair>
      <ValuePair v-if="trade.is_open" description="Stake">
        {{ formatPriceCurrency(trade.stake_amount, stakeCurrency) }}
        <template v-if="trade.trading_mode !== 'spot'">
          ({{ trade.leverage }}x)
          <span title="Position value" class="italic">{{
            formatPriceCurrency(trade.amount * trade.open_rate, stakeCurrency)
          }}</span>
        </template>
      </ValuePair>
      <ValuePair v-if="!trade.is_open" description="Total Stake">
        {{ formatPriceCurrency(trade.max_stake_amount ?? trade.stake_amount, stakeCurrency) }}
        {{ trade.trading_mode !== 'spot' ? `(${trade.leverage}x)` : '' }}
      </ValuePair>
      <ValuePair description="Amount">{{ formatPrice(trade.amount) }}</ValuePair>
      <ValuePair description="Open Rate">{{ formatPrice(trade.open_rate) }}</ValuePair>
      <ValuePair v-if="trade.is_open && trade.current_rate" description="Current Rate">
        {{ formatPrice(trade.current_rate) }}
        <span title="Current Value - In futures mode Collateral + PnL" class="italic">
          ({{ formatPriceCurrency(trade.stake_amount + (trade.profit_abs ?? 0), stakeCurrency) }})
        </span>
      </ValuePair>
      <ValuePair v-if="!trade.is_open && trade.close_rate" description="Close Rate">{{
        formatPrice(trade.close_rate)
      }}</ValuePair>

      <ValuePair v-if="trade.close_timestamp" description="Close date">{{
        timestampms(trade.close_timestamp)
      }}</ValuePair>
      <ValuePair
        v-if="trade.is_open && trade.realized_profit && !trade.total_profit_abs"
        description="Realized Profit"
      >
        <TradeProfit :trade="trade" mode="realized" />
      </ValuePair>
      <ValuePair v-if="trade.is_open && trade.total_profit_abs" description="Total Profit">
        <TradeProfit :trade="trade" mode="total" />
      </ValuePair>
      <ValuePair
        v-if="trade.profit_ratio && trade.profit_abs"
        :description="`${trade.is_open ? 'Current Profit' : 'Close Profit'}`"
      >
        <TradeProfit :trade="trade" />
      </ValuePair>
      <details>
        <summary>Details</summary>
        <ValuePair v-if="trade.min_rate" description="Min Rate">{{
          formatPrice(trade.min_rate)
        }}</ValuePair>
        <ValuePair v-if="trade.max_rate" description="Max Rate">{{
          formatPrice(trade.max_rate)
        }}</ValuePair>
        <ValuePair description="Open-Fees">
          {{ trade.fee_open_cost }} {{ trade.quote_currency }}
          <span v-if="trade.quote_currency !== trade.fee_open_currency">
            (in {{ trade.fee_open_currency }})
          </span>
          ({{ formatPercent(trade.fee_open) }})
        </ValuePair>
        <ValuePair v-if="trade.fee_close_cost && trade.fee_close" description="Fees close">
          {{ trade.fee_close_cost }} {{ trade.fee_close_currency }} ({{
            formatPercent(trade.fee_close)
          }})
        </ValuePair>
      </details>
    </section>
    <section class="ft-trade-detail-panel">
      <h5 class="detail-header">Stoploss</h5>
      <ValuePair description="Stoploss">
        {{ formatPercent(trade.stop_loss_ratio) }} |
        {{ formatPrice(trade.stop_loss_abs) }}
      </ValuePair>
      <ValuePair
        description="At risk"
        help="The amount at risk based on the stake amount. This is how much you would lose if the stoploss is hit."
      >
        {{
          formatPriceCurrency(trade.stake_amount * Math.abs(trade.stop_loss_ratio), stakeCurrency)
        }}
      </ValuePair>
      <ValuePair
        v-if="trade.is_open && trade.stoploss_current_dist_ratio && trade.stoploss_current_dist"
        description="Current stoploss dist"
      >
        {{ formatPercent(trade.stoploss_current_dist_ratio) }} |
        {{ formatPrice(trade.stoploss_current_dist) }}
      </ValuePair>
      <ValuePair
        v-if="trade.initial_stop_loss_pct && trade.initial_stop_loss_abs"
        description="Initial Stoploss"
      >
        {{ formatPercent(trade.initial_stop_loss_pct / 100) }} |
        {{ formatPrice(trade.initial_stop_loss_abs) }}
      </ValuePair>
      <ValuePair v-if="trade.stoploss_last_update_timestamp" description="Stoploss last updated">
        {{ timestampms(trade.stoploss_last_update_timestamp) }}
      </ValuePair>
      <div v-if="trade.trading_mode !== undefined && trade.trading_mode !== 'spot'">
        <h5 class="detail-header">Futures/Margin</h5>
        <ValuePair description="Direction">
          {{ trade.is_short ? 'short' : 'long' }} - {{ trade.leverage }}x
        </ValuePair>
        <ValuePair v-if="trade.funding_fees !== undefined" description="Funding fees">
          {{ formatPrice(trade.funding_fees) }}
        </ValuePair>
        <ValuePair v-if="trade.interest_rate !== undefined" description="Interest rate">
          {{ formatPrice(trade.interest_rate) }}
        </ValuePair>
        <ValuePair v-if="trade.liquidation_price !== undefined" description="Liquidation Price">
          {{ formatPrice(trade.liquidation_price) }}
        </ValuePair>
      </div>
      <details v-if="trade.orders">
        <summary>Orders {{ trade.orders.length > 1 ? `[${trade.orders.length}]` : '' }}</summary>
        <div class="ft-order-list">
          <article
            v-for="(order, key) in trade.orders"
            :key="key"
            class="ft-order-card"
            :title="`${order.ft_order_side} ${order.order_type} order for ${formatPriceCurrency(
              order.amount,
              trade.base_currency ?? '',
            )} at ${formatPriceCurrency(
              order.safe_price,
              trade.quote_currency ?? '',
            )}, filled ${formatPrice(order.filled)}`"
          >
            <header>
              <span class="ft-order-index">#{{ key + 1 }}</span>
              <span
                class="ft-order-side"
                :class="order.ft_order_side === 'buy' ? 'color-up' : 'color-down'"
              >
                <i-mdi-triangle v-if="order.ft_order_side === 'buy'" />
                <i-mdi-triangle-down v-else />
                {{ order.ft_order_side }}
              </span>
            </header>
            <div class="ft-order-meta">
              <span v-if="order.order_timestamp">
                <DateTimeTZ :date="order.order_timestamp" show-timezone />
              </span>
              <span v-if="order.ft_order_tag">{{ order.ft_order_tag }}</span>
            </div>
            <div class="ft-order-grid">
              <span>Rate</span>
              <b>{{ formatPrice(order.safe_price) }}</b>
              <span>Filled</span>
              <b>{{ formatPrice(order.filled ?? 0, 8) }}</b>
              <template v-if="order.remaining && order.remaining !== 0">
                <span>Remaining</span>
                <b>{{ formatPrice(order.remaining, 8) }}</b>
              </template>
            </div>
          </article>
        </div>
      </details>
    </section>
  </div>
</template>
<style scoped>
@reference '../../styles/tailwind.css';

.ft-trade-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 28rem), 1fr));
  gap: 0.85rem;
  width: 100%;
}

.ft-trade-detail-panel {
  min-width: 0;
  padding: 0.95rem;
  border: 1px solid var(--ft-panel-border);
  border-radius: var(--ft-card-radius);
  background: rgba(15, 23, 42, 0.78);
  box-shadow: var(--ft-shadow-soft);
}

.detail-header {
  @apply w-full block;
  margin: 0 0 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--ft-panel-border);
  color: var(--p-primary-color);
  font-size: 0.82rem;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}
.color-up {
  color: v-bind('colorStore.colorUp');
}

.color-down {
  color: v-bind('colorStore.colorDown');
}

:deep(.flex.w-full) {
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.34rem 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.08);
}

:deep(.flex.w-full:last-child) {
  border-bottom: 0;
}

:deep(label) {
  color: var(--ft-text-muted);
  font-size: 0.78rem;
  font-weight: 850;
  text-transform: uppercase;
}

:deep([class~='w-8/12']),
:deep([class~='w-4/12']) {
  min-width: 0;
}

:deep([class~='w-8/12']) {
  color: var(--ft-text);
  font-family: var(--ft-font-mono);
  font-weight: 850;
  overflow-wrap: anywhere;
}

details {
  margin-top: 0.65rem;
}

summary {
  cursor: pointer;
  color: var(--p-primary-color);
  font-weight: 900;
}

.ft-order-list {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.65rem;
}

.ft-order-card {
  display: grid;
  grid-template-columns: minmax(6.5rem, 0.7fr) minmax(12rem, 1.25fr) minmax(10rem, 1fr);
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  padding: 0.6rem 0.7rem;
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 0.45rem;
  background: rgba(5, 8, 20, 0.38);
}

.ft-order-card header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0.6rem;
  margin-bottom: 0;
}

.ft-order-index {
  color: var(--ft-text-muted);
  font-family: var(--ft-font-mono);
  font-size: 0.78rem;
  font-weight: 900;
}

.ft-order-side {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.45rem;
  border: 1px solid currentColor;
  border-radius: 0.35rem;
  background: rgba(15, 23, 42, 0.68);
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
}

.ft-order-side svg {
  width: 0.82rem;
  height: 0.82rem;
}

.ft-order-meta {
  display: grid;
  gap: 0.2rem;
  margin-bottom: 0;
  color: var(--ft-text-muted);
  font-size: 0.76rem;
  overflow-wrap: anywhere;
}

.ft-order-grid {
  display: grid;
  grid-template-columns: minmax(4rem, 0.7fr) minmax(0, 1fr);
  gap: 0.26rem 0.75rem;
}

.ft-order-grid span {
  color: var(--ft-text-muted);
  font-size: 0.72rem;
  font-weight: 850;
  text-transform: uppercase;
}

.ft-order-grid b {
  color: var(--ft-text);
  font-family: var(--ft-font-mono);
  font-weight: 900;
  text-align: right;
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .ft-trade-detail-panel {
    padding: 0.8rem;
  }

  :deep(.flex.w-full) {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.2rem;
  }

  :deep([class~='w-4/12']),
  :deep([class~='w-8/12']) {
    width: 100%;
  }

  .ft-order-card {
    display: block;
    padding: 0.65rem;
  }

  .ft-order-card header {
    justify-content: space-between;
    margin-bottom: 0.45rem;
  }

  .ft-order-meta {
    margin-bottom: 0.5rem;
  }

  .ft-order-grid {
    grid-template-columns: 1fr;
    gap: 0.16rem;
  }

  .ft-order-grid b {
    text-align: left;
  }
}
</style>

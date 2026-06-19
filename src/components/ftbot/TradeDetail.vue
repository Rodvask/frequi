<script setup lang="ts">
import type { Trade } from '@/types';
import { timestampmsWithTimezone } from '@/utils/formatters/timeformat';

const settingsStore = useSettingsStore();
const orderSearch = ref('');

const props = defineProps<{
  trade: Trade;
  stakeCurrency: string;
}>();

const filteredOrders = computed(() => {
  const q = orderSearch.value.toLowerCase().trim();
  if (!q) return undefined;
  return (props.trade.orders || []).filter((o) =>
    [o.ft_order_side, o.order_type, o.ft_order_tag, String(o.safe_price), String(o.filled)]
      .some((v) => v?.toLowerCase().includes(q)),
  );
});

function pad(s: string, w: number) {
  s = s || '—';
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

function copyOrders(trade: Trade) {
  if (!trade.orders?.length) return;
  const tz = settingsStore.timezone;
  // Column widths for alignment
  const cw = [3, 6, 8, 12, 14, 20, 24];
  const header = ['#', 'Side', 'Type', 'Price', 'Filled', 'Tag', 'Date']
    .map((h, i) => pad(h, cw[i])).join(' ');
  const sep = cw.map((w) => '-'.repeat(w)).join(' ');
  const rows = trade.orders.map((o, i) => {
    const side = o.ft_order_side === 'buy' ? 'BUY' : 'SELL';
    const date = o.order_timestamp ? timestampmsWithTimezone(o.order_timestamp, tz) : '—';
    const vals = [
      String(i + 1), side, o.order_type,
      formatPrice(o.safe_price), formatPrice(o.filled ?? 0),
      o.ft_order_tag || '—', date,
    ];
    return vals.map((v, vi) => pad(v, cw[vi])).join(' ');
  });
  const text = [header, sep, ...rows].join('\n');

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch {}
  document.body.removeChild(ta);
}

async function screenshotOrders(trade: Trade) {
  if (!trade.orders?.length) return;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const tz = settingsStore.timezone;
  const font = '12px monospace';
  const boldFont = 'bold 12px monospace';
  ctx.font = font;

  const padX = 16;
  const padY = 16;
  const rowH = 24;
  const headerH = 30;

  // Build rows data
  const headers = ['#', 'Side', 'Type', 'Price', 'Filled', 'Tag', 'Date'];
  const rows = trade.orders.map((o, i) => [
    String(i + 1),
    o.ft_order_side === 'buy' ? 'BUY' : 'SELL',
    o.order_type,
    formatPrice(o.safe_price),
    formatPrice(o.filled ?? 0),
    o.ft_order_tag || '—',
    o.order_timestamp ? timestampmsWithTimezone(o.order_timestamp, tz) : '—',
  ]);

  // Fixed column widths (px) generous for any content
  const colWidths = [32, 56, 64, 96, 96, 160, 200];
  const totalW = colWidths.reduce((a, b) => a + b, 0) + padX * 2;
  const totalH = padY * 2 + headerH + rows.length * rowH;

  canvas.width = totalW * 2;
  canvas.height = totalH * 2;
  ctx.scale(2, 2);

  const bg = '#1a1b26';
  const textColor = '#c0caf5';
  const mutedColor = '#565f89';
  const borderColor = '#3b414d';
  const green = '#3fb950';
  const red = '#f85149';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, totalW, totalH);

  // Header
  const headerY = padY + headerH / 2;
  let x = padX;
  headers.forEach((h, i) => {
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = mutedColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(h, x, headerY);
    x += colWidths[i];
  });

  // Divider
  ctx.strokeStyle = borderColor;
  ctx.beginPath();
  ctx.moveTo(padX, padY + headerH);
  ctx.lineTo(totalW - padX, padY + headerH);
  ctx.stroke();

  // Rows
  rows.forEach((vals, ri) => {
    const rowY = padY + headerH + 6 + (ri + 1) * rowH;
    let dx = padX;

    // # (left, muted)
    ctx.font = '12px monospace';
    ctx.fillStyle = mutedColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(vals[0], dx, rowY);
    dx += colWidths[0];

    // Side (left, colored)
    ctx.fillStyle = trade.orders[ri].ft_order_side === 'buy' ? green : red;
    ctx.fillText(vals[1], dx, rowY);
    dx += colWidths[1];

    // Type (left)
    ctx.fillStyle = textColor;
    ctx.fillText(vals[2], dx, rowY);
    dx += colWidths[2];

    // Price (left)
    ctx.fillText(vals[3], dx, rowY);
    dx += colWidths[3];

    // Filled (left)
    ctx.fillText(vals[4], dx, rowY);
    dx += colWidths[4];

    // Tag (left)
    ctx.fillText(vals[5], dx, rowY);
    dx += colWidths[5];

    // Date (left)
    ctx.fillText(vals[6], dx, rowY);
    // no need to advance after last
  });

  // Download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${trade.pair || 'trade'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
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
      <details v-if="trade.orders?.length">
        <summary>
          Orders <span class="text-xs opacity-60">[{{ trade.orders.length }}]</span>
        </summary>
        <div class="flex items-center gap-2 px-2 pt-2 pb-1">
          <button
            class="text-xs flex items-center gap-1 px-2 py-0.5 rounded transition-all cursor-pointer hover:brightness-125"
            :style="{ color: 'var(--p-primary-color)', border: '1px solid var(--p-primary-color)', background: 'color-mix(in srgb, var(--p-primary-color) 10%, transparent)' }"
            title="Copy orders table"
            @click="copyOrders(trade)"
          >
            <i-mdi-content-copy class="text-sm" /> Copy
          </button>
          <button
            class="text-xs flex items-center gap-1 px-2 py-0.5 rounded transition-all cursor-pointer hover:brightness-125"
            :style="{ color: 'var(--p-primary-color)', border: '1px solid var(--p-primary-color)', background: 'color-mix(in srgb, var(--p-primary-color) 10%, transparent)' }"
            title="Screenshot orders table"
            @click="screenshotOrders(trade)"
          >
            <i-mdi-download-box-outline class="text-sm" /> Screenshot
          </button>
          <span class="flex-1" />
          <InputText
            v-model="orderSearch"
            size="small"
            placeholder="Search orders…"
            class="max-w-[14rem]"
            :pt="{ root: { class: 'text-xs py-1 px-2' } }"
          />
        </div>
        <DataTable :value="filteredOrders ?? trade.orders" size="small" class="ft-metric-table" striped-rows>
          <Column field="idx" header="#">
            <template #body="{ data, index }">{{ index + 1 }}</template>
          </Column>
          <Column field="ft_order_side" header="Side">
            <template #body="{ data }">
              <span :class="data.ft_order_side === 'buy' ? 'text-profit' : 'text-loss'">
                {{ data.ft_order_side === 'buy' ? 'BUY' : 'SELL' }}
              </span>
            </template>
          </Column>
          <Column field="order_type" header="Type" />
          <Column field="safe_price" header="Price" />
          <Column field="filled" header="Filled" />
          <Column field="ft_order_tag" header="Tag" />
          <Column header="Date">
            <template #body="{ data }">
              <span class="text-muted whitespace-nowrap">{{ data.order_timestamp ? timestampmsWithTimezone(data.order_timestamp, settingsStore.timezone) : '—' }}</span>
            </template>
          </Column>
        </DataTable>
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
  background: color-mix(in srgb, var(--ft-panel-strong) 58%, transparent);
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
  font-family: var(--ft-font-sans);
  font-variant-numeric: tabular-nums;
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
}
</style>

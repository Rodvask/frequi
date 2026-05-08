<script setup lang="ts">
const botStore = useBotStore();

const botState = computed(() => botStore.activeBot.botState);
const botProfit = computed(() => botStore.activeBot.profit);

const runStateTone = computed(() => {
  const state = `${botState.value?.state ?? ''}`.toLowerCase();

  if (state.includes('run')) {
    return 'profit';
  }

  if (state.includes('stop')) {
    return 'warning';
  }

  return 'neutral';
});

const runModeTone = computed(() => (botState.value?.dry_run ? 'warning' : 'profit'));

const stakeLabel = computed(() => {
  const state = botState.value;

  if (!state) {
    return '';
  }

  return `${state.max_open_trades}x${state.stake_amount} ${state.stake_currency}`;
});

const marketLabel = computed(() => {
  const state = botState.value;

  if (!state) {
    return '';
  }

  const marginMode = state.trading_mode !== 'spot' ? state.margin_mode : undefined;

  return [state.trading_mode || 'spot', marginMode].filter(Boolean).join(' ');
});
</script>

<template>
  <div v-if="botState" class="ft-bot-status">
    <section class="ft-bot-status-hero">
      <div>
        <span class="ft-bot-status-eyebrow">Bot status</span>
        <h2>Freqtrade {{ botStore.activeBot.version }}</h2>
        <p>{{ botState.strategy }}</p>
      </div>
      <div class="ft-bot-status-badges">
        <span class="ft-status-badge" :class="`ft-status-badge-${runStateTone}`">
          {{ botState.state }}
        </span>
        <span class="ft-status-badge" :class="`ft-status-badge-${runModeTone}`">
          {{ botState.dry_run ? 'Dry-Run' : 'Live' }}
        </span>
      </div>
    </section>

    <section class="ft-bot-status-grid">
      <article class="ft-bot-status-item">
        <span>Stake setup</span>
        <strong>{{ stakeLabel }}</strong>
      </article>
      <article class="ft-bot-status-item">
        <span>Exchange</span>
        <strong>{{ botState.exchange }} {{ botState.demo_trading ? '(Demo)' : '' }}</strong>
      </article>
      <article class="ft-bot-status-item">
        <span>Market mode</span>
        <strong>{{ marketLabel }}</strong>
      </article>
      <article class="ft-bot-status-item">
        <span>Force entry</span>
        <strong>{{ botState.force_entry_enable ? 'Enabled' : 'Disabled' }}</strong>
      </article>
    </section>

    <section class="ft-bot-status-grid ft-bot-status-grid-compact">
      <article v-if="'stoploss_on_exchange' in botState" class="ft-bot-status-item">
        <span>Stoploss on exchange</span>
        <strong>{{ botState.stoploss_on_exchange ? 'Enabled' : 'Disabled' }}</strong>
      </article>
      <article v-if="botProfit" class="ft-bot-status-item">
        <span>Avg profit</span>
        <strong>{{ formatPercent(botProfit.profit_all_ratio_mean) }}</strong>
        <small>Total ratio {{ formatPercent(botProfit.profit_all_ratio_sum) }}</small>
      </article>
      <article v-if="botProfit" class="ft-bot-status-item">
        <span>Trades</span>
        <strong>{{ botProfit.trade_count }}</strong>
        <small>Avg duration {{ botProfit.avg_duration }}</small>
      </article>
      <article v-if="botProfit?.best_pair" class="ft-bot-status-item">
        <span>Best pair</span>
        <strong>{{ botProfit.best_pair }}</strong>
      </article>
      <article v-if="botProfit?.profit_factor" class="ft-bot-status-item">
        <span>Profit factor</span>
        <strong>{{ formatNumber(botProfit.profit_factor, 2) }}</strong>
      </article>
      <article v-if="botProfit?.trading_volume" class="ft-bot-status-item">
        <span>Trading volume</span>
        <strong>
          {{
            formatPriceCurrency(
              botProfit.trading_volume,
              botState.stake_currency,
              botState.stake_currency_decimals ?? 3,
            )
          }}
        </strong>
      </article>
    </section>

    <section v-if="botProfit?.first_trade_timestamp" class="ft-bot-status-timeline">
      <div v-if="botProfit.bot_start_timestamp">
        <span>Bot start</span>
        <strong><DateTimeTZ :date="botProfit.bot_start_timestamp" show-timezone /></strong>
      </div>
      <div>
        <span>First trade</span>
        <strong><DateTimeTZ :date="botProfit.first_trade_timestamp" show-timezone /></strong>
      </div>
      <div>
        <span>Last trade</span>
        <strong><DateTimeTZ :date="botProfit.latest_trade_timestamp" show-timezone /></strong>
      </div>
    </section>

    <Panel
      v-if="botStore.activeBot.strategy?.params"
      header="Strategy parameters"
      toggleable
      collapsed
      class="ft-bot-status-panel"
    >
      <StrategyParameters :strategy="botStore.activeBot.strategy" />
    </Panel>
    <BotProfit
      class="ft-bot-status-profit"
      v-if="botStore.activeBot.profitAll"
      :profit-all="botStore.activeBot.profitAll"
      :stake-currency="botState.stake_currency ?? 'USDT'"
      :stake-currency-decimals="botState.stake_currency_decimals ?? 3"
    />
  </div>
</template>

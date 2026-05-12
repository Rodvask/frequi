<script setup lang="ts">
import type { Trade, BotFeatures } from '@/types';

withDefaults(
  defineProps<{
    botFeatures: BotFeatures;
    trade: Trade;
    enableForceEntry?: boolean;
  }>(),
  {
    enableForceEntry: false,
  },
);
defineEmits<{
  forceExit: [trade: Trade, type?: 'limit' | 'market'];
  forceExitPartial: [trade: Trade];
  cancelOpenOrder: [trade: Trade];
  reloadTrade: [trade: Trade];
  deleteTrade: [trade: Trade];
  forceEntry: [trade: Trade];
}>();
</script>

<template>
  <div class="ft-trade-actions-list">
    <span class="ft-trade-actions-section">Exit</span>
    <Button
      v-if="!botFeatures.forceExitParams"
      class="ft-trade-action-item ft-trade-action-danger"
      size="small"
      severity="secondary"
      title="Force exit"
      label="Force exit"
      @click="$emit('forceExit', trade)"
    >
      <template #icon>
        <i-mdi-close-box />
      </template>
    </Button>
    <Button
      v-if="botFeatures.forceExitParams"
      size="small"
      class="ft-trade-action-item ft-trade-action-danger"
      severity="secondary"
      title="Force exit limit"
      label="Force exit limit"
      @click="$emit('forceExit', trade, 'limit')"
    >
      <template #icon>
        <i-mdi-close-box />
      </template>
    </Button>
    <Button
      v-if="botFeatures.forceExitParams"
      class="ft-trade-action-item ft-trade-action-danger"
      size="small"
      severity="secondary"
      title="Force exit market"
      label="Force exit market"
      @click="$emit('forceExit', trade, 'market')"
    >
      <template #icon>
        <i-mdi-close-box />
      </template>
    </Button>
    <Button
      v-if="botFeatures.forceEntryTag"
      class="ft-trade-action-item ft-trade-action-warning"
      size="small"
      severity="secondary"
      title="Force exit partial"
      label="Force exit partial"
      @click="$emit('forceExitPartial', trade)"
    >
      <template #icon>
        <i-mdi-close-box-multiple />
      </template>
    </Button>
    <span
      v-if="
        (botFeatures.cancelOpenOrders && (trade.open_order_id || trade.has_open_orders)) ||
        enableForceEntry
      "
      class="ft-trade-actions-section"
      >Position</span
    >
    <Button
      v-if="botFeatures.cancelOpenOrders && (trade.open_order_id || trade.has_open_orders)"
      class="ft-trade-action-item ft-trade-action-warning"
      size="small"
      severity="secondary"
      title="Cancel open orders"
      label="Cancel open orders"
      @click="$emit('cancelOpenOrder', trade)"
    >
      <template #icon>
        <i-mdi-cancel />
      </template>
    </Button>
    <Button
      v-if="enableForceEntry"
      class="ft-trade-action-item ft-trade-action-accent"
      size="small"
      severity="secondary"
      title="Increase position"
      label="Increase position"
      @click="$emit('forceEntry', trade)"
    >
      <template #icon>
        <i-mdi-plus-box-multiple-outline />
      </template>
    </Button>
    <span v-if="botFeatures.reloadTrade" class="ft-trade-actions-section">Maintenance</span>
    <Button
      v-if="botFeatures.reloadTrade"
      class="ft-trade-action-item"
      size="small"
      severity="secondary"
      title="Reload"
      label="Reload"
      @click="$emit('reloadTrade', trade)"
    >
      <template #icon><i-mdi-reload-alert /> </template>
    </Button>
    <span class="ft-trade-actions-section">Danger zone</span>
    <Button
      class="ft-trade-action-item ft-trade-action-danger"
      size="small"
      severity="secondary"
      title="Delete trade"
      label="Delete trade"
      @click="$emit('deleteTrade', trade)"
    >
      <template #icon>
        <i-mdi-delete />
      </template>
    </Button>
  </div>
</template>

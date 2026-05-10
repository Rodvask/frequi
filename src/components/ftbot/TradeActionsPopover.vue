<script setup lang="ts">
import type { Trade } from '@/types';
import type { BotFeatures } from '@/types/features';
import Popover from 'primevue/popover';

withDefaults(
  defineProps<{
    trade: Trade;
    id: number;
    botFeatures: BotFeatures;
    enableForceEntry?: boolean;
  }>(),
  {
    enableForceEntry: false,
  },
);
const emit = defineEmits<{
  forceExit: [trade: Trade, type?: string];
  forceExitPartial: [trade: Trade];
  cancelOpenOrder: [trade: Trade];
  reloadTrade: [trade: Trade];
  deleteTrade: [trade: Trade];
  forceEntry: [trade: Trade];
}>();
const popoverOpen = ref(false);

function forceExitHandler(item: Trade, ordertype: string | undefined = undefined) {
  popoverOpen.value = false;
  emit('forceExit', item, ordertype);
}
function forceExitPartialHandler(item: Trade) {
  popoverOpen.value = false;
  emit('forceExitPartial', item);
}
function cancelOpenOrderHandler(item: Trade) {
  popoverOpen.value = false;
  emit('cancelOpenOrder', item);
}
function handleReloadTrade(item: Trade) {
  popoverOpen.value = false;
  emit('reloadTrade', item);
}
function handleDeleteTrade(item: Trade) {
  popoverOpen.value = false;
  emit('deleteTrade', item);
}
function handleForceEntry(item: Trade) {
  popoverOpen.value = false;
  emit('forceEntry', item);
}
const popover = ref<InstanceType<typeof Popover> | null>(null);
</script>

<template>
  <div>
    <Button
      :id="`btn-actions-${id}`"
      class="ft-trade-actions-trigger"
      size="small"
      severity="secondary"
      title="Trade actions"
      aria-label="Trade actions"
      @click="popover?.toggle"
    >
      <i-mdi-gesture-tap />
    </Button>
    <Popover
      ref="popover"
      class="ft-trade-actions-popover"
      :target="`btn-actions-${id}`"
      :title="`Actions for ${trade.pair}`"
      triggers="manual"
      placement="left"
    >
      <header class="ft-trade-actions-header">
        <span>Trade actions</span>
        <strong>{{ trade.pair }}</strong>
        <small>#{{ trade.trade_id }}</small>
      </header>
      <TradeActions
        :trade="trade"
        :bot-features="botFeatures"
        :enable-force-entry="enableForceEntry"
        @force-exit="forceExitHandler"
        @force-exit-partial="forceExitPartialHandler"
        @delete-trade="handleDeleteTrade(trade)"
        @cancel-open-order="cancelOpenOrderHandler"
        @reload-trade="handleReloadTrade"
        @force-entry="handleForceEntry"
      />
      <Button
        class="ft-trade-action-item ft-trade-action-muted mt-1 w-full"
        size="small"
        severity="secondary"
        label="Close menu"
        @click="popover?.hide"
      >
        <template #icon><i-mdi-cancel class="me-1" /></template>
      </Button>
    </Popover>
  </div>
</template>

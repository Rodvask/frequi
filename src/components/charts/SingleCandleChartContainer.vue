<script setup lang="ts">
import type { ChartSliderPosition, PairHistory, Trade } from '@/types';
import { LoadingStatus } from '@/types';

import TradingViewCandleChart from './TradingViewCandleChart.vue';

const props = withDefaults(
  defineProps<{
    trades?: Trade[];
    availablePairs: string[];
    timeframe: string;
    historicView?: boolean;
    pair?: string;
    sliderPosition?: ChartSliderPosition;
    isSinglePairView?: boolean;
  }>(),
  {
    trades: () => [],
    historicView: false,
    pair: '',
    sliderPosition: undefined,
    isSinglePairView: true,
  },
);

const emit = defineEmits<{
  refreshData: [pair: string, columns: string[]];
}>();

const settingsStore = useSettingsStore();
const colorStore = useColorStore();
const botStore = useBotStore();
const plotStore = usePlotConfigStore();

const dataset = computed((): PairHistory => {
  if (props.historicView) {
    return botStore.activeBot.history[`${props.pair}__${props.timeframe}`]?.data;
  }
  return botStore.activeBot.candleData[`${props.pair}__${props.timeframe}`]?.data;
});

const datasetColumns = computed(() =>
  dataset.value ? (dataset.value.all_columns ?? dataset.value.columns) : [],
);
const datasetLoadedColumns = computed(() =>
  dataset.value ? (dataset.value.columns ?? dataset.value.all_columns) : [],
);

const hasDataset = computed(() => dataset.value && dataset.value.data.length > 0);
const isLoadingDataset = computed((): boolean => {
  if (props.historicView) {
    return botStore.activeBot.historyStatus === LoadingStatus.loading;
  }

  return botStore.activeBot.candleDataStatus === LoadingStatus.loading;
});
const noDatasetText = computed((): string => {
  const status = props.historicView
    ? botStore.activeBot.historyStatus
    : botStore.activeBot.candleDataStatus;

  switch (status) {
    case LoadingStatus.not_loaded:
      return 'Not loaded yet.';
    case LoadingStatus.loading:
      return 'Loading...';
    case LoadingStatus.success:
      return 'No data available';
    case LoadingStatus.error:
      return 'Failed to load data';
    default:
      return 'Unknown';
  }
});
function refresh() {
  emit('refreshData', props.pair, plotStore.usedColumns);
}

function refreshIfNecessary() {
  if (!hasDataset.value) {
    refresh();
  }
}

function assignFirstPair() {
  const [firstPair] = props.availablePairs;
  if (firstPair) {
    //props.pair = firstPair;
  }
}

watch(
  () => props.availablePairs,
  () => {
    if (!props.availablePairs.find((p) => p === props.pair)) {
      assignFirstPair();
      refresh();
    }
  },
);

watch(
  () => plotStore.plotConfig,
  () => {
    // Trigger reload if the used columns are not loaded yet but would be available.
    const hasAllColumns = plotStore.usedColumns.some(
      (c) => datasetColumns.value.includes(c) && !datasetLoadedColumns.value.includes(c),
    );

    if (settingsStore.useReducedPairCalls && hasAllColumns) {
      refresh();
    }
  },
);

watch(
  () => props.timeframe,
  () => {
    refreshIfNecessary();
  },
);
</script>

<template>
  <div
    class="flex-fill w-full flex-col align-items-stretch flex"
    :class="{
      'h-full': isSinglePairView,
      'h-150 border border-r border-b border-surface-300 dark:border-surface-700':
        !isSinglePairView,
    }"
  >
    <div class="flex me-0 w-full items-center justify-between">
      <div class="ms-1 md:ms-2 flex flex-wrap md:flex-nowrap items-center gap-1">
        <div v-if="dataset" class="ft-chart-signal-summary">
          <span title="Long entry signals">
            <i-mdi-arrow-up-bold />
            Long in <b>{{ dataset.enter_long_signals || dataset.buy_signals || 0 }}</b>
          </span>
          <span title="Long exit signals">
            <i-mdi-circle-outline />
            Long out <b>{{ dataset.exit_long_signals || dataset.sell_signals || 0 }}</b>
          </span>
          <span v-if="dataset.enter_short_signals" title="Short entry signals">
            <i-mdi-arrow-down-bold />
            Short in <b>{{ dataset.enter_short_signals }}</b>
          </span>
          <span v-if="dataset.exit_short_signals" title="Short exit signals">
            <i-mdi-circle-outline />
            Short out <b>{{ dataset.exit_short_signals }}</b>
          </span>
        </div>
      </div>
      <div>
        {{ pair || 'Pair' }}
      </div>
      <div v-if="isLoadingDataset">
        <ProgressSpinner class="w-4 h-4" stroke-width="4" small label="Spinning" />
      </div>
      <div v-else class="w-4 h-4"></div>
    </div>
    <div class="h-full flex">
      <div class="min-w-0 w-full flex-1">
        <TradingViewCandleChart
          v-if="hasDataset"
          :dataset="dataset"
          :trades="trades"
          :plot-config="plotStore.plotConfig"
          :heikin-ashi="settingsStore.useHeikinAshiCandles"
          :color-up="colorStore.colorUp"
          :color-down="colorStore.colorDown"
          :start-candle-count="settingsStore.chartDefaultCandleCount"
        />
        <div v-else class="m-auto">
          <ProgressSpinner v-if="isLoadingDataset" class="w-5 h-5" label="Spinning" />
          <div v-else class="text-lg">
            {{ noDatasetText }}
          </div>
          <p v-if="botStore.activeBot.historyTakesLonger">
            This is taking longer than expected ... Hold on ...
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ft-chart-signal-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
}

.ft-chart-signal-summary span {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  min-height: 1.45rem;
  padding: 0.1rem 0.45rem;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 0.35rem;
  background: rgba(8, 13, 26, 0.72);
  color: var(--ft-text-muted);
  font-size: 0.74rem;
  font-weight: 760;
  line-height: 1;
  white-space: nowrap;
}

.ft-chart-signal-summary svg {
  width: 0.82rem;
  height: 0.82rem;
  color: var(--p-primary-color);
}

.ft-chart-signal-summary b {
  color: var(--ft-text);
}
</style>

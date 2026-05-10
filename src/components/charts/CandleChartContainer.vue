<script setup lang="ts">
import type { ChartSliderPosition, PairHistory, Trade } from '@/types';

const props = withDefaults(
  defineProps<{
    trades?: Trade[];
    availablePairs: string[];
    timeframe: string;
    historicView?: boolean;
    /** Reload data on pair switch if in historic view */
    reloadDataOnSwitch?: boolean;
    strategy?: string;
    sliderPosition?: ChartSliderPosition;
  }>(),
  {
    trades: () => [],
    historicView: false,
    reloadDataOnSwitch: false,
    strategy: '',
    sliderPosition: undefined,
  },
);

const emit = defineEmits<{
  refreshData: [pair: string, columns: string[]];
}>();

const settingsStore = useSettingsStore();
const botStore = useBotStore();
const plotStore = usePlotConfigStore();

const dataset = computed((): PairHistory => {
  const firstpair = botStore.activeBot.plotMultiPairs[0];
  if (props.historicView) {
    return botStore.activeBot.history[`${firstpair}__${props.timeframe}`]?.data;
  }
  return botStore.activeBot.candleData[`${firstpair}__${props.timeframe}`]?.data;
});

const datasetColumns = computed(() =>
  dataset.value ? (dataset.value.all_columns ?? dataset.value.columns) : [],
);

const strategyName = computed(() => props.strategy || dataset.value?.strategy || '');

const showPlotConfigModal = ref(false);
function showConfigurator() {
  showPlotConfigModal.value = !showPlotConfigModal.value;
}

const isSinglePairView = computed(() => botStore.activeBot.plotMultiPairs.length === 1);

watch(
  () => botStore.activeBot.selectedPair,
  () => {
    botStore.activeBot.plotMultiPairs = [botStore.activeBot.selectedPair];
  },
);

onMounted(() => {
  if (botStore.activeBot.selectedPair) {
    botStore.activeBot.plotMultiPairs = [botStore.activeBot.selectedPair];
  } else if (props.availablePairs.length > 0) {
    assignFirstPair();
  }
  plotStore.plotConfigChanged();
});

function refresh() {
  for (const pair of botStore.activeBot.plotMultiPairs) {
    emit('refreshData', pair, plotStore.usedColumns);
  }
}

function refreshIfNecessary(newValue: string[], oldValue: string[] | undefined) {
  for (const pair of newValue) {
    if (oldValue?.includes(pair)) {
      continue;
    }
    emit('refreshData', pair, plotStore.usedColumns);
  }
}

function assignFirstPair() {
  const [firstPair] = props.availablePairs;
  if (firstPair) {
    botStore.activeBot.plotMultiPairs = [firstPair];
  }
}

watch(
  () => props.availablePairs,
  () => {
    if (
      botStore.activeBot.plotMultiPairs.length === 0 ||
      botStore.activeBot.plotMultiPairs.some((p) => !props.availablePairs.includes(p))
    ) {
      assignFirstPair();
      refresh();
    }
  },
);

watch(
  () => botStore.activeBot.plotMultiPairs,
  (newValue, oldValue) => {
    if (newValue.length === 0) return;

    if (!props.historicView || props.reloadDataOnSwitch) {
      refreshIfNecessary(newValue, oldValue);
    }
  },
  {
    immediate: true,
  },
);

watch(
  () => settingsStore.multiPairSelection,
  () => {
    if (
      !settingsStore.multiPairSelection &&
      botStore.activeBot.plotMultiPairs.length > 1 &&
      botStore.activeBot.plotMultiPairs[0]
    ) {
      // Select only the first pair if switching to single pair mode
      botStore.activeBot.plotMultiPairs = [botStore.activeBot.plotMultiPairs[0]];
    }
  },
);

const singlePairSelection = computed({
  get() {
    return botStore.activeBot.plotMultiPairs[0] || '';
  },
  set(value: string) {
    botStore.activeBot.plotMultiPairs = [value];
  },
});
</script>

<template>
  <div class="flex h-full">
    <div class="flex-fill w-full flex-col align-items-stretch flex h-full">
      <div class="ft-chart-toolbar flex me-0 items-center md:gap-2">
        <span class="ft-chart-meta md:ms-2 text-nowrap">{{ strategyName }} | {{ timeframe || '' }}</span>
        <MultiSelect
          v-if="settingsStore.multiPairSelection"
          v-model="botStore.activeBot.plotMultiPairs"
          class="ft-chart-pair-select w-80"
          :options="availablePairs"
          optionlabel=""
          placeholder="Select pairs to plot"
          size="small"
          filter
        >
        </MultiSelect>
        <Select
          v-else
          v-model="singlePairSelection"
          class="ft-chart-pair-select w-80"
          :options="availablePairs"
          size="small"
          :clearable="false"
          @input="refresh"
        >
        </Select>

        <Button
          class="ft-chart-icon-button"
          title="Refresh chart"
          severity="secondary"
          :disabled="botStore.activeBot.plotMultiPairs.length === 0"
          size="small"
          @click="refresh"
        >
          <i-mdi-refresh />
        </Button>
        <BaseCheckbox
          v-model="settingsStore.multiPairSelection"
          class="ft-chart-toggle"
          title="Show more than one pair in the chart."
        >
          <span class="text-nowrap">
            <span class="hidden md:inline">Multi pair</span>
            <span class="md:hidden">Multi</span>
          </span>
        </BaseCheckbox>
        <div class="ft-chart-options ms-auto flex items-center gap-2">
          <BaseCheckbox
            v-model="settingsStore.showMarkArea"
            class="ft-chart-toggle"
            title="Show or hide strategy chart areas and annotations."
          >
            <span class="text-nowrap">
              <span class="hidden md:inline">Chart Areas</span>
              <span class="md:hidden">Areas</span>
            </span>
          </BaseCheckbox>
          <BaseCheckbox
            v-model="settingsStore.useHeikinAshiCandles"
            class="ft-chart-toggle"
            title="Use Heikin Ashi candles."
          >
            <span class="text-nowrap">
              <span class="hidden md:inline">Heikin Ashi</span>
              <span class="md:hidden">Heikin</span>
            </span>
          </BaseCheckbox>

          <PlotConfigSelect></PlotConfigSelect>

          <div class="me-0 md:me-1">
            <Button
              size="small"
              title="Plot configurator"
              severity="secondary"
              @click="showConfigurator"
            >
              <template #icon>
                <i-mdi-cog width="12" height="12" />
              </template>
            </Button>
          </div>
        </div>
      </div>
      <div
        v-if="botStore.activeBot.plotMultiPairs?.length > 0"
        :class="{
          'min-w-0 w-full h-full ': isSinglePairView,
          'grid grid-cols-1 lg:grid-cols-2': !isSinglePairView,
        }"
      >
        <SingleCandleChartContainer
          v-for="pair in botStore.activeBot.plotMultiPairs"
          :key="pair"
          :available-pairs="availablePairs"
          :pair="pair"
          :historic-view="botStore.activeBot.isWebserverMode"
          :timeframe="timeframe"
          :trades="props.trades"
          :slider-position="props.sliderPosition"
          :is-single-pair-view="isSinglePairView"
          @refresh-data="refresh()"
        >
        </SingleCandleChartContainer>
      </div>
      <div v-else class="flex flex-col items-center justify-center h-full w-full">
        <span class="text-2xl font-semibold">No pair selected</span>
      </div>
    </div>
    <Dialog
      id="plotConfiguratorModal"
      v-model:visible="showPlotConfigModal"
      header="Plot Configurator"
      ok-only
      hide-backdrop
    >
      <PlotConfigurator :is-visible="showPlotConfigModal" :columns="datasetColumns" />
    </Dialog>
  </div>
</template>

<style scoped>
.ft-chart-toolbar {
  gap: 0.35rem;
  min-width: 0;
}

.ft-chart-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ft-chart-pair-select {
  min-width: 12rem;
  max-width: 20rem;
}

.ft-chart-icon-button {
  flex: 0 0 auto;
}

.ft-chart-options {
  min-width: 0;
}

@media (max-width: 768px) {
  .ft-chart-toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 0.3rem;
    align-items: center;
    padding: 0.25rem 0.25rem 0.35rem;
  }

  .ft-chart-meta {
    grid-column: 1 / -1;
    max-width: 100%;
    font-size: 0.72rem;
    font-weight: 750;
    line-height: 1.1;
  }

  .ft-chart-pair-select {
    grid-column: 1 / 2;
    width: 100% !important;
    min-width: 0;
  }

  .ft-chart-icon-button {
    width: 2rem;
    height: 2rem;
    padding: 0;
  }

  .ft-chart-toggle {
    font-size: 0.72rem;
    font-weight: 750;
  }

  .ft-chart-options {
    grid-column: 1 / -1;
    display: flex;
    gap: 0.35rem;
    align-items: center;
    width: 100%;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .ft-chart-options::-webkit-scrollbar {
    display: none;
  }

  .ft-chart-options :deep(.p-select),
  .ft-chart-options :deep(.p-button) {
    flex: 0 0 auto;
  }
}
</style>

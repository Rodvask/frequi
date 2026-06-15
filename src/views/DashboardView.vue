<script setup lang="ts">
import type { GridItemData } from '@/types';

const botStore = useBotStore();

const layoutStore = useLayoutStore();
const currentBreakpoint = ref('');

function breakpointChanged(newBreakpoint: string) {
  // console.log('breakpoint:', newBreakpoint);
  currentBreakpoint.value = newBreakpoint;
}
const isResizableLayout = computed(() =>
  ['', 'sm', 'md', 'lg', 'xl'].includes(currentBreakpoint.value),
);
const isLayoutLocked = computed(() => {
  return layoutStore.layoutLocked || !isResizableLayout.value;
});
const isCompactLayout = computed(() => ['xs', 'xxs'].includes(currentBreakpoint.value));
const dashboardMargin = computed<[number, number]>(() =>
  isCompactLayout.value ? [8, 10] : [10, 10],
);
const dashboardRowHeight = computed(() => (isCompactLayout.value ? 46 : 48));

const rawGridLayoutData = computed((): GridItemData[] => {
  if (isResizableLayout.value) {
    return layoutStore.dashboardLayout;
  }
  return [...layoutStore.getDashboardLayoutSm];
});

function overlapsColumn(item: GridItemData, reference: GridItemData): boolean {
  return item.x < reference.x + reference.w && item.x + item.w > reference.x;
}

const dashboardPanelIds = new Set([
  DashboardLayout.botComparison,
  DashboardLayout.dailyChart,
  DashboardLayout.allOpenTrades,
  DashboardLayout.cumChartChart,
]);

function operationalDashboardLayout(layout: GridItemData[]): GridItemData[] {
  const closedTradesPanel = layout.find((item) => item.i === DashboardLayout.allClosedTrades);

  const visibleLayout = layout.filter((item) => dashboardPanelIds.has(item.i));

  if (!closedTradesPanel) {
    return visibleLayout;
  }

  return visibleLayout.map((item) => {
    const shouldMoveUp =
      item.y >= closedTradesPanel.y + closedTradesPanel.h &&
      overlapsColumn(item, closedTradesPanel);

    return shouldMoveUp ? { ...item, y: item.y - closedTradesPanel.h } : item;
  });
}

const gridLayoutData = computed((): GridItemData[] =>
  operationalDashboardLayout(rawGridLayoutData.value),
);

function layoutUpdatedEvent(newLayout) {
  if (isResizableLayout.value) {
    const hiddenItems = rawGridLayoutData.value.filter(
      (item) => !newLayout.some((visibleItem) => visibleItem.i === item.i),
    );

    console.log('newlayout', [...newLayout, ...hiddenItems]);
    console.log('saving dashboard');
    layoutStore.dashboardLayout = [...newLayout, ...hiddenItems];
  }
}

const gridLayoutDaily = computed((): GridItemData => {
  return findGridLayout(gridLayoutData.value, DashboardLayout.dailyChart);
});

const gridLayoutBotComparison = computed((): GridItemData => {
  return findGridLayout(gridLayoutData.value, DashboardLayout.botComparison);
});

const gridLayoutAllOpenTrades = computed((): GridItemData => {
  return findGridLayout(gridLayoutData.value, DashboardLayout.allOpenTrades);
});

const gridLayoutCumChart = computed((): GridItemData => {
  return findGridLayout(gridLayoutData.value, DashboardLayout.cumChartChart);
});

const responsiveGridLayouts = computed(() => {
  return {
    sm: operationalDashboardLayout(layoutStore.getDashboardLayoutSm),
  };
});

onMounted(async () => {
  botStore.allGetDaily({ timescale: 30 });
  // botStore.activeBot.getTrades();
  botStore.activeBot.getOpenTrades();
  botStore.activeBot.getProfit();
});
</script>

<template>
  <GridLayout
    class="ft-dashboard-grid h-full w-full"
    :row-height="dashboardRowHeight"
    :layout="gridLayoutData"
    :vertical-compact="false"
    :margin="dashboardMargin"
    :responsive-layouts="responsiveGridLayouts"
    :is-resizable="!isLayoutLocked"
    :is-draggable="!isLayoutLocked"
    :responsive="true"
    :prevent-collision="true"
    :cols="{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }"
    :col-num="12"
    @layout-updated="layoutUpdatedEvent"
    @update:breakpoint="breakpointChanged"
  >
    <template #default="{ gridItemProps }">
      <GridItem
        v-bind="gridItemProps"
        :i="gridLayoutDaily.i"
        :x="gridLayoutDaily.x"
        :y="gridLayoutDaily.y"
        :w="gridLayoutDaily.w"
        :h="gridLayoutDaily.h"
        :min-w="3"
        :min-h="4"
        drag-allow-from=".drag-header"
      >
        <DraggableContainer :header="`Profit over time ${botStore.botCount > 1 ? 'combined' : ''}`">
          <PeriodBreakdown multi-bot-view />
        </DraggableContainer>
      </GridItem>
      <GridItem
        v-bind="gridItemProps"
        :i="gridLayoutBotComparison.i"
        :x="gridLayoutBotComparison.x"
        :y="gridLayoutBotComparison.y"
        :w="gridLayoutBotComparison.w"
        :h="gridLayoutBotComparison.h"
        :min-w="3"
        :min-h="4"
        drag-allow-from=".drag-header"
      >
        <DraggableContainer header="Bot comparison">
          <BotComparisonList />
        </DraggableContainer>
      </GridItem>
      <GridItem
        v-bind="gridItemProps"
        :i="gridLayoutAllOpenTrades.i"
        :x="gridLayoutAllOpenTrades.x"
        :y="gridLayoutAllOpenTrades.y"
        :w="gridLayoutAllOpenTrades.w"
        :h="gridLayoutAllOpenTrades.h"
        :min-w="3"
        :min-h="4"
        drag-allow-from=".drag-header"
      >
        <DraggableContainer>
          <template #header>
            <div class="flex justify-center">
              Open Trades
              <InfoBox
                class="ms-2"
                hint="Open trades of all selected bots. Click on a trade to go to the trade page for that trade/bot."
              />
            </div>
          </template>
          <TradeList active-trades :trades="botStore.allOpenTradesSelectedBots" multi-bot-view />
        </DraggableContainer>
      </GridItem>
      <GridItem
        v-bind="gridItemProps"
        :i="gridLayoutCumChart.i"
        :x="gridLayoutCumChart.x"
        :y="gridLayoutCumChart.y"
        :w="gridLayoutCumChart.w"
        :h="gridLayoutCumChart.h"
        :min-w="3"
        :min-h="4"
        drag-allow-from=".drag-header"
      >
        <DraggableContainer class="ft-dashboard-cum-profit-body" header="Cumulative Profit">
          <CumProfitChart
            :trades="botStore.allTradesSelectedBots"
            :open-trades="botStore.allOpenTradesSelectedBots"
            :show-title="false"
          />
        </DraggableContainer>
      </GridItem>
    </template>
  </GridLayout>
</template>

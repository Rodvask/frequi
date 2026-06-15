<script setup lang="ts">
import { useRoute } from 'vue-router';
import { ref, computed } from 'vue';
import IconViewList from '~icons/mdi/view-list';
import IconCompareHorizontal from '~icons/mdi/compare-horizontal';
import IconChartTimelineVariantShimmer from '~icons/mdi/chart-timeline-variant-shimmer';
import IconChartLine from '~icons/mdi/chart-line';
import IconFormatListGroup from '~icons/mdi/format-list-group';

const iconMap: Record<string, any> = {
  'i-mdi-monitor-dashboard': IconViewList,
  'i-mdi-swap-horizontal-circle-outline': IconCompareHorizontal,
  'i-mdi-chart-box-outline': IconChartTimelineVariantShimmer,
  'i-mdi-chart-line': IconChartLine,
  'i-mdi-format-list-bulleted-square': IconFormatListGroup,
};

const botStore = useBotStore();
const route = useRoute();

const isActive = (to: string) =>
  to === '/' ? route.path === to : route.path.startsWith(to) && (route.path.length === to.length || route.path[to.length] === '/');

function iconComp(name: string) {
  return iconMap[name] || null;
}

const tabs = ref([
  { label: 'Dashboard', to: '/dashboard', icon: 'i-mdi-monitor-dashboard', visible: computed(() => !botStore.canRunBacktest) },
  { label: 'Trades', to: '/open_trades', icon: 'i-mdi-swap-horizontal-circle-outline', visible: computed(() => !botStore.canRunBacktest) },
  { label: 'Analytics', to: '/analytics', icon: 'i-mdi-chart-box-outline', visible: computed(() => !botStore.canRunBacktest) },
  { label: 'Chart', to: '/graph', icon: 'i-mdi-chart-line', visible: true },
  { label: 'Logs', to: '/logs', icon: 'i-mdi-format-list-bulleted-square', visible: true },
]);
</script>

<template>
  <footer class="ft-mobile-bottom-nav md:hidden">
    <nav class="ft-mobile-bottom-nav-list">
      <RouterLink
        v-for="tab in tabs.filter((t) => t.visible)"
        :key="tab.to"
        :to="tab.to"
        class="ft-mobile-nav-item"
        :class="{ 'ft-mobile-nav-item-active': isActive(tab.to) }"
      >
        <component :is="iconComp(tab.icon)" class="ft-mobile-nav-icon" />
        <span class="ft-mobile-nav-label">{{ tab.label }}</span>
        <span class="ft-mobile-nav-indicator" />
      </RouterLink>
    </nav>
  </footer>
</template>

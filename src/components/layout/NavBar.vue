<script setup lang="ts">
import Favico from 'favico.js';
import { useRoute } from 'vue-router';
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick, h } from 'vue';
import Menu from 'primevue/menu';
import type { MenuItem } from 'primevue/menuitem';
import { breakpointsTailwind } from '@vueuse/core';

// Explicit icon imports (these are Vue components from unplugin-icons)
import IconViewList from '~icons/mdi/view-list';
import IconCompareHorizontal from '~icons/mdi/compare-horizontal';
import IconFolderClock from '~icons/mdi/folder-clock';
import IconChartTimelineVariantShimmer from '~icons/mdi/chart-timeline-variant-shimmer';
import IconChartLine from '~icons/mdi/chart-line';
import IconFormatListGroup from '~icons/mdi/format-list-group';
import IconCog from '~icons/mdi/cog';
import IconPlay from '~icons/mdi/play';
import IconDownloadBoxOutline from '~icons/mdi/download-box-outline';
import IconHistory from '~icons/mdi/history';
import IconSwapHorizontalCircleOutline from '~icons/mdi/swap-horizontal-circle-outline';
import IconCurrencyUsd from '~icons/mdi/currency-usd';
import IconFormatListText from '~icons/mdi/format-list-text';

const iconMap: Record<string, any> = {
  'i-mdi-view-dashboard-outline': IconViewList,
  'i-mdi-swap-horizontal-circle-outline': IconCompareHorizontal,
  'i-mdi-history': IconFolderClock,
  'i-mdi-chart-box-outline': IconChartTimelineVariantShimmer,
  'i-mdi-chart-line': IconChartLine,
  'i-mdi-text-box-outline': IconFormatListGroup,
  'i-mdi-cog-outline': IconCog,
  'i-mdi-currency-usd': IconCurrencyUsd,
  'i-mdi-download-outline': IconDownloadBoxOutline,
  'i-mdi-format-list-text': IconFormatListText,
};

const botStore = useBotStore();
const settingsStore = useSettingsStore();
const layoutStore = useLayoutStore();
const route = useRoute();
const router = useRouter();
const favicon = ref<Favico | undefined>(undefined);
const pingInterval = ref<number>();
const breakpoints = useBreakpoints(breakpointsTailwind);
const isMobile = breakpoints.smallerOrEqual('md');

async function clickLogout() {
  botStore.removeBot(botStore.selectedBot);
  await router.push('/');
}

const setOpenTradesAsPill = (tradeCount: number) => {
  if (!favicon.value) favicon.value = new Favico({ animation: 'none' });
  if (tradeCount !== 0 && settingsStore.openTradesInTitle === 'showPill') favicon.value.badge(tradeCount);
  else favicon.value.reset();
};

const resetDynamicLayout = (): void => {
  if (route?.fullPath === '/trade') layoutStore.resetTradingLayout();
  else if (route?.fullPath === '/dashboard') layoutStore.resetDashboardLayout();
};

const setTitle = () => {
  let title = 'Freqtrade UI';
  if (settingsStore.openTradesInTitle === OpenTradeVizOptions.asTitle)
    title = `(${botStore.activeBotorUndefined?.openTradeCount}) ${title}`;
  if (botStore.activeBotorUndefined?.botName) title = `${title} - ${botStore.activeBotorUndefined?.botName}`;
  document.title = title;
};

onBeforeUnmount(() => { if (pingInterval.value) clearInterval(pingInterval.value); });

onMounted(async () => {
  await settingsStore.loadUIVersion();
  pingInterval.value = window.setInterval(botStore.pingAll, 60000);
  if (settingsStore.currentTheme) {
    const isDark = ['dark', 'bootstrap_dark'].includes(settingsStore.currentTheme.toLowerCase());
    if (isDark) document.documentElement.classList.add('dark', 'ft-dark-theme');
    else document.documentElement.classList.remove('dark', 'ft-dark-theme');
    isDarkMode.value = isDark;
  }
});

settingsStore.$subscribe((_, state) => {
  if (settingsStore.openTradesInTitle !== state.openTradesInTitle) {
    setTitle();
    setOpenTradesAsPill(botStore.activeBotorUndefined?.openTradeCount || 0);
  }
});

watch(() => botStore.activeBotorUndefined?.botName, () => setTitle());
watch(() => botStore.activeBotorUndefined?.openTradeCount, () => {
  if (settingsStore.openTradesInTitle === OpenTradeVizOptions.showPill)
    setOpenTradesAsPill(botStore.activeBotorUndefined?.openTradeCount ?? 0);
  else if (settingsStore.openTradesInTitle === OpenTradeVizOptions.asTitle) setTitle();
});

const isActive = (to: string) =>
  to === '/' ? route.path === to : route.path.startsWith(to) && (route.path.length === to.length || route.path[to.length] === '/');

function iconComp(name: string) {
  return iconMap[name] || null;
}

const navItems = ref([
  { label: 'Dashboard', to: '/dashboard', visible: computed(() => !botStore.canRunBacktest), icon: 'i-mdi-view-dashboard-outline' },
  { label: 'Trade', to: '/trade', visible: computed(() => !botStore.canRunBacktest), icon: 'i-mdi-swap-horizontal-circle-outline' },
  { label: 'History', to: '/trade_history', visible: computed(() => !botStore.canRunBacktest), icon: 'i-mdi-history' },
  { label: 'Analytics', to: '/analytics', visible: computed(() => !botStore.canRunBacktest), icon: 'i-mdi-chart-box-outline' },
  { label: 'Chart', to: '/graph', icon: 'i-mdi-chart-line' },
  { label: 'Logs', to: '/logs', icon: 'i-mdi-text-box-outline' },
  { label: 'Settings', to: '/settings', mobileOnly: true, icon: 'i-mdi-cog-outline' },
  { label: 'Backtest', to: '/backtest', visible: computed(() => botStore.canRunBacktest), icon: 'i-mdi-currency-usd' },
  { label: 'Download Data', to: '/download_data', visible: computed(() => botStore.isWebserverMode && botStore.activeBot.botFeatures.downloadDataView), icon: 'i-mdi-download-outline' },
  { label: 'Pairlist Config', to: '/pairlist_config', icon: 'i-mdi-format-list-text', visible: computed(() => (botStore.activeBot?.isWebserverMode ?? false) && botStore.activeBot.botFeatures.pairlistConfig) },
]);

const menuItems = computed<MenuItem[]>(() => [
  { label: `v${settingsStore.uiVersion}`, disabled: true },
  { label: 'Settings', icon: 'i-mdi-cog', command: () => router.push('/settings') },
  { label: 'Lock Layout', checkbox: true, checked: layoutStore.layoutLocked, command: () => { layoutStore.layoutLocked = !layoutStore.layoutLocked; } },
  { label: 'Reset Layout', icon: 'i-mdi-lock-reset', command: resetDynamicLayout },
  { label: 'Logout', icon: 'i-mdi-logout', command: clickLogout, visible: botStore.hasBots && botStore.botCount === 1 },
]);

const menu = ref<InstanceType<typeof Menu> | null>();
function toggleMenu(event: Event) { menu.value?.toggle(event); }
const drawerVisible = ref(false);
const isDarkMode = ref(document.documentElement.classList.contains('dark'));

function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  if (isDark) {
    document.documentElement.classList.remove('dark', 'ft-dark-theme');
    settingsStore.currentTheme = 'light';
    isDarkMode.value = false;
  } else {
    document.documentElement.classList.add('dark', 'ft-dark-theme');
    settingsStore.currentTheme = 'dark';
    isDarkMode.value = true;
  }
}
</script>

<template>
  <header>
    <div class="ft-navbar flex items-center border-b px-3">
      <!-- Logo -->
      <RouterLink class="ft-navbar-brand flex items-center gap-2 me-4" exact to="/">
        <img class="h-[26px]" src="@/assets/freqtrade-logo.png" alt="Home" />
        <span class="text-base font-bold tracking-tight hidden sm:block">
          Freqtrade <span :style="{ color: 'var(--p-primary-color)' }">UI</span>
        </span>
      </RouterLink>

      <!-- Desktop nav -->
      <div class="hidden md:flex items-center gap-0.5 flex-1">
        <RouterLink
          v-for="item in navItems.filter((i) => (i.visible ?? true) && !i.mobileOnly)"
          :key="item.to"
          :to="item.to"
          class="ft-nav-link"
          :class="{ 'ft-nav-link-active': isActive(item.to) }"
        >
          <component :is="iconComp(item.icon)" class="text-base shrink-0" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </div>

      <!-- Right side -->
      <div class="flex items-center ms-auto gap-1.5">
        <div v-if="!settingsStore.confirmDialog && !isMobile" class="flex items-center gap-0.5 text-amber-400 text-xs me-1" title="Confirm dialog off">
          <i-mdi-run-fast class="text-sm" />
          <i-mdi-alert class="text-sm" />
        </div>

        <div class="flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg border" :style="{ borderColor: 'var(--ft-panel-border)' }">
          <Select
            v-if="botStore.botCount > 1"
            :model-value="botStore.selectedBotObj"
            size="small"
            no-caret
            :options="botStore.availableBotsSorted"
            @update:model-value="botStore.selectBot($event.botId)"
          >
            <template #value="{ value }"><BotEntry :bot="value" :no-buttons="true" /></template>
            <template #option="{ option }"><BotEntry :bot="option" :no-buttons="true" /></template>
          </Select>
          <ReloadControl />
        </div>

        <div v-if="!isMobile" class="hidden lg:flex items-center gap-1.5 text-sm px-2 py-0.5 rounded-lg" :style="{ color: 'var(--ft-navbar-text)', background: 'color-mix(in srgb, var(--ft-navbar-hover-bg) 50%, transparent)' }">
          <span class="truncate max-w-[100px] opacity-70">{{ botStore.activeBotorUndefined?.botName || 'No bot' }}</span>
          <span v-if="botStore.botCount === 1"
            class="text-xs font-semibold px-1.5 py-0.5 rounded-full"
            :style="{
              color: botStore.activeBotorUndefined?.isBotOnline ? 'var(--color-profit)' : 'var(--color-loss)',
              background: botStore.activeBotorUndefined?.isBotOnline ? 'color-mix(in srgb, var(--color-profit) 15%, transparent)' : 'color-mix(in srgb, var(--color-loss) 15%, transparent)',
            }"
          >
            {{ botStore.activeBotorUndefined?.isBotOnline ? 'Online' : 'Offline' }}
          </span>
        </div>

        <i-mdi-weather-night v-if="isDarkMode" class="nav-icon-btn text-lg p-1.5" title="Toggle theme" @click="toggleTheme" />
        <i-mdi-white-balance-sunny v-else class="nav-icon-btn text-lg p-1.5" title="Toggle theme" @click="toggleTheme" />

        <div v-if="botStore.hasBots" class="flex">
          <button class="nav-icon-btn gap-1.5 px-2" @click="toggleMenu">
            <Avatar label="FT" shape="circle" class="font-bold" :style="{ minWidth: '1.8rem', minHeight: '1.8rem', fontSize: '0.7rem', background: 'color-mix(in srgb, var(--ft-navbar-active) 18%, transparent)', color: 'var(--ft-navbar-active)' }" />
            <i-mdi-chevron-down class="text-xs opacity-50" />
          </button>
          <Menu ref="menu" :model="menuItems" popup class="w-48">
            <template #item="{ item, props }">
              <div v-bind="props" class="flex items-center gap-2.5 px-3 py-1.5 text-sm cursor-pointer" :class="{ 'opacity-50': item.disabled }">
                <i-mdi-cog v-if="item.label === 'Settings'" class="text-lg shrink-0" />
                <i-mdi-lock-reset v-if="item.label === 'Reset Layout'" class="text-lg shrink-0" />
                <i-mdi-logout v-if="item.label === 'Logout'" class="text-lg shrink-0" />
                <BaseCheckbox v-if="item.checkbox" v-model="item.checked" />
                <span>{{ item.label }}</span>
              </div>
            </template>
          </Menu>
        </div>
        <LoginModal v-else-if="route?.path !== '/login'" />

        <button v-if="isMobile" class="nav-icon-btn text-xl" @click="drawerVisible = !drawerVisible">
          <i-mdi-menu />
        </button>
      </div>
    </div>

    <!-- Mobile drawer -->
    <Drawer
      v-model:visible="drawerVisible"
      position="right"
      class="ft-navbar"
      :pt="{
        root: { class: 'border-none' },
        header: { class: 'hidden' },
        content: { class: 'p-0' },
        mask: { class: 'bg-black/40 backdrop-blur-sm' },
      }"
    >
      <template #container>
        <div class="flex flex-col h-full" :style="{ background: 'var(--ft-navbar-bg)' }">
          <div class="flex items-center justify-between px-4 py-3.5 border-b" :style="{ borderColor: 'var(--ft-panel-border)' }">
            <span class="font-bold text-base">
              Freqtrade <span :style="{ color: 'var(--p-primary-color)' }">UI</span>
            </span>
            <button class="nav-icon-btn" @click="drawerVisible = false">
              <i-mdi-close class="text-lg" />
            </button>
          </div>

          <nav class="flex flex-col gap-0.5 p-3 flex-1 overflow-auto">
            <RouterLink
              v-for="item in navItems.filter((i) => i.visible ?? true)"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              :style="{
                color: isActive(item.to) ? 'var(--ft-navbar-active)' : 'var(--ft-navbar-muted)',
                background: isActive(item.to) ? 'color-mix(in srgb, var(--ft-navbar-active) 12%, transparent)' : 'transparent',
              }"
              @click="drawerVisible = false"
            >
              <component :is="iconComp(item.icon)" class="text-lg shrink-0" />
              {{ item.label }}
            </RouterLink>
          </nav>

          <div class="border-t p-4 flex flex-col gap-3" :style="{ borderColor: 'var(--ft-panel-border)' }">
            <div class="flex items-center justify-between text-sm" :style="{ color: 'var(--ft-navbar-muted)' }">
              <span>v{{ settingsStore.uiVersion }}</span>
              <i-mdi-weather-night v-if="isDarkMode" class="nav-icon-btn text-base" title="Toggle theme" @click="toggleTheme" />
              <i-mdi-white-balance-sunny v-else class="nav-icon-btn text-base" title="Toggle theme" @click="toggleTheme" />
            </div>
            <Select
              v-if="botStore.botCount > 1"
              :model-value="botStore.selectedBotObj"
              size="small"
              no-caret
              :options="botStore.availableBotsSorted"
              @update:model-value="botStore.selectBot($event.botId)"
            >
              <template #value="{ value }"><BotEntry :bot="value" :no-buttons="true" /></template>
              <template #option="{ option }"><BotEntry :bot="option" :no-buttons="true" /></template>
            </Select>
            <ReloadControl class="justify-center w-full" />
            <button
              v-if="botStore.hasBots && botStore.botCount === 1"
              class="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm transition-colors"
              :style="{ color: 'var(--ft-navbar-muted)', background: 'color-mix(in srgb, var(--ft-navbar-hover-bg) 50%, transparent)' }"
              @click="clickLogout"
            >
              <i-mdi-logout /> Logout
            </button>
          </div>
        </div>
      </template>
    </Drawer>
  </header>
</template>

<script setup lang="ts">
const botStore = useBotStore();
const autoRefreshLoc = computed({
  get() {
    return botStore.globalAutoRefresh;
  },
  set(newValue: boolean) {
    botStore.setGlobalAutoRefresh(newValue);
  },
});
</script>

<template>
  <div class="ft-reload-control flex items-center ms-2">
    <Button
      class="ft-navbar-auto-toggle"
      :class="{ 'ft-navbar-auto-toggle-active': autoRefreshLoc }"
      severity="contrast"
      variant="outlined"
      size="small"
      title="Auto Refresh"
      :aria-pressed="autoRefreshLoc"
      @click="autoRefreshLoc = !autoRefreshLoc"
    >
      <template #icon>
        <i-mdi-check-bold v-if="autoRefreshLoc" />
        <i-mdi-refresh v-else />
      </template>
    </Button>
    <Button
      class="ft-navbar-refresh-button m-1"
      severity="contrast"
      variant="outlined"
      size="small"
      title="Auto Refresh all bots now"
      @click="botStore.allRefreshFull"
    >
      <template #icon>
        <i-mdi-refresh />
      </template>
    </Button>
  </div>
</template>

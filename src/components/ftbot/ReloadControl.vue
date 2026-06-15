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
  <div class="flex items-center gap-1">
    <Button
      class="ft-navbar-refresh-button"
      severity="contrast"
      variant="outlined"
      size="small"
      title="Refresh all bots now"
      @click="botStore.allRefreshFull"
    >
      <template #icon>
        <i-mdi-refresh class="text-sm" />
      </template>
    </Button>
    <ToggleSwitch
      v-model="autoRefreshLoc"
      :pt="{
        root: { class: 'h-[1.1rem] w-[1.9rem]' },
        slider: { class: 'h-[1.1rem] w-[1.9rem]' },
      }"
    />
  </div>
</template>

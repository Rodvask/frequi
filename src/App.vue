<script setup lang="ts">
const settingsStore = useSettingsStore();
const colorStore = useColorStore();
const applyColorVars = () => {
  Object.entries(colorStore.cssVars).forEach(([name, value]) => {
    document.documentElement.style.setProperty(name, value);
  });
};

onMounted(() => {
  setTimezone(settingsStore.timezone);
  colorStore.updateProfitLossColor();
  applyColorVars();
});
watch(
  () => settingsStore.timezone,
  (tz) => {
    console.log('timezone changed', tz);
    setTimezone(tz);
  },
);
watch(() => colorStore.cssVars, applyColorVars, { deep: true });
</script>

<template>
  <div
    id="app"
    class="ft-app-shell flex flex-col h-dvh min-h-0 overflow-hidden"
    :style="colorStore.cssVars"
  >
    <NavBar />
    <Toast />
    <BodyLayout class="min-h-0 grow overflow-auto" />
    <NavFooter />
  </div>
</template>

<style scoped>
#app {
  font-family: var(--ft-font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
}

/* * {
  outline: 1px solid #f00 !important;
} */
</style>

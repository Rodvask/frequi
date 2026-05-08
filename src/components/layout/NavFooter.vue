<script setup lang="ts">
const botStore = useBotStore();
</script>

<template>
  <footer class="ft-navbar ft-mobile-bottom-nav md:hidden">
    <!-- Only visible on xs (phone) viewport! -->
    <hr class="my-0" />
    <nav class="ft-mobile-bottom-nav-list" aria-label="Mobile primary navigation">
      <Button
        v-if="!botStore.canRunBacktest"
        icon-pos="top"
        variant="link"
        size="small"
        as="router-link"
        class="ft-mobile-nav-action align-items-center"
        to="/open_trades"
        label="Trades"
        aria-label="Open trades"
      >
        <template #icon>
          <i-mdi-folder-open height="24" width="24" />
        </template>
      </Button>
      <Button
        v-if="!botStore.canRunBacktest"
        icon-pos="top"
        variant="link"
        size="small"
        as="router-link"
        class="ft-mobile-nav-action align-items-center"
        to="/trade_history"
        label="History"
        aria-label="Trade history"
      >
        <template #icon>
          <i-mdi-folder-lock height="24" width="24" />
        </template>
      </Button>
      <Button
        v-if="!botStore.canRunBacktest"
        icon-pos="top"
        variant="link"
        size="small"
        as="router-link"
        class="ft-mobile-nav-action align-items-center"
        to="/pairlist"
        label="Pairlist"
        aria-label="Pairlist"
      >
        <template #icon>
          <i-mdi-view-list height="24" width="24" />
        </template>
      </Button>
      <Button
        v-if="!botStore.canRunBacktest"
        icon-pos="top"
        variant="link"
        size="small"
        as="router-link"
        class="ft-mobile-nav-action align-items-center"
        to="/balance"
        label="Balance"
        aria-label="Balance"
      >
        <template #icon>
          <i-mdi-bank height="24" width="24" />
        </template>
      </Button>
      <Button
        v-if="!botStore.canRunBacktest"
        icon-pos="top"
        variant="link"
        size="small"
        as="router-link"
        class="ft-mobile-nav-action align-items-center"
        to="/dashboard"
        label="Dashboard"
        aria-label="Dashboard"
      >
        <template #icon>
          <i-mdi-view-dashboard-outline height="24" width="24" />
        </template>
      </Button>
      <Button
        v-if="!botStore.canRunBacktest"
        icon-pos="top"
        variant="link"
        size="small"
        as="router-link"
        class="ft-mobile-nav-action align-items-center"
        to="/advanced-dashboard"
        label="Advanced"
        aria-label="Advanced dashboard"
      >
        <template #icon>
          <i-mdi-view-dashboard-edit-outline height="24" width="24" />
        </template>
      </Button>
    </nav>
  </footer>
</template>

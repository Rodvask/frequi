<script setup lang="ts">
import type { TimeSummaryRecord } from '@/types';

defineProps<{
  stats: { data: TimeSummaryRecord[] };
  stakeCurrencyDecimals: number;
  fiatDisplayCurrency: string;
  showProfitPercent?: boolean;
}>();
</script>

<template>
  <DataTable size="small" :value="stats.data">
    <Column field="date" header="Day" />
    <Column field="abs_profit" header="Profit">
      <template #body="{ data, field }">
        {{ formatPrice(data[field as string], stakeCurrencyDecimals) }}
      </template>
    </Column>
    <Column field="fiat_value" :header="`In ${fiatDisplayCurrency}`">
      <template #body="{ data, field }">
        {{ formatPrice(data[field as string], 2) }}
      </template>
    </Column>
    <Column field="trade_count" header="Trades" />
    <Column v-if="showProfitPercent" field="rel_profit" header="Profit%">
      <template #body="{ data, field }">
        {{ formatPercent(data[field as string], 2) }}
      </template>
    </Column>
  </DataTable>
</template>

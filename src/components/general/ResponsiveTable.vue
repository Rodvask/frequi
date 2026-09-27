<script setup lang="ts">
import type { DataTableRowClickEvent } from 'primevue/datatable';

interface ResponsiveColumn {
  field: string;
  header: string;
  /** Custom class for the header cell */
  headerClass?: string;
  /** Custom class for the body cell */
  bodyClass?: string;
  /** Whether the column is hidden on mobile card view */
  hideOnMobile?: boolean;
}

// A row here is a bag of values addressed by column name, because the columns are data and are
// read with a dynamic index. `Record<string, unknown>` states that, and it is what forces the
// narrowing where the template needs a concrete type. `any` stated nothing and let every
// unchecked field access compile.
const props = withDefaults(
  defineProps<{
    columns: ResponsiveColumn[];
    rows: Record<string, unknown>[];
    loading?: boolean;
    paginator?: boolean;
    rowsPerPage?: number;
    rowsPerPageOptions?: number[];
    emptyMessage?: string;
    /** Max items to show in mobile list (default: all) */
    mobileMax?: number;
  }>(),
  {
    loading: false,
    paginator: false,
    rowsPerPage: 10,
    rowsPerPageOptions: () => [10, 20, 30],
    emptyMessage: 'No data available.',
    mobileMax: 0,
  },
);

const emit = defineEmits<{
  'row-click': [value: DataTableRowClickEvent];
}>();

const mobileRows = computed(() => {
  const rows = props.rows;
  if (props.mobileMax > 0 && rows.length > props.mobileMax) {
    return rows.slice(0, props.mobileMax);
  }
  return rows;
});

function onRowClick(event: DataTableRowClickEvent) {
  emit('row-click', event);
}
</script>

<template>
  <!-- Desktop: DataTable -->
  <DataTable
    class="ft-metric-table hidden md:block"
    size="small"
    :value="rows"
    :loading="loading"
    :paginator="paginator"
    :rows="rowsPerPage"
    :rows-per-page-options="rowsPerPageOptions"
    selection-mode="single"
    @row-click="onRowClick"
  >
    <Column
      v-for="col in columns"
      :key="col.field"
      :field="col.field"
      :header="col.header"
      :header-class="col.headerClass"
      :body-class="col.bodyClass"
    >
      <template #body="{ data }">
        <slot :name="`cell-${col.field}`" :row="data" :value="data[col.field]">
          {{ data[col.field] }}
        </slot>
      </template>
    </Column>
    <template #empty>{{ emptyMessage }}</template>
    <template #paginatorstart>
      <slot name="paginatorstart" />
    </template>
    <template #paginatorend>
      <slot name="paginatorend" />
    </template>
  </DataTable>

  <!-- Mobile: card list -->
  <div class="ft-advanced-mobile-list block md:hidden">
    <div
      v-for="(row, index) in mobileRows"
      :key="row.key ?? index"
      class="ft-mobile-row-card"
      :class="{ 'cursor-pointer': $attrs.onRowClick }"
      @click="$emit('row-click', { data: row } as any)"
    >
      <slot name="mobile-card" :row="row" :index="index">
        <div>
          <strong>{{ row.key ?? row[columns[0]?.field] }}</strong>
          <span v-if="!columns[0]?.hideOnMobile">
            {{ row[columns[columns.length - 1]?.field] }}
          </span>
        </div>
        <b
          v-if="columns[1]"
          :class="(row[columns[1].field] as number) >= 0 ? 'text-profit' : 'text-loss'"
        >
          {{ row[columns[1].field] }}
        </b>
      </slot>
    </div>
    <div v-if="!rows.length" class="ft-empty-state">{{ emptyMessage }}</div>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
});
withDefaults(
  defineProps<{
    header?: string;
  }>(),
  {
    header: '',
  },
);
</script>

<template>
  <div class="ft-dashboard-card flex flex-col h-full w-full">
    <div class="ft-dashboard-card-header drag-header flex items-center py-1 px-3">
      <slot name="header">
        {{ header }}
      </slot>
    </div>
    <div class="ft-dashboard-card-body p-0 h-full w-full overflow-auto" v-bind="$attrs">
      <slot></slot>
    </div>
  </div>
</template>

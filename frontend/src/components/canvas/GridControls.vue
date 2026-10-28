<template>
  <div class="grid-controls" @click.stop>
    <el-select :model-value="String(colNum)" size="small" style="width: 110px" @change="emit('cols-preset', $event)">
      <el-option label="4 列" value="4" />
      <el-option label="8 列" value="8" />
      <el-option label="12 列" value="12" />
      <el-option label="24 列" value="24" />
    </el-select>
    <el-input-number
      :model-value="rowHeight"
      :min="20"
      :max="80"
      size="small"
      controls-position="right"
      style="width: 100px"
      @change="emit('row-height', $event)"
    />
    <el-checkbox :model-value="showAlways" size="small" @change="emit('show-always', $event)">始终网格</el-checkbox>
    <el-button type="primary" :disabled="!hasSelection" @click="emit('open-inspector')"> 属性 </el-button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  colNum: number;
  rowHeight: number;
  showAlways: boolean;
  hasSelection: boolean;
}>();

const emit = defineEmits<{
  'cols-preset': [val: string];
  'row-height': [val: number | undefined];
  'show-always': [val: boolean | string | number];
  'open-inspector': [];
}>();
</script>

<style scoped>
.grid-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>

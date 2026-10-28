<template>
  <div class="snap-guides-overlay">
    <div
      v-for="(xCol, index) in xLines"
      :key="'x-' + index"
      class="snap-guide-line snap-guide-line-v"
      :style="{ left: `calc(${(xCol / colNum) * 100}% - 1px)` }"
    >
      <span class="snap-badge">网格 Column {{ xCol }}</span>
    </div>
    <div
      v-for="(yRow, index) in yLines"
      :key="'y-' + index"
      class="snap-guide-line snap-guide-line-h"
      :style="{ top: `${yRow * rowHeight}px` }"
    >
      <span class="snap-badge">网格 Row {{ yRow }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  xLines: number[];
  yLines: number[];
  colNum: number;
  rowHeight: number;
}>();
</script>

<style scoped>
.snap-guides-overlay {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 3;
}
.snap-guide-line {
  position: absolute;
  background: #f56c6c;
}
.snap-guide-line-v {
  top: 0;
  bottom: 0;
  width: 1px;
}
.snap-guide-line-h {
  left: 0;
  right: 0;
  height: 1px;
}
.snap-badge {
  position: absolute;
  top: 0;
  left: 4px;
  font-size: 10px;
  background: #f56c6c;
  color: #fff;
  padding: 0 4px;
  border-radius: 2px;
}
</style>

<template>
  <div class="node-toolbar">
    <span class="node-type-tag">{{ label }}</span>
    <div class="toolbar-actions">
      <el-button size="small" :disabled="!canShrink" title="缩小一格" @click.stop="emit('scale', -1)"> − </el-button>
      <el-button size="small" :disabled="!canGrow" title="放大一格" @click.stop="emit('scale', 1)"> + </el-button>
      <el-icon class="delete-btn" title="删除" @click.stop="emit('remove')">
        <Delete />
      </el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Delete } from '@element-plus/icons-vue';

defineProps<{
  label: string;
  canShrink: boolean;
  canGrow: boolean;
}>();

const emit = defineEmits<{
  scale: [delta: number];
  remove: [];
}>();
</script>

<style scoped>
.node-toolbar {
  display: none;
  justify-content: space-between;
  align-items: center;
  padding: 4px 6px;
  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1px solid #ebeef5;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 5;
}
.grid-node-wrapper:hover .node-toolbar,
.grid-node-wrapper.selected .node-toolbar {
  display: flex;
}
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.node-type-tag {
  font-size: 11px;
  font-weight: 600;
  color: #409eff;
}
.delete-btn {
  cursor: pointer;
  color: #f56c6c;
  font-size: 16px;
  margin-left: 2px;
}
</style>

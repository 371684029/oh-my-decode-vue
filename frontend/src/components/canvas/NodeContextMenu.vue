<template>
  <ul
    class="node-context-menu"
    :style="{ left: x + 'px', top: y + 'px' }"
    @click.stop
    @contextmenu.prevent
  >
    <li @click="emit('command', 'props')">属性</li>
    <li @click="emit('command', 'copy')">复制</li>
    <li class="danger" @click="emit('command', 'delete')">删除</li>
  </ul>
</template>

<script setup lang="ts">
defineProps<{
  x: number;
  y: number;
}>();

const emit = defineEmits<{
  command: [cmd: 'props' | 'copy' | 'delete'];
}>();
</script>

<style scoped>
.node-context-menu {
  position: fixed;
  z-index: 4000;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  min-width: 120px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}
.node-context-menu li {
  padding: 8px 14px;
  font-size: 13px;
  color: #303133;
  cursor: pointer;
}
.node-context-menu li:hover {
  background: #f5f7fa;
  color: #409eff;
}
.node-context-menu li.danger {
  color: #f56c6c;
}
.node-context-menu li.danger:hover {
  background: #fef0f0;
  color: #f56c6c;
}
</style>

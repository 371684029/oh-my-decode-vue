<template>
  <div class="material-blackbox" :class="{ 'is-missing': missing }">
    <template v-if="renderedNodes.length > 0">
      <NodeRenderer v-for="child in renderedNodes" :key="child.id" :node="child" />
    </template>
    <div v-else class="blackbox-placeholder">
      <el-icon><Box /></el-icon>
      <p>{{ node.label }}</p>
      <p class="blackbox-version">v{{ node.materialRef?.version }}<span v-if="node.materialRef?.follow && node.materialRef.follow !== 'pin'"> · follow-{{ node.materialRef.follow }}</span></p>
      <p v-if="missing" class="missing-tip">物料缺失，已渲染占位（请检查物料是否被删除）</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import NodeRenderer from './NodeRenderer.vue';
import { resolveMaterial } from '../utils/materialResolver';
import { mapOutputEvents } from '../utils/materialInject';
import type { ComponentNode } from '../types/designer';

const props = defineProps<{ node: ComponentNode }>();

const renderedNodes = ref<ComponentNode[]>([]);
const missing = ref(false);

const load = async () => {
  const ref = props.node.materialRef;
  if (!ref) return;
  const version = await resolveMaterial(ref);
  if (!version) {
    missing.value = true;
    renderedNodes.value = [];
    return;
  }
  missing.value = false;
  // inputs 注入 + outputs 对齐（实例动作链接管对外事件）
  renderedNodes.value = mapOutputEvents(version.schema, props.node, version.contract);
};

onMounted(load);
watch(() => props.node.materialRef?.version, load);
watch(
  () => JSON.stringify(props.node.props),
  () => {
    if (!missing.value) load();
  }
);
</script>

<style scoped>
.material-blackbox {
  width: 100%;
}
.blackbox-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 80px;
  padding: 12px;
  border: 1px dashed #e6a23c;
  border-radius: 6px;
  background: #fdf6ec;
  color: #b88230;
  font-size: 13px;
}
.blackbox-placeholder .el-icon {
  font-size: 26px;
}
.blackbox-version {
  font-size: 12px;
  color: #909399;
  margin: 0;
}
.missing-tip {
  font-size: 12px;
  color: #f56c6c;
  margin: 0;
}
</style>

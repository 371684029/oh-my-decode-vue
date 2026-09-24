<template>
  <div class="layer-tree-container">
    <div class="layer-tree-header">
      <span class="title">页面大纲图层树 ({{ nodes.length }})</span>
    </div>

    <el-tree
      v-if="nodes.length > 0"
      :data="nodes"
      node-key="id"
      default-expand-all
      :expand-on-click-node="false"
      highlight-current
      :current-node-key="selectedNodeId ?? undefined"
      class="custom-layer-tree"
      @node-click="handleNodeClick"
    >
      <template #default="{ data }">
        <div class="tree-node-content" :class="{ 'is-selected': data.id === selectedNodeId }">
          <span class="node-label">
            <el-icon class="icon"><Menu /></el-icon>
            {{ data.label || data.type }}
            <span class="node-id">({{ data.id }})</span>
          </span>
          <div class="node-actions">
            <el-button type="danger" link size="small" title="删除组件" @click.stop="handleDelete(data.id)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </template>
    </el-tree>

    <div v-else class="empty-layers">
      <el-empty description="暂无图层，请从物料库拖拽组件" :image-size="60" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDesignerStore } from '../stores/designerStore';
import { Menu, Delete } from '@element-plus/icons-vue';

const designerStore = useDesignerStore();

const nodes = computed(() => designerStore.pageSchema.children || []);
const selectedNodeId = computed(() => designerStore.selectedNodeId);

const handleNodeClick = (data: any) => {
  designerStore.selectNode(data.id);
};

const handleDelete = (id: string) => {
  designerStore.removeNode(id);
};
</script>

<style scoped>
.layer-tree-container {
  padding: 12px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.layer-tree-header {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.custom-layer-tree {
  background: transparent;
  flex: 1;
  overflow-y: auto;
}

.tree-node-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  font-size: 12px;
  padding-right: 8px;
}

.tree-node-content.is-selected {
  color: #409eff;
  font-weight: 600;
}

.node-label {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-label .icon {
  font-size: 14px;
}

.node-id {
  color: #909399;
  font-size: 11px;
  font-weight: normal;
}

.node-actions {
  display: flex;
  align-items: center;
  opacity: 0.8;
}

.tree-node-content:hover .node-actions {
  opacity: 1;
}

.empty-layers {
  margin-top: 40px;
}
</style>

<template>
  <div
    class="canvas-container"
    @dragover.prevent
    @drop="handleDrop"
    @click="handleBackgroundClick"
  >
    <div class="canvas-header">
      <span class="page-title">{{ designerStore.pageSchema.title }}</span>
      <span class="page-info">组件数: {{ layoutItems.length }}</span>
    </div>

    <div v-if="layoutItems.length === 0" class="empty-placeholder">
      <el-icon class="empty-icon"><UploadFilled /></el-icon>
      <p>拖拽左侧高端表单/表格组件投射至此处画布</p>
    </div>

    <grid-layout
      v-else
      v-model:layout="layoutItems"
      :col-num="12"
      :row-height="50"
      :is-draggable="true"
      :is-resizable="true"
      :vertical-compact="true"
      :use-css-transforms="true"
      @layout-updated="handleLayoutUpdated"
      class="grid-canvas"
    >
      <grid-item
        v-for="item in layoutItems"
        :key="item.i"
        :x="item.x"
        :y="item.y"
        :w="item.w"
        :h="item.h"
        :i="item.i"
        class="grid-node-wrapper"
        :class="{ selected: designerStore.selectedNodeId === item.i }"
        @click.stop="designerStore.selectNode(item.i)"
      >
        <div class="node-toolbar">
          <span class="node-type-tag">{{ getNodeLabel(item.i) }}</span>
          <el-icon class="delete-btn" @click.stop="designerStore.removeNode(item.i)">
            <Delete />
          </el-icon>
        </div>

        <div class="node-content">
          <slot :node="getNode(item.i)" />
        </div>
      </grid-item>
    </grid-layout>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
// @ts-ignore
import { GridLayout, GridItem } from 'vue3-grid-layout-next';
import { useDesignerStore } from '../stores/designerStore';
import type { MaterialItem } from '../types/designer';

const designerStore = useDesignerStore();

const layoutItems = computed({
  get() {
    return designerStore.pageSchema.children.map((node) => node.layout);
  },
  set(val) {
    designerStore.updateNodeLayout(val);
  }
});

const getNode = (id: string) => {
  return designerStore.pageSchema.children.find((n) => n.id === id);
};

const getNodeLabel = (id: string) => {
  const node = getNode(id);
  return node ? node.label : id;
};

const handleLayoutUpdated = (newLayout: any[]) => {
  designerStore.updateNodeLayout(newLayout);
};

const handleDrop = (event: DragEvent) => {
  const data = event.dataTransfer?.getData('application/json');
  if (data) {
    try {
      const material: MaterialItem = JSON.parse(data);
      designerStore.addNodeFromMaterial(material, 0, 1000);
    } catch (e) {
      console.error('Failed to parse dropped material', e);
    }
  }
};

const handleBackgroundClick = () => {
  designerStore.selectNode(null);
};
</script>

<style scoped>
.canvas-container {
  flex: 1;
  background-color: #f5f7fa;
  position: relative;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
}
.canvas-header {
  background-color: #ffffff;
  padding: 10px 16px;
  border-radius: 6px;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
.page-title {
  font-weight: 600;
  color: #303133;
}
.page-info {
  font-size: 13px;
  color: #909399;
}
.empty-placeholder {
  flex: 1;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #909399;
  background-color: #ffffff;
  min-height: 400px;
}
.empty-icon {
  font-size: 48px;
  color: #c0c4cc;
  margin-bottom: 12px;
}
.grid-canvas {
  background-color: #ffffff;
  min-height: 600px;
  border-radius: 6px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}
.grid-node-wrapper {
  border: 1px solid #e4e7ed;
  background-color: #ffffff;
  border-radius: 4px;
  padding: 8px;
  position: relative;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  flex-direction: column;
}
.grid-node-wrapper.selected {
  border: 2px solid #409eff;
  box-shadow: 0 0 8px rgba(64, 158, 255, 0.3);
}
.node-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid #f0f2f5;
}
.node-type-tag {
  font-size: 12px;
  font-weight: 600;
  color: #409eff;
}
.delete-btn {
  cursor: pointer;
  color: #f56c6c;
  font-size: 14px;
}
.delete-btn:hover {
  transform: scale(1.15);
}
.node-content {
  flex: 1;
  overflow: auto;
}
</style>

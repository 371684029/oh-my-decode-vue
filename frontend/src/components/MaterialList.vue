<template>
  <div class="material-panel">
    <div class="panel-header">
      <el-icon><Menu /></el-icon>
      <span>组件物料库</span>
    </div>
    <el-tabs v-model="activeTab" class="material-tabs">
      <el-tab-pane label="自有高端组件" name="pro">
        <div class="material-grid">
          <div
            v-for="item in proMaterials"
            :key="item.type"
            class="material-item pro-item"
            draggable="true"
            @dragstart="handleDragStart($event, item)"
            @click="handleClickAdd(item)"
          >
            <el-icon class="material-icon"><component :is="item.icon" /></el-icon>
            <span class="material-label">{{ item.label }}</span>
          </div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="Element-UI 组件" name="element">
        <div class="material-grid">
          <div
            v-for="item in elementMaterials"
            :key="item.type"
            class="material-item element-item"
            draggable="true"
            @dragstart="handleDragStart($event, item)"
            @click="handleClickAdd(item)"
          >
            <el-icon class="material-icon"><component :is="item.icon" /></el-icon>
            <span class="material-label">{{ item.label }}</span>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { MATERIAL_REGISTRY } from '../registry/materials';
import type { MaterialItem } from '../types/designer';
import { useDesignerStore } from '../stores/designerStore';

const designerStore = useDesignerStore();
const activeTab = ref('pro');

const proMaterials = computed(() => MATERIAL_REGISTRY.filter((m) => m.category === 'pro'));
const elementMaterials = computed(() => MATERIAL_REGISTRY.filter((m) => m.category === 'element'));

const handleDragStart = (event: DragEvent, item: MaterialItem) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/json', JSON.stringify(item));
  }
};

const handleClickAdd = (item: MaterialItem) => {
  designerStore.addNodeFromMaterial(item, 0, 1000);
};
</script>

<style scoped>
.material-panel {
  width: 260px;
  background-color: #ffffff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.panel-header {
  padding: 14px 16px;
  font-weight: 600;
  font-size: 15px;
  border-bottom: 1px solid #f0f2f5;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #303133;
}
.material-tabs {
  padding: 0 12px;
}
.material-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 10px 0;
}
.material-item {
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: grab;
  background-color: #fafafa;
  transition: all 0.2s ease;
}
.material-item:hover {
  border-color: #409eff;
  background-color: #ecf5ff;
  color: #409eff;
  transform: translateY(-2px);
}
.pro-item:hover {
  border-color: #67c23a;
  background-color: #f0f9eb;
  color: #67c23a;
}
.material-icon {
  font-size: 22px;
  margin-bottom: 6px;
}
.material-label {
  font-size: 12px;
  text-align: center;
  word-break: break-all;
}
</style>

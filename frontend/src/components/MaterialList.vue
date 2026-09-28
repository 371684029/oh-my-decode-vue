<template>
  <div class="material-panel">
    <div class="panel-header">
      <el-icon><Menu /></el-icon>
      <span>物料与图层大纲</span>
      <el-button class="pack-btn" link type="primary" size="small" @click="saveDialogOpen = true">
        打包为物料
      </el-button>
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
      <el-tab-pane label="Element 组件" name="element">
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
      <el-tab-pane label="自定义物料" name="custom">
        <div class="custom-toolbar">
          <span class="custom-toolbar-title">用户打包生成的物料</span>
          <el-button link type="primary" size="small" @click="managerOpen = true">管理</el-button>
        </div>
        <div v-if="customMaterials.length > 0" class="material-grid">
          <div
            v-for="item in customMaterials"
            :key="item.type"
            class="material-item custom-item"
            draggable="true"
            @dragstart="handleDragStart($event, item)"
            @click="handleClickAdd(item)"
          >
            <el-icon class="material-icon"><component :is="item.icon" /></el-icon>
            <span class="material-label">{{ item.label }}</span>
            <span class="material-meta">{{ item.summary?.length || 0 }} 组件</span>
          </div>
        </div>
        <div v-else class="material-empty">
          <el-icon><Box /></el-icon>
          <p>暂无自定义物料</p>
          <p class="empty-tip">选中画布组件后点击「打包为物料」创建</p>
        </div>
      </el-tab-pane>
      <el-tab-pane label="图层大纲" name="layers">
        <LayerTree />
      </el-tab-pane>
      <el-tab-pane label="多图层管理" name="multi-layers">
        <LayerManager />
      </el-tab-pane>
      <el-tab-pane label="页面状态" name="page-state">
        <PageStatePanel />
      </el-tab-pane>
    </el-tabs>
    <MaterialSaveDialog :visible="saveDialogOpen" @close="saveDialogOpen = false" />
    <MaterialManager :visible="managerOpen" @close="managerOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { MATERIAL_REGISTRY } from '../registry/materials';
import { listCustomMaterials } from '../registry/materialRegistry';
import type { MaterialItem } from '../types/designer';
import { useDesignerStore } from '../stores/designerStore';
import LayerTree from './LayerTree.vue';
import LayerManager from './LayerManager.vue';
import PageStatePanel from './PageStatePanel.vue';
import MaterialSaveDialog from './MaterialSaveDialog.vue';
import MaterialManager from './MaterialManager.vue';

const designerStore = useDesignerStore();
const activeTab = ref('pro');
const saveDialogOpen = ref(false);
const managerOpen = ref(false);

const proMaterials = computed(() => MATERIAL_REGISTRY.filter((m) => m.category === 'pro'));
const elementMaterials = computed(() => MATERIAL_REGISTRY.filter((m) => m.category === 'element'));
const customMaterials = computed(() => listCustomMaterials());

const handleDragStart = (event: DragEvent, item: MaterialItem) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/json', JSON.stringify(item));
  }
};

const handleClickAdd = (item: MaterialItem) => {
  designerStore.addMaterialSmart(item, 0, 1000);
};
</script>

<style scoped>
.material-panel {
  width: 280px;
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
  flex: 1;
  display: flex;
  flex-direction: column;
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
.custom-item:hover {
  border-color: #e6a23c;
  background-color: #fdf6ec;
  color: #e6a23c;
}
.material-meta {
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
}
.material-empty {
  padding: 28px 0;
  text-align: center;
  color: #909399;
  font-size: 13px;
}
.material-empty .el-icon {
  font-size: 30px;
  margin-bottom: 6px;
}
.material-empty p {
  margin: 2px 0;
}
.material-empty .empty-tip {
  font-size: 12px;
}
.pack-btn {
  margin-left: auto;
}
.custom-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 2px 2px;
}
.custom-toolbar-title {
  font-size: 12px;
  color: #909399;
}
</style>

<template>
  <div class="canvas-container" @dragover.prevent @drop="handleDrop" @click="handleBackgroundClick">
    <div class="canvas-header">
      <span class="page-title">{{ designerStore.pageSchema.title }}</span>
      <el-tag v-if="editingLayer" type="warning" size="small" class="editing-layer-tag">
        正在编辑图层: {{ editingLayer.name }}
        <el-button link size="small" type="warning" @click="designerStore.exitLayerEdit()">退出</el-button>
      </el-tag>

      <!-- 多端响应式视口切换器 -->
      <div class="viewport-selector">
        <el-radio-group v-model="viewportMode" size="small">
          <el-radio-button value="desktop">
            <el-icon><Monitor /></el-icon> 桌面 100%
          </el-radio-button>
          <el-radio-button value="laptop">
            <el-icon><Platform /></el-icon> 笔记本 1366px
          </el-radio-button>
          <el-radio-button value="tablet">
            <el-icon><Cellphone /></el-icon> 平板 768px
          </el-radio-button>
          <el-radio-button value="mobile">
            <el-icon><Iphone /></el-icon> 移动端 375px
          </el-radio-button>
        </el-radio-group>
      </div>

      <span class="page-info">组件数: {{ layoutItems.length }}</span>
    </div>

    <div v-if="layoutItems.length === 0" class="empty-placeholder">
      <el-icon class="empty-icon"><UploadFilled /></el-icon>
      <p>拖拽左侧高端表单/表格组件投射至此处画布</p>
    </div>

    <div v-else class="canvas-viewport-wrapper" :style="viewportStyle">
      <!-- 对齐参考线与吸附指示器 -->
      <div v-if="activeSnapXLines.length > 0 || activeSnapYLines.length > 0" class="snap-guides-overlay">
        <div
          v-for="(xCol, index) in activeSnapXLines"
          :key="'x-' + index"
          class="snap-guide-line snap-guide-line-v"
          :style="{ left: `calc(${(xCol / colNum) * 100}% - 1px)` }"
        >
          <span class="snap-badge">网格 Column {{ xCol }}</span>
        </div>
        <div
          v-for="(yRow, index) in activeSnapYLines"
          :key="'y-' + index"
          class="snap-guide-line snap-guide-line-h"
          :style="{ top: `${yRow * 50}px` }"
        >
          <span class="snap-badge">网格 Row {{ yRow }}</span>
        </div>
      </div>

      <grid-layout
        v-model:layout="layoutItems"
        :col-num="colNum"
        :row-height="50"
        :is-draggable="true"
        :is-resizable="true"
        :vertical-compact="true"
        :use-css-transforms="true"
        class="grid-canvas"
        @layout-updated="handleLayoutUpdated"
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
          @move="handleItemMove"
          @moved="handleItemMoved"
          @resize="handleItemResize"
          @resized="handleItemResized"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { GridLayout, GridItem } from 'vue3-grid-layout-next';
import { useDesignerStore } from '../stores/designerStore';
import type { MaterialItem } from '../types/designer';
import { Monitor, Platform, Cellphone, Iphone, UploadFilled, Delete } from '@element-plus/icons-vue';

const designerStore = useDesignerStore();
const viewportMode = ref<'desktop' | 'laptop' | 'tablet' | 'mobile'>('desktop');

const colNum = computed(() => {
  switch (viewportMode.value) {
    case 'mobile':
      return 4;
    case 'tablet':
      return 8;
    case 'laptop':
      return 12;
    default:
      return 12;
  }
});

const viewportStyle = computed(() => {
  switch (viewportMode.value) {
    case 'laptop':
      return { width: '1366px', margin: '0 auto' };
    case 'tablet':
      return { width: '768px', margin: '0 auto' };
    case 'mobile':
      return { width: '375px', margin: '0 auto' };
    default:
      return { width: '100%' };
  }
});

const layoutItems = computed({
  get() {
    return designerStore.activeChildren.map((node) => node.layout);
  },
  set(val) {
    if (!designerStore.layoutGesture) designerStore.beginLayoutGesture();
    designerStore.updateNodeLayout(val, { history: false });
  }
});

const getNode = (id: string) => {
  return designerStore.activeChildren.find((n) => n.id === id);
};

/** 当前编辑的图层（null = 主画布） */
const editingLayer = computed(() => {
  return designerStore.pageSchema.layers?.find((l) => l.id === designerStore.editingLayerId) ?? null;
});

const getNodeLabel = (id: string) => {
  const node = getNode(id);
  return node ? node.label : id;
};

const activeSnapXLines = ref<number[]>([]);
const activeSnapYLines = ref<number[]>([]);

const calculateSnapLines = (movingId: string | number, newX: number, newY: number, newW?: number, newH?: number) => {
  const item = layoutItems.value.find((l) => l.i === movingId);
  const w = newW ?? item?.w ?? 1;
  const h = newH ?? item?.h ?? 1;

  const xLinesSet = new Set<number>();
  const yLinesSet = new Set<number>();

  const otherItems = layoutItems.value.filter((l) => l.i !== movingId);

  otherItems.forEach((other) => {
    // 检查 X 轴左右边缘与中心对齐吸附
    if (newX === other.x || newX === other.x + other.w) {
      xLinesSet.add(newX);
    }
    if (newX + w === other.x || newX + w === other.x + other.w) {
      xLinesSet.add(newX + w);
    }
    // 检查 Y 轴上下边缘对齐吸附
    if (newY === other.y || newY === other.y + other.h) {
      yLinesSet.add(newY);
    }
    if (newY + h === other.y || newY + h === other.y + other.h) {
      yLinesSet.add(newY + h);
    }
  });

  activeSnapXLines.value = Array.from(xLinesSet);
  activeSnapYLines.value = Array.from(yLinesSet);
};

const handleItemMove = (i: string | number, newX: number, newY: number) => {
  designerStore.beginLayoutGesture();
  calculateSnapLines(i, newX, newY);
};

const handleItemMoved = () => {
  designerStore.endLayoutGesture();
  activeSnapXLines.value = [];
  activeSnapYLines.value = [];
};

const handleItemResize = (i: string | number, newH: number, newW: number) => {
  designerStore.beginLayoutGesture();
  const item = layoutItems.value.find((l) => l.i === i);
  if (item) {
    calculateSnapLines(i, item.x, item.y, newW, newH);
  }
};

const handleItemResized = () => {
  designerStore.endLayoutGesture();
  activeSnapXLines.value = [];
  activeSnapYLines.value = [];
};

const handleLayoutUpdated = (newLayout: any[]) => {
  if (!designerStore.layoutGesture) designerStore.beginLayoutGesture();
  designerStore.updateNodeLayout(newLayout, { history: false });
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
.viewport-selector {
  display: flex;
  align-items: center;
}
.canvas-viewport-wrapper {
  transition: width 0.3s ease;
  position: relative;
}
.snap-guides-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 100;
}
.snap-guide-line {
  position: absolute;
  pointer-events: none;
}
.snap-guide-line-v {
  top: 0;
  bottom: 0;
  border-left: 2px dashed #f56c6c;
  background-color: rgba(245, 108, 108, 0.1);
}
.snap-guide-line-h {
  left: 0;
  right: 0;
  border-top: 2px dashed #409eff;
  background-color: rgba(64, 158, 255, 0.1);
}
.snap-badge {
  position: absolute;
  background-color: #303133;
  color: #ffffff;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
.snap-guide-line-v .snap-badge {
  top: 8px;
  left: 4px;
}
.snap-guide-line-h .snap-badge {
  left: 8px;
  top: 4px;
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
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
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

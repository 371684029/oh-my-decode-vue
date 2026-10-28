<template>
  <div class="canvas-container" @dragover.prevent @drop="handleDrop" @click="handleBackgroundClick">
    <div class="canvas-header">
      <el-input
        v-if="!preview"
        v-model="designerStore.pageSchema.title"
        class="page-title-input"
        placeholder="页面标题"
      />
      <span v-else class="page-title">{{ designerStore.pageSchema.title }}</span>
      <el-tag v-if="editingLayer" type="warning" size="small" class="editing-layer-tag">
        正在编辑图层: {{ editingLayer.name }}
        <el-button link size="small" type="warning" @click="designerStore.exitLayerEdit()">退出</el-button>
      </el-tag>

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

      <GridControls
        v-if="!preview"
        :col-num="colNum"
        :row-height="rowHeight"
        :show-always="showAlways"
        :has-selection="Boolean(designerStore.selectedNodeId)"
        @cols-preset="onColsPreset"
        @row-height="onRowHeightChange"
        @show-always="onShowAlwaysChange"
        @open-inspector="designerStore.openInspector()"
      />

      <span class="page-info">组件数: {{ layoutItems.length }} · {{ colNum }}×{{ rowHeight }}</span>
    </div>

    <div v-if="layoutItems.length === 0" class="empty-placeholder">
      <el-icon class="empty-icon"><UploadFilled /></el-icon>
      <p>拖拽左侧高端表单/表格组件投射至此处画布</p>
    </div>

    <div v-else class="canvas-viewport-wrapper" :style="viewportStyle">
      <SnapGuidesOverlay
        v-if="activeSnapXLines.length > 0 || activeSnapYLines.length > 0"
        :x-lines="activeSnapXLines"
        :y-lines="activeSnapYLines"
        :col-num="colNum"
        :row-height="rowHeight"
      />

      <grid-layout
        v-model:layout="layoutItems"
        :col-num="colNum"
        :row-height="rowHeight"
        :is-draggable="!preview"
        :is-resizable="!preview"
        :vertical-compact="true"
        :use-css-transforms="true"
        class="grid-canvas"
        :class="{ 'grid-canvas--lined': showGridOverlay }"
        :style="gridCanvasStyle"
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
          :class="{ selected: designerStore.selectedNodeIds.includes(item.i) }"
          @click.stop="onSelectNode(item.i, $event)"
          @dblclick.stop="onOpenInspector(item.i)"
          @contextmenu.prevent="onNodeContextMenu($event, item.i)"
          @move="handleItemMove"
          @moved="handleItemMoved"
          @resize="handleItemResize"
          @resized="handleItemResized"
        >
          <NodeToolbar
            v-if="!preview"
            :label="getNodeLabel(item.i)"
            :can-shrink="canShrink(item.i)"
            :can-grow="canGrow(item.i)"
            @scale="scaleNode(item.i, $event)"
            @remove="designerStore.removeNode(item.i)"
          />

          <div class="node-content">
            <slot :node="getNode(item.i)" />
          </div>
        </grid-item>
      </grid-layout>

      <NodeContextMenu
        v-if="ctxMenu"
        :x="ctxMenu.x"
        :y="ctxMenu.y"
        @command="onCtxCommand"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { GridLayout, GridItem } from 'vue3-grid-layout-next';
import { useDesignerStore } from '../stores/designerStore';
import type { MaterialItem } from '../types/designer';
import { Monitor, Platform, Cellphone, Iphone, UploadFilled } from '@element-plus/icons-vue';
import { notifyUser } from '../utils/notifyUser';
import NodeToolbar from './canvas/NodeToolbar.vue';
import NodeContextMenu from './canvas/NodeContextMenu.vue';
import GridControls from './canvas/GridControls.vue';
import SnapGuidesOverlay from './canvas/SnapGuidesOverlay.vue';
import { useCanvasGrid } from '../composables/useCanvasGrid';

const props = defineProps<{
  preview?: boolean;
}>();

const designerStore = useDesignerStore();
const preview = computed(() => props.preview === true);

const {
  viewportMode,
  colNum,
  rowHeight,
  showAlways,
  onColsPreset,
  onRowHeightChange,
  onShowAlwaysChange,
  showGridOverlay,
  gridCanvasStyle,
  viewportStyle
} = useCanvasGrid(preview);

const onSelectNode = (id: string, e?: MouseEvent) => {
  if (preview.value) return;
  designerStore.toggleNodeSelected(id, Boolean(e?.ctrlKey || e?.metaKey || e?.shiftKey));
};

const onOpenInspector = (id: string) => {
  if (preview.value) return;
  designerStore.selectNode(id);
  designerStore.openInspector();
};

const ctxMenu = ref<{ x: number; y: number; id: string } | null>(null);

const closeCtxMenu = () => {
  ctxMenu.value = null;
};

const onNodeContextMenu = (e: MouseEvent, id: string) => {
  if (preview.value) return;
  designerStore.selectNode(id);
  ctxMenu.value = { x: e.clientX, y: e.clientY, id };
};

const onCtxCommand = (cmd: 'props' | 'copy' | 'delete') => {
  const id = ctxMenu.value?.id;
  closeCtxMenu();
  if (!id) return;
  if (cmd === 'props') {
    onOpenInspector(id);
    return;
  }
  if (cmd === 'copy') {
    designerStore.selectNode(id);
    if (designerStore.copySelectedNode()) notifyUser('success', '已复制');
    return;
  }
  designerStore.removeNode(id);
  notifyUser('info', '已删除');
};

onMounted(() => {
  window.addEventListener('click', closeCtxMenu);
  window.addEventListener('scroll', closeCtxMenu, true);
});
onUnmounted(() => {
  window.removeEventListener('click', closeCtxMenu);
  window.removeEventListener('scroll', closeCtxMenu, true);
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

const editingLayer = computed(() => {
  return designerStore.pageSchema.layers?.find((l) => l.id === designerStore.editingLayerId) ?? null;
});

const getNodeLabel = (id: string) => {
  const node = getNode(id);
  return node ? node.label : id;
};

const canGrow = (id: string) => {
  const node = getNode(id);
  if (!node) return false;
  return node.layout.w + node.layout.x < colNum.value || node.layout.h < 20;
};

const canShrink = (id: string) => {
  const node = getNode(id);
  if (!node) return false;
  return node.layout.w > 1 || node.layout.h > 1;
};

const scaleNode = (id: string, delta: number) => {
  const node = getNode(id);
  if (!node) return;
  designerStore.recordHistory();
  const maxW = Math.max(1, colNum.value - node.layout.x);
  node.layout.w = Math.max(1, Math.min(maxW, node.layout.w + delta));
  node.layout.h = Math.max(1, Math.min(20, node.layout.h + delta));
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
    if (newX === other.x || newX === other.x + other.w) xLinesSet.add(newX);
    if (newX + w === other.x || newX + w === other.x + other.w) xLinesSet.add(newX + w);
    if (newY === other.y || newY === other.y + other.h) yLinesSet.add(newY);
    if (newY + h === other.y || newY + h === other.y + other.h) yLinesSet.add(newY + h);
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
  if (item) calculateSnapLines(i, item.x, item.y, newW, newH);
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
      designerStore.addMaterialSmart(material, 0, 1000);
    } catch (e) {
      console.error('Failed to parse dropped material', e);
    }
  }
};

const handleBackgroundClick = () => {
  closeCtxMenu();
  designerStore.selectNode(null);
};
</script>

<style scoped>
.canvas-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
  background: #f5f7fa;
  padding: 12px;
  min-width: 0;
}
.canvas-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.page-title-input {
  width: 220px;
}
.page-title {
  font-size: 16px;
  font-weight: 600;
}
.viewport-selector {
  margin-left: auto;
}
.page-info {
  font-size: 12px;
  color: #909399;
}
.editing-layer-tag {
  margin-left: 4px;
}
.empty-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  min-height: 360px;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  background: #fff;
}
.empty-icon {
  font-size: 48px;
  color: #c0c4cc;
  margin-bottom: 12px;
}
.canvas-viewport-wrapper {
  position: relative;
  flex: 1;
  min-height: 600px;
}
.grid-canvas {
  background-color: #ffffff;
  min-height: 600px;
  border-radius: 6px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
  position: relative;
  z-index: 2;
}
.grid-node-wrapper {
  border: 1px solid transparent;
  background-color: transparent;
  border-radius: 2px;
  padding: 0;
  position: relative;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  display: flex;
  flex-direction: column;
}
.grid-node-wrapper:hover:not(.selected) {
  border-color: rgba(64, 158, 255, 0.45);
}
.grid-node-wrapper.selected {
  border: 1px solid #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.25);
}
.node-content {
  flex: 1;
  overflow: auto;
  min-height: 0;
}
</style>

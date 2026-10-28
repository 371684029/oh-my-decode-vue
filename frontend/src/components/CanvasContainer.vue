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

      <div v-if="!preview" class="grid-controls" @click.stop>
        <el-select :model-value="String(colNum)" size="small" style="width: 110px" @change="onColsPreset">
          <el-option label="4 列" value="4" />
          <el-option label="8 列" value="8" />
          <el-option label="12 列" value="12" />
          <el-option label="24 列" value="24" />
        </el-select>
        <el-input-number
          :model-value="rowHeight"
          :min="20"
          :max="80"
          size="small"
          controls-position="right"
          style="width: 100px"
          @change="onRowHeightChange"
        />
        <el-checkbox :model-value="showAlways" size="small" @change="onShowAlwaysChange">始终网格</el-checkbox>
        <el-button type="primary" :disabled="!designerStore.selectedNodeId" @click="designerStore.openInspector()">
          属性
        </el-button>
      </div>

      <span class="page-info">组件数: {{ layoutItems.length }} · {{ colNum }}×{{ rowHeight }}</span>
    </div>

    <div v-if="layoutItems.length === 0" class="empty-placeholder">
      <el-icon class="empty-icon"><UploadFilled /></el-icon>
      <p>拖拽左侧高端表单/表格组件投射至此处画布</p>
    </div>

    <div v-else class="canvas-viewport-wrapper" :style="viewportStyle">
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
          :style="{ top: `${yRow * rowHeight}px` }"
        >
          <span class="snap-badge">网格 Row {{ yRow }}</span>
        </div>
      </div>

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
          <div v-if="!preview" class="node-toolbar">
            <span class="node-type-tag">{{ getNodeLabel(item.i) }}</span>
            <div class="toolbar-actions">
              <el-button
                size="small"
                :disabled="!canShrink(item.i)"
                title="缩小一格"
                @click.stop="scaleNode(item.i, -1)"
              >
                −
              </el-button>
              <el-button size="small" :disabled="!canGrow(item.i)" title="放大一格" @click.stop="scaleNode(item.i, 1)">
                +
              </el-button>
              <el-icon class="delete-btn" title="删除" @click.stop="designerStore.removeNode(item.i)">
                <Delete />
              </el-icon>
            </div>
          </div>

          <div class="node-content">
            <slot :node="getNode(item.i)" />
          </div>
        </grid-item>
      </grid-layout>

      <ul
        v-if="ctxMenu"
        class="node-context-menu"
        :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
        @click.stop
        @contextmenu.prevent
      >
        <li @click="onCtxCommand('props')">属性</li>
        <li @click="onCtxCommand('copy')">复制</li>
        <li class="danger" @click="onCtxCommand('delete')">删除</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { GridLayout, GridItem } from 'vue3-grid-layout-next';
import { useDesignerStore } from '../stores/designerStore';
import type { MaterialItem } from '../types/designer';
import { Monitor, Platform, Cellphone, Iphone, UploadFilled, Delete } from '@element-plus/icons-vue';
import { notifyUser } from '../utils/notifyUser';

const props = defineProps<{
  preview?: boolean;
}>();

const designerStore = useDesignerStore();
const preview = computed(() => props.preview === true);

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

const viewportMode = ref<'desktop' | 'laptop' | 'tablet' | 'mobile'>('desktop');

const viewportDefaultCols = computed(() => {
  switch (viewportMode.value) {
    case 'mobile':
      return 4;
    case 'tablet':
      return 8;
    default:
      return 12;
  }
});

const ensureGridMeta = () => {
  const meta = designerStore.pageSchema.meta;
  if (!meta.grid) {
    meta.grid = { cols: viewportDefaultCols.value, rowHeight: 50, showAlways: false };
  }
  return meta.grid;
};

const colNum = computed(() => designerStore.pageSchema.meta.grid?.cols ?? viewportDefaultCols.value);
const rowHeight = computed(() => designerStore.pageSchema.meta.grid?.rowHeight ?? 50);
const showAlways = computed(() => Boolean(designerStore.pageSchema.meta.grid?.showAlways));

const remapLayouts = (fromCols: number, toCols: number) => {
  if (fromCols === toCols || fromCols <= 0) return;
  for (const node of designerStore.activeChildren) {
    const layout = node.layout;
    layout.x = Math.min(toCols - 1, Math.round((layout.x * toCols) / fromCols));
    layout.w = Math.max(1, Math.min(toCols - layout.x, Math.round((layout.w * toCols) / fromCols) || 1));
  }
};

const onColsPreset = (val: string) => {
  const next = Number(val);
  if (!Number.isFinite(next) || next < 4) return;
  const grid = ensureGridMeta();
  const prev = grid.cols;
  remapLayouts(prev, next);
  grid.cols = next;
  designerStore.recordHistory();
};

const onRowHeightChange = (val: number | undefined) => {
  if (val == null) return;
  const grid = ensureGridMeta();
  grid.rowHeight = val;
  designerStore.recordHistory();
};

const onShowAlwaysChange = (val: boolean | string | number) => {
  const grid = ensureGridMeta();
  grid.showAlways = Boolean(val);
};

const showGridOverlay = computed(
  () => !preview.value && (showAlways.value || Boolean(designerStore.layoutGesture))
);

/** 淡虚线网格：SVG 短划线铺在 canvas 背景上 */
const gridCanvasStyle = computed(() => {
  if (!showGridOverlay.value) {
    return { backgroundColor: '#ffffff' };
  }
  const cols = colNum.value;
  const rh = rowHeight.value;
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="${rh}">` +
      `<path d="M99.5 0 V${rh}" fill="none" stroke="rgba(64,158,255,0.22)" stroke-width="1" stroke-dasharray="3 5"/>` +
      `<path d="M0 ${rh - 0.5} H100" fill="none" stroke="rgba(64,158,255,0.18)" stroke-width="1" stroke-dasharray="3 5"/>` +
      `</svg>`
  );
  return {
    backgroundColor: '#ffffff',
    backgroundImage: `url("data:image/svg+xml,${svg}")`,
    backgroundSize: `calc(100% / ${cols}) ${rh}px`
  };
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
.grid-controls {
  display: flex;
  align-items: center;
  gap: 8px;
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
.node-content {
  flex: 1;
  overflow: auto;
  min-height: 0;
}
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

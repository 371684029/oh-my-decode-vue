import { defineStore } from 'pinia';
import type { PageSchema, ComponentNode, MaterialItem, MaterialManifest } from '../types/designer';
import { findNode } from '../utils/schemaTree';
import { applyPatch, createPatch } from '../utils/jsonPatch';

import {
  entrySize,
  type GridLayoutItem,
  generateUniqueId,
  type HistoryEntry,
  rewriteActionTargets,
  rewriteNodeIds,
  shareBaseCanvas,
  stripSharedCanvasLayer,
  toHistoryDoc
} from './designerSchema';
import { createInitialState, designerGetters } from './designerState';
import { createBlackBoxNode, createLayer, createNodeFromMaterial, instantiateCompositeSnapshot } from './designerNodeFactory';
export const useDesignerStore = defineStore('designer', {
  state: createInitialState,
  getters: { ...designerGetters },
  actions: {
    flushPendingHistory() {
      if (this.historyTimer) {
        clearTimeout(this.historyTimer);
        this.historyTimer = null;
      }
      const snap = this.historyPending;
      this.historyPending = null;
      this.finalizePendingEntry();
      if (!snap || snap === JSON.stringify(this.pageSchema)) return;
      this.pushSnapshot(snap);
    },
    /** 结算 recordHistory 占位步：diff(before→当前) 为 patch 条目；无变化则弹出占位 */
    finalizePendingEntry() {
      const beforeSnap = this.historyPendingBefore;
      if (beforeSnap === null) return;
      this.historyPendingBefore = null;
      const stack = this.historyPast;
      const top = stack[stack.length - 1];
      if (!top?.pending) return;
      const before = JSON.parse(beforeSnap) as PageSchema;
      stripSharedCanvasLayer(before);
      const current = toHistoryDoc(this.pageSchema);
      const ops = createPatch(before, current);
      this.historyLastBefore = beforeSnap;
      if (ops.length === 0) {
        stack.pop();
      } else {
        stack[stack.length - 1] = { ops, inverse: createPatch(current, before) };
      }
    },
    /** 属性等直接改字段的操作：记下变更前快照，短时间多次输入合并成一步 */
    noteSchemaChange(previous: string) {
      if (this.suppressHistory) return;
      if (this.historyPending === null) this.historyPending = previous;
      if (this.historyTimer) clearTimeout(this.historyTimer);
      this.historyTimer = setTimeout(() => {
        this.historyTimer = null;
        this.flushPendingHistory();
      }, 400);
    },
    trimHistory(stack: HistoryEntry[]) {
      const newest = stack[stack.length - 1];
      const size = newest ? entrySize(newest) : 0;
      const maxSteps = size > 200000 ? 8 : size > 50000 ? 15 : 30;
      while (stack.length > maxSteps) this.dropOldest(stack);
      let total = stack.reduce((sum, item) => sum + entrySize(item), 0);
      while (stack.length > 1 && total > 1_500_000) {
        this.dropOldest(stack);
        total = stack.reduce((sum, item) => sum + entrySize(item), 0);
      }
    },
    dropOldest(stack: HistoryEntry[]) {
      stack.shift();
    },
    /** 把「snapshot → 当前」作为一步压入栈（patch 表达）；同源重复变更与空 diff 跳过 */
    pushEntry(stack: HistoryEntry[], snapshot: string) {
      this.finalizePendingEntry();
      if (snapshot === this.historyLastBefore) return;
      const before = JSON.parse(snapshot) as PageSchema;
      stripSharedCanvasLayer(before);
      const current = toHistoryDoc(this.pageSchema);
      const ops = createPatch(before, current);
      if (ops.length === 0) return;
      stack.push({ ops, inverse: createPatch(current, before) });
      this.historyLastBefore = snapshot;
      this.trimHistory(stack);
    },
    pushSnapshot(snapshot: string) {
      this.pushEntry(this.historyPast, snapshot);
      this.historyFuture = [];
    },
    /** 变更前调用：压入一个未结算占位步（变更发生后由结算点 diff 出 patch） */
    recordHistory() {
      this.flushPendingHistory();
      this.historyFuture = [];
      this.historyPast.push({ ops: [], inverse: [], pending: true });
      this.historyPendingBefore = JSON.stringify(this.pageSchema);
      this.trimHistory(this.historyPast);
    },
    beginLayoutGesture() {
      // 先结算在途占位步，保证手势条目独立成步
      this.finalizePendingEntry();
      if (!this.layoutGesture) {
        this.layoutGesture = true;
        this.layoutBefore = JSON.stringify(this.pageSchema);
      }
      // 安全网：久无 move/resize 事件时收起；拖拽中事件会不断刷新，避免 50ms 闪断
      if (this.layoutTimer) clearTimeout(this.layoutTimer);
      this.layoutTimer = setTimeout(() => this.endLayoutGesture(), 600);
    },
    endLayoutGesture() {
      if (this.layoutTimer) {
        clearTimeout(this.layoutTimer);
        this.layoutTimer = null;
      }
      if (!this.layoutGesture) return;
      const before = this.layoutBefore;
      this.layoutGesture = false;
      this.layoutBefore = null;
      if (before && before !== JSON.stringify(this.pageSchema)) this.pushSnapshot(before);
    },
    restoreSchema(snapshot: PageSchema) {
      const keepId = this.selectedNodeId;
      this.suppressHistory = true;
      this.pageSchema = shareBaseCanvas(snapshot);
      this.suppressHistory = false;
      this.selectedNodeId = keepId && this.selectedNode ? keepId : null;
      this.selectedNodeIds = this.selectedNodeId ? [this.selectedNodeId] : [];
      // v2.2：选中与属性栏解耦，恢复选中不强制开栏
    },
    undo() {
      this.flushPendingHistory();
      const entry = this.historyPast.pop();
      if (!entry) return;
      this.historyFuture.push(entry);
      this.historyLastBefore = null;
      const restored = applyPatch(toHistoryDoc(this.pageSchema), entry.inverse);
      this.restoreSchema(restored);
    },
    redo() {
      this.flushPendingHistory();
      const entry = this.historyFuture.pop();
      if (!entry) return;
      this.historyPast.push(entry);
      this.historyLastBefore = null;
      const restored = applyPatch(toHistoryDoc(this.pageSchema), entry.ops);
      this.restoreSchema(restored);
    },
    selectNode(id: string | null) {
      this.selectedNodeId = id;
      this.selectedNodeIds = id ? [id] : [];
    },
    /** 显式打开属性栏（不改变选中） */
    openInspector() {
      this.isDrawerOpen = true;
    },
    /** 关闭属性栏，不清空选中 */
    closeInspector() {
      this.isDrawerOpen = false;
    },
    /** 多选切换（additive = ctrl/shift 追加模式） */
    toggleNodeSelected(id: string, additive: boolean) {
      if (!additive || !this.selectedNodeId) {
        this.selectNode(id);
        return;
      }
      if (this.selectedNodeIds.includes(id)) {
        this.selectedNodeIds = this.selectedNodeIds.filter((n) => n !== id);
      } else {
        this.selectedNodeIds = [...this.selectedNodeIds, id];
      }
      this.selectedNodeId = this.selectedNodeIds[this.selectedNodeIds.length - 1] ?? null;
    },
    addNodeFromMaterial(material: MaterialItem, x = 0, y = 0) {
      this.recordHistory();
      const newNode = createNodeFromMaterial(material, x, y);
      this.activeChildren.push(newNode);
      this.selectNode(newNode.id);
    },
    /** 复合物料拖入实例化：深拷贝快照 → 平移落点 → 重写 id/target → 推入画布（v2.0.0） */
    /** 复合物料拖入实例化：工厂完成平移 + id/target 重写，store 只负责入栈与选中 */
    addCompositeFromMaterial(manifest: MaterialManifest, dropX = 0, dropY = 0): string {
      const nodes = instantiateCompositeSnapshot(manifest, dropX, dropY);
      if (nodes.length === 0) return '';
      this.recordHistory();
      this.activeChildren.push(...nodes);
      this.selectNode(nodes[0].id);
      return nodes[0].id;
    },
    /** 黑盒物料拖入：创建带 materialRef 的单一实例节点（渲染/出码按引用解析） */
    /** 黑盒物料拖入：创建带 materialRef 的单一实例节点（渲染/出码按引用解析） */
    addBlackBoxFromMaterial(manifest: MaterialManifest, x = 0, y = 0): string {
      this.recordHistory();
      const node = createBlackBoxNode(manifest, x, y);
      this.activeChildren.push(node);
      this.selectNode(node.id);
      return node.id;
    },
    /** 按物料形态智能落位：黑盒（有契约）→ 单实例；展开（有快照）→ 子树；原子 → 普通节点 */
    addMaterialSmart(material: MaterialItem, x = 0, y = 1000): string {
      const m = material as MaterialManifest;
      if (m.kind === 'composite' && m.contract) {
        return this.addBlackBoxFromMaterial(m, x, y);
      }
      if (m.kind === 'composite' && Array.isArray(m.schema) && m.schema.length > 0) {
        return this.addCompositeFromMaterial(m, x, y);
      }
      this.addNodeFromMaterial(material, x, y);
      return '';
    },
    updateNodeLayout(layoutList: GridLayoutItem[], options?: { history?: boolean }) {
      const record = options?.history !== false && !this.layoutGesture;
      let isChanged = false;
      layoutList.forEach((item) => {
        const node = this.activeChildren.find((n) => n.id === item.i);
        if (
          node &&
          (node.layout.x !== item.x || node.layout.y !== item.y || node.layout.w !== item.w || node.layout.h !== item.h)
        ) {
          if (!isChanged && record) {
            this.recordHistory();
            isChanged = true;
          }
          node.layout.x = item.x;
          node.layout.y = item.y;
          node.layout.w = item.w;
          node.layout.h = item.h;
        }
      });
    },
    removeNode(id: string) {
      const locate = (nodes: ComponentNode[]): ComponentNode[] | null => {
        if (nodes.some((node) => node.id === id)) return nodes;
        for (const node of nodes) {
          if (node.children) {
            const found = locate(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      const list = locate(this.activeChildren);
      if (!list) return;
      this.recordHistory();
      const idx = list.findIndex((node) => node.id === id);
      list.splice(idx, 1);
      if (this.selectedNodeId === id) {
        this.selectNode(null);
      }
    },
    /** 容器内子节点按数组顺序前后移动（弹性容器的排布顺序） */
    moveChild(parentId: string, childId: string, delta: number) {
      const parent = this.findNodeById(parentId);
      if (!parent?.children) return false;
      const index = parent.children.findIndex((node) => node.id === childId);
      const next = index + delta;
      if (index < 0 || next < 0 || next >= parent.children.length) return false;
      this.recordHistory();
      const [item] = parent.children.splice(index, 1);
      parent.children.splice(next, 0, item);
      return true;
    },
    setPageSchema(schema: PageSchema) {
      this.recordHistory();
      this.pageSchema = shareBaseCanvas(schema);
      this.editingLayerId = null;
      this.selectedNodeId = null;
      this.isDrawerOpen = false;
    },
    findNodeById(id: string): ComponentNode | null {
      return findNode(this.activeChildren, id);
    },
    addChildToNode(parentId: string, material: MaterialItem) {
      const parent = this.findNodeById(parentId);
      if (!parent) return false;
      this.recordHistory();
      if (!parent.children) parent.children = [];
      const id = generateUniqueId(material.type);
      parent.children.push({
        id,
        type: material.type,
        label: material.label,
        layout: {
          x: 0,
          y: 0,
          w: material.defaultLayout.w,
          h: material.defaultLayout.h,
          i: id
        },
        props: JSON.parse(JSON.stringify(material.defaultProps || {})),
        attrs: JSON.parse(JSON.stringify(material.defaultAttrs || {})),
        config: material.defaultConfig ? JSON.parse(JSON.stringify(material.defaultConfig)) : undefined,
        style: {},
        events: {}
      });
      this.selectNode(id);
      return true;
    },
    copySelectedNode() {
      if (!this.selectedNode) return false;
      this.copiedNode = JSON.parse(JSON.stringify(this.selectedNode));
      return true;
    },
    pasteNode() {
      if (!this.copiedNode) return false;
      this.recordHistory();
      const pastedNode: ComponentNode = JSON.parse(JSON.stringify(this.copiedNode));
      const idMap = rewriteNodeIds(pastedNode, generateUniqueId);
      rewriteActionTargets(pastedNode, idMap);
      pastedNode.layout.y += pastedNode.layout.h;
      this.activeChildren.push(pastedNode);
      this.selectNode(pastedNode.id);
      return true;
    },
    moveSelectedNodeBy(deltaX: number, deltaY: number) {
      if (!this.selectedNode) return false;
      const layout = this.selectedNode.layout;
      const newX = Math.max(0, layout.x + deltaX);
      const newY = Math.max(0, layout.y + deltaY);
      if (newX !== layout.x || newY !== layout.y) {
        this.recordHistory();
        layout.x = newX;
        layout.y = newY;
        return true;
      }
      return false;
    },
    addLayer(type: 'dialog' | 'loading' | 'custom-html', name: string) {
      this.recordHistory();
      if (!this.pageSchema.layers) this.pageSchema.layers = [];
      const layerId = generateUniqueId('layer_' + type);
      const newLayer = createLayer(type, name, layerId, (this.pageSchema.layers.length + 1) * 10);
      this.pageSchema.layers.push(newLayer);
      this.activeLayerId = layerId;
      return layerId;
    },
    removeLayer(id: string) {
      if (!this.pageSchema.layers) return;
      const idx = this.pageSchema.layers.findIndex((l) => l.id === id);
      if (idx !== -1 && this.pageSchema.layers[idx].type !== 'canvas') {
        this.recordHistory();
        this.pageSchema.layers.splice(idx, 1);
        if (this.editingLayerId === id) this.editingLayerId = null;
        this.activeLayerId = 'layer_base_canvas';
      }
    },
    toggleLayerVisible(id: string) {
      if (!this.pageSchema.layers) return;
      const layer = this.pageSchema.layers.find((l) => l.id === id);
      if (layer) {
        this.recordHistory();
        layer.visible = !layer.visible;
      }
    },
    updateLayerProps(id: string, newProps: Record<string, unknown>) {
      if (!this.pageSchema.layers) return;
      const layer = this.pageSchema.layers.find((l) => l.id === id);
      if (layer) {
        this.recordHistory();
        layer.props = { ...(layer.props || {}), ...newProps };
      }
    },
    /** 进入图层内编辑（非 canvas 图层）：画布切换为该图层 children */
    enterLayerEdit(layerId: string) {
      const layer = this.pageSchema.layers?.find((l) => l.id === layerId);
      if (layer && layer.type !== 'canvas') {
        this.editingLayerId = layerId;
        this.activeLayerId = layerId;
        this.selectNode(null);
      }
    },
    /** 退出图层内编辑，返回主画布 */
    exitLayerEdit() {
      this.editingLayerId = null;
      this.activeLayerId = 'layer_base_canvas';
      this.selectNode(null);
    }
  }
});

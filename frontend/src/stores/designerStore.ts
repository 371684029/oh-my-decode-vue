import { defineStore } from 'pinia';
import type { PageSchema, ComponentNode, MaterialItem, MaterialManifest } from '../types/designer';
import { findNode } from '../utils/schemaTree';
import { applyPatch, createPatch, type JsonPatchOp } from '../utils/jsonPatch';

type HistoryEntry = { kind: 'snap'; data: string } | { kind: 'patch'; ops: JsonPatchOp[] };

function materializeHistory(entries: HistoryEntry[]): PageSchema {
  let index = entries.length - 1;
  while (index > 0 && entries[index].kind !== 'snap') index--;
  const base = entries[index];
  if (!base || base.kind !== 'snap') throw new Error('历史栈缺少快照');
  let doc = JSON.parse(base.data) as PageSchema;
  for (let cursor = index + 1; cursor < entries.length; cursor++) {
    const entry = entries[cursor];
    doc = entry.kind === 'snap' ? (JSON.parse(entry.data) as PageSchema) : applyPatch(doc, entry.ops);
  }
  return doc;
}

function entrySize(entry: HistoryEntry): number {
  return entry.kind === 'snap' ? entry.data.length : JSON.stringify(entry.ops).length;
}

/**
 * 主画布只有一份节点数组：pageSchema.children。
 * type=canvas 的图层 children 指向同一引用，避免两套数据各写各的。
 */
export function shareBaseCanvas(schema: PageSchema): PageSchema {
  if (!schema.children) schema.children = [];
  if (!schema.layers) schema.layers = [];
  let base = schema.layers.find((layer) => layer.type === 'canvas');
  if (!base) {
    base = {
      id: 'layer_base_canvas',
      name: '主画布图层 (Base Canvas)',
      type: 'canvas',
      visible: true,
      zIndex: 1,
      children: schema.children
    };
    schema.layers.unshift(base);
    return schema;
  }
  if (schema.children.length === 0 && (base.children?.length ?? 0) > 0) {
    schema.children = base.children;
  } else {
    base.children = schema.children;
  }
  return schema;
}

/** 生成全局唯一节点/图层 id（时间戳 + 随机后缀，避免同毫秒内重复） */
const generateUniqueId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** 重写节点树全部 id（对深拷贝调用）；返回旧 id → 新 id 映射（v2.0.0 提取自 pasteNode） */
export function rewriteNodeIds(root: ComponentNode, generateId: (type: string) => string): Map<string, string> {
  const idMap = new Map<string, string>();
  const assignIds = (node: ComponentNode) => {
    const nextId = generateId(node.type);
    idMap.set(node.id, nextId);
    node.id = nextId;
    node.layout.i = nextId;
    node.children?.forEach(assignIds);
  };
  assignIds(root);
  return idMap;
}

/** 按 idMap 重写事件动作链 target 引用；不在映射内的 target 保留（执行时安全跳过） */
export function rewriteActionTargets(root: ComponentNode, idMap: Map<string, string>): void {
  const rewriteTargets = (node: ComponentNode) => {
    for (const rule of Object.values(node.events || {})) {
      rule.actions?.forEach((action) => {
        if (action.target && idMap.has(action.target)) action.target = idMap.get(action.target);
      });
    }
    node.children?.forEach(rewriteTargets);
  };
  rewriteTargets(root);
}

export const useDesignerStore = defineStore('designer', {
  state: () => ({
    pageSchema: shareBaseCanvas({
      id: 'page_' + Date.now(),
      title: '未命名低代码页面',
      type: 'page' as const,
      meta: {
        author: 'LowCode Admin',
        description: '通过低代码平台生成的页面',
        version: '1.5.0'
      },
      state: {},
      children: [] as ComponentNode[],
      layers: [
        {
          id: 'layer_base_canvas',
          name: '主画布图层 (Base Canvas)',
          type: 'canvas',
          visible: true,
          zIndex: 1,
          children: []
        }
      ]
    }),
    activeLayerId: 'layer_base_canvas' as string,
    /** 当前编辑目标图层 id（null = 主画布）；进入非 canvas 图层后在其 children 中编辑 */
    editingLayerId: null as string | null,
    selectedNodeId: null as string | null,
    /** 多选节点 id 集合（v2.0.0，用于打包为物料） */
    selectedNodeIds: [] as string[],
    copiedNode: null as ComponentNode | null,
    isDrawerOpen: false,
    drawerTab: 'props' as 'props' | 'config' | 'attrs' | 'json',
    historyPast: [] as HistoryEntry[],
    historyFuture: [] as HistoryEntry[],
    /** 撤销/重做回放时不再把恢复动作记成新历史 */
    suppressHistory: false,
    historyPending: null as string | null,
    historyTimer: null as ReturnType<typeof setTimeout> | null,
    /** 拖拽/缩放过程中不入栈，松手时记一步 */
    layoutGesture: false,
    layoutBefore: null as string | null,
    layoutTimer: null as ReturnType<typeof setTimeout> | null
  }),
  getters: {
    /** 当前编辑目标（图层 children 或主画布 children）的响应式数组引用 */
    activeChildren(state): ComponentNode[] {
      if (state.editingLayerId) {
        const layer = state.pageSchema.layers?.find((l) => l.id === state.editingLayerId);
        if (layer) return layer.children;
      }
      return state.pageSchema.children;
    },
    selectedNode(state): ComponentNode | null {
      if (!state.selectedNodeId) return null;
      const children = state.editingLayerId
        ? state.pageSchema.layers?.find((l) => l.id === state.editingLayerId)?.children
        : state.pageSchema.children;
      return findNode(children, state.selectedNodeId);
    },
    canUndo(state): boolean {
      return state.historyPast.length > 0;
    },
    canRedo(state): boolean {
      return state.historyFuture.length > 0;
    }
  },
  actions: {
    flushPendingHistory() {
      if (this.historyTimer) {
        clearTimeout(this.historyTimer);
        this.historyTimer = null;
      }
      const snap = this.historyPending;
      this.historyPending = null;
      if (!snap || snap === JSON.stringify(this.pageSchema)) return;
      this.pushSnapshot(snap);
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
      if (stack.length >= 2 && stack[0].kind === 'snap' && stack[1].kind === 'patch') {
        const state = materializeHistory(stack.slice(0, 2));
        stack.splice(0, 2, { kind: 'snap', data: JSON.stringify(state) });
        return;
      }
      stack.shift();
    },
    pushEntry(stack: HistoryEntry[], snapshot: string) {
      if (stack.length > 0 && JSON.stringify(materializeHistory(stack)) === snapshot) return;
      if (stack.length === 0 || stack.length % 10 === 0) {
        stack.push({ kind: 'snap', data: snapshot });
      } else {
        const prev = materializeHistory(stack);
        stack.push({ kind: 'patch', ops: createPatch(prev, JSON.parse(snapshot)) });
      }
      this.trimHistory(stack);
    },
    pushSnapshot(snapshot: string) {
      this.pushEntry(this.historyPast, snapshot);
      this.historyFuture = [];
    },
    recordHistory() {
      this.flushPendingHistory();
      this.pushSnapshot(JSON.stringify(this.pageSchema));
    },
    beginLayoutGesture() {
      if (!this.layoutGesture) {
        this.layoutGesture = true;
        this.layoutBefore = JSON.stringify(this.pageSchema);
      }
      if (this.layoutTimer) clearTimeout(this.layoutTimer);
      this.layoutTimer = setTimeout(() => this.endLayoutGesture(), 50);
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
      this.isDrawerOpen = !!this.selectedNodeId;
    },
    undo() {
      this.flushPendingHistory();
      if (this.historyPast.length === 0) return;
      const currentSnapshot = JSON.stringify(this.pageSchema);
      const restored = materializeHistory(this.historyPast);
      this.historyPast.pop();
      this.pushEntry(this.historyFuture, currentSnapshot);
      this.restoreSchema(restored);
    },
    redo() {
      this.flushPendingHistory();
      if (this.historyFuture.length === 0) return;
      const currentSnapshot = JSON.stringify(this.pageSchema);
      const restored = materializeHistory(this.historyFuture);
      this.historyFuture.pop();
      this.pushEntry(this.historyPast, currentSnapshot);
      this.restoreSchema(restored);
    },
    selectNode(id: string | null) {
      this.selectedNodeId = id;
      this.isDrawerOpen = !!id;
      this.selectedNodeIds = id ? [id] : [];
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
      this.isDrawerOpen = !!this.selectedNodeId;
    },
    addNodeFromMaterial(material: MaterialItem, x = 0, y = 0) {
      this.recordHistory();
      const id = generateUniqueId(material.type);
      const newNode: ComponentNode = {
        id,
        type: material.type,
        label: material.label,
        layout: {
          x,
          y,
          w: material.defaultLayout.w,
          h: material.defaultLayout.h,
          i: id
        },
        props: JSON.parse(JSON.stringify(material.defaultProps || {})),
        attrs: JSON.parse(JSON.stringify(material.defaultAttrs || {})),
        config: material.defaultConfig ? JSON.parse(JSON.stringify(material.defaultConfig)) : undefined,
        style: {},
        events: {}
      };
      this.activeChildren.push(newNode);
      this.selectNode(id);
    },
    /** 复合物料拖入实例化：深拷贝快照 → 平移落点 → 重写 id/target → 推入画布（v2.0.0） */
    addCompositeFromMaterial(manifest: MaterialManifest, dropX = 0, dropY = 0): string {
      const snapshot = manifest.schema || [];
      if (snapshot.length === 0) return '';
      this.recordHistory();
      const nodes = JSON.parse(JSON.stringify(snapshot)) as ComponentNode[];

      // 克隆快照包围盒原点（兼容非 0 起点快照），整体平移到落点
      let minX = Infinity;
      let minY = Infinity;
      const measure = (list: ComponentNode[]) => {
        for (const node of list) {
          minX = Math.min(minX, node.layout.x);
          minY = Math.min(minY, node.layout.y);
          if (node.children?.length) measure(node.children);
        }
      };
      measure(nodes);
      const tx = dropX - (Number.isFinite(minX) ? minX : 0);
      const ty = dropY - (Number.isFinite(minY) ? minY : 0);
      const translate = (list: ComponentNode[]) => {
        for (const node of list) {
          node.layout.x += tx;
          node.layout.y += ty;
          if (node.children?.length) translate(node.children);
        }
      };
      translate(nodes);

      // 先共享 idMap 重写全部子孙 id，再统一重写事件 target（跨顶层节点的引用也正确）
      const idMap = new Map<string, string>();
      for (const node of nodes) {
        const map = rewriteNodeIds(node, generateUniqueId);
        map.forEach((next, prev) => idMap.set(prev, next));
      }
      for (const node of nodes) {
        rewriteActionTargets(node, idMap);
      }

      this.activeChildren.push(...nodes);
      this.selectNode(nodes[0].id);
      return nodes[0].id;
    },
    /** 黑盒物料拖入：创建带 materialRef 的单一实例节点（渲染/出码按引用解析） */
    addBlackBoxFromMaterial(manifest: MaterialManifest, x = 0, y = 0): string {
      this.recordHistory();
      const id = generateUniqueId(manifest.type);
      const node: ComponentNode = {
        id,
        type: manifest.type,
        label: manifest.label,
        layout: { x, y, w: manifest.defaultLayout.w, h: manifest.defaultLayout.h, i: id },
        props: {},
        attrs: {},
        style: {},
        events: {},
        materialRef: { id: manifest.type, version: manifest.currentVersion || '1.0.0', follow: 'pin' }
      };
      this.activeChildren.push(node);
      this.selectNode(id);
      return id;
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
    updateNodeLayout(layoutList: any[], options?: { history?: boolean }) {
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
      const defaultProps: any = {};

      if (type === 'custom-html') {
        defaultProps.htmlCode =
          '<div class="custom-card">\n  <h3>自定义 HTML 图层内容</h3>\n  <p id="time-text">正在加载...</p>\n</div>';
        defaultProps.cssCode =
          '.custom-card { padding: 12px; background: #f0f9eb; border: 1px solid #67c23a; border-radius: 6px; color: #303133; }';
        defaultProps.scriptMounted =
          'const el = container.querySelector("#time-text"); if (el) { el.innerText = "挂载时间: " + new Date().toLocaleTimeString(); }';
        defaultProps.scriptUnmounted = 'console.log("自定义 HTML 图层已被卸载!");';
      } else if (type === 'dialog') {
        defaultProps.title = name || '业务弹窗图层';
        defaultProps.width = '50%';
      } else if (type === 'loading') {
        defaultProps.loadingText = '全屏数据加载中，请稍候...';
      }

      const newLayer = {
        id: layerId,
        name:
          name || (type === 'dialog' ? '业务弹窗图层' : type === 'loading' ? 'Loading 遮罩图层' : '自定义 HTML 图层'),
        type,
        visible: type === 'custom-html',
        zIndex: (this.pageSchema.layers.length + 1) * 10,
        props: defaultProps,
        children: []
      };

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
    updateLayerProps(id: string, newProps: Record<string, any>) {
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

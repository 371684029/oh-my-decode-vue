import { defineStore } from 'pinia';
import type { PageSchema, ComponentNode, MaterialItem, MaterialManifest } from '../types/designer';
import { findNode } from '../utils/schemaTree';
import { applyPatch, createPatch, type JsonPatchOp } from '../utils/jsonPatch';

/**
 * 撤销历史条目（v2.4.0 patch 式）：只存正向 patch（before→after）与反向 patch（after→before），
 * 不存全量 Schema 快照。undo 对当前状态应用 inverse、redo 应用 ops，因此条目可独立撤销/重做。
 * pending 标记 = recordHistory 落下的未结算占位步（变更尚未发生，before 暂存于 historyPendingBefore），
 * 在下一次结算点（recordHistory / flush / 手势开始 / undo / redo）diff 出 ops；无变化则弹出。
 */
type HistoryEntry = { ops: JsonPatchOp[]; inverse: JsonPatchOp[]; pending?: true };

/**
 * 主画布图层 children 与 schema.children 同源（shareBaseCanvas）。
 * 历史 diff 前清空该副本，避免同一子树在 patch 里出现两份路径；恢复后由 shareBaseCanvas 重新链接。
 */
function stripSharedCanvasLayer(doc: PageSchema): void {
  const base = doc.layers?.find((layer) => layer.type === 'canvas');
  if (base) base.children = [];
}

function toHistoryDoc(schema: PageSchema): PageSchema {
  const doc = JSON.parse(JSON.stringify(schema)) as PageSchema;
  stripSharedCanvasLayer(doc);
  return doc;
}

function entrySize(entry: HistoryEntry): number {
  return JSON.stringify(entry.ops).length + JSON.stringify(entry.inverse).length;
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
    /** recordHistory 占位步的 before 快照（全仓同一时刻至多一份，结算即释放） */
    historyPendingBefore: null as string | null,
    /** 最近一次结算的 before 快照，用于丢弃重复入栈的同源变更 */
    historyLastBefore: null as string | null,
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
        events:
          material.type === 'pro-table'
            ? {
                view: {
                  enabled: true,
                  actions: [
                    {
                      id: 'default-view-msg',
                      type: 'show_message',
                      payload: {
                        messageType: 'info',
                        messageText: "查看 · {{ event.row.name || event.row.title || event.row.id || '当前行' }}"
                      }
                    }
                  ]
                },
                delete: {
                  enabled: true,
                  actions: [
                    {
                      id: 'default-delete-msg',
                      type: 'show_message',
                      payload: {
                        messageType: 'warning',
                        messageText: "删除 · {{ event.row.name || event.row.title || event.row.id || '当前行' }}"
                      }
                    }
                  ]
                }
              }
            : {}
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

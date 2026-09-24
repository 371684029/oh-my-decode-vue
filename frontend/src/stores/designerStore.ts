import { defineStore } from 'pinia';
import type { PageSchema, ComponentNode, MaterialItem } from '../types/designer';
import { findNode } from '../utils/schemaTree';

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

export const useDesignerStore = defineStore('designer', {
  state: () => ({
    pageSchema: shareBaseCanvas({
      id: 'page_' + Date.now(),
      title: '未命名低代码页面',
      type: 'page' as const,
      meta: {
        author: 'LowCode Admin',
        description: '通过低代码平台生成的页面',
        version: '1.3.0'
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
    copiedNode: null as ComponentNode | null,
    isDrawerOpen: false,
    drawerTab: 'props' as 'props' | 'config' | 'attrs' | 'json',
    historyPast: [] as string[],
    historyFuture: [] as string[]
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
    recordHistory() {
      const snapshot = JSON.stringify(this.pageSchema);
      // 去重：与最近一次快照相同则跳过（避免无效历史）
      if (this.historyPast.length > 0 && this.historyPast[this.historyPast.length - 1] === snapshot) {
        return;
      }
      // 自适应历史深度：schema 越大保留步数越少，控制内存占用
      const size = snapshot.length;
      const maxSteps = size > 200000 ? 8 : size > 50000 ? 15 : 30;
      while (this.historyPast.length >= maxSteps) {
        this.historyPast.shift();
      }
      this.historyPast.push(snapshot);
      this.historyFuture = [];
    },
    undo() {
      if (this.historyPast.length === 0) return;
      const currentSnapshot = JSON.stringify(this.pageSchema);
      this.historyFuture.push(currentSnapshot);

      const previousSnapshot = this.historyPast.pop()!;
      const keepId = this.selectedNodeId;
      this.pageSchema = shareBaseCanvas(JSON.parse(previousSnapshot));
      this.selectedNodeId = keepId && this.selectedNode ? keepId : null;
      this.isDrawerOpen = !!this.selectedNodeId;
    },
    redo() {
      if (this.historyFuture.length === 0) return;
      const currentSnapshot = JSON.stringify(this.pageSchema);
      this.historyPast.push(currentSnapshot);

      const nextSnapshot = this.historyFuture.pop()!;
      const keepId = this.selectedNodeId;
      this.pageSchema = shareBaseCanvas(JSON.parse(nextSnapshot));
      this.selectedNodeId = keepId && this.selectedNode ? keepId : null;
      this.isDrawerOpen = !!this.selectedNodeId;
    },
    selectNode(id: string | null) {
      this.selectedNodeId = id;
      this.isDrawerOpen = !!id;
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
    updateNodeLayout(layoutList: any[]) {
      let isChanged = false;
      layoutList.forEach((item) => {
        const node = this.activeChildren.find((n) => n.id === item.i);
        if (
          node &&
          (node.layout.x !== item.x || node.layout.y !== item.y || node.layout.w !== item.w || node.layout.h !== item.h)
        ) {
          if (!isChanged) {
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
      const idx = this.activeChildren.findIndex((n) => n.id === id);
      if (idx !== -1) {
        this.recordHistory();
        this.activeChildren.splice(idx, 1);
        if (this.selectedNodeId === id) {
          this.selectNode(null);
        }
      }
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
      const newId = generateUniqueId(this.copiedNode.type);
      const pastedNode: ComponentNode = JSON.parse(JSON.stringify(this.copiedNode));
      pastedNode.id = newId;
      pastedNode.layout.i = newId;
      pastedNode.layout.y += pastedNode.layout.h; // 下移一行排列
      this.activeChildren.push(pastedNode);
      this.selectNode(newId);
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
        visible: true,
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

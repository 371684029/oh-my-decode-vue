import { defineStore } from 'pinia';
import type { PageSchema, ComponentNode, MaterialItem } from '../types/designer';

export const useDesignerStore = defineStore('designer', {
  state: () => ({
    pageSchema: {
      id: 'page_' + Date.now(),
      title: '未命名低代码页面',
      type: 'page' as const,
      meta: {
        author: 'LowCode Admin',
        description: '通过低代码平台生成的页面',
        version: '1.2.0'
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
    } as PageSchema,
    activeLayerId: 'layer_base_canvas' as string,
    selectedNodeId: null as string | null,
    copiedNode: null as ComponentNode | null,
    isDrawerOpen: false,
    drawerTab: 'props' as 'props' | 'config' | 'attrs' | 'json',
    historyPast: [] as string[],
    historyFuture: [] as string[]
  }),
  getters: {
    selectedNode(state): ComponentNode | null {
      if (!state.selectedNodeId) return null;
      return state.pageSchema.children.find((node: ComponentNode) => node.id === state.selectedNodeId) || null;
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
      // 限制最大撤销步数为 30
      if (this.historyPast.length >= 30) {
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
      this.pageSchema = JSON.parse(previousSnapshot);
      this.selectedNodeId = null;
      this.isDrawerOpen = false;
    },
    redo() {
      if (this.historyFuture.length === 0) return;
      const currentSnapshot = JSON.stringify(this.pageSchema);
      this.historyPast.push(currentSnapshot);

      const nextSnapshot = this.historyFuture.pop()!;
      this.pageSchema = JSON.parse(nextSnapshot);
      this.selectedNodeId = null;
      this.isDrawerOpen = false;
    },
    selectNode(id: string | null) {
      this.selectedNodeId = id;
      this.isDrawerOpen = !!id;
    },
    addNodeFromMaterial(material: MaterialItem, x = 0, y = 0) {
      this.recordHistory();
      const id = material.type + '_' + Date.now().toString(36).substring(4);
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
      this.pageSchema.children.push(newNode);
      this.selectNode(id);
    },
    updateNodeLayout(layoutList: any[]) {
      let isChanged = false;
      layoutList.forEach((item) => {
        const node = this.pageSchema.children.find((n) => n.id === item.i);
        if (node && (node.layout.x !== item.x || node.layout.y !== item.y || node.layout.w !== item.w || node.layout.h !== item.h)) {
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
      const idx = this.pageSchema.children.findIndex((n) => n.id === id);
      if (idx !== -1) {
        this.recordHistory();
        this.pageSchema.children.splice(idx, 1);
        if (this.selectedNodeId === id) {
          this.selectNode(null);
        }
      }
    },
    setPageSchema(schema: PageSchema) {
      this.recordHistory();
      this.pageSchema = schema;
      this.selectedNodeId = null;
      this.isDrawerOpen = false;
    },
    copySelectedNode() {
      if (!this.selectedNode) return false;
      this.copiedNode = JSON.parse(JSON.stringify(this.selectedNode));
      return true;
    },
    pasteNode() {
      if (!this.copiedNode) return false;
      this.recordHistory();
      const newId = this.copiedNode.type + '_' + Date.now().toString(36).substring(4);
      const pastedNode: ComponentNode = JSON.parse(JSON.stringify(this.copiedNode));
      pastedNode.id = newId;
      pastedNode.layout.i = newId;
      pastedNode.layout.y += pastedNode.layout.h; // 下移一行排列
      this.pageSchema.children.push(pastedNode);
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
      const layerId = 'layer_' + type + '_' + Date.now().toString(36).substring(4);
      const defaultProps: any = {};

      if (type === 'custom-html') {
        defaultProps.htmlCode = '<div class="custom-card">\n  <h3>自定义 HTML 图层内容</h3>\n  <p id="time-text">正在加载...</p>\n</div>';
        defaultProps.cssCode = '.custom-card { padding: 12px; background: #f0f9eb; border: 1px solid #67c23a; border-radius: 6px; color: #303133; }';
        defaultProps.scriptMounted = 'const el = container.querySelector("#time-text"); if (el) { el.innerText = "挂载时间: " + new Date().toLocaleTimeString(); }';
        defaultProps.scriptUnmounted = 'console.log("自定义 HTML 图层已被卸载!");';
      } else if (type === 'dialog') {
        defaultProps.title = name || '业务弹窗图层';
        defaultProps.width = '50%';
      } else if (type === 'loading') {
        defaultProps.loadingText = '全屏数据加载中，请稍候...';
      }

      const newLayer = {
        id: layerId,
        name: name || (type === 'dialog' ? '业务弹窗图层' : type === 'loading' ? 'Loading 遮罩图层' : '自定义 HTML 图层'),
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
    }
  }
});

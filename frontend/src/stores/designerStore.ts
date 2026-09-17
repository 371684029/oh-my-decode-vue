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
        version: '0.0.1'
      },
      state: {},
      children: [] as ComponentNode[]
    } as PageSchema,
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
    }
  }
});

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
    isDrawerOpen: false,
    drawerTab: 'props' as 'props' | 'config' | 'attrs' | 'json'
  }),
  getters: {
    selectedNode(state): ComponentNode | null {
      if (!state.selectedNodeId) return null;
      return state.pageSchema.children.find((node: ComponentNode) => node.id === state.selectedNodeId) || null;
    }
  },
  actions: {
    selectNode(id: string | null) {
      this.selectedNodeId = id;
      this.isDrawerOpen = !!id;
    },
    addNodeFromMaterial(material: MaterialItem, x = 0, y = 0) {
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
      layoutList.forEach((item) => {
        const node = this.pageSchema.children.find((n) => n.id === item.i);
        if (node) {
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
        this.pageSchema.children.splice(idx, 1);
        if (this.selectedNodeId === id) {
          this.selectNode(null);
        }
      }
    },
    setPageSchema(schema: PageSchema) {
      this.pageSchema = schema;
      this.selectedNodeId = null;
      this.isDrawerOpen = false;
    }
  }
});

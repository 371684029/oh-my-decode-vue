/**
 * 设计器初始状态 (v2.8.0 巨型文件拆分 #3)。
 *
 * 从 designerStore 抽出的 `state` 定义。纯字面量、无外部依赖，
 * Pinia 通过 `state: createInitialState` 直接引用本函数。
 */

import type { ComponentNode } from '../types/designer';
import { findNode } from '../utils/schemaTree';
import { shareBaseCanvas, type HistoryEntry } from './designerSchema';

export function createInitialState() {
  return {
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
  };
}

export type DesignerState = ReturnType<typeof createInitialState>;

/**
 * 设计器 getter 定义 (v2.8.0 巨型文件拆分 #4)。
 *
 * 与 state 一样是纯 `state => ...` 取值（不访问 `this`），
 * 因此可以和初始状态放在同一模块，各自独立推导类型。
 */
export const designerGetters = {
  /** 当前编辑目标（图层 children 或主画布 children）的响应式数组引用 */
   /** 当前编辑目标（图层 children 或主画布 children）的响应式数组引用 */
  activeChildren(state: DesignerState): ComponentNode[] {
    if (state.editingLayerId) {
      const layer = state.pageSchema.layers?.find((l) => l.id === state.editingLayerId);
      if (layer) return layer.children;
    }
    return state.pageSchema.children;
  },
  selectedNode(state: DesignerState): ComponentNode | null {
    if (!state.selectedNodeId) return null;
    const children = state.editingLayerId
      ? state.pageSchema.layers?.find((l) => l.id === state.editingLayerId)?.children
      : state.pageSchema.children;
    return findNode(children, state.selectedNodeId);
  },
  canUndo(state: DesignerState): boolean {
    return state.historyPast.length > 0;
  },
  canRedo(state: DesignerState): boolean {
    return state.historyFuture.length > 0;
  }
};

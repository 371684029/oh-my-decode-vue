/**
 * 设计器 Schema 纯工具 (v2.8.0 巨型文件拆分 #1)。
 *
 * 从 designerStore 抽出的**纯函数与类型**（不含任何 store 状态访问）：
 * 撤销历史条目定义、主画布同源链接、历史 diff 前的副本剥离、
 * id 生成，以及树 id / 事件 target 重写。
 *
 * 抽出的边界是「没有 `this` 的代码」——不碰 action 体，因此拆分不会
 * 改变任何 store 行为，可以独立测试。
 */

import type { ComponentNode, PageSchema } from '../types/designer';
import type { JsonPatchOp } from '../utils/jsonPatch';

/**
 * 撤销历史条目（v2.4.0 patch 式）：只存正向 patch（before→after）与反向 patch（after→before），
 * 不存全量 Schema 快照。undo 对当前状态应用 inverse、redo 应用 ops，因此条目可独立撤销/重做。
 * pending 标记 = recordHistory 落下的未结算占位步（变更尚未发生，before 暂存于 historyPendingBefore），
 * 在下一次结算点（recordHistory / flush / 手势开始 / undo / redo）diff 出 ops；无变化则弹出。
 */
export type HistoryEntry = { ops: JsonPatchOp[]; inverse: JsonPatchOp[]; pending?: true };

/** vue3-grid-layout-next 布局条目（库未导出类型，按 updateNodeLayout 实际使用字段定义） */
export interface GridLayoutItem {
  x: number;
  y: number;
  w: number;
  h: number;
  i: string;
}

/**
 * 主画布图层 children 与 schema.children 同源（shareBaseCanvas）。
 * 历史 diff 前清空该副本，避免同一子树在 patch 里出现两份路径；恢复后由 shareBaseCanvas 重新链接。
 */
export function stripSharedCanvasLayer(doc: PageSchema): void {
  const base = doc.layers?.find((layer) => layer.type === 'canvas');
  if (base) base.children = [];
}

export function toHistoryDoc(schema: PageSchema): PageSchema {
  const doc = JSON.parse(JSON.stringify(schema)) as PageSchema;
  stripSharedCanvasLayer(doc);
  return doc;
}

export function entrySize(entry: HistoryEntry): number {
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
export const generateUniqueId = (prefix: string): string =>
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

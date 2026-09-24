/**
 * 设计器渲染与出码引擎共同承认的节点类型。
 * 新增物料时必须同时登记此处，并补上 NodeRenderer 分支与 codeGenerator 模板。
 */
export const RENDERED_NODE_TYPES = [
  'pro-table',
  'pro-form',
  'pro-container',
  'el-button',
  'el-input',
  'el-card',
  'el-tag',
  'el-alert',
  'el-switch',
  'el-divider'
] as const;

export type RenderedNodeType = (typeof RENDERED_NODE_TYPES)[number];

export function isRenderedNodeType(type: string): type is RenderedNodeType {
  return (RENDERED_NODE_TYPES as readonly string[]).includes(type);
}

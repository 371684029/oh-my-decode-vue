/** 未配置数据源时，设计器与出码共用的表格占位行。 */
export const TABLE_PLACEHOLDER_ROWS = [
  { id: 101, name: '张三', role: '系统管理员', status: '正常', updatedAt: '2026-09-15' },
  { id: 102, name: '李四', role: '前端开发者', status: '启用', updatedAt: '2026-09-15' }
] as const;

export function placeholderTableTotal(): number {
  return TABLE_PLACEHOLDER_ROWS.length;
}

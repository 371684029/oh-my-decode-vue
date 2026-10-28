/** 表格行操作兜底文案（设计器与出码共用规则） */

export type RowActionDef = { label?: string; type?: string; eventKey?: string };

export function rowSummary(row: Record<string, unknown> | null | undefined): string {
  if (!row || typeof row !== 'object') return '当前行';
  const preferred = [row.name, row.title, row.label, row.id];
  for (const v of preferred) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
  }
  for (const v of Object.values(row)) {
    if (v !== undefined && v !== null && typeof v !== 'object' && String(v).trim() !== '') return String(v);
  }
  return '当前行';
}

export function resolveActionLabel(eventKey: string, actions?: RowActionDef[]): string {
  const found = (actions || []).find((a) => a.eventKey === eventKey);
  if (found?.label) return found.label;
  const fallback: Record<string, string> = { view: '查看', delete: '删除', edit: '编辑' };
  return fallback[eventKey] || eventKey;
}

export function resolveActionMessageType(
  eventKey: string,
  actions?: RowActionDef[]
): 'success' | 'warning' | 'info' {
  const found = (actions || []).find((a) => a.eventKey === eventKey);
  if (found?.type === 'danger' || eventKey === 'delete') return 'warning';
  if (found?.type === 'success') return 'success';
  return 'info';
}

export function formatRowActionMessage(
  eventKey: string,
  row: Record<string, unknown> | null | undefined,
  actions?: RowActionDef[]
): { type: 'success' | 'warning' | 'info'; message: string } {
  return {
    type: resolveActionMessageType(eventKey, actions),
    message: `${resolveActionLabel(eventKey, actions)} · ${rowSummary(row)}`
  };
}

/** 出码用：与 formatRowActionMessage 规则对齐的兜底 JS 语句（已在 handleRowAction 内） */
export function rowActionFallbackStatements(
  messageApi: 'ElMessage' | 'ElementPlus.ElMessage',
  typed = true
): string[] {
  const cast = typed ? ' as Record<string, string>' : '';
  return [
    `const preferred = [row?.name, row?.title, row?.label, row?.id];`,
    `let rowLabel = '当前行';`,
    `for (const v of preferred) { if (v !== undefined && v !== null && String(v).trim() !== '') { rowLabel = String(v); break; } }`,
    `if (rowLabel === '当前行' && row && typeof row === 'object') { for (const v of Object.values(row)) { if (v !== undefined && v !== null && typeof v !== 'object' && String(v).trim() !== '') { rowLabel = String(v); break; } } }`,
    `const actionLabel = ({ view: '查看', delete: '删除', edit: '编辑' }${cast})[eventKey] || eventKey;`,
    `${messageApi}({ type: eventKey === 'delete' ? 'warning' : 'info', message: actionLabel + ' · ' + rowLabel });`
  ];
}

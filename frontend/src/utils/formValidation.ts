import type { ActionNode, EventRule } from '../types/designer';

export interface FormItemLike {
  field?: string;
  name?: string;
  label?: string;
  component?: string;
  type?: string;
  required?: boolean;
}

export interface RequiredField {
  field: string;
  label: string;
}

const CHECKED_COMPONENTS = new Set(['input', 'select', 'date']);

/** 需要拦截空值的必填项。开关不参与，false 是合法值。 */
export function requiredInputFields(items: FormItemLike[] | undefined): RequiredField[] {
  const fields: RequiredField[] = [];
  for (const item of items || []) {
    const kind = item.component || item.type;
    if (!item.required || !kind || !CHECKED_COMPONENTS.has(kind)) continue;
    const field = item.field || item.name || '';
    if (!field) continue;
    fields.push({ field, label: item.label || field });
  }
  return fields;
}

export function isEmptyRequiredValue(value: unknown): boolean {
  if (value == null) return true;
  return String(value).trim() === '';
}

export function emptyRequiredFields(
  items: FormItemLike[] | undefined,
  values: Record<string, unknown> | undefined
): RequiredField[] {
  return requiredInputFields(items).filter((item) => isEmptyRequiredValue(values?.[item.field]));
}

/** 校验通过后才执行 submit 动作并提示成功。 */
export async function submitDesignerForm(
  events: Record<string, EventRule> | undefined,
  items: FormItemLike[] | undefined,
  values: Record<string, unknown>,
  deps: {
    notify: (type: 'success' | 'warning', message: string) => void;
    runActions: (actions: ActionNode[]) => Promise<void>;
  }
): Promise<{ ok: boolean; missing: RequiredField[] }> {
  const missing = emptyRequiredFields(items, values);
  if (missing.length > 0) return { ok: false, missing };
  const rule = events?.submit;
  if (rule?.enabled && rule.actions.length > 0) await deps.runActions(rule.actions);
  deps.notify('success', '表单提交成功');
  return { ok: true, missing: [] };
}

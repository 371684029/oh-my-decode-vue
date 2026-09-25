import type { ComponentNode } from '../types/designer';

export interface MaterialFieldContract {
  name: string;
  label: string;
  required: boolean;
  source: 'props' | 'config';
}

/** 自制组件必填项。缺了只警告，不阻止保存和渲染。 */
export const MATERIAL_CONTRACTS: Record<string, MaterialFieldContract[]> = {
  'pro-table': [{ name: 'columns', label: '列定义', required: true, source: 'config' }],
  'pro-form': [{ name: 'items', label: '表单项', required: true, source: 'config' }],
  'pro-container': [{ name: 'title', label: '容器标题', required: true, source: 'props' }]
};

export function missingRequiredFields(node: Pick<ComponentNode, 'type' | 'props' | 'config'>): MaterialFieldContract[] {
  const fields = MATERIAL_CONTRACTS[node.type] || [];
  return fields.filter((field) => {
    if (!field.required) return false;
    const bag = field.source === 'props' ? node.props : node.config;
    const value = bag?.[field.name];
    if (value === undefined || value === null || value === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  });
}

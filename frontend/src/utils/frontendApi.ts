import type { ApiBinding, ComponentNode, PageSchema } from '../types/designer';
import { TABLE_PLACEHOLDER_ROWS } from './tablePlaceholder';

const MOCK_PREFIX = '/api/mock/';

/** 主画布节点 + 非 canvas 图层节点 + 嵌套 children（canvas 图层与 children 同源，不重复收集） */
function collectNodes(schema: PageSchema): ComponentNode[] {
  const acc: ComponentNode[] = [];
  const walk = (nodes?: ComponentNode[]) => {
    for (const node of nodes || []) {
      acc.push(node);
      walk(node.children);
    }
  };
  walk(schema.children);
  for (const layer of schema.layers || []) {
    if (layer.type === 'canvas') continue;
    walk(layer.children);
  }
  return acc;
}

function columnProps(node: ComponentNode): string[] {
  const columns = node.config?.columns;
  if (!Array.isArray(columns)) return [];
  return columns
    .map((col) => (col && typeof col === 'object' ? String((col as { prop?: unknown }).prop ?? '') : ''))
    .filter(Boolean);
}

function tableExample(node: ComponentNode): { data: { list: Record<string, unknown>[]; total: number } } {
  const props = columnProps(node);
  const placeholder = TABLE_PLACEHOLDER_ROWS.map((row) => ({ ...row }));
  const rows =
    props.length > 0 && props.every((prop) => prop in placeholder[0])
      ? placeholder
      : [1, 2].map((index) => {
          const row: Record<string, unknown> = { id: 100 + index };
          const fields = props.length > 0 ? props : ['id', 'name'];
          for (const prop of fields) {
            if (prop === 'id') row[prop] = 100 + index;
            else row[prop] = `${prop}-${index}`;
          }
          return row;
        });
  return { data: { list: rows, total: rows.length } };
}

function formExample(node: ComponentNode): { data: Record<string, unknown> } {
  const items = Array.isArray(node.config?.items) ? node.config.items : [];
  const data: Record<string, unknown> = {};
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as { field?: unknown; component?: unknown; label?: unknown; options?: unknown };
    const field = typeof item.field === 'string' ? item.field : '';
    if (!field) continue;
    if (item.component === 'switch') {
      data[field] = true;
      continue;
    }
    if (item.component === 'date') {
      data[field] = '2026-09-15';
      continue;
    }
    if (item.component === 'select' && Array.isArray(item.options)) {
      const first = item.options.find((option) => option && typeof option === 'object') as
        | { value?: unknown }
        | undefined;
      data[field] = first && 'value' in first ? first.value : '';
      continue;
    }
    data[field] = field === 'username' ? '张三' : `示例${typeof item.label === 'string' ? item.label : field}`;
  }
  return { data };
}

function pageSize(node: ComponentNode): number {
  const pagination = node.config?.pagination as { pageSize?: unknown } | undefined;
  const size = pagination?.pageSize;
  return typeof size === 'number' && size > 0 ? size : 10;
}

function buildMockBinding(node: ComponentNode): ApiBinding {
  if (node.type === 'pro-form') {
    return {
      url: `${MOCK_PREFIX}${node.id}`,
      method: 'GET',
      params: {},
      autoFetch: true,
      responsePath: 'data',
      example: formExample(node)
    };
  }
  return {
    url: `${MOCK_PREFIX}${node.id}`,
    method: 'GET',
    params: { page: '{{ state.page }}', size: pageSize(node) },
    autoFetch: true,
    responsePath: 'data.list',
    totalProp: 'data.total',
    example: tableExample(node)
  };
}

/** 只给还没有 url 的表格和表单补上 Mock，返回新绑定的节点 id。 */
export function applyMockBindings(schema: PageSchema): string[] {
  const added: string[] = [];
  for (const node of collectNodes(schema)) {
    if (node.type !== 'pro-table' && node.type !== 'pro-form') continue;
    if (node.apiBinding?.url?.trim()) continue;
    node.apiBinding = buildMockBinding(node);
    added.push(node.id);
  }
  return added;
}

function fence(json: string): string {
  const marker = json.includes('```') ? '~~~' : '```';
  return `${marker}json\n${json}\n${marker}`;
}

function formatParams(params: Record<string, unknown> | undefined): string {
  const entries = Object.entries(params ?? {});
  if (entries.length === 0) return '无';
  return entries
    .map(([key, value]) => `- \`${key}\`：${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join('\n');
}

/** 写出当前页面每个已绑定数据源的方法、路径、参数和响应示例。 */
export function renderApiMarkdown(schema: PageSchema): string {
  const nodes = collectNodes(schema).filter((node) => node.apiBinding?.url?.trim());
  const title = schema.title?.trim() || '未命名页面';
  if (nodes.length === 0) {
    return `# ${title} 接口文档\n\n当前页面没有已绑定的接口。\n`;
  }
  const sections = nodes.map((node, index) => {
    const binding = node.apiBinding as ApiBinding;
    const method = binding.method ?? 'GET';
    const lines = [
      `## ${index + 1}. ${node.label || node.type} \`${node.id}\``,
      '',
      `- 组件：\`${node.type}\``,
      `- 方法：${method}`,
      `- 路径：\`${binding.url}\``,
      `- 参数：`,
      formatParams(binding.params)
    ];
    if (binding.responsePath) lines.push(`- 数据路径：\`${binding.responsePath}\``);
    if (binding.totalProp) lines.push(`- 总数字段：\`${binding.totalProp}\``);
    lines.push('', '响应示例：', '');
    if (binding.example !== undefined) {
      lines.push(fence(JSON.stringify(binding.example, null, 2)));
    } else {
      lines.push('未提供响应示例。');
    }
    return lines.join('\n');
  });
  return [
    `# ${title} 接口文档`,
    '',
    '以下是这个页面前端实际会请求的接口。`/api/mock/` 开头的地址在设计器里直接返回响应示例；导出的页面仍按该路径发起请求。',
    '',
    ...sections
  ].join('\n');
}

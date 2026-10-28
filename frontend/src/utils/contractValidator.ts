import type { ComponentNode } from '../types/designer';
import { getMaterial } from '../registry/materialRegistry';

/**
 * 组件 I/O 契约校验（v2.3.0）
 * - validateComponentProps：属性/配置的类型与必填 IO 警告（与 materialContract 的必填项互补）
 * - getOutputPayloadHints：事件出口的 payload 提示（可引用路径 / payloadSchema）
 *
 * 只出警告，不阻止保存与渲染。与 docs/implemented/COMPONENT_IO_SPECIFICATION.md 对齐。
 */

export interface PropIoIssue {
  name: string;
  message: string;
}

export interface OutputPayloadHint {
  name: string;
  label: string;
  description?: string;
  payloadSchema?: {
    type: 'object' | 'array' | 'string' | 'number';
    properties?: Record<string, { type: string; description: string }>;
  };
  samplePaths: string[];
}

type ExpectedType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'expression' | 'data';

interface FieldContract {
  name: string;
  label: string;
  source: 'props' | 'config';
  expected: ExpectedType;
  required?: boolean;
}

/** 内置物料的期望入参类型（漏配/未知字段不报，只报显式登记的字段） */
const BUILTIN_FIELD_CONTRACTS: Record<string, FieldContract[]> = {
  'pro-table': [
    { name: 'border', label: '边框', source: 'props', expected: 'boolean' },
    { name: 'stripe', label: '斑马纹', source: 'props', expected: 'boolean' },
    { name: 'size', label: '尺寸', source: 'props', expected: 'string' },
    { name: 'columns', label: '列定义', source: 'config', expected: 'array', required: true },
    { name: 'actions', label: '行操作', source: 'config', expected: 'array' },
    { name: 'pagination', label: '分页配置', source: 'config', expected: 'object' }
  ],
  'pro-form': [
    { name: 'labelWidth', label: '标签宽度', source: 'props', expected: 'string' },
    { name: 'layout', label: '布局', source: 'props', expected: 'string' },
    { name: 'size', label: '尺寸', source: 'props', expected: 'string' },
    { name: 'items', label: '表单项', source: 'config', expected: 'array', required: true }
  ],
  'pro-container': [
    { name: 'title', label: '容器标题', source: 'props', expected: 'string', required: true },
    { name: 'direction', label: '排列方向', source: 'props', expected: 'string' },
    { name: 'padding', label: '内边距', source: 'props', expected: 'string' }
  ],
  'el-button': [
    { name: 'type', label: '按钮类型', source: 'props', expected: 'string' },
    { name: 'text', label: '按钮文字', source: 'props', expected: 'string' },
    { name: 'size', label: '尺寸', source: 'props', expected: 'string' }
  ],
  'el-input': [
    { name: 'placeholder', label: '占位提示', source: 'props', expected: 'string' },
    { name: 'clearable', label: '可清空', source: 'props', expected: 'boolean' }
  ],
  'el-card': [
    { name: 'header', label: '卡片标题', source: 'props', expected: 'string' },
    { name: 'content', label: '卡片内容', source: 'props', expected: 'string' },
    { name: 'shadow', label: '阴影', source: 'props', expected: 'string' }
  ],
  'el-tag': [
    { name: 'text', label: '标签文字', source: 'props', expected: 'string' },
    { name: 'type', label: '标签类型', source: 'props', expected: 'string' },
    { name: 'effect', label: '主题', source: 'props', expected: 'string' }
  ],
  'el-alert': [
    { name: 'title', label: '标题', source: 'props', expected: 'string' },
    { name: 'type', label: '类型', source: 'props', expected: 'string' },
    { name: 'showIcon', label: '显示图标', source: 'props', expected: 'boolean' },
    { name: 'closable', label: '可关闭', source: 'props', expected: 'boolean' }
  ],
  'el-switch': [
    { name: 'value', label: '开关值', source: 'props', expected: 'boolean' },
    { name: 'activeText', label: '开启文案', source: 'props', expected: 'string' },
    { name: 'inactiveText', label: '关闭文案', source: 'props', expected: 'string' }
  ],
  'el-divider': [
    { name: 'text', label: '分割文字', source: 'props', expected: 'string' },
    { name: 'contentPosition', label: '文字位置', source: 'props', expected: 'string' }
  ]
};

/** 各内置类型的事件出口（与 NodeRenderer / materials.ts 的 outputs 声明对齐） */
const TYPE_EVENTS: Record<string, string[]> = {
  'pro-table': ['view', 'delete'],
  'pro-form': ['submit'],
  'el-button': ['click'],
  'el-input': ['change'],
  'el-switch': ['change']
};

const rowActionPayload: Omit<OutputPayloadHint, 'name' | 'label'> = {
  description: '行动作事件，携带当前行记录',
  payloadSchema: {
    type: 'object',
    properties: {
      row: { type: 'object', description: '当前行记录对象' },
      eventKey: { type: 'string', description: '动作标识（config.actions 的 eventKey）' }
    }
  },
  samplePaths: ['event.row', 'event.eventKey']
};

/** 事件名 → payload 语义（黑盒输出名与内部事件名同名，可直接命中） */
const EVENT_HINTS: Record<string, Omit<OutputPayloadHint, 'name'>> = {
  click: {
    label: '点击',
    description: '原生 MouseEvent，通常无需在动作里引用',
    samplePaths: []
  },
  change: {
    label: '值变更',
    description: '携带变更后的控件值',
    samplePaths: ['event']
  },
  submit: {
    label: '提交',
    description: '携带表单值对象（字段名 → 填写值）',
    payloadSchema: { type: 'object' },
    samplePaths: ['event']
  },
  view: { label: '查看行', ...rowActionPayload },
  delete: { label: '删除行', ...rowActionPayload }
};

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
}

/** 整段 {{ }} 表达式的值跳过类型检查（运行时才可求值） */
function isExpressionValue(value: unknown): boolean {
  return typeof value === 'string' && value.includes('{{');
}

function actualTypeName(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function typeMatches(expected: ExpectedType, value: unknown): boolean {
  switch (expected) {
    case 'expression':
      return true;
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'data':
      return typeof value === 'object' && value !== null;
    case 'string':
    case 'number':
    case 'boolean':
      return typeof value === expected;
  }
}

/**
 * 校验节点入参的必填与类型 IO 警告。
 * - 内置类型：对照 BUILTIN_FIELD_CONTRACTS
 * - 黑盒 custom-*：对照物料契约 inputs（缺必填 / 类型不符）
 * - 未知类型：不报
 */
export function validateComponentProps(
  node: Pick<ComponentNode, 'type' | 'props' | 'config'>
): PropIoIssue[] {
  const issues: PropIoIssue[] = [];

  if (node.type.startsWith('custom-')) {
    const manifest = getMaterial(node.type);
    const inputs = manifest?.contract?.inputs || manifest?.inputs || [];
    for (const input of inputs) {
      const value = node.props?.[input.name];
      if (input.required && isEmptyValue(value)) {
        issues.push({ name: input.name, message: `输入 ${input.label}（${input.name}）为必填项` });
      } else if (!isEmptyValue(value) && !isExpressionValue(value) && !typeMatches(input.type, value)) {
        issues.push({
          name: input.name,
          message: `输入 ${input.label}（${input.name}）期望类型 ${input.type}，实际为 ${actualTypeName(value)}`
        });
      }
    }
    return issues;
  }

  for (const field of BUILTIN_FIELD_CONTRACTS[node.type] || []) {
    const bag = field.source === 'props' ? node.props : node.config;
    const value = bag?.[field.name];
    if (isEmptyValue(value)) {
      if (field.required) {
        issues.push({ name: field.name, message: `${field.label}（${field.name}）为必填项` });
      }
      continue;
    }
    if (isExpressionValue(value)) continue;
    if (!typeMatches(field.expected, value)) {
      issues.push({
        name: field.name,
        message: `${field.label}（${field.name}）期望类型 ${field.expected}，实际为 ${actualTypeName(value)}`
      });
    }
  }
  return issues;
}

/**
 * 事件出口的 payload 提示。
 * - 内置类型：按类型事件出口返回
 * - 黑盒 custom-*：按物料契约 outputs 返回（输出名与内部事件名同名，命中同一 payload 语义）
 * - 未知类型：空数组
 */
export function getOutputPayloadHints(type: string): OutputPayloadHint[] {
  if (type.startsWith('custom-')) {
    const manifest = getMaterial(type);
    const declared: Array<{ name: string; label: string; event?: string }> =
      manifest?.contract?.outputs?.map((o) => ({ name: o.name, label: o.label, event: o.event })) ||
      manifest?.outputs?.map((o) => ({ name: o.name, label: o.label })) ||
      [];
    return declared.map(({ name, label, event }) => {
      const hint = EVENT_HINTS[name] || (event ? EVENT_HINTS[event] : undefined);
      return {
        name,
        label: label || hint?.label || name,
        description: hint?.description,
        payloadSchema: hint?.payloadSchema,
        samplePaths: hint?.samplePaths ?? []
      };
    });
  }

  return (TYPE_EVENTS[type] || []).map((name) => {
    const hint = EVENT_HINTS[name];
    return {
      name,
      label: hint?.label || name,
      description: hint?.description,
      payloadSchema: hint?.payloadSchema,
      samplePaths: hint?.samplePaths ?? []
    };
  });
}

import type { PageSchema, ComponentNode } from '../../types/designer';
import { canInlineExpression } from '../expression';
import { resolveMaterial } from '../materialResolver';
import { mapOutputEvents } from '../materialInject';

// ============================================================
// 多目标出码引擎 · 共享层 (v2.4.0 拆分)
// 安全转义辅助、标识符绑定、属性序列化、表达式渲染、黑盒物料快照
// ============================================================

/**
 * 黑盒物料解析结果映射：node.id → 已注入 inputs / 对齐 outputs 的快照子树。
 * 出码是同步的，调用方需先 await preloadMaterialSchemas(schema) 填充本映射。
 */
const materialSchemaMap = new Map<string, ComponentNode[]>();

export function clearMaterialSchemas(): void {
  materialSchemaMap.clear();
}

/** 预解析页面内所有黑盒实例（填 materialSchemaMap），供同步出码渲染 */
export async function preloadMaterialSchemas(schema: PageSchema): Promise<void> {
  materialSchemaMap.clear();
  const nodes = allEditableNodes(schema);
  for (const node of nodes) {
    if (!node.materialRef) continue;
    const version = await resolveMaterial(node.materialRef);
    if (version) {
      materialSchemaMap.set(node.id, mapOutputEvents(version.schema, node, version.contract));
    }
  }
}

/** 供 renderNode 读取黑盒快照（未预解析时为 undefined，渲染占位） */
export function getMaterialSnapshot(nodeId: string): ComponentNode[] | undefined {
  return materialSchemaMap.get(nodeId);
}

// ============================================================
// 安全转义辅助（防止用户配置内容破坏生成的代码结构）
// ============================================================

/** HTML 文本 / 双引号 attribute 值转义 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 安全化 class / 自定义元素标签标识（仅保留小写字母数字连字符） */
export function safeClassToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 单行注释安全化（剥离换行，防止破坏注释结构） */
export function safeComment(value: unknown): string {
  return String(value ?? '').replace(/[\r\n]+/g, ' ');
}

/** 将多行文本整体缩进（用于嵌入不同深度的生成上下文） */
export function indentLines(text: string, spaces = 2): string {
  if (!text) return '';
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.trim() ? pad + line : line))
    .join('\n');
}

/** 节点 id → 合法 JS 标识符片段（用于生成数据变量名） */
export function safeIdent(value: string): string {
  const out = String(value).replace(/[^a-zA-Z0-9_$]/g, '_');
  return out && !/^[0-9]/.test(out) ? out : 'n' + out;
}

function shortHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}

/** 同一页内把 id 映射成互不冲突的标识符。生成开始前绑定。 */
let identOfImpl = (id: string) => safeIdent(id);

export function bindIdents(schema: PageSchema): void {
  const ids: string[] = [];
  const walk = (nodes?: ComponentNode[]) => {
    for (const node of nodes || []) {
      ids.push(node.id);
      walk(node.children);
    }
  };
  walk(schema.children);
  for (const layer of schema.layers || []) {
    ids.push(layer.id);
    walk(layer.children);
  }
  const used = new Set<string>();
  const map = new Map<string, string>();
  for (const id of ids) {
    if (map.has(id)) continue;
    let ident = safeIdent(id);
    if (used.has(ident)) ident = `${ident}_${shortHash(id)}`;
    let n = 2;
    while (used.has(ident)) ident = `${safeIdent(id)}_${shortHash(id)}_${n++}`;
    used.add(ident);
    map.set(id, ident);
  }
  identOfImpl = (id: string) => map.get(id) ?? safeIdent(id);
}

export const identOf = (id: string): string => identOfImpl(id);

const ATTR_NAME = /^[A-Za-z_][A-Za-z0-9_:-]*$/;

export function safeAttrName(key: string): string | null {
  return ATTR_NAME.test(key) ? key : null;
}

/** 写进 style 属性的单个声明值，避免用分号或花括号逃出声明。 */
export function safeStyleToken(value: unknown): string {
  return String(value ?? '').replace(/[;{}<>\r\n]/g, '');
}

export function renderBoundText(value: unknown, fallback = ''): string {
  const text = value === undefined || value === null || value === '' ? fallback : String(value);
  const full = text.match(/^\s*\{\{\s*(.*?)\s*\}\}\s*$/);
  if (full && canInlineExpression(full[1])) return `{{ ${full[1].trim()} }}`;
  return escapeHtml(text);
}

/** 嵌入 JS 字符串字面量，并把 `<` 写成 \\u003c，避免 `</script>` 打断 HTML/SFC */
export function embedJsString(value: string): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** 主画布节点 + 非 canvas 图层节点 + 嵌套 children（canvas 图层与 children 同源，不重复收集） */
export function allEditableNodes(schema: PageSchema): ComponentNode[] {
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

// ============================================================
// 表达式渲染（{{ }} → JS 表达式 / 安全回退字符串字面量）
// ============================================================

/** 只内联受限解释器能完整解析的表达式，其余退回字符串字面量 */
export function inlineExpr(source: string): string {
  const raw = source.trim();
  return canInlineExpression(raw) ? `(${raw})` : JSON.stringify(source);
}

/** 响应提取路径 → JS 属性访问。非法片段（含分号、调用）退回根变量，不拼进产物 */
export function renderPathExpr(path: string | undefined, rootVar: string): string {
  if (!path || !path.trim()) return rootVar;
  let expr = rootVar;
  for (const raw of path.split('.')) {
    if (!raw) return rootVar;
    const indexed = raw.match(/^([A-Za-z_$][A-Za-z0-9_$]*)(\[\d+\])?$/);
    const indexOnly = raw.match(/^\[(\d+)\]$/);
    if (indexed) {
      expr += indexed[2] ? `.${indexed[1]}${indexed[2]}` : `.${indexed[1]}`;
    } else if (indexOnly) {
      expr += `[${indexOnly[1]}]`;
    } else {
      return rootVar;
    }
  }
  return expr;
}

/** 请求参数对象字面量（{{ expr }} → 内联 JS 表达式） */
export function renderParamsLiteral(params: Record<string, any> | undefined): string {
  if (!params || Object.keys(params).length === 0) return '{}';
  const entries = Object.entries(params).map(([k, v]) => {
    if (typeof v === 'string') {
      const m = v.match(/^\s*\{\{\s*(.*?)\s*\}\}\s*$/);
      return `${JSON.stringify(k)}: ${m ? inlineExpr(m[1]) : JSON.stringify(v)}`;
    }
    return `${JSON.stringify(k)}: ${JSON.stringify(v)}`;
  });
  return `{ ${entries.join(', ')} }`;
}

// ============================================================
// 属性序列化（props / attrs → HTML / Vue attribute 文本）
// ============================================================

/** 格式化属性对，转换为 HTML/Vue attribute 文本（字符串值转义） */
export function stringifyAttributes(props: Record<string, any>, attrs: Record<string, any>): string {
  const parts: string[] = [];

  const push = (key: string, val: unknown) => {
    const name = safeAttrName(key);
    if (!name || val === undefined || val === null || val === '') return;
    if (typeof val === 'boolean') {
      if (val) parts.push(`:${name}="true"`);
      return;
    }
    if (typeof val === 'number') {
      parts.push(`:${name}="${val}"`);
      return;
    }
    const text = String(val);
    const full = text.match(/^\s*\{\{\s*(.*?)\s*\}\}\s*$/);
    if (full && canInlineExpression(full[1])) {
      parts.push(`:${name}="${full[1].trim()}"`);
      return;
    }
    parts.push(`${name}="${escapeHtml(text)}"`);
  };

  for (const [key, val] of Object.entries(props)) push(key, val);
  for (const [key, val] of Object.entries(attrs)) push(key, val);

  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

export function attributesExcept(
  props: Record<string, any>,
  attrs: Record<string, any>,
  omit: string[]
): string {
  const next = { ...props };
  for (const key of omit) delete next[key];
  return stringifyAttributes(next, attrs);
}

export function formPlaceholder(item: { placeholder?: unknown; label?: unknown }, fallback: string): string {
  const custom = typeof item.placeholder === 'string' ? item.placeholder.trim() : '';
  return escapeHtml(custom || fallback);
}

export function tablePageSize(node: ComponentNode): number {
  const pagination = node.config?.pagination as { pageSize?: unknown } | undefined;
  const size = pagination?.pageSize;
  return typeof size === 'number' && size > 0 ? size : 10;
}

export function tablePaginationEnabled(node: ComponentNode): boolean {
  const pagination = node.config?.pagination as { enabled?: unknown } | undefined;
  if (!pagination) return true;
  return pagination.enabled !== false;
}

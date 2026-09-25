import type { PageSchema, ComponentNode, LayerConfig, ApiBinding, ActionNode, EventRule } from '../types/designer';
import { isRenderedNodeType } from '../registry/nodeTypes';
import { sanitizeCss } from './sanitizeCss';
import { canInlineExpression } from './expression';
import { inlineableExpression } from './condition';
import { requiredInputFields } from './formValidation';
import { FETCH_CHECKED_SOURCE, FORBIDDEN_STATE_KEYS } from './dataSource';
import { TABLE_PLACEHOLDER_ROWS } from './tablePlaceholder';
import { buildCustomHtmlSrcdoc } from './customHtmlDocument';

// ============================================================
// 多目标出码引擎 (Code Generator)
// 目标 1: Vue 3 SFC (.vue)              —— 完整渲染
// 目标 2: W3C Web Component (.js)       —— 完整渲染，配套 PageTemplate.vue 在宿主项目中构建
// 目标 3: 独立 HTML (.html)             —— 完整渲染 (Vue CDN + Element Plus CDN)
// 目标 4: package.json 构建清单
// ============================================================

// ============================================================
// 安全转义辅助（防止用户配置内容破坏生成的代码结构）
// ============================================================

/** HTML 文本 / 双引号 attribute 值转义 */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 安全化 class / 自定义元素标签标识（仅保留小写字母数字连字符） */
function safeClassToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 单行注释安全化（剥离换行，防止破坏注释结构） */
function safeComment(value: unknown): string {
  return String(value ?? '').replace(/[\r\n]+/g, ' ');
}

/** 将多行文本整体缩进（用于嵌入不同深度的生成上下文） */
function indentLines(text: string, spaces = 2): string {
  if (!text) return '';
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.trim() ? pad + line : line))
    .join('\n');
}

/** 节点 id → 合法 JS 标识符片段（用于生成数据变量名） */
function safeIdent(value: string): string {
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
let identOf = (id: string) => safeIdent(id);

function bindIdents(schema: PageSchema): void {
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
  identOf = (id: string) => map.get(id) ?? safeIdent(id);
}

const ATTR_NAME = /^[A-Za-z_][A-Za-z0-9_:-]*$/;

function safeAttrName(key: string): string | null {
  return ATTR_NAME.test(key) ? key : null;
}

/** 写进 style 属性的单个声明值，避免用分号或花括号逃出声明。 */
function safeStyleToken(value: unknown): string {
  return String(value ?? '').replace(/[;{}<>\r\n]/g, '');
}

function renderBoundText(value: unknown, fallback = ''): string {
  const text = value === undefined || value === null || value === '' ? fallback : String(value);
  const full = text.match(/^\s*\{\{\s*(.*?)\s*\}\}\s*$/);
  if (full && canInlineExpression(full[1])) return `{{ ${full[1].trim()} }}`;
  return escapeHtml(text);
}

/** 嵌入 JS 字符串字面量，并把 `<` 写成 \\u003c，避免 `</script>` 打断 HTML/SFC */
function embedJsString(value: string): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** 主画布节点 + 非 canvas 图层节点 + 嵌套 children（canvas 图层与 children 同源，不重复收集） */
function allEditableNodes(schema: PageSchema): ComponentNode[] {
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

/** 只内联受限解释器能完整解析的表达式，其余退回字符串字面量 */
function inlineExpr(source: string): string {
  const raw = source.trim();
  return canInlineExpression(raw) ? `(${raw})` : JSON.stringify(source);
}

/** 响应提取路径 → JS 属性访问。非法片段（含分号、调用）退回根变量，不拼进产物 */
function renderPathExpr(path: string | undefined, rootVar: string): string {
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
function renderParamsLiteral(params: Record<string, any> | undefined): string {
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

/** 格式化属性对，转换为 HTML/Vue attribute 文本（字符串值转义） */
function stringifyAttributes(props: Record<string, any>, attrs: Record<string, any>): string {
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

/**
 * 将 ComponentNode 单节点递归转换为模板文本
 */
function applyVisibleWhen(node: ComponentNode, html: string, indent: string): string {
  const expr = inlineableExpression(node.visibleWhen);
  if (!expr) return html;
  return `${indent}<div v-show="${escapeHtml(expr)}">\n${html}${indent}</div>\n`;
}

function renderNodeToTemplate(node: ComponentNode, indentLevel = 3): string {
  const indent = ' '.repeat(indentLevel * 2);
  return applyVisibleWhen(node, renderNodeMarkup(node, indentLevel), indent);
}

function attributesExcept(
  props: Record<string, any>,
  attrs: Record<string, any>,
  omit: string[]
): string {
  const next = { ...props };
  for (const key of omit) delete next[key];
  return stringifyAttributes(next, attrs);
}

function formPlaceholder(item: { placeholder?: unknown; label?: unknown }, fallback: string): string {
  const custom = typeof item.placeholder === 'string' ? item.placeholder.trim() : '';
  return escapeHtml(custom || fallback);
}

function tablePageSize(node: ComponentNode): number {
  const pagination = node.config?.pagination as { pageSize?: unknown } | undefined;
  const size = pagination?.pageSize;
  return typeof size === 'number' && size > 0 ? size : 10;
}

function tablePaginationEnabled(node: ComponentNode): boolean {
  const pagination = node.config?.pagination as { enabled?: unknown } | undefined;
  if (!pagination) return true;
  return pagination.enabled !== false;
}

function renderNodeMarkup(node: ComponentNode, indentLevel = 3): string {
  const indent = ' '.repeat(indentLevel * 2);
  const attrStr = stringifyAttributes(node.props || {}, node.attrs || {});

  switch (node.type) {
    case 'pro-table': {
      const columns = node.config?.columns || [];
      const colIndent = ' '.repeat((indentLevel + 1) * 2);
      const dataName = `tableData_${identOf(node.id)}`;
      const totalName = `totalCount_${identOf(node.id)}`;
      const pageName = `currentPage_${identOf(node.id)}`;
      let colsTemplate = '';

      columns.forEach((col: any) => {
        colsTemplate += `${colIndent}<el-table-column prop="${escapeHtml(col.prop)}" label="${escapeHtml(col.label)}"${col.width ? ` width="${escapeHtml(col.width)}"` : ''}${col.align ? ` align="${escapeHtml(col.align)}"` : ''}${col.sortable ? ' sortable' : ''} />\n`;
      });

      const rowActions = Array.isArray(node.config?.actions) ? node.config.actions : [];
      const actionButtons = rowActions
        .map((action: any) => {
          const eventKey = String(action.eventKey || 'click');
          return `${indent}        <el-button link type="${escapeHtml(action.type || 'primary')}" size="small" @click="handleRowAction('${escapeHtml(node.id)}', '${escapeHtml(eventKey)}', scope.row)">${escapeHtml(action.label || '操作')}</el-button>\n`;
        })
        .join('');
      const actionColumn = actionButtons
        ? `${indent}    <el-table-column label="操作" align="center" width="160">\n` +
          `${indent}      <template #default="scope">\n` +
          actionButtons +
          `${indent}      </template>\n` +
          `${indent}    </el-table-column>\n`
        : '';
      const pageSize = tablePageSize(node);
      const pagination = tablePaginationEnabled(node)
        ? `${indent}  <el-pagination\n` +
          `${indent}    v-model:current-page="${pageName}"\n` +
          `${indent}    :page-size="${pageSize}"\n` +
          `${indent}    layout="total, prev, pager, next"\n` +
          `${indent}    :total="${totalName}"\n` +
          `${indent}    size="small"\n` +
          `${indent}    style="margin-top: 10px; justify-content: flex-end"\n` +
          `${indent}    @current-change="onPage_${identOf(node.id)}"\n` +
          `${indent}  />\n`
        : '';

      return (
        `${indent}<!-- 高端表格 Component -->\n` +
        `${indent}<el-card shadow="always">\n` +
        `${indent}  <el-table :data="${dataName}"${attrStr} style="width: 100%">\n` +
        colsTemplate +
        actionColumn +
        `${indent}  </el-table>\n` +
        pagination +
        `${indent}</el-card>\n`
      );
    }

    case 'pro-form': {
      const items = node.config?.items || [];
      const itemIndent = ' '.repeat((indentLevel + 1) * 2);
      const formName = `formData_${identOf(node.id)}`;
      const formAttrs = attributesExcept(node.props || {}, node.attrs || {}, ['labelWidth', 'layout', 'size']);
      const inline = node.props.layout === 'inline' ? ' inline' : '';
      const size = node.props.size ? ` size="${escapeHtml(String(node.props.size))}"` : '';
      const labelWidth = escapeHtml(String(node.props.labelWidth || '100px'));
      let itemsTemplate = '';

      items.forEach((item: any) => {
        const itemType = item.component || item.type;
        const field = item.field || item.name;
        const required = item.required ? ' required' : '';

        if (itemType === 'input') {
          itemsTemplate +=
            `${itemIndent}<el-form-item label="${escapeHtml(item.label)}" prop="${escapeHtml(field)}"${required}>\n` +
            `${itemIndent}  <el-input v-model='${formName}[${JSON.stringify(field)}]' placeholder="${formPlaceholder(item, `请输入${item.label || ''}`)}" />\n` +
            `${itemIndent}</el-form-item>\n`;
        } else if (itemType === 'select') {
          const options = Array.isArray(item.options) ? item.options : [];
          let optTemplate = '';
          options.forEach((opt: any) => {
            optTemplate += `${itemIndent}    <el-option label="${escapeHtml(opt.label)}" value="${escapeHtml(opt.value)}" />\n`;
          });
          itemsTemplate +=
            `${itemIndent}<el-form-item label="${escapeHtml(item.label)}" prop="${escapeHtml(field)}"${required}>\n` +
            `${itemIndent}  <el-select v-model='${formName}[${JSON.stringify(field)}]' placeholder="${formPlaceholder(item, `请选择${item.label || ''}`)}">\n` +
            optTemplate +
            `${itemIndent}  </el-select>\n` +
            `${itemIndent}</el-form-item>\n`;
        } else if (itemType === 'switch') {
          itemsTemplate +=
            `${itemIndent}<el-form-item label="${escapeHtml(item.label)}" prop="${escapeHtml(field)}">\n` +
            `${itemIndent}  <el-switch v-model='${formName}[${JSON.stringify(field)}]' />\n` +
            `${itemIndent}</el-form-item>\n`;
        } else if (itemType === 'date') {
          itemsTemplate +=
            `${itemIndent}<el-form-item label="${escapeHtml(item.label)}" prop="${escapeHtml(field)}"${required}>\n` +
            `${itemIndent}  <el-date-picker v-model='${formName}[${JSON.stringify(field)}]' type="date" placeholder="${formPlaceholder(item, '请选择日期')}" style="width: 100%" />\n` +
            `${itemIndent}</el-form-item>\n`;
        }
      });

      return (
        `${indent}<!-- 高端表单 Component -->\n` +
        `${indent}<el-form :model="${formName}"${formAttrs}${inline} label-width="${labelWidth}"${size}>\n` +
        itemsTemplate +
        `${indent}  <el-form-item>\n` +
        `${indent}    <el-button type="primary" @click="handleSubmit('${escapeHtml(node.id)}')">提交</el-button>\n` +
        `${indent}    <el-button @click="handleReset('${escapeHtml(node.id)}')">重置</el-button>\n` +
        `${indent}  </el-form-item>\n` +
        `${indent}</el-form>\n`
      );
    }

    case 'el-button': {
      const clickBinding =
        node.events?.click?.enabled && node.events.click.actions.length > 0
          ? ` @click="handleNodeClick('${escapeHtml(node.id)}', 'click', $event)"`
          : '';
      return `${indent}<el-button${attrStr}${clickBinding}>${renderBoundText(node.props.text, '按钮')}</el-button>\n`;
    }

    case 'el-input':
      return `${indent}<el-input v-model="formData_${identOf(node.id)}"${attrStr} />\n`;

    case 'el-card':
      return (
        `${indent}<el-card${attrStr}>\n` +
        `${indent}  <p>${renderBoundText(node.props.content, '卡片内容区域')}</p>\n` +
        `${indent}</el-card>\n`
      );

    case 'el-tag':
      return `${indent}<el-tag${attrStr}>${renderBoundText(node.props.text, '标签')}</el-tag>\n`;

    case 'el-alert':
      return `${indent}<el-alert${attrStr} />\n`;

    case 'el-switch':
      return `${indent}<el-switch v-model="formData_${identOf(node.id)}"${attrStr} />\n`;

    case 'el-divider':
      return `${indent}<el-divider${attrStr}>${renderBoundText(node.props.text, '')}</el-divider>\n`;

    case 'pro-container': {
      let childrenTemplate = '';
      (node.children || []).forEach((child) => {
        childrenTemplate += renderNodeToTemplate(child, indentLevel + 1);
      });
      const direction = safeStyleToken(node.props.direction) || 'row';
      const padding = safeStyleToken(node.props.padding) || '12px';
      return (
        `${indent}<!-- 嵌套弹性容器 Component -->\n` +
        `${indent}<el-card class="pro-container-box"${attrStr}>\n` +
        `${indent}  <template #header><span>${renderBoundText(node.props.title, '嵌套弹性容器')}</span></template>\n` +
        `${indent}  <div style="display: flex; flex-direction: ${direction}; gap: 12px; padding: ${padding}">\n` +
        childrenTemplate +
        `${indent}  </div>\n` +
        `${indent}</el-card>\n`
      );
    }

    default:
      if (isRenderedNodeType(node.type)) {
        return `${indent}<!-- 已登记类型缺少出码模板: ${escapeHtml(node.type)} -->\n${indent}<div id="${escapeHtml(node.id)}">${escapeHtml(node.label)}</div>\n`;
      }
      return `${indent}<div id="${escapeHtml(node.id)}"${attrStr}>${escapeHtml(node.label)}</div>\n`;
  }
}

/**
 * 渲染图层模板，并收集生命周期脚本
 * @param refStyle 模板 ref 的访问风格：
 *   - 'composition'：SFC script setup 同名 ref 变量（customHtmlRef_xxx?.value）
 *   - 'options'：options API 的 this.$refs（HTML CDN 渲染）
 */
function renderLayers(
  schema: PageSchema,
  _refStyle: 'composition' | 'options' = 'composition'
): {
  extraLayersTemplate: string;
  extraLifecycleScripts: string;
  extraUnmountScripts: string;
} {
  let extraLayersTemplate = '';
  const extraLifecycleScripts = '';
  const extraUnmountScripts = '';

  if (schema.layers && schema.layers.length > 0) {
    schema.layers.forEach((layer: LayerConfig) => {
      const layerIdent = identOf(layer.id);
      if (layer.type === 'dialog') {
        let dialogBody = '';
        (layer.children || []).forEach((child) => {
          dialogBody += renderNodeToTemplate(child, 3);
        });
        if (!dialogBody.trim()) {
          dialogBody = `      <p>${escapeHtml(layer.name)} 内暂无组件</p>\n`;
        }
        extraLayersTemplate +=
          `    <!-- 弹窗图层: ${safeComment(layer.name)} -->\n` +
          `    <el-dialog v-model="dialogVisible_${layerIdent}" title="${escapeHtml(layer.props?.title) || escapeHtml(layer.name)}" width="${escapeHtml(layer.props?.width) || '50%'}">\n` +
          dialogBody +
          `    </el-dialog>\n\n`;
      } else if (layer.type === 'loading') {
        extraLayersTemplate +=
          `    <!-- Loading 遮罩图层: ${safeComment(layer.name)} -->\n` +
          `    <div v-if="loadingVisible_${layerIdent}" class="loading-overlay">\n` +
          `      <p>${escapeHtml(layer.props?.loadingText) || '数据加载中...'}</p>\n` +
          `    </div>\n\n`;
      } else if (layer.type === 'custom-html') {
        extraLayersTemplate +=
          `    <!-- 自定义 HTML 图层: ${safeComment(layer.name)} -->\n` +
          `    <iframe class="custom-html-frame" sandbox="allow-scripts" title="${escapeHtml(layer.name)}" :srcdoc="customHtmlSrcdoc_${layerIdent}"></iframe>\n\n`;
      }
    });
  }

  return { extraLayersTemplate, extraLifecycleScripts, extraUnmountScripts };
}

/** 收集图层状态字段声明（dialog 显隐 / loading 显隐） */
function collectLayerStateDecls(schema: PageSchema): { dialogVisible: string[]; loadingVisible: string[] } {
  const dialogVisible: string[] = [];
  const loadingVisible: string[] = [];
  schema.layers?.forEach((l) => {
    const visible = l.visible ? 'true' : 'false';
    if (l.type === 'dialog') dialogVisible.push(`const dialogVisible_${identOf(l.id)} = ref(${visible});`);
    else if (l.type === 'loading') loadingVisible.push(`const loadingVisible_${identOf(l.id)} = ref(${visible});`);
  });
  return { dialogVisible, loadingVisible };
}

/** 渲染主体模板（节点 + 图层），供三种目标复用 */
function renderPageTemplateBody(schema: PageSchema, baseIndent = 2): string {
  let templateBody = '';
  (schema.children || []).forEach((child) => {
    templateBody += renderNodeToTemplate(child, baseIndent);
  });

  const { extraLayersTemplate } = renderLayers(schema);

  if (!templateBody.trim() && !extraLayersTemplate.trim()) {
    templateBody = '    <div class="empty-page">页面暂无内容，请在设计器中拖入物料组件</div>\n';
  }

  return templateBody + extraLayersTemplate;
}

/** 生成页面级样式（供三种目标复用） */
function renderPageStyle(schema: PageSchema): string {
  return `.lowcode-page-${safeClassToken(schema.id)} {
  padding: 24px;
  background-color: #f5f7fa;
  min-height: 100vh;
}
.empty-page {
  text-align: center;
  color: #909399;
  padding: 60px 0;
}
.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.85);
  color: #409eff;
  font-weight: 600;
}
.custom-html-wrapper {
  margin: 12px 0;
}
${(schema.layers || [])
  .filter((layer) => layer.type === 'custom-html' && layer.props?.cssCode)
  .map((layer) => `/* ${safeComment(layer.name)} */\n${sanitizeCss(layer.props?.cssCode || '')}`)
  .join('\n')}`;
}

// ---------------------------------------------------------------------------
// v1.3.0 出码辅助：数据源加载与事件动作链生成
// ---------------------------------------------------------------------------

/** URL 表达式：全串 {{ expr }} → 内联表达式；部分内嵌 → 字符串拼接 */
function renderUrlExpr(url: string): string {
  const full = url.match(/^\s*\{\{\s*(.*?)\s*\}\}\s*$/);
  if (full) return inlineExpr(full[1]);
  if (url.includes('{{')) {
    const parts = url.split(/\{\{\s*(.*?)\s*\}\}/);
    return parts.map((p, i) => (i % 2 === 1 ? inlineExpr(p) : JSON.stringify(p))).join(' + ') || JSON.stringify(url);
  }
  return JSON.stringify(url);
}

/** payload 值表达式（{{ expr }} → 内联，对象/数组递归） */
function renderPayloadExpr(value: unknown): string {
  if (typeof value === 'string') {
    const m = value.match(/^\s*\{\{\s*(.*?)\s*\}\}\s*$/);
    return m ? inlineExpr(m[1]) : JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => renderPayloadExpr(v)).join(', ')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, any>).map(
      ([k, v]) => `${JSON.stringify(k)}: ${renderPayloadExpr(v)}`
    );
    return `{ ${entries.join(', ')} }`;
  }
  return JSON.stringify(value);
}

/** 生成 GET 请求块文本（options API 需 this. 前缀，composition 不需要） */
function renderFetchRequestBlock(
  urlExpr: string,
  paramsLit: string,
  method: 'GET' | 'POST',
  optionsApi: boolean,
  pageExpr?: string,
  pageSize = 10
): string {
  const call = 'fetchChecked';
  void optionsApi;
  const merged = pageExpr ? `{ page: ${pageExpr}, size: ${pageSize}, ...(${paramsLit}) }` : paramsLit;
  if (method === 'POST') {
    return `    const res = await ${call}(${urlExpr}, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(${merged}), signal: AbortSignal.timeout(10000) });`;
  }
  return `    const params = ${merged};
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.append(k, String(v)); });
    const q = qs.toString();
    const base = ${urlExpr};
    const url = q ? (base.includes('?') ? base + '&' + q : base + '?' + q) : base;
    const res = await ${call}(url, { method: 'GET', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000) });`;
}

/** 生成表格节点加载函数（composition API） */
function renderTableLoadFunction(node: ComponentNode, binding: ApiBinding, optionsApi = false): string {
  const dataName = `tableData_${identOf(node.id)}`;
  const totalName = `totalCount_${identOf(node.id)}`;
  const method = binding.method ?? 'GET';
  const listExpr = renderPathExpr(binding.responsePath, 'json');
  const totalExpr = binding.totalProp ? renderPathExpr(binding.totalProp, 'json') : 'undefined';
  const pageExpr = optionsApi ? `this.currentPage_${identOf(node.id)}` : `currentPage_${identOf(node.id)}.value`;
  const requestBlock = renderFetchRequestBlock(
    renderUrlExpr(binding.url),
    renderParamsLiteral(binding.params),
    method,
    optionsApi,
    pageExpr,
    tablePageSize(node)
  );

  return `const loadData_${identOf(node.id)} = async () => {
  try {
${requestBlock}
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const list = ${listExpr};
    ${dataName}.value = Array.isArray(list) ? list : [];
    const total = ${totalExpr};
    if (total !== undefined) ${totalName}.value = Number(total) || 0;
  } catch (err) {
    console.error('数据加载失败:', err);
  }
};`;
}

/** 生成表单节点加载函数（composition API） */
function renderFormLoadFunction(node: ComponentNode, binding: ApiBinding): string {
  const formName = `formData_${identOf(node.id)}`;
  const method = binding.method ?? 'GET';
  const dataExpr = renderPathExpr(binding.responsePath, 'json');
  const requestBlock = renderFetchRequestBlock(
    renderUrlExpr(binding.url),
    renderParamsLiteral(binding.params),
    method,
    false
  );

  return `const loadData_${identOf(node.id)} = async () => {
  try {
${requestBlock}
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const data = ${dataExpr};
    if (data && typeof data === 'object') {
      ${formName}.value = { ...data };
    }
  } catch (err) {
    console.error('表单数据加载失败:', err);
  }
};`;
}

function enabledEventEntries(node: ComponentNode): Array<[string, EventRule]> {
  return Object.entries(node.events || {}).filter((entry): entry is [string, EventRule] =>
    Boolean(entry[1]?.enabled && (entry[1].actions?.length ?? 0) > 0)
  );
}

function renderStateAssigns(payload: Record<string, any> | undefined, optionsApi: boolean): string {
  return Object.entries(payload ?? {})
    .filter(([key]) => !FORBIDDEN_STATE_KEYS.has(key))
    .map(
      ([key, value]) => `${optionsApi ? 'this.state' : 'state'}[${JSON.stringify(key)}] = ${renderPayloadExpr(value)};`
    )
    .join('\n    ');
}

/** 生成节点事件动作链 handler */
function renderNodeClickHandler(eventNodes: ComponentNode[], optionsApi = false): string {
  const blocks = eventNodes.flatMap((node) =>
    enabledEventEntries(node).map(([eventKey, rule]) => {
      const stmts = rule.actions
        .map((action) => wrapActionCondition(action, renderActionStatement(action, optionsApi)))
        .filter(Boolean)
        .join('\n    ');
      return `  if (nodeId === ${JSON.stringify(node.id)} && eventKey === ${JSON.stringify(eventKey)}) {\n    ${stmts}\n  }`;
    })
  );
  if (blocks.length === 0) return '';
  if (optionsApi) return `handleNodeClick(nodeId, eventKey, $event) {\n${blocks.join('\n')}\n  },`;
  return `const handleNodeClick = async (nodeId: string, eventKey: string, $event: any) => {\n${blocks.join('\n')}\n};`;
}

function wrapActionCondition(action: ActionNode, statement: string): string {
  if (!statement) return '';
  const raw = action.when?.trim();
  if (!raw) return statement;
  const expr = inlineableExpression(raw);
  if (!expr) return '';
  const body = statement.replaceAll('\n', '\n      ');
  return `if (${expr}) {\n      ${body}\n    }`;
}

function renderSubmitGuards(formNodes: ComponentNode[], optionsApi: boolean): string {
  const lines: string[] = [];
  for (const node of formNodes) {
    const fields = requiredInputFields(node.config?.items);
    for (const field of fields) {
      const access = `${optionsApi ? 'form' : 'form.value'}[${JSON.stringify(field.field)}]`;
      const warn = optionsApi
        ? `ElementPlus.ElMessage.warning(${JSON.stringify(`请填写${field.label}`)})`
        : `ElMessage.warning(${JSON.stringify(`请填写${field.label}`)})`;
      lines.push(
        `if (formId === ${JSON.stringify(node.id)} && (${access} == null || String(${access}).trim() === '')) { ${warn}; return; }`
      );
    }
  }
  return lines.join('\n  ');
}

/** 单条动作语句；optionsApi=true 时变量经 this. 访问 */
function renderActionStatement(action: ActionNode, optionsApi: boolean): string {
  const refAccess = (name: string) => (optionsApi ? `this.${name}` : `${name}.value`);
  switch (action.type) {
    case 'set_state':
      return renderStateAssigns(action.payload, optionsApi);
    case 'reload_data':
      return action.target ? `await ${optionsApi ? 'this.' : ''}loadData_${identOf(action.target)}();` : '';
    case 'open_dialog': {
      if (!action.target) return '';
      const assigns = renderStateAssigns(action.payload, optionsApi);
      const show = `${refAccess(`dialogVisible_${identOf(action.target)}`)} = true;`;
      return assigns ? `${assigns}\n    ${show}` : show;
    }
    case 'close_dialog':
      return action.target ? `${refAccess(`dialogVisible_${identOf(action.target)}`)} = false;` : '';
    case 'toggle_loading':
      return action.target
        ? `${refAccess(`loadingVisible_${identOf(action.target)}`)} = ${action.payload?.visible ?? true};`
        : '';
    case 'show_message':
      return `ElMessage({ type: ${JSON.stringify(action.payload?.messageType ?? 'success')}, message: ${renderPayloadExpr(action.payload?.messageText ?? '操作完成')} });`;
    default:
      return '';
  }
}

/** 生成 Vue SFC script setup 主体（v1.3.0：数据源 + 事件动作链 + 参数化） */
function renderFormLookup(formNodes: ComponentNode[], optionsApi: boolean): string {
  const lines = formNodes.map((node) => {
    const name = optionsApi ? `this.formData_${identOf(node.id)}` : `formData_${identOf(node.id)}`;
    return `  if (formId === ${JSON.stringify(node.id)}) return ${name};`;
  });
  return `${lines.join('\n')}\n  return null;`;
}

function renderFieldRef(node: ComponentNode, optionsApi: boolean): string {
  const name = `formData_${identOf(node.id)}`;
  if (node.type === 'el-switch') {
    const initial = typeof node.props?.value === 'boolean' ? String(node.props.value) : 'false';
    return optionsApi ? `${name}: ${initial},` : `const ${name} = ref(${initial});`;
  }
  const initial = typeof node.props?.value === 'string' ? JSON.stringify(node.props.value) : "''";
  return optionsApi ? `${name}: ${initial},` : `const ${name} = ref(${initial});`;
}

function renderScriptSetup(schema: PageSchema): string {
  const children = allEditableNodes(schema);
  const tableNodes = children.filter((n) => n.type === 'pro-table');
  const formNodes = children.filter((n) => n.type === 'pro-form');
  const fieldNodes = children.filter((n) => n.type === 'el-input' || n.type === 'el-switch');
  const eventNodes = children.filter((n) => enabledEventEntries(n).length > 0);

  const { dialogVisible, loadingVisible } = collectLayerStateDecls(schema);
  const customHtmlDecls = (schema.layers || [])
    .filter((layer) => layer.type === 'custom-html')
    .map((layer) => `const customHtmlSrcdoc_${identOf(layer.id)} = ${embedJsString(buildCustomHtmlSrcdoc(layer))};`);
  const layerStateDecls = [...dialogVisible, ...loadingVisible, ...customHtmlDecls].join('\n');

  const lines: string[] = [FETCH_CHECKED_SOURCE, ''];

  // 1. 页面全局状态（表达式绑定作用域）
  const stateEntries = Object.entries(schema.state || {})
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(',\n');
  lines.push('// 页面全局状态（表达式绑定作用域）');
  lines.push(`const state = reactive<Record<string, any>>({\n${stateEntries}\n});`);
  lines.push('');

  const autoFetchCalls: string[] = [];

  // 2. 表格节点
  tableNodes.forEach((n) => {
    const dataName = `tableData_${identOf(n.id)}`;
    const totalName = `totalCount_${identOf(n.id)}`;
    const pageName = `currentPage_${identOf(n.id)}`;
    const binding = n.apiBinding;
    if (binding?.url) {
      lines.push(`// 数据源: ${safeComment(binding.url)}`);
      lines.push(`const ${dataName} = ref<any[]>([]);`);
      lines.push(`const ${totalName} = ref(0);`);
      lines.push(`const ${pageName} = ref(1);`);
      lines.push(renderTableLoadFunction(n, binding));
      lines.push(
        `const onPage_${identOf(n.id)} = (page: number) => { ${pageName}.value = page; state.page = page; loadData_${identOf(n.id)}(); };`
      );
      if (binding.autoFetch !== false) autoFetchCalls.push(`  loadData_${identOf(n.id)}();`);
    } else {
      lines.push(`// 占位数据：可在设计器中为该组件配置数据源替换`);
      lines.push(`const ${dataName} = ref(${JSON.stringify(TABLE_PLACEHOLDER_ROWS)});`);
      lines.push(`const ${totalName} = ref(${TABLE_PLACEHOLDER_ROWS.length});`);
      lines.push(`const ${pageName} = ref(1);`);
      lines.push(`const onPage_${identOf(n.id)} = (page: number) => { ${pageName}.value = page; state.page = page; };`);
    }
    lines.push('');
  });

  // 3. 表单节点
  formNodes.forEach((n) => {
    const formName = `formData_${identOf(n.id)}`;
    const binding = n.apiBinding;
    lines.push(`const ${formName} = ref<Record<string, any>>({});`);
    if (binding?.url) {
      lines.push(renderFormLoadFunction(n, binding));
      if (binding.autoFetch !== false) autoFetchCalls.push(`  loadData_${identOf(n.id)}();`);
    }
    lines.push('');
  });

  fieldNodes.forEach((node) => {
    lines.push(renderFieldRef(node, false));
  });
  if (fieldNodes.length > 0) lines.push('');

  // 4. 事件动作链 handler
  const clickHandler = renderNodeClickHandler(eventNodes);
  if (clickHandler) {
    lines.push(clickHandler);
    lines.push('');
  }

  // 5. 表格行动作 + 表单提交/重置
  if (tableNodes.length > 0) {
    const guards = eventNodes.flatMap((node) =>
      enabledEventEntries(node).map(
        ([eventKey]) => `(nodeId === ${JSON.stringify(node.id)} && eventKey === ${JSON.stringify(eventKey)})`
      )
    );
    lines.push(`const handleRowAction = async (nodeId: string, eventKey: string, row: any) => {`);
    if (guards.length > 0) {
      lines.push(`  if (${guards.join(' || ')}) {`);
      lines.push(`    await handleNodeClick(nodeId, eventKey, { row, eventKey });`);
      lines.push(`    return;`);
      lines.push(`  }`);
    }
    lines.push(`  console.log('查看行数据:', row);`);
    lines.push(`  ElMessage.info('查看: ' + (row.name || row.id));`);
    lines.push(`};`);
    lines.push('');
  }
  if (formNodes.length > 0) {
    lines.push(`const lookupForm = (formId: string) => {\n${renderFormLookup(formNodes, false)}\n};`);
    lines.push(`const handleSubmit = async (formId: string) => {`);
    lines.push(`  const form = lookupForm(formId);\n  if (!form) return;`);
    const guards = renderSubmitGuards(formNodes, false);
    if (guards) lines.push(`  ${guards}`);
    if (clickHandler) lines.push(`  await handleNodeClick(formId, 'submit', form.value);`);
    lines.push(`  console.log('Form Submitted:', form.value);`);
    lines.push(`  ElMessage.success('表单提交成功');`);
    lines.push(`};`);
    lines.push('');
    lines.push(`const handleReset = (formId: string) => {`);
    lines.push(`  const form = lookupForm(formId);\n  if (!form) return;`);
    lines.push(`  Object.keys(form.value).forEach((key) => { form.value[key] = undefined; });`);
    lines.push(`  ElMessage.info('表单已重置');`);
    lines.push(`};`);
    lines.push('');
  }

  // 6. 图层状态声明
  if (layerStateDecls) {
    lines.push(layerStateDecls);
    lines.push('');
  }

  // 7. 初始化加载
  if (autoFetchCalls.length > 0) {
    lines.push(`const loadInitialData = () => {\n${autoFetchCalls.join('\n')}\n};`);
  } else {
    lines.push(`const loadInitialData = () => {\n  // 无自动请求的数据源\n};`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * 1. 生成标准的 Vue 3 SFC 单文件组件 (.vue)
 */
export function generateVueSFC(schema: PageSchema): string {
  bindIdents(schema);
  const { extraLifecycleScripts, extraUnmountScripts } = renderLayers(schema);

  const templateBody = renderPageTemplateBody(schema, 2);
  const scriptBody = renderScriptSetup(schema);

  return `<template>
  <div class="lowcode-page-${safeClassToken(schema.id)}">
${templateBody}  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';

${scriptBody}
onMounted(() => {
  loadInitialData();
${extraLifecycleScripts || '  console.log("低代码页面及多图层组件已成功挂载!");\n'}
});

onUnmounted(() => {
${extraUnmountScripts || '  console.log("低代码页面组件已卸载!");\n'}
});
</script>

<style scoped>
${renderPageStyle(schema)}
</style>
`;
}

/**
 * 1b. 生成 Web Component 配套的页面组件 (PageTemplate.vue)
 */
export function generatePageTemplate(schema: PageSchema): string {
  return generateVueSFC(schema);
}

/**
 * 2. 生成 W3C Web Component 自定义元素包装脚本 (.js)
 * 完整渲染：通过 createApp 将 PageTemplate 挂载到自定义元素 (light DOM)，
 * 使 Element Plus 全局样式正常生效。需配套下载 PageTemplate.vue 并在
 * 宿主项目（Vue 3 + Element Plus + Vite）中构建运行。
 */
export function generateWebComponent(schema: PageSchema): string {
  const tagName = `custom-page-${safeClassToken(schema.id) || 'page'}`;

  return `/**
 * Web Component 包装脚本
 * 标签名: <${tagName}></${tagName}>
 * 说明:
 *   - 完整渲染 (非演示级)：通过 Vue createApp 将 PageTemplate 挂载到
 *     自定义元素 (light DOM)，Element Plus 全局样式正常生效。
 *   - 使用前提：宿主项目需安装 vue / element-plus，且本文件与配套的
 *     PageTemplate.vue 放置于同一目录。
 *   - 跨框架复用：React / Angular / jQuery / 原生 HTML 均可直接引用该标签。
 */
import { createApp, h } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import PageTemplate from './PageTemplate.vue';

class ${tagName.replace(/-/g, '_')} extends HTMLElement {
  private _app: ReturnType<typeof createApp> | null = null;

  connectedCallback() {
    const app = createApp({
      render: () => h(PageTemplate, { key: Date.now() })
    });
    app.use(ElementPlus);
    this._app = app;
    app.mount(this);
  }

  disconnectedCallback() {
    if (this._app) {
      this._app.unmount();
      this._app = null;
    }
  }
}

if (!customElements.get('${tagName}')) {
  customElements.define('${tagName}', ${tagName.replace(/-/g, '_')});
  console.log('Web Component <${tagName}> 成功注册!');
}

export default ${tagName.replace(/-/g, '_')};
`;
}

// ---------------------------------------------------------------------------
// v1.3.0 出码辅助：独立 HTML (options API) 数据层
// ---------------------------------------------------------------------------

/** options API: 表格/表单数据加载方法（this. 访问数据） */
function renderOptionsLoadFunction(node: ComponentNode, binding: ApiBinding, isForm: boolean): string {
  const dataName = isForm ? `formData_${identOf(node.id)}` : `tableData_${identOf(node.id)}`;
  const totalName = `totalCount_${identOf(node.id)}`;
  const method = binding.method ?? 'GET';
  const dataExpr = renderPathExpr(binding.responsePath, 'json');
  const totalExpr = binding.totalProp ? renderPathExpr(binding.totalProp, 'json') : 'undefined';
  const pageExpr = isForm ? undefined : `this.currentPage_${identOf(node.id)}`;
  const requestBlock = renderFetchRequestBlock(
    renderUrlExpr(binding.url),
    renderParamsLiteral(binding.params),
    method,
    true,
    pageExpr,
    isForm ? undefined : tablePageSize(node)
  );

  if (isForm) {
    return `async loadData_${identOf(node.id)}() {
  try {
${requestBlock}
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const data = ${dataExpr};
    if (data && typeof data === 'object') {
      this.${dataName} = { ...data };
    }
  } catch (err) {
    console.error('表单数据加载失败:', err);
  }
}`;
  }
  return `async loadData_${identOf(node.id)}() {
  try {
${requestBlock}
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const list = ${dataExpr};
    this.${dataName} = Array.isArray(list) ? list : [];
    const total = ${totalExpr};
    if (total !== undefined) this.${totalName} = Number(total) || 0;
  } catch (err) {
    console.error('数据加载失败:', err);
  }
}`;
}

/** options API: data() 返回内容（节点化数据名 + 图层状态） */
function renderOptionsData(schema: PageSchema): string {
  const children = allEditableNodes(schema);
  const tableNodes = children.filter((n) => n.type === 'pro-table');
  const formNodes = children.filter((n) => n.type === 'pro-form');

  const fields: string[] = [];

  const stateEntries = Object.entries(schema.state || {})
    .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(', ');
  fields.push(`state: { ${stateEntries} },`);

  tableNodes.forEach((n) => {
    const dataName = `tableData_${identOf(n.id)}`;
    const totalName = `totalCount_${identOf(n.id)}`;
    const pageName = `currentPage_${identOf(n.id)}`;
    if (n.apiBinding?.url) {
      fields.push(`${dataName}: [], // 数据源: ${safeComment(n.apiBinding.url)}`);
      fields.push(`${totalName}: 0,`);
      fields.push(`${pageName}: 1,`);
    } else {
      fields.push(`${dataName}: ${JSON.stringify(TABLE_PLACEHOLDER_ROWS)}, // 占位数据：可在设计器中配置数据源替换`);
      fields.push(`${totalName}: ${TABLE_PLACEHOLDER_ROWS.length},`);
      fields.push(`${pageName}: 1,`);
    }
  });

  formNodes.forEach((n) => {
    fields.push(`formData_${identOf(n.id)}: {},`);
  });
  children
    .filter((node) => node.type === 'el-input' || node.type === 'el-switch')
    .forEach((node) => fields.push(renderFieldRef(node, true)));

  (schema.layers || []).forEach((layer) => {
    if (layer.type === 'dialog')
      fields.push(`dialogVisible_${identOf(layer.id)}: ${layer.visible ? 'true' : 'false'},`);
    if (layer.type === 'loading')
      fields.push(`loadingVisible_${identOf(layer.id)}: ${layer.visible ? 'true' : 'false'},`);
  });
  (schema.layers || [])
    .filter((layer) => layer.type === 'custom-html')
    .forEach((layer) => {
      fields.push(`customHtmlSrcdoc_${identOf(layer.id)}: ${embedJsString(buildCustomHtmlSrcdoc(layer))},`);
    });

  return fields.join('\n          ');
}

/** options API: methods 内容（加载 + 事件动作链 + 表单/行动作） */
function renderOptionsMethods(schema: PageSchema): string {
  const children = allEditableNodes(schema);
  const tableNodes = children.filter((n) => n.type === 'pro-table');
  const formNodes = children.filter((n) => n.type === 'pro-form');
  const eventNodes = children.filter((n) => enabledEventEntries(n).length > 0);

  const methods: string[] = [];

  tableNodes.forEach((n) => {
    if (n.apiBinding?.url) methods.push(renderOptionsLoadFunction(n, n.apiBinding, false));
    const pageName = `currentPage_${identOf(n.id)}`;
    const reload = n.apiBinding?.url ? `this.loadData_${identOf(n.id)}();` : '';
    methods.push(`onPage_${identOf(n.id)}(page) { this.${pageName} = page; this.state.page = page; ${reload} },`);
  });
  formNodes.forEach((n) => {
    if (n.apiBinding?.url) methods.push(renderOptionsLoadFunction(n, n.apiBinding, true));
  });

  const clickHandler = renderNodeClickHandler(eventNodes, true);
  if (clickHandler) methods.push(clickHandler);

  if (tableNodes.length > 0) {
    const guards = eventNodes.flatMap((node) =>
      enabledEventEntries(node).map(
        ([eventKey]) => `(nodeId === ${JSON.stringify(node.id)} && eventKey === ${JSON.stringify(eventKey)})`
      )
    );
    const delegated = guards.length
      ? `    if (${guards.join(' || ')}) {\n      return this.handleNodeClick(nodeId, eventKey, { row, eventKey });\n    }\n`
      : '';
    methods.push(`handleRowAction(nodeId, eventKey, row) {
${delegated}    console.log('查看行数据:', row);
    ElementPlus.ElMessage.info('查看: ' + (row.name || row.id));
  },`);
  }

  if (formNodes.length > 0) {
    methods.push(`lookupForm(formId) {\n${renderFormLookup(formNodes, true)}\n  },`);
    const guards = renderSubmitGuards(formNodes, true);
    const submitCall = clickHandler ? `await this.handleNodeClick(formId, 'submit', form);\n    ` : '';
    methods.push(`async handleSubmit(formId) {
    const form = this.lookupForm(formId);
    if (!form) return;
    ${guards ? `${guards}\n    ` : ''}${submitCall}console.log('Form Submitted:', form);
    ElementPlus.ElMessage.success('表单提交成功');
  },`);
    methods.push(`handleReset(formId) {
    const form = this.lookupForm(formId);
    if (!form) return;
    Object.keys(form).forEach((key) => {
      form[key] = undefined;
    });
    ElementPlus.ElMessage.info('表单已重置');
  },`);
  }

  return methods.join('\n  ');
}

/**
 * 3. 生成独立纯 HTML + CDN 可运行文件 (index.html)
 * 完整渲染：Vue 3 CDN (完整版，含模板编译器) + Element Plus CDN，
 * 模板直接内联，双击即可在浏览器运行。
 */
export function generateHTML(schema: PageSchema): string {
  bindIdents(schema);
  const children = allEditableNodes(schema);
  const tableNodes = children.filter((n) => n.type === 'pro-table');
  const formNodes = children.filter((n) => n.type === 'pro-form');
  // HTML 使用 options API（CDN 渲染），模板 ref 需通过 this.$refs 访问
  const { extraLifecycleScripts, extraUnmountScripts } = renderLayers(schema, 'options');
  const templateBody = renderPageTemplateBody(schema, 4);

  const dataFields = renderOptionsData(schema);
  const methodsBody = renderOptionsMethods(schema);

  const autoFetchCalls = [
    ...tableNodes
      .filter((n) => n.apiBinding?.url && n.apiBinding.autoFetch !== false)
      .map((n) => `this.loadData_${identOf(n.id)}();`),
    ...formNodes
      .filter((n) => n.apiBinding?.url && n.apiBinding.autoFetch !== false)
      .map((n) => `this.loadData_${identOf(n.id)}();`)
  ].join('\n');
  const mountBody = [autoFetchCalls, extraLifecycleScripts].filter(Boolean).join('\n');

  const mountedScript = `    mounted() {
${indentLines(mountBody, 2) || '      console.log("低代码页面已挂载!");'}
    },
    beforeUnmount() {
${indentLines(extraUnmountScripts, 2) || '      console.log("低代码页面已卸载!");'}
    },`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(schema.title) || '低代码独立 HTML 页面'}</title>
  <!-- Element Plus CSS -->
  <link rel="stylesheet" href="https://unpkg.com/element-plus/dist/index.css">
  <style>
${renderPageStyle(schema)
  .split('\n')
  .map((l) => '    ' + l)
  .join('\n')}
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #f5f7fa;
    }
    .page-header {
      text-align: center;
      padding: 16px;
      background: #ffffff;
      border-bottom: 1px solid #ebeef5;
    }
    .page-header h2 { margin: 0; color: #303133; }
    .page-header p { margin: 4px 0 0; color: #909399; font-size: 12px; }
  </style>
</head>
<body>
  <div id="app">
    <div class="page-header">
      <h2>${escapeHtml(schema.title) || '未命名低代码页面'}</h2>
      <p>页面 ID: ${escapeHtml(schema.id)} | 生成版本: v${escapeHtml(schema.meta.version)}</p>
    </div>
    <div class="lowcode-page-${safeClassToken(schema.id)}">
${templateBody}    </div>
  </div>

  <!-- Vue 3 CDN (完整版，含模板编译器) & Element Plus CDN -->
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
  <script src="https://unpkg.com/element-plus"></script>
  <script>
    const { createApp } = Vue;
    ${FETCH_CHECKED_SOURCE}

    const App = {
      template: \`
        <div>
          <div class="page-header">
            <h2>${escapeHtml(schema.title) || '未命名低代码页面'}</h2>
            <p>页面 ID: ${escapeHtml(schema.id)} | 生成版本: v${escapeHtml(schema.meta.version)}</p>
          </div>
          <div class="lowcode-page-${safeClassToken(schema.id)}">
${templateBody}          </div>
        </div>
      \`,
      data() {
        return {
${dataFields}
        };
      },
${mountedScript}
      methods: {
${methodsBody}
      }
    };

    createApp(App).use(ElementPlus).mount('#app');
  </script>
</body>
</html>
`;
}

/**
 * 4. 生成配套 package.json 依赖构建清单
 */
export function generatePackageJson(schema: PageSchema): string {
  return JSON.stringify(
    {
      name: `lowcode-export-${safeClassToken(schema.id) || 'page'}`,
      version: '1.0.0',
      private: true,
      scripts: {
        dev: 'vite',
        build: 'vue-tsc -b && vite build',
        preview: 'vite preview'
      },
      dependencies: {
        vue: '^3.4.0',
        'element-plus': '^2.6.0',
        '@element-plus/icons-vue': '^2.3.0'
      },
      devDependencies: {
        '@vitejs/plugin-vue': '^5.0.0',
        typescript: '^5.3.0',
        vite: '^5.1.0',
        'vue-tsc': '^2.0.0'
      }
    },
    null,
    2
  );
}

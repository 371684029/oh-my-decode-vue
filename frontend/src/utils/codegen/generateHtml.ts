import type { PageSchema, ComponentNode, ApiBinding } from '../../types/designer';
import { FETCH_CHECKED_SOURCE } from '../dataSource';
import { TABLE_PLACEHOLDER_ROWS } from '../tablePlaceholder';
import { buildCustomHtmlSrcdoc } from '../customHtmlDocument';
import { rowActionFallbackStatements } from '../rowActionMessage';
import {
  bindIdents,
  allEditableNodes,
  embedJsString,
  escapeHtml,
  indentLines,
  safeComment,
  safeClassToken,
  tablePageSize,
  renderPathExpr,
  renderParamsLiteral,
  identOf
} from './shared';
import { renderLayers, renderPageTemplateBody, renderPageStyle } from './renderNode';
import {
  enabledEventEntries,
  renderNodeClickHandler,
  renderSubmitGuards,
  renderFormLookup,
  renderFieldRef,
  renderUrlExpr,
  renderFetchRequestBlock
} from './actions';

// ============================================================
// 目标 3: 独立 HTML (.html) — options API (Vue CDN)
// ============================================================

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
${delegated}${rowActionFallbackStatements('ElementPlus.ElMessage', false)
      .map((s) => `    ${s}`)
      .join('\n')}
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

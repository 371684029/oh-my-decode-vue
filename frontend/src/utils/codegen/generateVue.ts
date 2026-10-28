import type { PageSchema } from '../../types/designer';
import { FETCH_CHECKED_SOURCE } from '../dataSource';
import { TABLE_PLACEHOLDER_ROWS } from '../tablePlaceholder';
import { buildCustomHtmlSrcdoc } from '../customHtmlDocument';
import { rowActionFallbackStatements } from '../rowActionMessage';
import {
  bindIdents,
  allEditableNodes,
  embedJsString,
  safeComment,
  safeClassToken,
  identOf
} from './shared';
import {
  renderLayers,
  collectLayerStateDecls,
  renderPageTemplateBody,
  renderPageStyle
} from './renderNode';
import { indentBlock, finalizeArtifact } from './format';
import {
  enabledEventEntries,
  renderNodeClickHandler,
  renderSubmitGuards,
  renderFormLookup,
  renderFieldRef,
  renderTableLoadFunction,
  renderFormLoadFunction
} from './actions';

// ============================================================
// 目标 1: Vue 3 SFC (.vue) — Composition API script setup
// ============================================================

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
    for (const stmt of rowActionFallbackStatements('ElMessage', true)) {
      lines.push(`  ${stmt}`);
    }
    lines.push(`};`);
    lines.push('');
  }
  if (formNodes.length > 0) {
    lines.push(`const lookupForm = (formId: string) => {\n${renderFormLookup(formNodes, false)}\n};`);
    lines.push(`const handleSubmit = async (formId: string) => {`);
    lines.push(`  const form = lookupForm(formId);\n  if (!form) return;`);
    const guards = renderSubmitGuards(formNodes, false);
    if (guards) lines.push(indentBlock(guards, 2));
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

  return finalizeArtifact(`<template>
  <div class="lowcode-page-${safeClassToken(schema.id)}">
${templateBody}  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';

${scriptBody}
onMounted(() => {
  loadInitialData();
${extraLifecycleScripts || '  console.log("低代码页面及多图层组件已成功挂载!");'}
});

onUnmounted(() => {
${extraUnmountScripts || '  console.log("低代码页面组件已卸载!");'}
});
</script>

<style scoped>
${renderPageStyle(schema).trimEnd()}
</style>
`);
}

/**
 * 1b. 生成 Web Component 配套的页面组件 (PageTemplate.vue)
 */
export function generatePageTemplate(schema: PageSchema): string {
  return generateVueSFC(schema);
}

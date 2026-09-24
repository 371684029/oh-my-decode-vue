import type { PageSchema, ComponentNode, LayerConfig } from '../types/designer';

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

/** 格式化属性对，转换为 HTML/Vue attribute 文本（字符串值转义） */
function stringifyAttributes(props: Record<string, any>, attrs: Record<string, any>): string {
  const parts: string[] = [];

  for (const [key, val] of Object.entries(props)) {
    if (val === undefined || val === null || val === '') continue;
    if (typeof val === 'boolean') {
      if (val) parts.push(`:${key}="true"`);
    } else if (typeof val === 'number') {
      parts.push(`:${key}="${val}"`);
    } else {
      parts.push(`${key}="${escapeHtml(val)}"`);
    }
  }

  for (const [key, val] of Object.entries(attrs)) {
    if (val === undefined || val === null || val === '') continue;
    parts.push(`${key}="${escapeHtml(val)}"`);
  }

  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

/**
 * 将 ComponentNode 单节点递归转换为模板文本
 */
function renderNodeToTemplate(node: ComponentNode, indentLevel = 3): string {
  const indent = ' '.repeat(indentLevel * 2);
  const attrStr = stringifyAttributes(node.props || {}, node.attrs || {});

  switch (node.type) {
    case 'pro-table': {
      const columns = node.config?.columns || [];
      const colIndent = ' '.repeat((indentLevel + 1) * 2);
      let colsTemplate = '';

      columns.forEach((col: any) => {
        colsTemplate += `${colIndent}<el-table-column prop="${escapeHtml(col.prop)}" label="${escapeHtml(col.label)}"${col.width ? ` width="${escapeHtml(col.width)}"` : ''}${col.sortable ? ' sortable' : ''} />\n`;
      });

      return (
        `${indent}<!-- 高端表格 Component -->\n` +
        `${indent}<el-card shadow="always">\n` +
        `${indent}  <el-table :data="tableData"${attrStr} style="width: 100%">\n` +
        colsTemplate +
        `${indent}    <el-table-column label="操作" align="center" width="160">\n` +
        `${indent}      <template #default="scope">\n` +
        `${indent}        <el-button link type="primary" size="small" @click="handleRowAction(scope.row)">查看</el-button>\n` +
        `${indent}      </template>\n` +
        `${indent}    </el-table-column>\n` +
        `${indent}  </el-table>\n` +
        `${indent}  <el-pagination\n` +
        `${indent}    v-model:current-page="currentPage"\n` +
        `${indent}    :page-size="10"\n` +
        `${indent}    layout="total, prev, pager, next"\n` +
        `${indent}    :total="tableData.length"\n` +
        `${indent}    size="small"\n` +
        `${indent}    style="margin-top: 10px; justify-content: flex-end"\n` +
        `${indent}  />\n` +
        `${indent}</el-card>\n`
      );
    }

    case 'pro-form': {
      const items = node.config?.items || [];
      const itemIndent = ' '.repeat((indentLevel + 1) * 2);
      let itemsTemplate = '';

      items.forEach((item: any) => {
        // 兼容 component / type 两种字段命名，统一取 field 为数据绑定键
        const itemType = item.component || item.type;
        const field = item.field || item.name;

        if (itemType === 'input') {
          itemsTemplate +=
            `${itemIndent}<el-form-item label="${escapeHtml(item.label)}" prop="${escapeHtml(field)}">\n` +
            `${itemIndent}  <el-input v-model='formData[${JSON.stringify(field)}]' placeholder="请输入${escapeHtml(item.label)}" />\n` +
            `${itemIndent}</el-form-item>\n`;
        } else if (itemType === 'select') {
          const options = item.options || [
            { label: '选项一', value: '1' },
            { label: '选项二', value: '2' }
          ];
          let optTemplate = '';
          options.forEach((opt: any) => {
            optTemplate += `${itemIndent}    <el-option label="${escapeHtml(opt.label)}" value="${escapeHtml(opt.value)}" />\n`;
          });
          itemsTemplate +=
            `${itemIndent}<el-form-item label="${escapeHtml(item.label)}" prop="${escapeHtml(field)}">\n` +
            `${itemIndent}  <el-select v-model='formData[${JSON.stringify(field)}]' placeholder="请选择${escapeHtml(item.label)}">\n` +
            optTemplate +
            `${itemIndent}  </el-select>\n` +
            `${itemIndent}</el-form-item>\n`;
        } else if (itemType === 'switch') {
          itemsTemplate +=
            `${itemIndent}<el-form-item label="${escapeHtml(item.label)}" prop="${escapeHtml(field)}">\n` +
            `${itemIndent}  <el-switch v-model='formData[${JSON.stringify(field)}]' />\n` +
            `${itemIndent}</el-form-item>\n`;
        } else if (itemType === 'date') {
          itemsTemplate +=
            `${itemIndent}<el-form-item label="${escapeHtml(item.label)}" prop="${escapeHtml(field)}">\n` +
            `${itemIndent}  <el-date-picker v-model='formData[${JSON.stringify(field)}]' type="date" placeholder="请选择日期" style="width: 100%" />\n` +
            `${itemIndent}</el-form-item>\n`;
        }
      });

      return (
        `${indent}<!-- 高端表单 Component -->\n` +
        `${indent}<el-form :model="formData"${attrStr} label-width="100px">\n` +
        itemsTemplate +
        `${indent}  <el-form-item>\n` +
        `${indent}    <el-button type="primary" @click="handleSubmit">提交</el-button>\n` +
        `${indent}    <el-button @click="handleReset">重置</el-button>\n` +
        `${indent}  </el-form-item>\n` +
        `${indent}</el-form>\n`
      );
    }

    case 'el-button':
      return `${indent}<el-button${attrStr}>${escapeHtml(node.props.text) || '按钮'}</el-button>\n`;

    case 'el-input':
      return `${indent}<el-input v-model='formData[${JSON.stringify(node.id)}]'${attrStr} />\n`;

    case 'el-card':
      return (
        `${indent}<el-card${attrStr}>\n` +
        `${indent}  <p>${escapeHtml(node.props.content) || '卡片内容区域'}</p>\n` +
        `${indent}</el-card>\n`
      );

    case 'el-tag':
      return `${indent}<el-tag${attrStr}>${escapeHtml(node.props.text) || '标签'}</el-tag>\n`;

    case 'el-alert':
      return `${indent}<el-alert${attrStr} />\n`;

    case 'el-switch':
      return `${indent}<el-switch v-model='formData[${JSON.stringify(node.id)}]'${attrStr} />\n`;

    case 'el-divider':
      return `${indent}<el-divider${attrStr}>${escapeHtml(node.props.text) || ''}</el-divider>\n`;

    default:
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
  refStyle: 'composition' | 'options' = 'composition'
): {
  extraLayersTemplate: string;
  extraLifecycleScripts: string;
  extraUnmountScripts: string;
} {
  let extraLayersTemplate = '';
  let extraLifecycleScripts = '';
  let extraUnmountScripts = '';

  if (schema.layers && schema.layers.length > 0) {
    schema.layers.forEach((layer: LayerConfig) => {
      const refExpr =
        refStyle === 'options' ? `this.$refs.customHtmlRef_${layer.id}` : `customHtmlRef_${layer.id}?.value`;
      if (layer.type === 'dialog') {
        extraLayersTemplate +=
          `    <!-- 弹窗图层: ${safeComment(layer.name)} -->\n` +
          `    <el-dialog v-model="dialogVisible_${layer.id}" title="${escapeHtml(layer.props?.title) || escapeHtml(layer.name)}" width="${escapeHtml(layer.props?.width) || '50%'}">\n` +
          `      <p>这是 ${escapeHtml(layer.name)} 嵌套弹窗内容。</p>\n` +
          `    </el-dialog>\n\n`;
      } else if (layer.type === 'loading') {
        extraLayersTemplate +=
          `    <!-- Loading 遮罩图层: ${safeComment(layer.name)} -->\n` +
          `    <div v-if="loadingVisible_${layer.id}" class="loading-overlay">\n` +
          `      <p>${escapeHtml(layer.props?.loadingText) || '数据加载中...'}</p>\n` +
          `    </div>\n\n`;
      } else if (layer.type === 'custom-html') {
        extraLayersTemplate +=
          `    <!-- 自定义 HTML 图层: ${safeComment(layer.name)} -->\n` +
          `    <div class="custom-html-wrapper" ref="customHtmlRef_${layer.id}">\n` +
          `      ${layer.props?.htmlCode || ''}\n` +
          `    </div>\n\n`;

        if (layer.props?.scriptMounted) {
          extraLifecycleScripts +=
            `  // 自定义 HTML 图层 (${safeComment(layer.name)}) onMounted 生命周期\n` +
            `  try {\n` +
            `    const container = ${refExpr};\n` +
            `    ${layer.props.scriptMounted}\n` +
            `  } catch (err) { console.error(err); }\n\n`;
        }
        if (layer.props?.scriptUnmounted) {
          extraUnmountScripts +=
            `  // 自定义 HTML 图层 (${safeComment(layer.name)}) onUnmounted 生命周期\n` +
            `  try {\n` +
            `    const container = ${refExpr};\n` +
            `    ${layer.props.scriptUnmounted}\n` +
            `  } catch (err) { console.error(err); }\n\n`;
        }
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
    if (l.type === 'dialog') dialogVisible.push(`const dialogVisible_${l.id} = ref(false);`);
    else if (l.type === 'loading') loadingVisible.push(`const loadingVisible_${l.id} = ref(true);`);
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
}`;
}

/**
 * 1. 生成标准的 Vue 3 SFC 单文件组件 (.vue)
 */
export function generateVueSFC(schema: PageSchema): string {
  const { dialogVisible, loadingVisible } = collectLayerStateDecls(schema);
  const { extraLifecycleScripts, extraUnmountScripts } = renderLayers(schema);
  const layerStateDecls = [...dialogVisible, ...loadingVisible].join('\n');

  const templateBody = renderPageTemplateBody(schema, 2);

  return `<template>
  <div class="lowcode-page-${safeClassToken(schema.id)}">
${templateBody}  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';

// 全局/表单响应式状态
const formData = reactive<Record<string, any>>({});
const tableData = ref([
  { id: 101, name: '张三', role: '系统管理员', status: '正常', updatedAt: '2026-09-15' },
  { id: 102, name: '李四', role: '前端开发者', status: '启用', updatedAt: '2026-09-15' }
]);
const currentPage = ref(1);
${layerStateDecls ? layerStateDecls + '\n' : ''}
onMounted(() => {
${extraLifecycleScripts || '  console.log("低代码页面及多图层组件已成功挂载!");\n'}
});

onUnmounted(() => {
${extraUnmountScripts || '  console.log("低代码页面组件已卸载!");\n'}
});

const handleRowAction = (row: any) => {
  console.log('查看行数据:', row);
  ElMessage.info('查看: ' + (row.name || row.id));
};

const handleSubmit = () => {
  console.log('Form Submitted:', formData);
  ElMessage.success('表单提交成功');
};

const handleReset = () => {
  Object.keys(formData).forEach((key) => {
    formData[key] = undefined;
  });
  ElMessage.info('表单已重置');
};
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

/**
 * 3. 生成独立纯 HTML + CDN 可运行文件 (index.html)
 * 完整渲染：Vue 3 CDN (完整版，含模板编译器) + Element Plus CDN，
 * 模板直接内联，双击即可在浏览器运行。
 */
export function generateHTML(schema: PageSchema): string {
  const { dialogVisible, loadingVisible } = collectLayerStateDecls(schema);
  // HTML 使用 options API（CDN 渲染），模板 ref 需通过 this.$refs 访问
  const { extraLifecycleScripts, extraUnmountScripts } = renderLayers(schema, 'options');
  const templateBody = renderPageTemplateBody(schema, 4);

  const layerStateData = [
    ...dialogVisible.map((d) => `      ${d}`.replace('const ', '').replace(' = ref(false);', ': false')),
    ...loadingVisible.map((l) => `      ${l}`.replace('const ', '').replace(' = ref(true);', ': true'))
  ].join(',\n');

  const mountedScript = `    mounted() {
${indentLines(extraLifecycleScripts, 2) || '      console.log("低代码页面已挂载!");'}
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
          formData: {},
          tableData: [
            { id: 101, name: '张三', role: '系统管理员', status: '正常', updatedAt: '2026-09-15' },
            { id: 102, name: '李四', role: '前端开发者', status: '启用', updatedAt: '2026-09-15' }
          ],
          currentPage: 1
${layerStateData ? ',\n' + layerStateData : ''}
        };
      },
${mountedScript}
      methods: {
        handleRowAction(row) {
          console.log('查看行数据:', row);
          ElementPlus.ElMessage.info('查看: ' + (row.name || row.id));
        },
        handleSubmit() {
          console.log('Form Submitted:', this.formData);
          ElementPlus.ElMessage.success('表单提交成功');
        },
        handleReset() {
          Object.keys(this.formData).forEach((key) => {
            this.formData[key] = undefined;
          });
          ElementPlus.ElMessage.info('表单已重置');
        }
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

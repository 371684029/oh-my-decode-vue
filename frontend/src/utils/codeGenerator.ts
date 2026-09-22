import type { PageSchema, ComponentNode } from '../types/designer';

/**
 * 格式化属性对，转换为 HTML/Vue attribute 文本
 */
function stringifyAttributes(props: Record<string, any>, attrs: Record<string, any>): string {
  const parts: string[] = [];

  // 处理 Props
  for (const [key, val] of Object.entries(props)) {
    if (val === undefined || val === null || val === '') continue;
    if (typeof val === 'boolean') {
      if (val) parts.push(`:${key}="true"`);
    } else if (typeof val === 'number') {
      parts.push(`:${key}="${val}"`);
    } else {
      parts.push(`${key}="${val}"`);
    }
  }

  // 处理 Attrs
  for (const [key, val] of Object.entries(attrs)) {
    if (val === undefined || val === null || val === '') continue;
    parts.push(`${key}="${val}"`);
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
        colsTemplate += `${colIndent}<el-table-column prop="${col.prop}" label="${col.label}"${col.width ? ` width="${col.width}"` : ''} />\n`;
      });

      return `${indent}<!-- 高端表格 Component -->\n` +
        `${indent}<el-card shadow="always">\n` +
        `${indent}  <el-table :data="tableData"${attrStr} style="width: 100%">\n` +
        colsTemplate +
        `${indent}  </el-table>\n` +
        `${indent}</el-card>\n`;
    }

    case 'pro-form': {
      const items = node.config?.items || [];
      const itemIndent = ' '.repeat((indentLevel + 1) * 2);
      let itemsTemplate = '';

      items.forEach((item: any) => {
        if (item.type === 'input') {
          itemsTemplate += `${itemIndent}<el-form-item label="${item.label}" prop="${item.name}">\n` +
            `${itemIndent}  <el-input v-model="formData.${item.name}" placeholder="请输入${item.label}" />\n` +
            `${itemIndent}</el-form-item>\n`;
        } else if (item.type === 'select') {
          itemsTemplate += `${itemIndent}<el-form-item label="${item.label}" prop="${item.name}">\n` +
            `${itemIndent}  <el-select v-model="formData.${item.name}" placeholder="请选择${item.label}">\n` +
            `${itemIndent}    <el-option label="选项一" value="1" />\n` +
            `${itemIndent}    <el-option label="选项二" value="2" />\n` +
            `${itemIndent}  </el-select>\n` +
            `${itemIndent}</el-form-item>\n`;
        } else if (item.type === 'switch') {
          itemsTemplate += `${itemIndent}<el-form-item label="${item.label}" prop="${item.name}">\n` +
            `${itemIndent}  <el-switch v-model="formData.${item.name}" />\n` +
            `${itemIndent}</el-form-item>\n`;
        }
      });

      return `${indent}<!-- 高端表单 Component -->\n` +
        `${indent}<el-form :model="formData"${attrStr} label-width="100px">\n` +
        itemsTemplate +
        `${indent}  <el-form-item>\n` +
        `${indent}    <el-button type="primary" @click="handleSubmit">提交</el-button>\n` +
        `${indent}    <el-button @click="handleReset">重置</el-button>\n` +
        `${indent}  </el-form-item>\n` +
        `${indent}</el-form>\n`;
    }

    case 'el-button':
      return `${indent}<el-button${attrStr}>${node.props.text || '按钮'}</el-button>\n`;

    case 'el-input':
      return `${indent}<el-input v-model="formData.${node.id}"${attrStr} />\n`;

    case 'el-card':
      return `${indent}<el-card${attrStr}>\n` +
        `${indent}  <p>${node.props.content || '卡片内容区域'}</p>\n` +
        `${indent}</el-card>\n`;

    case 'el-tag':
      return `${indent}<el-tag${attrStr}>${node.props.text || '标签'}</el-tag>\n`;

    case 'el-alert':
      return `${indent}<el-alert${attrStr} />\n`;

    case 'el-switch':
      return `${indent}<el-switch v-model="formData.${node.id}"${attrStr} />\n`;

    case 'el-divider':
      return `${indent}<el-divider${attrStr}>${node.props.text || ''}</el-divider>\n`;

    default:
      return `${indent}<div id="${node.id}"${attrStr}>${node.label}</div>\n`;
  }
}

/**
 * 1. 生成标准的 Vue 3 SFC 单文件组件 (.vue)
 */
export function generateVueSFC(schema: PageSchema): string {
  let templateBody = '';
  schema.children.forEach((child) => {
    templateBody += renderNodeToTemplate(child, 2);
  });

  let extraLayersTemplate = '';
  let extraLifecycleScripts = '';

  if (schema.layers && schema.layers.length > 0) {
    schema.layers.forEach((layer) => {
      if (layer.type === 'dialog') {
        extraLayersTemplate += `    <!-- 弹窗图层: ${layer.name} -->\n` +
          `    <el-dialog v-model="dialogVisible_${layer.id}" title="${layer.props?.title || layer.name}" width="${layer.props?.width || '50%'}">\n` +
          `      <p>这是 ${layer.name} 嵌套弹窗内容。</p>\n` +
          `    </el-dialog>\n\n`;
      } else if (layer.type === 'loading') {
        extraLayersTemplate += `    <!-- Loading 遮罩图层: ${layer.name} -->\n` +
          `    <div v-if="loadingVisible_${layer.id}" class="loading-overlay">\n` +
          `      <p>${layer.props?.loadingText || '数据加载中...'}</p>\n` +
          `    </div>\n\n`;
      } else if (layer.type === 'custom-html') {
        extraLayersTemplate += `    <!-- 自定义 HTML 图层: ${layer.name} -->\n` +
          `    <div class="custom-html-wrapper" ref="customHtmlRef_${layer.id}">\n` +
          `      ${layer.props?.htmlCode || ''}\n` +
          `    </div>\n\n`;

        if (layer.props?.scriptMounted) {
          extraLifecycleScripts += `  // 自定义 HTML 图层 (${layer.name}) onMounted 生命周期\n` +
            `  try {\n    ${layer.props.scriptMounted}\n  } catch (err) { console.error(err); }\n\n`;
        }
      }
    });
  }

  if (!templateBody.trim() && !extraLayersTemplate.trim()) {
    templateBody = '    <div class="empty-page">页面暂无内容，请在设计器中拖入物料组件</div>\n';
  }

  return `<template>
  <div class="lowcode-page-${schema.id}">
${templateBody}${extraLayersTemplate}  </div>
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

onMounted(() => {
${extraLifecycleScripts || '  console.log("低代码页面及多图层组件已成功挂载!");\n'}
});

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
.lowcode-page-${schema.id} {
  padding: 24px;
  background-color: #f5f7fa;
  min-height: 100vh;
}
.empty-page {
  text-align: center;
  color: #909399;
  padding: 60px 0;
}
</style>
`;
}

/**
 * 2. 生成原生 W3C Web Component 自定义元素代码 (.js)
 */
export function generateWebComponent(schema: PageSchema): string {
  const tagName = `custom-page-${schema.id.toLowerCase().replace(/_/g, '-')}`;

  return `/**
 * Web Component 包装脚本
 * 标签名: <${tagName}></${tagName}>
 * 框架无关：可在 React / Angular / jQuery / 原生 HTML 中直接引用
 */
import { defineCustomElement, createApp, h } from 'vue';

const PageTemplate = {
  template: \`
    <div style="padding: 20px; font-family: sans-serif;">
      <h2>${schema.title || '低代码 Web Component'}</h2>
      <div class="web-component-body">
        <!-- 低代码渲染区域 -->
        <p>这是一个跨框架渲染的 Web Component 原生自定义元素。</p>
      </div>
    </div>
  \`
};

// 使用 Vue 3 defineCustomElement API 注册标准 W3C Custom Element
const CustomElementClass = defineCustomElement(PageTemplate);

if (!customElements.get('${tagName}')) {
  customElements.define('${tagName}', CustomElementClass);
  console.log('Web Component <${tagName}> 成功注册!');
}

export default CustomElementClass;
`;
}

/**
 * 3. 生成独立纯 HTML + CDN 可运行文件 (index.html)
 */
/**
 * 4. 生成配套 package.json 依赖构建清单
 */
export function generatePackageJson(schema: PageSchema): string {
  return JSON.stringify({
    "name": `lowcode-export-${schema.id.toLowerCase().replace(/_/g, '-')}`,
    "version": "1.0.0",
    "private": true,
    "scripts": {
      "dev": "vite",
      "build": "vue-tsc -b && vite build",
      "preview": "vite preview"
    },
    "dependencies": {
      "vue": "^3.4.0",
      "element-plus": "^2.6.0",
      "@element-plus/icons-vue": "^2.3.0"
    },
    "devDependencies": {
      "@vitejs/plugin-vue": "^5.0.0",
      "typescript": "^5.3.0",
      "vite": "^5.1.0",
      "vue-tsc": "^2.0.0"
    }
  }, null, 2);
}

export function generateHTML(schema: PageSchema): string {
  let nodesHtml = '';
  schema.children.forEach((child) => {
    nodesHtml += `      <div style="margin-bottom: 16px;">
        <h3>${child.label} (${child.type})</h3>
        <p>DOM ID: <code>${child.id}</code></p>
      </div>\n`;
  });

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${schema.title || '低代码独立 HTML 页面'}</title>
  <!-- Element Plus CSS -->
  <link rel="stylesheet" href="https://unpkg.com/element-plus/dist/index.css">
  <style>
    body {
      margin: 0;
      padding: 24px;
      background: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .page-container {
      max-width: 1200px;
      margin: 0 auto;
      background: #ffffff;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <div id="app" class="page-container">
    <h2>${schema.title || '未命名低代码页面'}</h2>
    <p style="color: #666;">页面 ID: <code>${schema.id}</code> | 生成版本: v${schema.meta.version}</p>
    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">

    <div class="nodes-list">
${nodesHtml}    </div>
  </div>

  <!-- Vue 3 CDN & Element Plus CDN -->
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
  <script src="https://unpkg.com/element-plus"></script>
  <script>
    const { createApp, ref } = Vue;
    const app = createApp({
      setup() {
        return {};
      }
    });
    app.use(ElementPlus);
    app.mount('#app');
  </script>
</body>
</html>
`;
}

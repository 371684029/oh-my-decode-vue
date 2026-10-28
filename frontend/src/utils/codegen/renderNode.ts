import type { PageSchema, ComponentNode, LayerConfig } from '../../types/designer';
import { isRenderedNodeType } from '../../registry/nodeTypes';
import { sanitizeCss } from '../sanitizeCss';
import { inlineableExpression } from '../condition';
import {
  escapeHtml,
  safeComment,
  safeStyleToken,
  renderBoundText,
  stringifyAttributes,
  attributesExcept,
  formPlaceholder,
  tablePageSize,
  tablePaginationEnabled,
  identOf,
  getMaterialSnapshot,
  safeClassToken
} from './shared';

// ============================================================
// 共享节点渲染层：ComponentNode → 模板文本（Vue / HTML 目标复用）
// ============================================================

/**
 * 将 ComponentNode 单节点递归转换为模板文本
 */
function applyVisibleWhen(node: ComponentNode, html: string, indent: string): string {
  const expr = inlineableExpression(node.visibleWhen);
  if (!expr) return html;
  return `${indent}<div v-show="${escapeHtml(expr)}">\n${html}${indent}</div>\n`;
}

export function renderNodeToTemplate(node: ComponentNode, indentLevel = 3): string {
  const indent = ' '.repeat(indentLevel * 2);
  return applyVisibleWhen(node, renderNodeMarkup(node, indentLevel), indent);
}

export function renderNodeMarkup(node: ComponentNode, indentLevel = 3): string {
  const indent = ' '.repeat(indentLevel * 2);

  // 黑盒物料实例（v2.1.0）：解析后的快照已由 preloadMaterialSchemas 注入映射
  if (node.materialRef) {
    const snapshot = getMaterialSnapshot(node.id);
    if (!snapshot || snapshot.length === 0) {
      return `${indent}<div style="padding:8px;border:1px dashed #e6a23c;border-radius:4px;color:#b88230">${escapeHtml(node.label)}（物料 ${escapeHtml(node.materialRef.id)}@${escapeHtml(node.materialRef.version)} 未解析）</div>`;
    }
    return snapshot.map((n) => renderNodeToTemplate(n, indentLevel)).join('\n');
  }

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
      const colIndent = ' '.repeat((indentLevel + 2) * 2);
      const formName = `formData_${identOf(node.id)}`;
      const formAttrs = attributesExcept(node.props || {}, node.attrs || {}, [
        'labelWidth',
        'layout',
        'size',
        'itemGap',
        'gutter'
      ]);
      const inline = node.props.layout === 'inline' ? ' inline' : '';
      const size = node.props.size ? ` size="${escapeHtml(String(node.props.size))}"` : '';
      const labelWidth = escapeHtml(String(node.props.labelWidth || '100px'));
      const gutter = Number(node.props.gutter ?? 16);
      const itemGap = node.props.itemGap;
      const rowStyle =
        itemGap != null && itemGap !== ''
          ? ` style="row-gap: ${escapeHtml(typeof itemGap === 'number' ? `${itemGap}px` : String(itemGap))}"`
          : '';
      let itemsTemplate = '';

      items.forEach((item: any) => {
        const itemType = item.component || item.type;
        const field = item.field || item.name;
        const required = item.required ? ' required' : '';
        const span = Number(item.span ?? 12);
        const widthStyle = item.width
          ? ` style="width: ${escapeHtml(String(item.width))}"`
          : itemType === 'select' || itemType === 'date'
            ? ' style="width: 100%"'
            : '';
        let control = '';
        if (itemType === 'input') {
          control = `<el-input v-model='${formName}[${JSON.stringify(field)}]' placeholder="${formPlaceholder(item, `请输入${item.label || ''}`)}"${widthStyle} />`;
        } else if (itemType === 'select') {
          const options = Array.isArray(item.options) ? item.options : [];
          let optTemplate = '';
          options.forEach((opt: any) => {
            optTemplate += `${colIndent}    <el-option label="${escapeHtml(opt.label)}" value="${escapeHtml(opt.value)}" />\n`;
          });
          control =
            `<el-select v-model='${formName}[${JSON.stringify(field)}]' placeholder="${formPlaceholder(item, `请选择${item.label || ''}`)}"${widthStyle || ' style="width: 100%"'}>\n` +
            optTemplate +
            `${colIndent}  </el-select>`;
        } else if (itemType === 'switch') {
          control = `<el-switch v-model='${formName}[${JSON.stringify(field)}]' />`;
        } else if (itemType === 'date') {
          control = `<el-date-picker v-model='${formName}[${JSON.stringify(field)}]' type="date" placeholder="${formPlaceholder(item, '请选择日期')}"${widthStyle || ' style="width: 100%"'} />`;
        }
        if (!control) return;
        itemsTemplate +=
          `${itemIndent}<el-col :span="${span}">\n` +
          `${colIndent}<el-form-item label="${escapeHtml(item.label)}" prop="${escapeHtml(field)}"${required}>\n` +
          `${colIndent}  ${control}\n` +
          `${colIndent}</el-form-item>\n` +
          `${itemIndent}</el-col>\n`;
      });

      return (
        `${indent}<!-- 高端表单 Component -->\n` +
        `${indent}<el-form :model="${formName}"${formAttrs}${inline} label-width="${labelWidth}"${size}>\n` +
        `${indent}  <el-row :gutter="${gutter}"${rowStyle}>\n` +
        itemsTemplate +
        `${indent}  </el-row>\n` +
        `${indent}  <el-form-item>\n` +
        `${indent}    <el-button type="primary" @click="handleSubmit('${escapeHtml(node.id)}')">提交</el-button>\n` +
        `${indent}    <el-button @click="handleReset('${escapeHtml(node.id)}')">重置</el-button>\n` +
        `${indent}  </el-form-item>\n` +
        `${indent}</el-form>\n`
      );
    }

    case 'pro-spacer': {
      const h = escapeHtml(String(node.props?.height || '24px'));
      return `${indent}<div class="pro-spacer" style="min-height: ${h}; width: 100%" aria-hidden="true"></div>\n`;
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
      if (node.type.startsWith('el-')) {
        const tag = escapeHtml(node.type);
        const text = node.props?.text ?? node.props?.label ?? node.props?.title ?? node.props?.content;
        if (text != null && String(text).length > 0) {
          return `${indent}<${tag}${attrStr}>${escapeHtml(String(text))}</${tag}>\n`;
        }
        return `${indent}<${tag}${attrStr} />\n`;
      }
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
export function renderLayers(
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
export function collectLayerStateDecls(schema: PageSchema): { dialogVisible: string[]; loadingVisible: string[] } {
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
export function renderPageTemplateBody(schema: PageSchema, baseIndent = 2): string {
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
export function renderPageStyle(schema: PageSchema): string {
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

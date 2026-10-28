import type { PageSchema } from '../../types/designer';
import { safeClassToken } from './shared';
import { finalizeArtifact } from './format';

// ============================================================
// 目标 2: W3C Web Component (.js)
// ============================================================

/**
 * 2. 生成 W3C Web Component 自定义元素包装脚本 (.js)
 * 默认以 Shadow DOM 注册：Element Plus 核心样式经 defineCustomElement 的
 * `styles` 选项注入影子根（Shadow DOM 下文档样式不穿透，必须注入）；文档级
 * 样式导入兜底 teleport 到 body 的浮层。另导出 Light DOM 兜底注册助手。
 * 需配套下载 PageTemplate.vue 并在宿主项目（Vue 3 + Element Plus + Vite）中构建运行。
 */
export function generateWebComponent(schema: PageSchema): string {
  const tagName = `custom-page-${safeClassToken(schema.id) || 'page'}`;

  return finalizeArtifact(`/**
 * Web Component 包装脚本
 * 标签名: <${tagName}></${tagName}>
 * 说明:
 *   - Shadow DOM 模式（默认）：defineCustomElement 以 styles 注入 Element Plus
 *     核心样式，影子根内的组件自带完整样式；文档级样式导入兜底 teleport 到
 *     body 的浮层（下拉面板、Message 等，它们不在影子根内）。
 *   - Light DOM 兜底：调用 registerLightDomElement() 以 shadowRoot:false 注册
 *     <${tagName}-light>，不创建影子根，组件直接继承宿主页面样式；适用于
 *     宿主需要覆盖 / 共享组件样式，或目标环境不支持 Shadow DOM 的场景。
 *   - 使用前提：宿主项目需安装 vue / element-plus，且本文件与配套的
 *     PageTemplate.vue 放置于同一目录。
 *   - 跨框架复用：React / Angular / jQuery / 原生 HTML 均可直接引用该标签。
 */
import { defineCustomElement } from 'vue';
import ElementPlus from 'element-plus';
// 文档级 Element Plus 样式：浮层组件挂在 body 上，Light DOM 模式同样依赖它。
import 'element-plus/dist/index.css';
// element-plus/dist/index.css?inline —— ?inline 后缀让打包器（Vite / webpack）
// 把样式表解析为字符串而不是注入文档，供 defineCustomElement 的 styles 选项
// 注入 Shadow DOM（直接 import 的样式进不了影子根）。
import elementPlusCss from 'element-plus/dist/index.css?inline';
import PageTemplate from './PageTemplate.vue';

const installElementPlus = (app) => {
  app.use(ElementPlus);
};

// 默认注册：Shadow DOM + styles 注入，元素内的 Element Plus 组件开箱即有样式
const CustomPageElement = defineCustomElement(PageTemplate, {
  styles: [elementPlusCss],
  configureApp: installElementPlus,
});

if (!customElements.get('${tagName}')) {
  customElements.define('${tagName}', CustomPageElement);
  console.log('Web Component <${tagName}> 成功注册!');
}

/**
 * Light DOM 兜底注册（shadowRoot: false，不创建 Shadow Root）。
 * 何时用：宿主页面需要与组件共享样式 / CSS 变量，或目标环境不支持 Shadow DOM。
 * 此模式下 Vue 不支持 styles 注入（会告警），Element Plus 样式由文件顶部的
 * 文档级 import 覆盖。标签名默认带 -light 后缀，与默认 Shadow DOM 注册互不冲突。
 * 返回该自定义元素类，可按需自行 customElements.define。
 */
export function registerLightDomElement(tagName = '${tagName}-light') {
  const LightElement = defineCustomElement(PageTemplate, {
    shadowRoot: false,
    configureApp: installElementPlus,
  });
  if (!customElements.get(tagName)) {
    customElements.define(tagName, LightElement);
    console.log('Web Component <' + tagName + '> 成功注册 (Light DOM)!');
  }
  return LightElement;
}

export default CustomPageElement;
`);
}

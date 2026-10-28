import type { PageSchema } from '../../types/designer';
import { safeClassToken } from './shared';

// ============================================================
// 目标 2: W3C Web Component (.js)
// ============================================================

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

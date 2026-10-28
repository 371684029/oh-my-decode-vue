import type { PageSchema, MaterialManifest } from '../types/designer';
import { safeClassToken } from './codegen/shared';
import { generateVueSFC } from './codegen/generateVue';
import { generateHTML } from './codegen/generateHtml';

// ============================================================
// 多目标出码引擎 (Code Generator) — 公共门面 (v2.4.0 拆分)
// 目标 1: Vue 3 SFC (.vue)              —— codegen/generateVue.ts
// 目标 2: W3C Web Component (.js)       —— codegen/generateWebComponent.ts
// 目标 3: 独立 HTML (.html)             —— codegen/generateHtml.ts
// 目标 4: package.json 构建清单         —— 本文件
// 共享节点渲染层 / 安全辅助              —— codegen/shared.ts + codegen/renderNode.ts
// ============================================================

export { clearMaterialSchemas, preloadMaterialSchemas } from './codegen/shared';
export { generateVueSFC, generatePageTemplate } from './codegen/generateVue';
export { generateWebComponent } from './codegen/generateWebComponent';
export { generateHTML } from './codegen/generateHtml';

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

// ============================================================
// 物料自描述出码 (v2.0.0)
// 导出文件 = 可运行代码 + 可导入物料定义（内嵌 @lowcode-material 注释块）
// ============================================================

/** 序列化 manifest 为可嵌入注释的安全 JSON：`--` 转义为 `\u002d`，防止闭合 HTML 注释 */
export function buildMaterialManifestComment(manifest: MaterialManifest): string {
  const compact = JSON.stringify(manifest).replace(/--/g, '\\u002d\\u002d');
  return `<!-- @lowcode-material ${compact} -->\n`;
}

/** 导出物料：Vue SFC / 独立 HTML，头部内嵌 @lowcode-material manifest 注释块（v2.0.0） */
export function generateMaterialBundle(manifest: MaterialManifest): { vue: string; html: string } {
  const schema: PageSchema = {
    id: `material_${manifest.type}`,
    title: manifest.label,
    type: 'component',
    meta: { author: 'LowCode Material', description: '', version: '1.0.0' },
    state: {},
    children: manifest.schema || []
  };
  const head = buildMaterialManifestComment(manifest);
  return {
    vue: head + generateVueSFC(schema),
    html: head + generateHTML(schema)
  };
}

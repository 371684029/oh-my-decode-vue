import { describe, expect, test } from 'vitest';
import { buildCustomHtmlSrcdoc } from './customHtmlDocument';
import { generateVueSFC } from './codeGenerator';
import type { PageSchema } from '../types/designer';

describe('buildCustomHtmlSrcdoc', () => {
  test('html 里的 script 被去掉，生命周期脚本不能提前闭合', () => {
    const doc = buildCustomHtmlSrcdoc({
      props: {
        htmlCode: '</div><script>alert(1)</script><b>ok</b>',
        scriptMounted: '</SCRIPT><script>alert(2)</script>'
      }
    });
    expect(doc).not.toContain('<script>alert(1)</script>');
    expect(doc).toContain('<b>ok</b>');
    expect(doc).toContain('<\\/script>');
    expect(doc).not.toContain('</SCRIPT>');
  });

  test('出码 srcdoc 与设计器使用同一份文档', () => {
    const layer = {
      id: 'layer_html',
      name: '自定义HTML',
      type: 'custom-html' as const,
      visible: true,
      zIndex: 1,
      props: {
        htmlCode: '<div>卡片</div><script>alert(1)</script>',
        scriptMounted: 'console.log("mounted");'
      },
      children: []
    };
    const schema: PageSchema = {
      id: 'page_html',
      title: '页面',
      type: 'page',
      meta: { author: 'a', description: 'b', version: '1.6.0' },
      state: {},
      children: [],
      layers: [layer]
    };
    const code = generateVueSFC(schema);
    expect(code).toContain('sandbox="allow-scripts"');
    expect(code).not.toContain('<script>alert(1)</script>');
    expect(buildCustomHtmlSrcdoc(layer)).toContain('console.log("mounted")');
    expect(code).toContain('console.log(\\"mounted\\")');
  });
});

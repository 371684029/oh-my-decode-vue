import { describe, expect, test } from 'vitest';
import { generateVueSFC, generateWebComponent, generateHTML, generatePackageJson } from './codeGenerator';
import type { PageSchema, ComponentNode } from '../types/designer';
import { MATERIAL_REGISTRY } from '../registry/materials';
import { RENDERED_NODE_TYPES } from '../registry/nodeTypes';

/** 构造覆盖全部节点类型 + 三种图层的测试 Schema */
function buildTestSchema(): PageSchema {
  return {
    id: 'page_test_001',
    title: '测试页面',
    type: 'page',
    meta: { author: 'tester', description: 'unit test', version: '1.2.0' },
    state: { name: '张三' },
    children: [
      {
        id: 'btn_1',
        type: 'el-button',
        label: '按钮',
        layout: { x: 0, y: 0, w: 2, h: 2, i: 'btn_1' },
        props: { text: '提交', type: 'primary' },
        attrs: { 'data-testid': 'btn' },
        style: {},
        events: {}
      },
      {
        id: 'tbl_1',
        type: 'pro-table',
        label: '高端表格',
        layout: { x: 0, y: 2, w: 12, h: 6, i: 'tbl_1' },
        props: { border: true, stripe: true },
        attrs: {},
        style: {},
        events: {},
        config: {
          columns: [
            { prop: 'id', label: 'ID', width: '80', sortable: true },
            { prop: 'name', label: '姓名' }
          ]
        }
      },
      {
        id: 'form_1',
        type: 'pro-form',
        label: '高端表单',
        layout: { x: 0, y: 8, w: 12, h: 5, i: 'form_1' },
        props: { labelWidth: '100px' },
        attrs: {},
        style: {},
        events: {},
        config: {
          items: [
            { field: 'username', label: '用户名', component: 'input', required: true },
            { field: 'gender', label: '性别', component: 'select', options: [{ label: '男', value: 'male' }] },
            { field: 'birthday', label: '出生日期', component: 'date' },
            { field: 'enableNotice', label: '开启通知', component: 'switch' }
          ]
        }
      }
    ],
    layers: [
      { id: 'layer_base_canvas', name: '主画布', type: 'canvas', visible: true, zIndex: 1, children: [] },
      {
        id: 'layer_dlg',
        name: '业务弹窗',
        type: 'dialog',
        visible: true,
        zIndex: 20,
        props: { title: '详情弹窗', width: '50%' },
        children: []
      },
      {
        id: 'layer_loading',
        name: '加载遮罩',
        type: 'loading',
        visible: true,
        zIndex: 30,
        props: { loadingText: '加载中...' },
        children: []
      },
      {
        id: 'layer_html',
        name: '自定义HTML',
        type: 'custom-html',
        visible: true,
        zIndex: 40,
        props: {
          htmlCode: '<div class="custom-card">卡片</div>',
          cssCode: '.custom-card { color: red; }',
          scriptMounted: 'console.log("mounted");',
          scriptUnmounted: 'console.log("unmounted");'
        },
        children: []
      }
    ]
  };
}

describe('generateVueSFC', () => {
  const code = generateVueSFC(buildTestSchema());

  test('输出完整 SFC 结构（template/script/style）', () => {
    expect(code).toContain('<template>');
    expect(code).toContain('<script setup lang="ts">');
    expect(code).toContain('<style scoped>');
  });

  test('渲染节点模板', () => {
    expect(code).toContain('<el-button');
    expect(code).toContain('type="primary"');
    expect(code).toContain('data-testid="btn"');
    expect(code).toContain('<el-table');
    expect(code).toContain('<el-table-column prop="id" label="ID" width="80" sortable');
    expect(code).toContain('<el-form');
    expect(code).toContain('v-model=\'formData_form_1["username"]\'');
    expect(code).toContain('v-model=\'formData_form_1["birthday"]\'');
  });

  test('渲染图层模板与生命周期', () => {
    expect(code).toContain('el-dialog');
    expect(code).toContain('dialogVisible_layer_dlg');
    expect(code).toContain('loadingVisible_layer_loading');
    expect(code).toContain('customHtmlSrcdoc_layer_html');
    expect(code).toContain('sandbox="allow-scripts"');
    expect(code).not.toContain('v-html="customHtml_layer_html"');
    expect(code).not.toContain('new Function');
    expect(code).toContain('console.log(\\"mounted\\")');
    expect(code).toContain('console.log(\\"unmounted\\")');
    expect(code).not.toContain('<div class="custom-card">卡片</div>');
    expect(code).toContain('onMounted');
    expect(code).toContain('onUnmounted');
  });

  test('包含页面样式与根容器', () => {
    expect(code).toContain('lowcode-page-page-test-001');
  });
});

describe('generateWebComponent', () => {
  const code = generateWebComponent(buildTestSchema());

  test('输出完整渲染包装（非占位）', () => {
    expect(code).toContain("import { createApp, h } from 'vue'");
    expect(code).toContain("import PageTemplate from './PageTemplate.vue'");
    expect(code).toContain('app.mount(this)');
    expect(code).toContain('disconnectedCallback');
    expect(code).toContain('customElements.define');
  });

  test('标签名由 schema id 派生', () => {
    expect(code).toContain('custom-page-page-test-001');
  });

  test('不再包含旧的占位模板文案', () => {
    expect(code).not.toContain('这是一个跨框架渲染的 Web Component 原生自定义元素。');
  });
});

describe('generateHTML', () => {
  const code = generateHTML(buildTestSchema());

  test('输出自包含 HTML 与 CDN', () => {
    expect(code).toContain('<!DOCTYPE html>');
    expect(code).toContain('unpkg.com/vue@3/dist/vue.global.js');
    expect(code).toContain('unpkg.com/element-plus');
    expect(code).toContain('createApp(App)');
    expect(code).toContain('createApp(App).use(ElementPlus)');
  });

  test('完整内联模板与状态', () => {
    expect(code).toContain('<el-button');
    expect(code).toContain('tableData');
    expect(code).toContain('formData');
    expect(code).toContain('console.log(\\"mounted\\")');
  });

  test('不再输出占位节点列表', () => {
    expect(code).not.toContain('nodes-list');
    expect(code).not.toContain('DOM ID:');
  });
});

describe('generatePackageJson', () => {
  const pkg = JSON.parse(generatePackageJson(buildTestSchema()));

  test('包含构建所需依赖', () => {
    expect(pkg.dependencies).toHaveProperty('vue');
    expect(pkg.dependencies).toHaveProperty('element-plus');
    expect(pkg.scripts).toHaveProperty('build');
    expect(pkg.name).toContain('lowcode-export');
  });
});

describe('出码引擎输入转义（防止用户配置破坏生成代码）', () => {
  function maliciousSchema(): PageSchema {
    const base = buildTestSchema();
    return {
      ...base,
      id: 'Page/Demo_001',
      title: '标题含 <script>alert(1)</script> 与 "引号"',
      children: [
        {
          id: 'btn_x',
          type: 'el-button',
          label: '按钮',
          layout: { x: 0, y: 0, w: 2, h: 2, i: 'btn_x' },
          props: { text: '<img src=x onerror=alert(1)>', type: 'primary' },
          attrs: {},
          style: {},
          events: {}
        },
        {
          id: 'form_x',
          type: 'pro-form',
          label: '表单',
          layout: { x: 0, y: 2, w: 12, h: 5, i: 'form_x' },
          props: {},
          attrs: {},
          style: {},
          events: {},
          config: {
            items: [{ field: 'user.name"x', label: '含引号字段', component: 'input' }]
          }
        }
      ],
      layers: [
        {
          id: 'layer_dlg',
          name: '弹窗\n换行名',
          type: 'dialog',
          visible: true,
          zIndex: 10,
          props: { title: '弹窗"标题', width: '50%' },
          children: []
        }
      ]
    };
  }

  test('SFC 中 props 文本与 attribute 值被 HTML 转义', () => {
    const code = generateVueSFC(maliciousSchema());
    expect(code).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(code).toContain('type="primary"');
    expect(code).not.toContain('<img src=x');
  });

  test('SFC 中表单项字段名以安全方括号形式绑定', () => {
    const code = generateVueSFC(maliciousSchema());
    expect(code).toContain('formData_form_x["user.name\\"x"]');
    expect(code).toContain('label="含引号字段"');
  });

  test('HTML 中 title 被转义且不再原样输出脚本标签', () => {
    const code = generateHTML(maliciousSchema());
    expect(code).toContain('标题含 &lt;script&gt;alert(1)&lt;/script&gt; 与 &quot;引号&quot;');
    expect(code).not.toContain('<script>alert(1)</script>');
  });

  test('Web Component 标签名由 schema.id 安全化（非法字符转连字符）', () => {
    const code = generateWebComponent(maliciousSchema());
    expect(code).toContain('custom-page-page-demo-001');
    expect(code).not.toMatch(/custom-page-[A-Z_/]/);
  });

  test('package.json 包名安全化', () => {
    const pkg = JSON.parse(generatePackageJson(maliciousSchema()));
    expect(pkg.name).toBe('lowcode-export-page-demo-001');
  });

  test('弹窗标题与图层名注释安全处理', () => {
    const code = generateVueSFC(maliciousSchema());
    expect(code).toContain('title="弹窗&quot;标题"');
    expect(code).toContain('<!-- 弹窗图层: 弹窗 换行名 -->');
  });

  test('自定义 HTML 与脚本以字符串嵌入，不能打断 script 标签', () => {
    const schema = buildTestSchema();
    const layer = schema.layers?.find((item) => item.type === 'custom-html');
    if (!layer?.props) throw new Error('missing html layer');
    layer.props.htmlCode = '</div><script>alert(1)</script>';
    layer.props.scriptMounted = '</script><script>alert(2)</script>';
    const code = generateVueSFC(schema);
    expect(code).not.toContain('<script>alert(1)</script>');
    expect(code).not.toContain('<script>alert(2)</script>');
    expect(code).toContain('\\u003c/script>');
  });

  test('不安全表达式和响应路径不会变成可执行代码', () => {
    const schema = buildTestSchema();
    const table = schema.children.find((node) => node.type === 'pro-table');
    if (!table) throw new Error('missing table');
    table.apiBinding = {
      url: '{{ 1) || alert(1) || (1 }}',
      responsePath: 'data.list;alert(1)',
      method: 'GET'
    };
    const code = generateVueSFC(schema);
    expect(code).toContain(JSON.stringify('1) || alert(1) || (1'));
    expect(code).not.toContain('(1) || alert(1)');
    expect(code).not.toContain('list;alert');
    expect(code).toContain('AbortSignal.timeout(10000)');
  });

  test('弹窗图层导出其中的子节点', () => {
    const schema = buildTestSchema();
    const dialog = schema.layers?.find((item) => item.type === 'dialog');
    if (!dialog) throw new Error('missing dialog');
    dialog.children = [
      {
        id: 'dlg_btn',
        type: 'el-button',
        label: '弹窗按钮',
        layout: { x: 0, y: 0, w: 2, h: 2, i: 'dlg_btn' },
        props: { text: '弹窗内按钮', type: 'success' },
        attrs: {},
        style: {},
        events: {}
      }
    ];
    const code = generateVueSFC(schema);
    expect(code).toContain('弹窗内按钮');
    expect(code).not.toContain('内暂无组件');
  });
});

describe('物料与出码登记一致', () => {
  test('每个物料类型都有出码模板', () => {
    const registered = new Set<string>(RENDERED_NODE_TYPES);
    for (const material of MATERIAL_REGISTRY) {
      expect(registered.has(material.type)).toBe(true);
      const node: ComponentNode = {
        id: 'node_1',
        type: material.type,
        label: material.label,
        layout: { x: 0, y: 0, w: 2, h: 2, i: 'node_1' },
        props: { ...material.defaultProps },
        attrs: {},
        style: {},
        events: {},
        config: material.defaultConfig
      };
      const code = generateVueSFC({
        ...buildTestSchema(),
        children: [node],
        layers: []
      });
      expect(code).not.toContain('缺少出码模板');
      expect(code).not.toContain(`>${material.label}</div>`);
    }
  });
});

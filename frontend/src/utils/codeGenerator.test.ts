import { describe, expect, test } from 'vitest';
import ts from 'typescript';
import { generateVueSFC, generatePageTemplate, generateWebComponent, generateHTML, generatePackageJson } from './codeGenerator';
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
    expect(code).toContain("import { defineCustomElement } from 'vue'");
    expect(code).toContain("import PageTemplate from './PageTemplate.vue'");
    expect(code).toContain('styles: [elementPlusCss]');
    expect(code).toContain('customElements.define');
  });

  test('标签名由 schema id 派生', () => {
    expect(code).toContain('custom-page-page-test-001');
  });

  test('不再包含旧的占位模板文案', () => {
    expect(code).not.toContain('这是一个跨框架渲染的 Web Component 原生自定义元素。');
  });

  test('注入 Element Plus 核心样式（?inline 字符串 + styles 选项）', () => {
    expect(code).toContain("import elementPlusCss from 'element-plus/dist/index.css?inline'");
    expect(code).toContain('styles: [elementPlusCss]');
    // 注释说明 ?inline 由打包器解析为样式字符串
    expect(code).toContain('?inline');
  });

  test('提供 Light DOM 兜底注册助手且生成源码语法有效', () => {
    expect(code).toContain('export function registerLightDomElement');
    expect(code).toContain('shadowRoot: false');
    // 生成的 .js 源码必须能通过语法解析（import/export 为 ESM，用 TS transpile 校验）
    const { diagnostics } = ts.transpileModule(code, {
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 }
    });
    expect(diagnostics ?? []).toEqual([]);
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

describe('v1.6.0 出码正确性', () => {
  test('数据源 URL 换行不会变成独立语句', () => {
    const schema = buildTestSchema();
    const table = schema.children.find((node) => node.type === 'pro-table');
    if (!table) throw new Error('missing table');
    table.apiBinding = { url: 'http://example.com\nconst injected = 1', method: 'GET' };
    const sfc = generateVueSFC(schema);
    const html = generateHTML(schema);
    expect(sfc).not.toMatch(/^const injected = 1/m);
    expect(html).not.toMatch(/^const injected = 1/m);
    expect(sfc).toContain('数据源: http://example.com const injected = 1');
    expect(html).toContain("redirect: 'manual'");
  });

  test('非法属性名和样式注入不会进入模板', () => {
    const schema = buildTestSchema();
    schema.children = [
      {
        id: 'box_1',
        type: 'pro-container',
        label: '容器',
        layout: { x: 0, y: 0, w: 12, h: 4, i: 'box_1' },
        props: { title: '容器', direction: 'row;background:url(javascript:alert(1))', padding: '8px' },
        attrs: { '"><img': 'x' },
        style: {},
        events: {}
      }
    ];
    const code = generateVueSFC(schema);
    expect(code).not.toContain('"><img');
    expect(code).not.toContain('flex-direction: row;');
    expect(code).toContain('flex-direction: rowbackground:url(javascript:alert(1))');
  });

  test('两个表单按 id 查找，输入框和开关有声明', () => {
    const schema = buildTestSchema();
    schema.children.push({
      id: 'form_2',
      type: 'pro-form',
      label: '第二表单',
      layout: { x: 0, y: 12, w: 12, h: 4, i: 'form_2' },
      props: {},
      attrs: {},
      style: {},
      events: {},
      config: { items: [] }
    });
    schema.children.push({
      id: 'a-b',
      type: 'el-input',
      label: '输入',
      layout: { x: 0, y: 16, w: 4, h: 2, i: 'a-b' },
      props: { placeholder: '甲' },
      attrs: {},
      style: {},
      events: {}
    });
    schema.children.push({
      id: 'a_b',
      type: 'el-switch',
      label: '开关',
      layout: { x: 4, y: 16, w: 2, h: 2, i: 'a_b' },
      props: {},
      attrs: {},
      style: {},
      events: {}
    });
    const code = generateVueSFC(schema);
    expect(code).toContain('if (formId === "form_1") return formData_form_1;');
    expect(code).toContain('if (formId === "form_2") return formData_form_2;');
    expect(code).not.toContain('? formData_form_1');
    expect(code).toContain('const formData_a_b = ref');
    expect(code).toContain('v-model="formData_a_b"');
    expect(code).toContain('const formData_a_b_');
    expect(code).toContain('v-model="formData_a_b_');
    const html = generateHTML(schema);
    expect(html).toContain('if (formId === "form_2") return this.formData_form_2;');
  });

  test('分页变化会再次请求，安全表达式内联', () => {
    const schema = buildTestSchema();
    const table = schema.children.find((node) => node.type === 'pro-table');
    const button = schema.children.find((node) => node.type === 'el-button');
    if (!table || !button) throw new Error('missing nodes');
    table.apiBinding = { url: '/api/users', method: 'GET', params: { q: 'a' } };
    button.props.text = '{{ state.name }}';
    button.props.bad = '{{ 1) || alert(1) || (1 }}';
    const code = generateVueSFC(schema);
    expect(code).toContain('onPage_tbl_1');
    expect(code).toContain('loadData_tbl_1()');
    expect(code).toContain('page: currentPage_tbl_1.value');
    expect(code).toContain('>{{ state.name }}<');
    expect(code).toContain('{{ 1) || alert(1) || (1 }}');
    expect(code).not.toContain(':bad="1)');
  });

  test('显隐、动作条件和必填提交', () => {
    const schema = buildTestSchema();
    const button = schema.children.find((node) => node.type === 'el-button');
    const form = schema.children.find((node) => node.type === 'pro-form');
    if (!button || !form) throw new Error('missing nodes');
    button.visibleWhen = '{{ state.show === true }}';
    button.events = {
      click: {
        enabled: true,
        actions: [
          { id: 'a1', type: 'show_message', when: '{{ state.ok === true }}', payload: { messageText: '第一条' } },
          { id: 'a2', type: 'show_message', payload: { messageText: '第二条' } },
          { id: 'a3', type: 'show_message', when: '{{ 1) || alert(1) || (1 }}', payload: { messageText: '坏条件' } }
        ]
      }
    };
    form.events = {
      submit: { enabled: true, actions: [{ id: 's1', type: 'show_message', payload: { messageText: '已提交' } }] }
    };
    const code = generateVueSFC(schema);
    expect(code).toContain('v-show="state.show === true"');
    expect(code).toContain('if (state.ok === true)');
    expect(code).toContain('第二条');
    expect(code).not.toContain('alert(1)');
    expect(code).toContain('请填写用户名');
    expect(code).toContain("await handleNodeClick(formId, 'submit', form.value)");
    const hidden = { ...button, visibleWhen: '{{ 1) || alert(1) || (1 }}' };
    const bad = generateVueSFC({
      ...schema,
      children: schema.children.map((node) => (node.id === button.id ? hidden : node))
    });
    expect(bad).not.toContain('v-show="1)');
    const html = generateHTML(schema);
    expect(html).toContain('请填写用户名');
    expect(html).toContain('return;');
  });

  test('下拉选项按配置出码，空选项不写死默认项', () => {
    const schema = buildTestSchema();
    const code = generateVueSFC(schema);
    expect(code).toContain('label="男"');
    expect(code).toContain('value="male"');
    const form = schema.children.find((node) => node.type === 'pro-form');
    const gender = form?.config?.items?.find((item: { field?: string }) => item.field === 'gender');
    if (!gender) throw new Error('missing gender');
    gender.options = [];
    const empty = generateVueSFC(schema);
    expect(empty).not.toContain('选项一');
  });

  test('图层初始可见性与 Schema 一致', () => {
    const schema = buildTestSchema();
    const dialog = schema.layers?.find((layer) => layer.type === 'dialog');
    if (!dialog) throw new Error('missing dialog');
    dialog.visible = true;
    const code = generateVueSFC(schema);
    expect(code).toContain('const dialogVisible_layer_dlg = ref(true);');
    expect(code).toContain('const loadingVisible_layer_loading = ref(true);');
  });
});

describe('v1.11.0 出码与画布对齐', () => {
  test('表单占位、必填和标签宽度进入 Vue、配套组件与 HTML', () => {
    const schema = buildTestSchema();
    const form = schema.children.find((node) => node.type === 'pro-form');
    if (!form?.config?.items) throw new Error('missing form');
    form.props.labelWidth = '140px';
    form.props.layout = 'inline';
    const username = form.config.items.find((item: { field?: string }) => item.field === 'username');
    if (!username) throw new Error('missing username');
    username.placeholder = '请填写账号';

    const outputs = [generateVueSFC(schema), generatePageTemplate(schema), generateHTML(schema)];
    for (const code of outputs) {
      expect(code).toContain('placeholder="请填写账号"');
      expect(code).toContain('label-width="140px"');
      expect(code).toContain(' inline');
      expect(code).not.toContain('labelWidth=');
    }
    expect(outputs[0]).toContain('prop="username" required');
  });

  test('表格分页和空操作不另写一套', () => {
    const schema = buildTestSchema();
    const table = schema.children.find((node) => node.type === 'pro-table');
    if (!table?.config?.columns) throw new Error('missing table');
    table.config.pagination = { enabled: true, pageSize: 20 };
    table.config.columns[0].align = 'center';
    table.config.actions = [];
    table.apiBinding = { url: '/api/rows', method: 'GET', responsePath: 'data.list' };

    for (const code of [generateVueSFC(schema), generateHTML(schema)]) {
      expect(code).toContain(':page-size="20"');
      expect(code).toContain('size: 20');
      expect(code).toContain('align="center"');
      expect(code).not.toContain('>查看</el-button>');
    }

    table.config.actions = [{ label: '详情', type: 'primary', eventKey: 'view' }];
    expect(generateVueSFC(schema)).toContain('>详情</el-button>');
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

// ============================================================
// v2.4.0 字节级基线锁定（P0-1 拆分出码引擎 / P2-2 出码格式化）
// 以下断言覆盖 pro-form（input/select/switch/date + 逐项 span/width）、
// pro-table（列/分页/行操作）、pro-spacer、通用 el-*、黑盒 materialRef 占位、
// 事件动作链与弹窗图层。
// P2-2 期望串由格式化管线输出重新固化：与拆分基线逐 token 比对确认
// 仅空白（缩进 / 换行 / 行尾空格）变化，标签、属性、属性顺序、JS 标识符
// 与逻辑逐字节一致。此后输出必须逐字节一致。
// ============================================================

/** 覆盖全部出码分支的锁定 Schema（勿随意改动：改动即破坏基线语义） */
function buildLockSchema(): PageSchema {
  return {
    id: 'page_lock_001',
    title: '锁定页',
    type: 'page',
    meta: { author: 'lock', description: 'byte lock', version: '1.0.0' },
    state: { name: '张三', flag: false },
    children: [
      {
        id: 'form_lock',
        type: 'pro-form',
        label: '锁定表单',
        layout: { x: 0, y: 0, w: 12, h: 5, i: 'form_lock' },
        props: { labelWidth: '120px' },
        attrs: {},
        style: {},
        events: {
          submit: { enabled: true, actions: [{ id: 'fs1', type: 'show_message', payload: { messageText: '表单已提交' } }] }
        },
        config: {
          items: [
            { field: 'username', label: '用户名', component: 'input', required: true, span: 24, width: '200px' },
            { field: 'role', label: '角色', component: 'select', span: 8, options: [{ label: '管理员', value: 'admin' }] },
            { field: 'enabled', label: '启用', component: 'switch' },
            { field: 'birthday', label: '生日', component: 'date' }
          ]
        }
      },
      {
        id: 'tbl_lock',
        type: 'pro-table',
        label: '锁定表格',
        layout: { x: 0, y: 5, w: 12, h: 6, i: 'tbl_lock' },
        props: { border: true },
        attrs: {},
        style: {},
        events: {},
        apiBinding: {
          url: '/api/lock',
          method: 'GET',
          params: { q: '{{ state.name }}' },
          responsePath: 'data.list',
          totalProp: 'data.total'
        },
        config: {
          columns: [
            { prop: 'id', label: 'ID', width: '80', sortable: true, align: 'center' },
            { prop: 'name', label: '名称' }
          ],
          pagination: { enabled: true, pageSize: 20 },
          actions: [{ label: '详情', type: 'primary', eventKey: 'view' }]
        }
      },
      {
        id: 'sp_lock',
        type: 'pro-spacer',
        label: '间隔',
        layout: { x: 0, y: 11, w: 12, h: 1, i: 'sp_lock' },
        props: { height: '32px' },
        attrs: {},
        style: {},
        events: {}
      },
      {
        id: 'prog_lock',
        type: 'el-progress',
        label: '进度',
        layout: { x: 0, y: 12, w: 6, h: 2, i: 'prog_lock' },
        props: { text: '进度文本' },
        attrs: { 'stroke-width': 8 },
        style: {},
        events: {}
      },
      {
        id: 'mat_lock',
        type: 'custom-locked-box',
        label: '锁定物料',
        layout: { x: 6, y: 12, w: 6, h: 2, i: 'mat_lock' },
        props: {},
        attrs: {},
        style: {},
        events: {},
        materialRef: { id: 'custom-locked-box', version: '1.2.0' }
      },
      {
        id: 'btn_lock',
        type: 'el-button',
        label: '按钮',
        layout: { x: 0, y: 14, w: 2, h: 2, i: 'btn_lock' },
        props: { text: '触发', type: 'primary' },
        attrs: {},
        style: {},
        events: {
          click: {
            enabled: true,
            actions: [
              { id: 'a1', type: 'set_state', payload: { name: '李四' } },
              { id: 'a2', type: 'show_message', when: '{{ state.flag === true }}', payload: { messageText: '条件消息' } },
              { id: 'a3', type: 'open_dialog', target: 'layer_lock', payload: { from: 'btn' } },
              { id: 'a4', type: 'reload_data', target: 'tbl_lock' }
            ]
          }
        }
      }
    ],
    layers: [
      {
        id: 'layer_lock',
        name: '锁定弹窗',
        type: 'dialog',
        visible: true,
        zIndex: 20,
        props: { title: '锁定弹窗标题', width: '40%' },
        children: [
          {
            id: 'dlg_btn',
            type: 'el-button',
            label: '弹窗按钮',
            layout: { x: 0, y: 0, w: 2, h: 2, i: 'dlg_btn' },
            props: { text: '弹窗按钮文本' },
            attrs: {},
            style: {},
            events: {}
          }
        ]
      }
    ]
  };
}

describe('v2.4.0 重构前字节级基线锁定', () => {
  test('generateVueSFC 完整输出逐字节一致', () => {
    expect(generateVueSFC(buildLockSchema())).toBe(`<template>
  <div class="lowcode-page-page-lock-001">
    <!-- 高端表单 Component -->
    <el-form :model="formData_form_lock" label-width="120px">
      <el-row :gutter="16">
        <el-col :span="24">
          <el-form-item label="用户名" prop="username" required>
            <el-input v-model='formData_form_lock["username"]' placeholder="请输入用户名" style="width: 200px" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="角色" prop="role">
            <el-select v-model='formData_form_lock["role"]' placeholder="请选择角色" style="width: 100%">
              <el-option label="管理员" value="admin" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="启用" prop="enabled">
            <el-switch v-model='formData_form_lock["enabled"]' />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="生日" prop="birthday">
            <el-date-picker v-model='formData_form_lock["birthday"]' type="date" placeholder="请选择日期" style="width: 100%" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item>
        <el-button type="primary" @click="handleSubmit('form_lock')">提交</el-button>
        <el-button @click="handleReset('form_lock')">重置</el-button>
      </el-form-item>
    </el-form>
    <!-- 高端表格 Component -->
    <el-card shadow="always">
      <el-table :data="tableData_tbl_lock" :border="true" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" align="center" sortable />
        <el-table-column prop="name" label="名称" />
        <el-table-column label="操作" align="center" width="160">
          <template #default="scope">
            <el-button link type="primary" size="small" @click="handleRowAction('tbl_lock', 'view', scope.row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="currentPage_tbl_lock"
        :page-size="20"
        layout="total, prev, pager, next"
        :total="totalCount_tbl_lock"
        size="small"
        style="margin-top: 10px; justify-content: flex-end"
        @current-change="onPage_tbl_lock"
      />
    </el-card>
    <div class="pro-spacer" style="min-height: 32px; width: 100%" aria-hidden="true"></div>
    <el-progress text="进度文本" :stroke-width="8">进度文本</el-progress>
    <div style="padding:8px;border:1px dashed #e6a23c;border-radius:4px;color:#b88230">锁定物料（物料 custom-locked-box@1.2.0 未解析）</div>
    <el-button text="触发" type="primary" @click="handleNodeClick('btn_lock', 'click', $event)">触发</el-button>
    <!-- 弹窗图层: 锁定弹窗 -->
    <el-dialog v-model="dialogVisible_layer_lock" title="锁定弹窗标题" width="40%">
      <el-button text="弹窗按钮文本">弹窗按钮文本</el-button>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';

async function fetchChecked(url, init) {
  const maxHops = 3;
  const redirects = new Set([301, 302, 303, 307, 308]);
  const blockedHost = (hostname) => {
    const host = String(hostname || '').toLowerCase().replace(/\\.$/, '').replace(/^\\[|\\]$/g, '');
    if (host === 'metadata.google.internal') return true;
    if (/^0x[0-9a-f]+$/i.test(host) || /^\\d+$/.test(host)) return true;
    const ipv4 = /^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$/.exec(host);
    if (ipv4 && Number(ipv4[1]) === 169 && Number(ipv4[2]) === 254) return true;
    if (host.includes(':') && /^fe[89ab]/i.test(host)) return true;
    return false;
  };
  const rawHost = (value) => {
    const match = /^[a-z][a-z\\d+.-]*:\\/\\/([^/?#]*)/i.exec(value);
    if (!match) return '';
    let authority = match[1];
    const at = authority.lastIndexOf('@');
    if (at >= 0) authority = authority.slice(at + 1);
    if (authority.startsWith('[')) {
      const end = authority.indexOf(']');
      return end >= 0 ? authority.slice(1, end) : authority;
    }
    return authority.replace(/:\\d+$/, '');
  };
  const assertUrl = (value) => {
    if (value.startsWith('/') && !value.startsWith('//')) return;
    if (blockedHost(rawHost(value))) throw new Error('不允许访问该地址');
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('数据源仅允许 http 或 https');
    if (blockedHost(parsed.hostname)) throw new Error('不允许访问该地址');
  };
  let current = url;
  for (let hop = 0; hop <= maxHops; hop++) {
    assertUrl(current);
    const res = await fetch(current, Object.assign({}, init, { redirect: 'manual' }));
    if (res.type === 'opaqueredirect' || redirects.has(res.status)) {
      if (hop === maxHops) throw new Error('重定向次数过多');
      const location = res.headers.get('location');
      if (!location) throw new Error('重定向缺少 Location');
      current = new URL(location, current).toString();
      continue;
    }
    return res;
  }
  throw new Error('重定向次数过多');
}

// 页面全局状态（表达式绑定作用域）
const state = reactive<Record<string, any>>({
  "name": "张三",
  "flag": false
});

// 数据源: /api/lock
const tableData_tbl_lock = ref<any[]>([]);
const totalCount_tbl_lock = ref(0);
const currentPage_tbl_lock = ref(1);
const loadData_tbl_lock = async () => {
  try {
    const params = { page: currentPage_tbl_lock.value, size: 20, ...({ "q": (state.name) }) };
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.append(k, String(v)); });
    const q = qs.toString();
    const base = "/api/lock";
    const url = q ? (base.includes('?') ? base + '&' + q : base + '?' + q) : base;
    const res = await fetchChecked(url, { method: 'GET', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const list = json.data.list;
    tableData_tbl_lock.value = Array.isArray(list) ? list : [];
    const total = json.data.total;
    if (total !== undefined) totalCount_tbl_lock.value = Number(total) || 0;
  } catch (err) {
    console.error('数据加载失败:', err);
  }
};
const onPage_tbl_lock = (page: number) => { currentPage_tbl_lock.value = page; state.page = page; loadData_tbl_lock(); };

const formData_form_lock = ref<Record<string, any>>({});

const handleNodeClick = async (nodeId: string, eventKey: string, $event: any) => {
  if (nodeId === "form_lock" && eventKey === "submit") {
    ElMessage({ type: "success", message: "表单已提交" });
  }
  if (nodeId === "btn_lock" && eventKey === "click") {
    state["name"] = "李四";
    if (state.flag === true) {
      ElMessage({ type: "success", message: "条件消息" });
    }
    state["from"] = "btn";
    dialogVisible_layer_lock.value = true;
    await loadData_tbl_lock();
  }
};

const handleRowAction = async (nodeId: string, eventKey: string, row: any) => {
  if ((nodeId === "form_lock" && eventKey === "submit") || (nodeId === "btn_lock" && eventKey === "click")) {
    await handleNodeClick(nodeId, eventKey, { row, eventKey });
    return;
  }
  const preferred = [row?.name, row?.title, row?.label, row?.id];
  let rowLabel = '当前行';
  for (const v of preferred) { if (v !== undefined && v !== null && String(v).trim() !== '') { rowLabel = String(v); break; } }
  if (rowLabel === '当前行' && row && typeof row === 'object') { for (const v of Object.values(row)) { if (v !== undefined && v !== null && typeof v !== 'object' && String(v).trim() !== '') { rowLabel = String(v); break; } } }
  const actionLabel = ({ view: '查看', delete: '删除', edit: '编辑' } as Record<string, string>)[eventKey] || eventKey;
  ElMessage({ type: eventKey === 'delete' ? 'warning' : 'info', message: actionLabel + ' · ' + rowLabel });
};

const lookupForm = (formId: string) => {
  if (formId === "form_lock") return formData_form_lock;
  return null;
};
const handleSubmit = async (formId: string) => {
  const form = lookupForm(formId);
  if (!form) return;
  if (formId === "form_lock" && (form.value["username"] == null || String(form.value["username"]).trim() === '')) { ElMessage.warning("请填写用户名"); return; }
  await handleNodeClick(formId, 'submit', form.value);
  console.log('Form Submitted:', form.value);
  ElMessage.success('表单提交成功');
};

const handleReset = (formId: string) => {
  const form = lookupForm(formId);
  if (!form) return;
  Object.keys(form.value).forEach((key) => { form.value[key] = undefined; });
  ElMessage.info('表单已重置');
};

const dialogVisible_layer_lock = ref(true);

const loadInitialData = () => {
  loadData_tbl_lock();
};

onMounted(() => {
  loadInitialData();
  console.log("低代码页面及多图层组件已成功挂载!");
});

onUnmounted(() => {
  console.log("低代码页面组件已卸载!");
});
</script>

<style scoped>
.lowcode-page-page-lock-001 {
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
</style>
`);
  });

  test('generateHTML 完整输出逐字节一致', () => {
    expect(generateHTML(buildLockSchema())).toBe(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>锁定页</title>
  <!-- Element Plus CSS -->
  <link rel="stylesheet" href="https://unpkg.com/element-plus/dist/index.css">
  <style>
    .lowcode-page-page-lock-001 {
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
      <h2>锁定页</h2>
      <p>页面 ID: page_lock_001 | 生成版本: v1.0.0</p>
    </div>
    <div class="lowcode-page-page-lock-001">
      <!-- 高端表单 Component -->
      <el-form :model="formData_form_lock" label-width="120px">
        <el-row :gutter="16">
          <el-col :span="24">
            <el-form-item label="用户名" prop="username" required>
              <el-input v-model='formData_form_lock["username"]' placeholder="请输入用户名" style="width: 200px" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="角色" prop="role">
              <el-select v-model='formData_form_lock["role"]' placeholder="请选择角色" style="width: 100%">
                <el-option label="管理员" value="admin" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="启用" prop="enabled">
              <el-switch v-model='formData_form_lock["enabled"]' />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="生日" prop="birthday">
              <el-date-picker v-model='formData_form_lock["birthday"]' type="date" placeholder="请选择日期" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item>
          <el-button type="primary" @click="handleSubmit('form_lock')">提交</el-button>
          <el-button @click="handleReset('form_lock')">重置</el-button>
        </el-form-item>
      </el-form>
      <!-- 高端表格 Component -->
      <el-card shadow="always">
        <el-table :data="tableData_tbl_lock" :border="true" style="width: 100%">
          <el-table-column prop="id" label="ID" width="80" align="center" sortable />
          <el-table-column prop="name" label="名称" />
          <el-table-column label="操作" align="center" width="160">
            <template #default="scope">
              <el-button link type="primary" size="small" @click="handleRowAction('tbl_lock', 'view', scope.row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="currentPage_tbl_lock"
          :page-size="20"
          layout="total, prev, pager, next"
          :total="totalCount_tbl_lock"
          size="small"
          style="margin-top: 10px; justify-content: flex-end"
          @current-change="onPage_tbl_lock"
        />
      </el-card>
      <div class="pro-spacer" style="min-height: 32px; width: 100%" aria-hidden="true"></div>
      <el-progress text="进度文本" :stroke-width="8">进度文本</el-progress>
      <div style="padding:8px;border:1px dashed #e6a23c;border-radius:4px;color:#b88230">锁定物料（物料 custom-locked-box@1.2.0 未解析）</div>
      <el-button text="触发" type="primary" @click="handleNodeClick('btn_lock', 'click', $event)">触发</el-button>
      <!-- 弹窗图层: 锁定弹窗 -->
      <el-dialog v-model="dialogVisible_layer_lock" title="锁定弹窗标题" width="40%">
        <el-button text="弹窗按钮文本">弹窗按钮文本</el-button>
      </el-dialog>

    </div>
  </div>

  <!-- Vue 3 CDN (完整版，含模板编译器) & Element Plus CDN -->
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
  <script src="https://unpkg.com/element-plus"></script>
  <script>
    const { createApp } = Vue;
    async function fetchChecked(url, init) {
      const maxHops = 3;
      const redirects = new Set([301, 302, 303, 307, 308]);
      const blockedHost = (hostname) => {
        const host = String(hostname || '').toLowerCase().replace(/\\.$/, '').replace(/^\\[|\\]$/g, '');
        if (host === 'metadata.google.internal') return true;
        if (/^0x[0-9a-f]+$/i.test(host) || /^\\d+$/.test(host)) return true;
        const ipv4 = /^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$/.exec(host);
        if (ipv4 && Number(ipv4[1]) === 169 && Number(ipv4[2]) === 254) return true;
        if (host.includes(':') && /^fe[89ab]/i.test(host)) return true;
        return false;
      };
      const rawHost = (value) => {
        const match = /^[a-z][a-z\\d+.-]*:\\/\\/([^/?#]*)/i.exec(value);
        if (!match) return '';
        let authority = match[1];
        const at = authority.lastIndexOf('@');
        if (at >= 0) authority = authority.slice(at + 1);
        if (authority.startsWith('[')) {
          const end = authority.indexOf(']');
          return end >= 0 ? authority.slice(1, end) : authority;
        }
        return authority.replace(/:\\d+$/, '');
      };
      const assertUrl = (value) => {
        if (value.startsWith('/') && !value.startsWith('//')) return;
        if (blockedHost(rawHost(value))) throw new Error('不允许访问该地址');
        const parsed = new URL(value);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('数据源仅允许 http 或 https');
        if (blockedHost(parsed.hostname)) throw new Error('不允许访问该地址');
      };
      let current = url;
      for (let hop = 0; hop <= maxHops; hop++) {
        assertUrl(current);
        const res = await fetch(current, Object.assign({}, init, { redirect: 'manual' }));
        if (res.type === 'opaqueredirect' || redirects.has(res.status)) {
          if (hop === maxHops) throw new Error('重定向次数过多');
          const location = res.headers.get('location');
          if (!location) throw new Error('重定向缺少 Location');
          current = new URL(location, current).toString();
          continue;
        }
        return res;
      }
      throw new Error('重定向次数过多');
    }

    const App = {
      template: \`
        <div>
          <div class="page-header">
            <h2>锁定页</h2>
            <p>页面 ID: page_lock_001 | 生成版本: v1.0.0</p>
          </div>
          <div class="lowcode-page-page-lock-001">
            <!-- 高端表单 Component -->
            <el-form :model="formData_form_lock" label-width="120px">
              <el-row :gutter="16">
                <el-col :span="24">
                  <el-form-item label="用户名" prop="username" required>
                    <el-input v-model='formData_form_lock["username"]' placeholder="请输入用户名" style="width: 200px" />
                  </el-form-item>
                </el-col>
                <el-col :span="8">
                  <el-form-item label="角色" prop="role">
                    <el-select v-model='formData_form_lock["role"]' placeholder="请选择角色" style="width: 100%">
                      <el-option label="管理员" value="admin" />
                    </el-select>
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="启用" prop="enabled">
                    <el-switch v-model='formData_form_lock["enabled"]' />
                  </el-form-item>
                </el-col>
                <el-col :span="12">
                  <el-form-item label="生日" prop="birthday">
                    <el-date-picker v-model='formData_form_lock["birthday"]' type="date" placeholder="请选择日期" style="width: 100%" />
                  </el-form-item>
                </el-col>
              </el-row>
              <el-form-item>
                <el-button type="primary" @click="handleSubmit('form_lock')">提交</el-button>
                <el-button @click="handleReset('form_lock')">重置</el-button>
              </el-form-item>
            </el-form>
            <!-- 高端表格 Component -->
            <el-card shadow="always">
              <el-table :data="tableData_tbl_lock" :border="true" style="width: 100%">
                <el-table-column prop="id" label="ID" width="80" align="center" sortable />
                <el-table-column prop="name" label="名称" />
                <el-table-column label="操作" align="center" width="160">
                  <template #default="scope">
                    <el-button link type="primary" size="small" @click="handleRowAction('tbl_lock', 'view', scope.row)">详情</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <el-pagination
                v-model:current-page="currentPage_tbl_lock"
                :page-size="20"
                layout="total, prev, pager, next"
                :total="totalCount_tbl_lock"
                size="small"
                style="margin-top: 10px; justify-content: flex-end"
                @current-change="onPage_tbl_lock"
              />
            </el-card>
            <div class="pro-spacer" style="min-height: 32px; width: 100%" aria-hidden="true"></div>
            <el-progress text="进度文本" :stroke-width="8">进度文本</el-progress>
            <div style="padding:8px;border:1px dashed #e6a23c;border-radius:4px;color:#b88230">锁定物料（物料 custom-locked-box@1.2.0 未解析）</div>
            <el-button text="触发" type="primary" @click="handleNodeClick('btn_lock', 'click', $event)">触发</el-button>
            <!-- 弹窗图层: 锁定弹窗 -->
            <el-dialog v-model="dialogVisible_layer_lock" title="锁定弹窗标题" width="40%">
              <el-button text="弹窗按钮文本">弹窗按钮文本</el-button>
            </el-dialog>

          </div>
        </div>
      \`,
      data() {
        return {
          state: { "name": "张三", "flag": false },
          tableData_tbl_lock: [], // 数据源: /api/lock
          totalCount_tbl_lock: 0,
          currentPage_tbl_lock: 1,
          formData_form_lock: {},
          dialogVisible_layer_lock: true,
        };
      },
      mounted() {
        this.loadData_tbl_lock();
      },
      beforeUnmount() {
        console.log("低代码页面已卸载!");
      },
      methods: {
        async loadData_tbl_lock() {
          try {
            const params = { page: this.currentPage_tbl_lock, size: 20, ...({ "q": (state.name) }) };
            const qs = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.append(k, String(v)); });
            const q = qs.toString();
            const base = "/api/lock";
            const url = q ? (base.includes('?') ? base + '&' + q : base + '?' + q) : base;
            const res = await fetchChecked(url, { method: 'GET', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000) });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const json = await res.json();
            const list = json.data.list;
            this.tableData_tbl_lock = Array.isArray(list) ? list : [];
            const total = json.data.total;
            if (total !== undefined) this.totalCount_tbl_lock = Number(total) || 0;
          } catch (err) {
            console.error('数据加载失败:', err);
          }
        }
        onPage_tbl_lock(page) { this.currentPage_tbl_lock = page; this.state.page = page; this.loadData_tbl_lock(); },
        handleNodeClick(nodeId, eventKey, $event) {
          if (nodeId === "form_lock" && eventKey === "submit") {
            ElMessage({ type: "success", message: "表单已提交" });
          }
          if (nodeId === "btn_lock" && eventKey === "click") {
            this.state["name"] = "李四";
            if (state.flag === true) {
              ElMessage({ type: "success", message: "条件消息" });
            }
            this.state["from"] = "btn";
            this.dialogVisible_layer_lock = true;
            await this.loadData_tbl_lock();
          }
        },
        handleRowAction(nodeId, eventKey, row) {
          if ((nodeId === "form_lock" && eventKey === "submit") || (nodeId === "btn_lock" && eventKey === "click")) {
            return this.handleNodeClick(nodeId, eventKey, { row, eventKey });
          }
          const preferred = [row?.name, row?.title, row?.label, row?.id];
          let rowLabel = '当前行';
          for (const v of preferred) { if (v !== undefined && v !== null && String(v).trim() !== '') { rowLabel = String(v); break; } }
          if (rowLabel === '当前行' && row && typeof row === 'object') { for (const v of Object.values(row)) { if (v !== undefined && v !== null && typeof v !== 'object' && String(v).trim() !== '') { rowLabel = String(v); break; } } }
          const actionLabel = ({ view: '查看', delete: '删除', edit: '编辑' })[eventKey] || eventKey;
          ElementPlus.ElMessage({ type: eventKey === 'delete' ? 'warning' : 'info', message: actionLabel + ' · ' + rowLabel });
        },
        lookupForm(formId) {
          if (formId === "form_lock") return this.formData_form_lock;
          return null;
        },
        async handleSubmit(formId) {
          const form = this.lookupForm(formId);
          if (!form) return;
          if (formId === "form_lock" && (form["username"] == null || String(form["username"]).trim() === '')) { ElementPlus.ElMessage.warning("请填写用户名"); return; }
          await this.handleNodeClick(formId, 'submit', form);
          console.log('Form Submitted:', form);
          ElementPlus.ElMessage.success('表单提交成功');
        },
        handleReset(formId) {
          const form = this.lookupForm(formId);
          if (!form) return;
          Object.keys(form).forEach((key) => {
            form[key] = undefined;
          });
          ElementPlus.ElMessage.info('表单已重置');
        },
      }
    };

    createApp(App).use(ElementPlus).mount('#app');
  </script>
</body>
</html>
`);
  });

  test('generateWebComponent 完整输出逐字节一致', () => {
    expect(generateWebComponent(buildLockSchema())).toBe(`/**
 * Web Component 包装脚本
 * 标签名: <custom-page-page-lock-001></custom-page-page-lock-001>
 * 说明:
 *   - Shadow DOM 模式（默认）：defineCustomElement 以 styles 注入 Element Plus
 *     核心样式，影子根内的组件自带完整样式；文档级样式导入兜底 teleport 到
 *     body 的浮层（下拉面板、Message 等，它们不在影子根内）。
 *   - Light DOM 兜底：调用 registerLightDomElement() 以 shadowRoot:false 注册
 *     <custom-page-page-lock-001-light>，不创建影子根，组件直接继承宿主页面样式；适用于
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

if (!customElements.get('custom-page-page-lock-001')) {
  customElements.define('custom-page-page-lock-001', CustomPageElement);
  console.log('Web Component <custom-page-page-lock-001> 成功注册!');
}

/**
 * Light DOM 兜底注册（shadowRoot: false，不创建 Shadow Root）。
 * 何时用：宿主页面需要与组件共享样式 / CSS 变量，或目标环境不支持 Shadow DOM。
 * 此模式下 Vue 不支持 styles 注入（会告警），Element Plus 样式由文件顶部的
 * 文档级 import 覆盖。标签名默认带 -light 后缀，与默认 Shadow DOM 注册互不冲突。
 * 返回该自定义元素类，可按需自行 customElements.define。
 */
export function registerLightDomElement(tagName = 'custom-page-page-lock-001-light') {
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
  });
});

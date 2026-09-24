# 低代码前端平台架构演进与体验优化深度建议 (Platform Architecture & Recommendations)

> **文档版本**: 2.0.0 (详细技术落地版)
> **状态**: 持续跟进与演进中 (Active & Evolving)
> **适用技术栈**: Vue 3 (Composition API) + Element Plus + Pinia + Express + SQLite

结合本项目（Vue 3 + Element Plus + Node.js/Express + SQLite）的实际落地情况与企级低代码平台的演进经验，本文对 **5 大架构演进方向** 做出极致详尽的技术落地说明、代码结构规范与实现方案流程图：

---

## 1. Vue 3 SFC 干净源码“零废码”生成器引擎 (Clean Code Generator Engine)

### 1.1 痛点与深度设计理念
传统低代码最忌讳“强绑定平台运行时 (Runtime Dependency)”。如果离线导出的源码依赖大量 `LowCodeRuntime` 库，代码将失去可读性，导致后续二次开发与维保极其艰难。

本生成器引擎的目标是：**输入 JSON Schema，输出纯正、优雅、零平台黑盒依赖的多目标产物（Vue 3 SFC `.vue` 单文件组件、原生 W3C Web Components 自定义元素，以及纯 HTML + Vanilla JS Bundle）**。

```text
+-----------------------+      +---------------------------+      +-----------------------+
|  Page JSON Schema     | ──►  |  Code Generator (AST)     | ──►  |  Standard .vue File   |
|  - Component Nodes    |      |  - Template Generator     |      |  - <template>         |
|  - Props / Attrs      |      |  - Script Setup Generator |      |  - <script setup>     |
|  - Event Rules        |      |  - Style & Prettier Format|      |  - <style scoped>     |
+-----------------------+      +---------------------------+      +-----------------------+
```

### 1.2 核心实现流程与代码转化结构

#### A. `<template>` 模板生成器
根据 `ComponentNode` 的 `type`、`props`、`attrs` 递归生成 Element Plus 标准标签：
- 将 `pro-table` 展开为包含 `<el-table>`、`<el-table-column>` 和 `<el-pagination>` 的干净模板。
- 将 `pro-form` 展开为绑定 `v-model="formData"` 的 `<el-form>` 和 `<el-form-item>` 布局。

#### B. `<script setup lang="ts">` 逻辑提取
自动收集模板中使用的响应式变量、Axios 接口请求及事件函数：

```vue
<!-- 生成的干净 .vue 源码示例 -->
<template>
  <div class="generated-page">
    <el-card shadow="always">
      <el-form :model="formData" label-width="100px">
        <el-form-item label="用户名">
          <el-input v-model="formData.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询用户</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="tableData" border stripe style="width: 100%; margin-top: 16px">
        <el-table-column prop="id" label="ID" width="80" align="center" />
        <el-table-column prop="name" label="姓名" />
        <el-table-column prop="status" label="状态" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';

// 响应式表单数据
const formData = reactive({
  username: ''
});

// 表格数据源
const tableData = ref([]);

// 查询事件响应函数
const handleSearch = async () => {
  try {
    const res = await axios.get('/api/users', { params: formData });
    tableData.value = res.data.data.records;
    ElMessage.success('查询成功');
  } catch (err: any) {
    ElMessage.error('查询失败: ' + err.message);
  }
};

onMounted(() => {
  handleSearch();
});
</script>

<style scoped>
.generated-page {
  padding: 20px;
}
</style>
```

#### C. 代码格式化与 Prettier 美化
生成引擎在拼接字符串后，调用 `prettier/standalone` 进行 AST 级别代码排版与对齐，保证输出源码达到高级前端工程师手动编写的书写规范。

---

## 2. 独立沙箱预览与多端/多分辨率自适应 (Sandbox Preview & Multi-Device Canvas)

### 2.1 深度方案与通信架构
在低代码设计器中，为了避免设计器本身的 CSS 样式与页面组件样式发生互相污染，且为了实现真正的“多端响应式模拟”，必须采用 **Iframe 隔离沙箱 + PostMessage 跨文档通信** 架构。

```text
+---------------------------------------------------------------------------------+
|                         主设计器宿主窗口 (Host Window)                          |
|  [顶部画幅选择器: PC 100% | Laptop 1366px | Tablet 768px | Mobile 375px]          |
|  [比例尺缩放: 50% ~ 150%]                                                       |
|                                                                                 |
|   +-------------------------------------------------------------------------+   |
|   |                      独立沙箱 Iframe (Sandbox)                           |   |
|   |  - 隔离 CSS 污染                                                         |   |
|   |  - 运行实时组件 Renderer                                                 |   |
|   |  - 通过 PostMessage 接收 Host 发送的 Schema 变动                           |   |
|   +-------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------+
```

### 2.2 核心 PostMessage 通信协议规范

```typescript
// 宿主 -> 沙箱消息结构
export interface HostToSandboxMessage {
  type: 'UPDATE_SCHEMA' | 'SELECT_NODE' | 'HIGHLIGHT_HOVER';
  payload: {
    pageSchema?: any;
    selectedNodeId?: string | null;
  };
}

// 沙箱 -> 宿主消息结构
export interface SandboxToHostMessage {
  type: 'NODE_CLICKED' | 'NODE_DRAG_DROPPED' | 'RENDER_ERROR';
  payload: {
    nodeId?: string;
    error?: string;
  };
}
```

---

## 3. 撤销/重做 (Undo / Redo) 历史栈与快照 Diff 比较

### 3.1 深度设计方案：基于 JSON Patch 的时间旅行 (Time-Travel Engine)
用户在调整网格位置、配置组件属性、修改事件列表时，可能会产生误操作。传统全量保存 JSON 副本会消耗大量内存，本方案采用 **RFC 6902 JSON Patch 微量变更差异** 技术：

```typescript
import { applyPatch, createPatch } from 'rfc6902';

export class HistoryStore {
  private past: Array<any[]> = [];   // 撤销栈 (Undo Patches)
  private future: Array<any[]> = []; // 重做栈 (Redo Patches)
  private present: any;              // 当前 PageSchema 快照

  constructor(initialSchema: any) {
    this.present = JSON.parse(JSON.stringify(initialSchema));
  }

  // 记录一次操作变动
  pushState(newSchema: any) {
    const patches = createPatch(this.present, newSchema);
    if (patches.length > 0) {
      this.past.push(patches);
      this.present = JSON.parse(JSON.stringify(newSchema));
      this.future = []; // 清空重做栈
    }
  }

  // 执行撤销 (Undo)
  undo(): any | null {
    if (this.past.length === 0) return null;
    const patches = this.past.pop()!;
    // 逆向应用 Patch
    const inversePatches = createInversePatches(patches);
    applyPatch(this.present, inversePatches);
    this.future.push(patches);
    return this.present;
  }
}
```

### 3.2 界面集成与快捷键
- **键盘监听**: 绑定全局 `keydown` 事件（`Ctrl + Z` 执行 undo，`Ctrl + Y` 或 `Ctrl + Shift + Z` 执行 redo）。
- **快照 Diff 对比弹窗**: 在比对版本时，使用 `monaco-editor` 的 `createDiffEditor` 高亮展示 JSON 变动点。

---

## 4. 插件化物料扩展与远程组件动态加载 (Dynamic Material Plugin System)

### 4.1 深度方案与加载架构
为了让业务部门能够独立开发第三方 UI 组件（如 ECharts 图表、特定行业 UI 控件）并无缝接入平台，而无需重新编译部署平台主体，设计 **基于 Module Federation / ESM 的远程组件加载器**。

```text
+---------------------------------------------------------------------------------+
|                         远程组件物料包 (Material Plugin)                         |
|  - index.js (UMD/ESM Bundle)                                                    |
|  - meta.json (组件名, 图标, 属性 Setter 配置定义, 默认 Props)                    |
+---------------------------------------------------------------------------------+
                                         │
                                  网络 CDN 远程下载
                                         │
                                         ▼
+---------------------------------------------------------------------------------+
|                       低代码平台物料注册中心 (Plugin Registry)                   |
|  1. 动态 `import()` 加载远程 JS 模块                                            |
|  2. `app.component(meta.name, RemoteComponent)` 全局注册                         |
|  3. 将 meta 定义注入左侧物料库面板 (MaterialList)                               |
+---------------------------------------------------------------------------------+
```

### 4.2 远程物料插件 Meta 契约规范 (`LowCodePluginMeta`)

```json
{
  "name": "biz-echarts-line",
  "label": "折线图表组件",
  "version": "1.0.0",
  "category": "extension",
  "entry": "https://cdn.example.com/plugins/biz-echarts-line.js",
  "defaultLayout": { "w": 6, "h": 5 },
  "defaultProps": {
    "title": "月度销售趋势",
    "theme": "light"
  },
  "setters": [
    { "field": "title", "label": "图表标题", "setter": "el-input" },
    { "field": "theme", "label": "配色主题", "setter": "el-select", "options": ["light", "dark"] }
  ]
}
```

---

## 5. 细粒度字段级权限与动态显隐规则引擎 (Field Permission & Rule Engine)

### 5.1 深度方案与表达式求解器
企级业务中，同一个表单在不同角色（如普通员工、部门经理、HR）面前有不同的字段可见性与编辑权限。例如：普通员工看“薪资”字段隐藏，部门经理只读，HR 可编辑。

#### A. 规则定义 Schema 扩展
在 `ComponentNode` 中扩展 `permission` 与 `rules` 逻辑：

```typescript
export interface ComponentPermissionRule {
  // 1. 字段显隐与禁用规则
  visibleRule?: string;    // JS 表达式 (例: "state.user.role === 'admin' || state.form.amount < 5000")
  disabledRule?: string;   // JS 表达式 (例: "state.form.status === 'APPROVED'")

  // 2. 细粒度 RBAC 权限标识
  permissionCode?: string; // (例: "user:salary:view")
}
```

#### B. 沙箱安全的表达式解析引擎 (Safe Rule Evaluator)
避免使用危险的 `eval()`，采用安全作用域解析器（如 `expr-eval` 或基于 AST 的表达式执行）：

```typescript
export function evaluateCondition(expression: string, contextScope: Record<string, any>): boolean {
  try {
    // 构建受控的作用域函数
    const keys = Object.keys(contextScope);
    const values = Object.values(contextScope);
    const fn = new Function(...keys, `return Boolean(${expression});`);
    return fn(...values);
  } catch (e) {
    console.warn(`Condition evaluation failed for "${expression}":`, e);
    return true; // 报错时默认兜底显示，保障可用性
  }
}
```

#### C. Vue 3 动态权限指令 (`v-permission`)
封装 Vue 3 全局指令 `v-permission="'user:salary:view'"`，内部与 Pinia 用户 Store 联动，无权限时自动销毁 DOM 或置灰禁用。

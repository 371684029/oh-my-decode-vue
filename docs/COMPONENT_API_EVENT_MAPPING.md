# 架构技术规范文档：组件、接口与事件 (Component - API - Event) 三角映射模型规范

> **文档版本**: 1.0.0
> **状态**: 持续跟进与演进中 (Active & Evolving)
> **适用范围**: 低代码前端平台核心渲染器 (Renderer)、设计器 (Designer) 与出码引擎 (Code Generator)

---

## 1. 架构设计哲学与三角关系图

在现代化企级低代码 UI 平台中，“组件”、“接口（数据源）”与“事件（动作）”是构建动态交互页面的三大核心柱石。传统的低代码设计往往容易将三者强行耦合（如将 API 请求直接写死在按钮的 onClick 里面），这会导致**类型混乱、不可复用、排查困难**。

本项目提出 **“Component - API - Event”解耦三角映射规范 (The CAE Triangle Mapping Architecture)**：

```text
                     +----------------------------------+
                     |        页面全局状态中枢          |
                     |       (Pinia / Reactive State)   |
                     +----------------------------------+
                                ▲            │
             状态监听 / 参数映射  │            │ 驱动重新渲染 / 属性透传
                                │            ▼
       +--------------------------------------------------------------+
       |                                                              |
       |  【组件层: Component Node】  ◄───────  【接口层: API Data】  |
       |  - ProTable (高端表格)                 - RESTful / GraphQL   |
       |  - ProForm (高端表单)                  - JSON Path 提取      |
       |  - Element UI 元素                      - 入参 / 出参转换     |
       |                                                              |
       +--------------------------------------------------------------+
                                ▲            │
                      抛出事件  │            │ 执行动作链
                      (Event)   │            ▼ (Action Chain)
                       +--------------------------------+
                       |   【事件动作层: Event/Action】  |
                       |   - Event Trigger              |
                       |   - Action Dispatcher          |
                       |   - Event Flow Orchestrator    |
                       +--------------------------------+
```

### 核心解耦原则：
1. **组件只负责渲染与UI状态 (Pure UI Component)**：组件不知道具体的 API URL，只暴露标准化 `props`（数据驱动）与 `events`（事件触发）。
2. **接口只负责数据通讯与转换 (Stateless API Layer)**：数据源 `DataSource` 定义入参（Query/Body）和出参字段提取（JSON Path），不关心数据最终渲染给哪一个组件。
3. **事件只负责流转与调度 (Event Dispatcher & Action Chain)**：事件作为粘合剂，监听组件的 `onClick`, `onChange`, `onRowSelect` 等触发点，按顺序调度执行一个或多个 `Action`（调用接口、修改全局 State、弹窗控制、页面跳转）。

---

## 2. 完备的 TypeScript Schema 规范定义

为了保证平台代码工整、强类型标注与高度可读性，以下确立完整的 Schema 接口标准：

### 2.1 接口层 Schema (`DataSourceSchema`)

```typescript
export interface DataSourceParam {
  key: string;              // 参数名 (例: "keyword", "pageNo")
  valueType: 'static' | 'state' | 'component_value' | 'route_param';
  value: any;               // 映射源表达式 (例: "state.searchForm.name" 或 "1")
  required?: boolean;
}

export interface DataSourceSchema {
  id: string;               // 数据源唯一标识 (例: "ds_user_list")
  name: string;             // 别名
  url: string;              // 接口地址
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  params: DataSourceParam[];// 参数映射列表
  responseTransform?: {
    dataPath: string;       // JSON Path 数据提取 (例: "data.records")
    totalPath?: string;     // 分页总数提取 (例: "data.total")
  };
}
```

### 2.2 事件动作层 Schema (`EventActionSchema`)

```typescript
export type ActionType =
  | 'fetch_api'        // 触发网络请求并更新数据
  | 'set_state'         // 修改全局状态 State
  | 'control_modal'     // 打开/关闭弹框或抽屉
  | 'navigate'          // 页面/路由跳转
  | 'show_message'      // 消息弹窗 (Message/Notification)
  | 'custom_script';    // 自定义 JS 脚本

export interface ActionNode {
  id: string;
  type: ActionType;
  name: string;
  payload: {
    // fetch_api 专用
    apiId?: string;
    targetComponentIds?: string[]; // 请求成功后联动刷新的组件 ID 列表

    // set_state 专用
    statePath?: string;
    stateValue?: any;

    // control_modal 专用
    modalId?: string;
    modalAction?: 'open' | 'close' | 'toggle';

    // navigate 专用
    url?: string;
    target?: '_self' | '_blank';

    // show_message 专用
    messageType?: 'success' | 'warning' | 'info' | 'error';
    messageText?: string;

    // custom_script 专用
    scriptCode?: string;
  };
}

export interface EventRule {
  eventName: string;        // 组件抛出的事件标识 (例: "onClick", "onSearch", "onRowSelect")
  description?: string;
  enabled: boolean;
  actionChain: ActionNode[];// 动作执行链条
}
```

### 2.3 组件层 Schema (`ComponentNodeSchema`)

```typescript
export interface ComponentNodeSchema {
  id: string;               // 节点唯一 ID (例: "node_table_101")
  type: string;             // 组件类型 (例: "pro-table", "pro-form", "el-button")
  label: string;            // 物料标签
  layout: { x: number; y: number; w: number; h: number; i: string };

  props: Record<string, any>; // 静态/绑定属性
  attrs: Record<string, any>; // 原生透传属性
  config?: Record<string, any>;// 高端组件专属配置 (如表格列、表单项)

  // 绑定配置: 数据源绑定与事件响应绑定
  apiBinding?: {
    dataSourceId: string;
    autoFetch: boolean;     // 组件装载时是否自动请求
    targetPropMap: {
      dataProp: string;     // 绑定组件的哪个属性 (例: "mockData")
      totalProp?: string;   // 绑定组件的分页属性 (例: "pagination.total")
    };
  };

  events?: Record<string, EventRule>; // 监听的事件规则列表
}
```

---

## 3. 数据与事件的单向流向与闭环流程 (Data & Event Lifecycle)

```text
       【1. 用户交互 / 触发端】
       例如：点击 ProForm 搜索按钮、改变分页输入框
                 │
                 ▼
       【2. 抛出事件 Event】
       组件抛出 "onClick" / "onSearch" 事件及 Context Payload ($event)
                 │
                 ▼
       【3. 动作调度器 Action Dispatcher】
       按 Order 顺序检索对应的 EventRule.actionChain 并执行
                 │
      ┌──────────┴──────────────────────────┐
      ▼                                     ▼
【Action A: set_state】            【Action B: fetch_api】
更新 Pinia 全局响应式状态           组装接口 Params -> 发送 HTTP 请求
      │                                     │
      ▼                                     ▼
【4. 状态响应与订阅器】             【5. 响应字段提取 Response Mapper】
触发依赖该 State 的其他组件更新       根据 JSON Path (data.records) 提取数据
      │                                     │
      └──────────────────┬──────────────────┘
                         ▼
             【6. 目标组件重绘渲染】
             ProTable 接收最新数据数组并重绘页面
```

---

## 4. 典型企级业务场景映射推演

### 场景一：搜索表单 (ProForm) 联动过滤表格 (ProTable)

- **组件划分**：`form_search` (ProForm), `table_data` (ProTable)。
- **接口绑定**：`table_data` 绑定数据源 `ds_get_users` (URL: `/api/users/list`)。
- **参数映射**：`ds_get_users` 的 `params` 字段配置为：
  - `name`: `valueType = 'state'`, `value = 'state.searchForm.username'`
  - `status`: `valueType = 'state'`, `value = 'state.searchForm.status'`
- **事件动作配置**：`form_search` 的 `onSearch` 事件关联 Action：
  - `Action 1`: `type = 'fetch_api'`, `payload.targetApiId = 'ds_get_users'`, `payload.targetComponentIds = ['table_data']`
- **执行闭环**：表单更改 -> 修改 `state.searchForm` -> 点击搜索 -> 执行 `fetch_api` 读取最新 `state` 发请求 -> `table_data` 自动刷新并渲染。

### 场景二：表格行点击“编辑”按钮，弹窗加载并回显数据

- **触发源**：`table_data` 的 `onRowEdit` 事件。
- **动作链条 (Action Chain)**：
  - `Action 1` (`set_state`)：设置全局 `state.currentUserId = $event.row.id`。
  - `Action 2` (`control_modal`)：设置 `modal_edit_user` 的状态为 `open`。
  - `Action 3` (`fetch_api`)：触发数据源 `ds_get_user_detail`（带入 `userId = state.currentUserId`），将数据回显至弹窗内的 `form_edit` 组件。

---

## 5. 低代码可视化配置面板 UX 规范 (Design System)

为确保非代码人员能够顺畅完成配置，设计器右侧抽屉面板分为 4 个高度解耦的配置 Tab：

1. **【属性 Props】Tab**：配置基础 UI 属性（尺寸、标题、显示/隐藏、禁用状态）。
2. **【高级 Config】Tab**：配置高端表单/表格的列定义、表单控件类型与校验规则。
3. **【数据源 API】Tab**：选择并绑定当前组件依赖的数据接口，配置请求参数映射与 JSON 提取路径，支持**现场一键连通性测试 (Live Test)**。
4. **【事件与动作 ⚡】Tab**：提供卡片链条式动作编排器 (Chain Action Editor)，允许用户为 `onClick`、`onChange` 等事件添加串行动作链。

---

## 6. 持续跟进与技术演进路线图 (Technical Roadmap)

为保持本映射架构的先进性与扩展性，制定以下跟进路线计划：

- [x] **v0.0.1**：基础网格画布、ProForm/ProTable 物料与本地 JSON/SQLite 架构搭建。
- [x] **v0.1.0**：完成组件、接口与事件三角映射规范文档及完整架构设计思考。
- [ ] **v0.1.1**：前端实现 `ActionDispatcher` 与 `ApiExecutor` 统一派发引擎。
- [ ] **v0.1.2**：实现侧边抽屉 `ApiBindingSetter.vue` 与 `EventActionEditor.vue` 可视化组件。
- [ ] **v0.2.0**：引入 OpenAPI/Swagger 接口文档一键导入，与计算公式引擎 (Formula Engine)。

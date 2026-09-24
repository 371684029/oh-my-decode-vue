# 架构技术规范文档：组件、接口与事件 (Component - API - Event) 三角映射模型规范

> **文档版本**: 1.1.0
> **状态**: 持续跟进与演进中 (Active & Evolving)
> **适用范围**: 低代码前端平台核心渲染器 (Renderer)、设计器 (Designer) 与出码引擎 (Code Generator)

---

## 1. 核心理念：JSON Schema 是数据互通与映射连接的唯一桥梁 (The JSON Bridge Concept)

在低代码数据互通的设计中，系统通过**监听用户的拖拉拽操作**，实时构建并维护一个高可读性、可序列化的 **JSON 树**。

**JSON 既是视图渲染的凭证，也是组件、接口、事件与表单字段之间映射连接的唯一桥梁。**

```text
+-----------------------------------------------------------------------------------+
|                                 JSON 桥梁连接模型                                  |
+-----------------------------------------------------------------------------------+
|  [用户拖拉拽操作 Drag & Drop] ──监听/驱动──► [全局 Pinia Store] ──实时导出──► [JSON 文件]
|                                                                                   |
|  JSON 节点核心属性映射表：                                                         |
|  - id        : 对应 DOM ID 及画布节点的全局唯一标识 (例: "node_input_101")          |
|  - component : 对应渲染的 UI 组件 / 物料类型 (例: "pro-table", "el-button")        |
|  - name      : 对应表单项属性 / 数据绑定的 Key 字段 (例: "username", "pageNo")     |
|  - click     : 对应点击等原生/组件交互触发事件 (例: { actionChain: [...] })       |
|  - functions : 对应当前作用域/域下的业务逻辑函数与 JS 脚本 (例: { formatData })    |
+-----------------------------------------------------------------------------------+
```

---

## 2. 架构设计哲学与三角关系图

在现代化企级低代码 UI 平台中，“组件”、“接口（数据源）”与“事件（动作）”是构建动态交互页面的三大核心柱石。

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

## 3. 完备的 JSON 桥梁 Schema 定义 (`ComponentNodeBridge`)

基于 JSON 桥梁模型，定义标准化的 TypeScript 强类型接口：

```typescript
// JSON 桥梁节点映射结构
export interface ComponentNodeBridge {
  // 1. 标识映射
  id: string;               // 对应 DOM ID 与节点 ID (例: "node_btn_submit")
  component: string;        // 对应映射的 UI 组件 (例: "el-button", "pro-table")
  name?: string;            // 对应表单项属性 / 数据绑定 key (例: "username", "age")

  // 2. 界面与布局属性
  label: string;            // 拖拽物料显示的文案
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
    i: string;
  };
  props: Record<string, any>;
  attrs: Record<string, any>;
  config?: Record<string, any>;

  // 3. 事件触发映射 (如 click, change)
  click?: EventRuleBridge;  // 点击事件快捷配置
  events?: Record<string, EventRuleBridge>; // 完整事件触发映射表

  // 4. 作用域/域下逻辑处理函数 (Functions)
  functions?: {
    beforeRequest?: string; // 请求前置数据处理函数 (例: "function(params) { return params; }")
    afterResponse?: string; // 响应后置转换函数
    validator?: string;     // 表单自定义校验函数
    customHandler?: string; // 作用域内自定义 JS 逻辑补丁
  };

  // 5. 接口数据源绑定
  apiBinding?: {
    dataSourceId: string;
    autoFetch: boolean;
    targetPropMap: {
      dataProp: string;
      totalProp?: string;
    };
  };
}

export interface EventRuleBridge {
  eventName: string;        // 事件类型 (如 "click", "change")
  enabled: boolean;
  actions: ActionNodeBridge[];
}

export interface ActionNodeBridge {
  id: string;
  type: 'fetch_api' | 'set_state' | 'control_modal' | 'navigate' | 'show_message' | 'custom_script';
  name: string;
  payload: Record<string, any>;
}
```

---

## 4. 数据与事件的单向流向与闭环流程 (Data & Event Lifecycle)

```text
       【1. 拖拉拽与用户交互】
       监听 Drag & Drop 操作 ──► 维护底层 JSON 桥梁树 (JSON Schema Tree)
                                          │
                                          ▼
       【2. 抛出事件 Event / Click】
       组件触发 click/change 事件并携送 JSON 中定义的 name 与 Context Payload
                                          │
                                          ▼
       【3. 动作调度器 Action Dispatcher】
       检索对应 JSON 中的 click/events 映射规则，顺序执行 Action 链
                                          │
      ┌───────────────────────────────────┴───────────────────────────────────┐
      ▼                                                                       ▼
【Action A: set_state】                                              【Action B: fetch_api】
更新 Pinia 全局响应式状态                                             组装接口 Params -> 发送 HTTP 请求
      │                                                                       │
      ▼                                                                       ▼
【4. 状态响应与订阅器】                                               【5. 结合 functions 函数处理】
触发依赖该 State 的其他组件更新                                         执行 JSON 中定义的 functions.afterResponse 数据转换
      │                                                                       │
      └───────────────────────────────────┬───────────────────────────────────┘
                                          ▼
                              【6. 目标组件重绘渲染】
                              ProTable/Component 接收数据并重绘页面
```

---

## 5. 典型企级业务场景映射推演

### 场景：表单提交按钮点击调用删除接口

1. **JSON 桥梁节点**:
```json
{
  "id": "node_btn_delete_01",
  "component": "el-button",
  "name": "deleteButton",
  "label": "删除用户",
  "props": { "type": "danger", "text": "确认删除" },
  "click": {
    "eventName": "click",
    "enabled": true,
    "actions": [
      {
        "id": "act_1",
        "type": "fetch_api",
        "name": "调用删除接口",
        "payload": { "targetApiId": "ds_delete_user" }
      },
      {
        "id": "act_2",
        "type": "show_message",
        "name": "提示删除成功",
        "payload": { "messageType": "success", "messageText": "用户删除成功！" }
      }
    ]
  },
  "functions": {
    "beforeRequest": "function(params) { console.log('准备删除', params); return params; }"
  }
}
```

---

## 6. 低代码可视化配置面板 UX 规范 (Design System)

设计器右侧抽屉面板提供可视化的属性映射器：
1. **【属性 Props & Component】Tab**：配置 `component` 类型与 `name` 表单项属性。
2. **【数据源 API】Tab**：选择接口并配置参数/响应路径。
3. **【事件与动作 (Click/Events)】Tab**：可视化编排 `click` 点击事件响应链。
4. **【逻辑函数 (Functions)】Tab**：编辑当前域下的 `functions` 自定义逻辑处理代码。

---

## 7. 持续跟进与技术演进路线图 (Technical Roadmap)

- [x] **v0.0.1**：基础网格画布、ProForm/ProTable 物料与本地 JSON/SQLite 架构搭建。
- [x] **v0.1.0**：确立以 JSON 为映射桥梁的“组件、接口、事件 (Component-API-Event)”三角架构规范文档。
- [ ] **v0.1.1**：前端实现基于 JSON 桥梁的 `ActionDispatcher` 与 `ApiExecutor` 统一派发引擎。
- [ ] **v0.1.2**：实现侧边抽屉 `functions` 逻辑函数编辑器与 `click` 事件链条可视化编排器。

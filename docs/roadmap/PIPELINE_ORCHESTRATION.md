# 数据与事件管道编排技术规范 (Data & Event Pipeline Orchestration Specification)

## 1. 概述与设计理念

在低代码前端平台中，组件交互、弹窗跳转、页面路由跳转、数据转换以及异步 API 请求往往散落在不同组件的事件处理逻辑中。为了实现高内聚、低耦合、可视化及可审计的低代码交互系统，平台将**弹窗跳转、页面跳转、组件联动与数据响应**统一抽象为 **管道编排 (Pipeline Orchestration)** 模式。

管道编排的核心理念是：**将任何交互行为看作一个从“输入 (Input)”经过“生命周期处理与数据转换 (Lifecycle & Transform)”最终到达“输出与动作响应 (Output & Action)”的单向管道流**。

```text
[触发源 (Trigger Source)]
       │
       ▼ (Input Payload)
┌─────────────────────────────────────────────────────────────┐
│ 管道处理流 (Event Pipeline)                                  │
│                                                             │
│  1. beforeTransform (前置生命周期 / 参数校验 / 拦截)           │
│     └── 校验输入参数合法性                                   │
│                                                             │
│  2. asyncFetch / scriptTransform (数据清洗与异步 API)        │
│     └── 调用后端 API / SQLite 数据查询 / 执行 JavaScript 转换 │
│                                                             │
│  3. afterTransform (后置生命周期 / 状态刷新 / 审计记录)        │
│     └── 记录操作日志 / 写入目标上下文                        │
└─────────────────────────────────────────────────────────────┘
       │
       ▼ (Output & Action Outcome)
[终点动作 (Action Outcome)]
 ├── 打开/关闭弹窗图层 (Dialog Layer Action)
 ├── 页面路由跳转 (Router Navigation)
 ├── 组件属性/状态更新 (Component State Sync)
 └── 全局遮罩/提示 (Loading & Toast Notification)
```

---

## 2. 管道核心架构与组成部分

管道模型划分为三个主要阶段：输入端 (Input Source)、生命周期与数据转换节点 (Lifecycle & Transform Nodes) 以及输出与动作响应端 (Output & Action Outcome)。

### 2.1 管道输入端 (Input Source)
管道可以由多种触发源建立：
* **组件级事件 (Component Event)**：如按钮点击 `click`、表格行点击 `row-click`、表单提交 `submit`、下拉框选中 `change`。
* **图层生命周期 (Layer Lifecycle)**：如自定义 HTML 图层挂载 `onMounted` 触发初始化数据加载管道。
* **页面与路由事件 (Page & Route Event)**：页面首次加载 `onPageLoad`、URL Query 监听。

### 2.2 管道生命周期与转换节点 (Pipeline Lifecycle & Transform Nodes)
管道中间段由一系列可流转的生命周期钩子和数据转换节点组成：
1. **`beforeTransform(input, context)`**：
   * 前置拦截器与参数校验。
   * 支持返回 `false` 终止管道执行，或返回清洗后的 `input` 参数。
2. **`asyncFetch(input)`**：
   * 执行 HTTP/REST API 请求或 SQLite 引擎查询，支持全局 Loading 自动联动。
3. **`scriptTransform(input, context)`**：
   * 安全沙箱内执行用户定义的 JavaScript 函数，进行数据结构重构与字段映射。
4. **`afterTransform(output, context)`**：
   * 后置生命周期钩子，触发审计日志记录 (`auditLog`)、上下文更新或状态通知。

### 2.3 管道输出与动作端 (Output & Action Outcome)
管道执行完毕后，将处理好的数据（Payload）传递给指定的动作终点：
* **图层动作 (Layer Action)**：
  * `openDialog(layerId, payload)`：打开指定弹窗图层并注入数据。
  * `closeDialog(layerId)`：关闭指定弹窗图层。
  * `toggleLoading(layerId, visible)`：控制特定图层或全局遮罩。
* **页面路由动作 (Navigation Action)**：
  * `navigateTo(path, query)`：内部 Vue Router 页面跳转。
  * `redirectTo(url)`：外部 URL 重定向。
* **组件/状态联动 (State & Component Action)**：
  * `setComponentProps(nodeId, props)`：更新画布中其他组件的属性。
  * `triggerComponentMethod(nodeId, method, args)`：主动调用特定组件暴露的方法（如 `table.reload()`）。

---

## 3. Schema JSON 定义规范

管道在 `PageSchema` 中由 `pipelines` 数组集中声明与编排：

```json
{
  "pipelines": [
    {
      "id": "pipe_view_user_detail",
      "name": "查看用户详情并打开弹窗管道",
      "trigger": {
        "nodeId": "btn_view_detail",
        "event": "click"
      },
      "input": {
        "source": "table_user.selectedRow"
      },
      "lifecycle": {
        "beforeTransform": "if (!input || !input.id) return false; return input;",
        "scriptTransform": "const res = await fetch('/api/users/' + input.id); return await res.json();",
        "afterTransform": "console.log('数据转化完成', output);"
      },
      "output": {
        "actionType": "openDialog",
        "targetLayerId": "dialog_user_detail",
        "payloadMapping": {
          "userInfo": "$output.data"
        }
      }
    },
    {
      "id": "pipe_navigate_to_order",
      "name": "页面路由跳转管道",
      "trigger": {
        "nodeId": "btn_go_order",
        "event": "click"
      },
      "input": {
        "source": "form.orderId"
      },
      "output": {
        "actionType": "navigateTo",
        "targetPath": "/orders/detail",
        "queryMapping": {
          "id": "$input"
        }
      }
    }
  ]
}
```

---

## 4. 管道编排与生命周期 (Lifecycle) 的协同与辨析

管道编排与生命周期**完全不冲突，两者是天生一对的互补与协同关系**，完全在低代码平台中同时存在。

### 4.1 职责分工与维度对比
* **生命周期 (Lifecycle)**：回答 **“什么时候 (When)”** 的问题。它是组件、图层或页面在特定时刻（如 `onMounted` 挂载、`onUnmounted` 卸载、`onUpdated` 更新）抛出的被动时间钩子。
* **管道编排 (Pipeline Orchestration)**：回答 **“怎么做、数据怎么流转 (How & What Flow)”** 的问题。它是处理数据转换、异步 API 交互、状态同步与终点动作的主动数据与事件流引擎。

| 维度 | 生命周期 (Lifecycle) | 管道编排 (Pipeline Orchestration) |
| :--- | :--- | :--- |
| **关注核心** | 状态节点与时刻 (When) | 数据流转与动作链 (How & What) |
| **触发机制** | 由 Vue/DOM 系统自动抛出 (如 `onMounted`) | 由生命周期钩子、UI 事件或 API 调起 |
| **逻辑复杂度** | 适合简短的节点初始化/清理逻辑 | 适合复杂的跨组件、跨图层、异步 API 编排 |
| **协同关系** | **生命周期是管道的“入口发令枪”，管道是生命周期的“执行载体”** |

### 4.2 两者的协同工作范式

#### 1. 生命周期作为管道的入口触发源 (Input Trigger)
当图层或组件到达某个生命周期时刻（例如自定义 HTML 图层挂载 `onMounted`）时，自动调起一个编排好的管道。
> **场景**：`onMounted` 发令枪响 -> 启动初始化管道 -> `beforeTransform` 提取 URL Query -> `asyncFetch` 调用 API 获取详情 -> `scriptTransform` 数据清洗 -> `output` 渲染到画布组件。

#### 2. 管道内部包含阶段性生命周期节点 (Pipeline Internal Lifecycles)
管道在被调起执行的过程中，自身也具备清晰的流转生命周期钩子（如 `beforeTransform` 前置校验、`afterTransform` 后置审计），确保每一阶段数据流可控、可拦截、可留痕。

---

## 5. 架构优势与演进方向

1. **完全解耦与高复用性**：
   组件不再绑定具体的业务代码或跳转逻辑。按钮只负责发送 `click` 事件，弹窗只负责接收数据展示，一切交互关系由管道进行统一编排管理。
2. **全链路日志与审计 (Audit Ready)**：
   得益于统一的管道控制器，系统的每一次交互均可捕获完整的轨迹：`Trigger` -> `Input` -> `Transform Duration` -> `Output Action`，方便在线调试与审计。
3. **面向可视化连线编排 (Flow Graph Ready)**：
   声明式的 Schema 结构能够极易地转换为节点流程图（Flow / Dagre Node Graph），为后续版本中支持拖拽连线的可视化逻辑编排（Visual Flow Engine）奠定基础。

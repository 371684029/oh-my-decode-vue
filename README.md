# 低代码前端可视化平台 (Low-Code Frontend Platform)

> 高性能、高可扩展性、高度模块化的企级 Vue 3 低代码可视化前端搭建平台与出码引擎。

![低代码可视化编辑器界面预览](docs/assets/preview.png)

---

## 📖 项目简介

本项目旨在打造一款可通过**可视化拖拉拽**快速生成 Vue 3 页面的低代码平台。平台以 **JSON Schema 为唯一映射桥梁**连接 UI 组件层。当前版本 **v1.12.0**：导出语料库时，同一页面各写一条 Vue 组件和一条 HTML 组件。完整管道编排与远程物料仍在规划中（详见 `docs/`）。

项目采用了 **Node.js + Express + SQLite** 架构，其中页面/组件的 Schema 配置文件**直接存储为本地 `.json` 文件**，而 SQLite 数据库专用于记录高可靠的**操作审计日志 (Operation Audit Logs)**。

---

## ✨ 核心特性

> 状态标注：✅ 已实现　🔜 规划中/未实现（详见 `docs/` 各版本规划文档）

- **✅ 可视化网格布局引擎**：集成 `vue3-grid-layout-next` 拖拽画布，支持组件拖投放置、自由缩放拉伸、自动响应式网格布局、对齐参考线与吸附指示。
- **✅ 丰富的分类物料库**：
  - **自有高端组件 (Pro Components)**：`高端表格 (ProTable)`（支持列可视化定义、排序、分页、操作列按钮）、`高端表单 (ProForm)`（支持多列布局、多类型表单控件与必填校验）。
  - **Element-UI 组件 (Native UI Components)**：`按钮 (Button)`、`输入框 (Input)`、`卡片 (Card)`、`标签 (Tag)`、`警告提示 (Alert)`、`开关 (Switch)`、`分割线 (Divider)` 等。
- **✅ 可视化属性配置抽屉 (Property Drawer)**：
  - **属性 Props**：实时修改组件外观与原生属性。
  - **高级 Config**：动态可视化增删/重排表格列定义及表单项。
  - **原生 Attrs**：动态透传原生 HTML 属性。
  - **JSON 源码预览**：实时生成并渲染对应 Schema，支持一键复制。
- **✅ 存储与审计解耦架构**：
  - **JSON 文件直接存储**： Schema 数据写入后端 `storage/pages/{page_id}.json`，实现极佳的人类可读性与无缝 Git 版本追踪（原子写入 + 备份）。
  - **SQLite 审计留痕**：所有的修改、保存与删除操作均自动落盘至 SQLite 操作日志表（`logs.db`）。
- **✅ 多图层系统**：弹窗 (Dialog) / Loading 遮罩 / 自定义 HTML 三种图层，支持显隐切换、zIndex 管理与生命周期脚本钩子。
- **✅ 多目标出码引擎**：Vue 3 SFC (`.vue`) / W3C Web Component (`.js`，配套 PageTemplate.vue) / 独立 HTML (`.html`，CDN 完整渲染) 三目标均为**完整渲染**，并对用户配置内容做 HTML 转义与标签名安全化。
- **✅ 数据驱动能力**：接口数据源绑定（`apiBinding`）、表达式绑定真实渲染（`{{ }}`）、事件动作链（从列表选择目标；失败即停止），出码产物生成带 10 秒超时的前端 `fetch`。
- **✅ 操作历史与自动保存**：撤销/重做覆盖布局和属性修改（连续输入合并成一步，并按体积丢弃最早快照）、复制/粘贴/删除快捷键、3 分钟无感自动保存。
- **✅ 安全加固**：后端 Schema 落盘前 Zod 强校验（结构、脚本/HTML 长度、id 禁止路径字符）；表达式求值器为受限解释器（拒绝函数调用/赋值/原型链访问，不使用 `eval`），出码只内联通过该解释器的表达式；自定义 HTML 在设计器和导出页面都放进 sandbox iframe；API 默认只监听 `127.0.0.1`，CORS 默认只放行本地设计器。
- **✅ 工程化与质量**：Vitest 单元测试（前端 69、后端 5）、ESLint + Prettier（0 error / 0 warning）、GitHub Actions CI（双 Node 版本）、`shared` 共享类型包、Element Plus 按需引入。

### 🔜 规划中的核心能力（详见 `docs/`）

- **Component - API - Event (CAE) 三角解耦模型**：REST 数据源与最小动作链已实现；GraphQL、Event Flow Orchestrator 仍规划中。
- **数据与事件管道编排 (Pipeline Orchestration)**：`beforeTransform` / `asyncFetch` / `scriptTransform` / `afterTransform` 生命周期管道、页面路由跳转 — 规划中。
- **组件 I/O 契约强校验**、**Module Federation 远程物料插件**、**可视化逻辑流编排** — 规划中。

---

## 🏗️ 架构设计哲学 (Architecture)

### 1. JSON 桥梁模型 (The JSON Bridge Concept) ✅

平台通过监听用户的拖拉拽与属性配置操作，实时构建并维护一个可序列化的 **JSON 树**。JSON 既是视图渲染的凭证，也是连接组件、接口与事件的唯一桥梁。

核心属性 Key 规范：

- `id`: DOM ID 与画布节点的全局唯一标识。✅
- `component`: 对应的 UI 组件 / 物料类型。✅
- `name`: 对应的表单项属性 / 数据绑定 Key。🟡 (基础表单字段已用)
- `click`: 点击事件动作链（刷新数据、开关弹窗、消息、写入 state）。✅
- `functions`: 对应作用域/域下的逻辑处理函数与业务脚本。🔜 规划中

### 2. Component - API - Event (CAE) 三角解耦模型 🟡 最小闭环已落地

> 组件渲染、`apiBinding` 数据源和 click 动作链已经接通。GraphQL、可视化流程编排和完整管道仍按下方蓝图演进。

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

---

## 🛠️ 技术栈选型

| 层级              | 技术选型              | 版本/组件        | 说明                                               |
| :---------------- | :-------------------- | :--------------- | :------------------------------------------------- |
| **前端框架**      | Vue 3                 | `3.5+`           | Composition API 及 `<script setup>` 范式           |
| **UI 组件库**     | Element Plus          | `2.x`            | 企级 UI 物料与高端表单/表格（按需引入）            |
| **拖拽布局引擎**  | vue3-grid-layout-next | `1.x`            | 基于栅格网格的可伸缩拖拽布局插件                   |
| **状态管理**      | Pinia                 | `4.x`            | 响应式 Store，管理设计器全局 Schema 状态           |
| **前端构建**      | Vite                  | `8.x`            | 极速冷启动与 HMR 构建工具（rolldown 内核）         |
| **表达式求值**    | 自研受限解释器        | —                | `{{ }}` 表达式安全求值（拒绝 eval / new Function） |
| **HTML 消毒**     | DOMPurify             | `3.x`            | 自定义 HTML 写入 iframe 文档前消毒                 |
| **后端运行环境**  | Node.js               | `20+` / `22+`    | JavaScript 运行环境（CI 覆盖 20 与 22）            |
| **后端 Web 框架** | Express               | `4.x`            | RESTful API 服务框架                               |
| **Schema 校验**   | Zod                   | `4.x`            | 页面 Schema 落盘前结构强校验与字段长度限制         |
| **JSON 文件存储** | Node File System      | `fs/promises`    | 持久化存储 Schema JSON 配置文件                    |
| **日志数据库**    | SQLite                | `better-sqlite3` | 本地轻量级审计日志数据库                           |
| **共享类型**      | `@lowcode/shared`     | —                | Monorepo 共享类型包，消除前后端类型漂移            |
| **单元测试**      | Vitest                | `4.x`            | 前端与后端：Store / 出码 / 表达式 / 数据源 / 存储  |
| **代码规范**      | ESLint + Prettier     | `10.x` / `3.x`   | 0 error / 0 warning，统一代码风格                  |
| **CI/CD**         | GitHub Actions        | —                | 双 Node 版本：typecheck → lint → test → build      |
| **工程化 & 规范** | TypeScript            | `6.x`            | 前后端与 shared 使用同一主版本                     |

---

## 📂 项目工程目录结构

```text
low-code-platform/
├── .github/workflows/      # GitHub Actions CI（typecheck → lint → test → build）
├── docs/                   # 文档集
│   ├── implemented/        # 技术规范 (CAE/物料/组件 I/O/管道编排) 与优化报告
│   └── roadmap/            # 各版本规划与路线图 (0.x ~ 3.0.0，含 v1.3.0 至 v1.12.0)
├── shared/                 # 共享类型包 @lowcode/shared（纯类型，前后端共用）
│   └── src/index.ts        # ComponentNode / PageSchema / LayerConfig / MaterialItem ...
├── frontend/               # Vue 3 前端低代码设计器工程
│   ├── src/
│   │   ├── components/     # 设计器 UI 组件 (CanvasContainer, MaterialList, PropertyDrawer ...)
│   │   ├── registry/       # 物料注册 (materials.ts) 与已登记节点类型 (nodeTypes.ts)
│   │   ├── stores/         # Pinia 全局设计器 Store (designerStore.ts)
│   │   ├── utils/          # 出码 (codeGenerator.ts) / 表达式 (expression.ts) / 数据源 (dataSource.ts)
│   │   ├── types/          # 类型 re-export（统一来自 @lowcode/shared）
│   │   ├── *.test.ts       # Vitest 单元测试（Store / 出码引擎 / 表达式求值器）
│   │   └── App.vue         # 主应用与 API 联调界面
│   ├── .env / .env.example # VITE_API_BASE 环境变量
│   ├── eslint.config.js    # ESLint flat config（vue + TS + prettier 协调）
│   ├── vitest.config.ts
│   ├── package.json
│   └── vite.config.ts      # unplugin 按需引入 + vendor 分包
├── backend/                # Node.js + Express 后端服务工程
│   ├── src/
│   │   ├── controllers/    # JSON Schema CRUD 与日志控制器
│   │   ├── middleware/     # X-Api-Key 认证
│   │   ├── db/             # SQLite logs.db 初始化脚本
│   │   ├── services/       # 文件读写存储服务 (storageService.ts)
│   │   ├── validation/     # Zod 落盘强校验 (schemaValidation.ts)
│   │   └── server.ts       # Express 服务入口
│   ├── storage/            # JSON 文件持久化存储目录
│   │   ├── pages/          # 页面配置 JSON 集合 (*.json)
│   │   └── components/     # 组件配置 JSON 集合 (*.json)
│   ├── data/               # SQLite 数据库存储目录 (logs.db)
│   ├── eslint.config.mjs   # ESLint flat config（TS + prettier 协调）
│   ├── package.json
│   └── tsconfig.json
├── package.json            # Root Monorepo 脚本（build / test / lint / typecheck）
└── README.md
```

---

## 🚀 快速开始与开发指南

### 1. 安装依赖

```bash
# 在项目根目录下安装所有 Workspaces 依赖
npm install
```

### 2. 启动开发服务器

```bash
# 启动后端 REST API 服务 (运行于 http://localhost:3001)
npm run dev:backend

# 启动前端 Vite 低代码设计器 (运行于 http://localhost:5173)
npm run dev:frontend
```

### 3. 构建与打包

```bash
# 对前端与后端同时进行 TypeScript 类型检查与生产编译打包
npm run build
```

### 4. 质量检查（CI 同款命令）

```bash
npm run typecheck   # 前后端类型检查
npm run lint        # ESLint（0 error / 0 warning 门槛）
npm run test        # Vitest：前端 69 用例 + 后端 5 用例
npm run format      # Prettier 全仓格式化
```

---

## 🔌 后端 RESTful API 接口定义

| 请求方式   | 路径                       | 描述                                                                                          | 参数 / Body                       |
| :--------- | :------------------------- | :-------------------------------------------------------------------------------------------- | :-------------------------------- |
| **GET**    | `/api/schemas`             | 获取页面/组件 JSON 列表                                                                       | `?type=page` 或 `?type=component` |
| **GET**    | `/api/schemas/:id`         | 读取指定 ID 的 Schema 内容                                                                    | `?type=page`                      |
| **POST**   | `/api/schemas`             | 保存 Schema 至本地 `.json` 文件并记录 SQLite 日志（落盘前 Zod 结构强校验 + 脚本字段长度上限） | Body: `PageSchema` JSON 对象      |
| **DELETE** | `/api/schemas/:id`         | 删除 Schema 配置文件并记录 SQLite 日志                                                        | `?type=page`                      |
| **GET**    | `/api/logs`                | 查询 SQLite 操作审计日志                                                                      | `?pageId=xxx` (可选)              |
| **GET**    | `/api/schemas/:id/backups` | 列出该 Schema 的备份代数                                                                      | `?type=page`                      |
| **POST**   | `/api/schemas/:id/restore` | 从指定备份代恢复                                                                              | Body: `{ "index": 1 }`            |

配置了环境变量 `API_KEY` 后，以上接口要求请求头 `X-Api-Key`。`CORS_ORIGIN` 默认 `http://localhost:5173`，`HOST` 默认 `127.0.0.1`。

`VITE_API_KEY` 会打进前端包，只适合挡住对本机端口的随意扫描，不能当作用户口令或服务端机密。未配置 `API_KEY` 时接口保持开放，方便本地开发。

---

## 📝 版本变更历史 (Changelog)

### 📌 v1.12.0 (当前版本 - 2026-09)

- **语料库导出**：同一页面写成 JSONL 里的两行，一行是 Vue 单文件组件，一行是独立 HTML。默认收当前画布，也可以并入已保存页面。

### 📌 v1.11.0 (2026-09)

- **出码跟画布用同一份配置**：表单占位提示、必填、标签宽度和内联布局会写进 Vue 组件、Web Component 配套组件和独立 HTML。
- **表格不再另写一套**：分页大小跟配置走，请求参数使用同一个 `size`。没有行按钮时不再补一列「查看」。

### 📌 v1.10.0 (2026-09)

- **改数据源不再丢掉 Mock**：打开组件或修改参数时，地址没变就保留响应示例。参数还不是合法 JSON 时，沿用上次保存的参数并给出提示。
- **配置可以排序**：表格列和表单项可以上移、下移，表单项可以改占位提示。画布按这个顺序渲染。
- **抽屉不再挡住顶栏**：顶栏按钮在属性面板打开时仍可点击。设计器界面和抽屉里的选项改为中文。

### 📌 v1.9.0 (2026-09)

- **一键 Mock**：还没填地址的高端表格和高端表单会补上 `/api/mock/` 数据源。设计器直接返回响应示例，已有地址不会被覆盖。出码仍只请求该路径，不把示例写进脚本。
- **接口文档**：同一操作和导出对话框都会给出方法、路径、参数和响应示例，可复制或下载 `api.md`。

### 📌 v1.8.0 (2026-09)

- **已保存页面可收尾**：画布上可以直接改标题。载入读取完整 Schema。列表里可以删除，也可以恢复上一份备份。
- **纯预览不再露出搭建控件**：预览时不能拖拽、缩放或删除组件，按钮和表单仍然可以操作。退出预览后编辑能力恢复。
- **下拉选项可编辑**：表单 Select 可以增删选项的显示文字和值，设计器与出码使用同一份选项。

### 📌 v1.7.0 (2026-09)

- **表单必填拦截提交**：输入框、下拉框和日期为空时，设计器和导出页面都停住并指出未填项；填完才执行 `submit` 动作。开关的 `false` 不算未填。
- **按表达式显隐**：组件可写 `{{ state.show === true }}`。无法安全求值的表达式保持显示，不会写进生成代码。
- **动作按条件跳过**：动作上的 `when` 为假时跳过这一条，后面的动作继续执行。
- **页面初始状态**：物料面板可以增删改 `state` 的键和 JSON 值，显隐和动作立刻按新值求值。

### 📌 v1.6.0 (2026-09)

- **出码不再被用户字符串打断**：URL 换行留在注释里，非法属性名丢弃，样式值去掉会闭合声明的字符。
- **多表单按 id 分支**：提交和重置按 `formId` 取对应表单数据；输入框和开关各自声明数据。
- **表格占位与分页**：未绑定数据源时设计器和出码使用同一组占位行；导出页面翻页会再次请求。
- **行操作与弹窗载荷**：表格行按钮执行对应事件动作链；打开弹窗时把载荷写入页面状态。
- **表达式与图层初始可见性**：能通过白名单的 `{{ }}` 内联进模板，其余保持转义字符串；新建弹窗和 Loading 默认隐藏，导出初始值跟 `layer.visible`。
- **粘贴、变量名与存储**：粘贴重写子孙 id；页面级标识符冲突时加短哈希；页面和组件备份分目录，版本递增和删除走同一写队列。
- **请求与状态写入**：跟随重定向时重新检查每一跳；`__proto__` 等键不会写进页面状态。
- **自定义 HTML 与密钥比较**：设计器和出码共用同一份 srcdoc 清洗；启用 `API_KEY` 时用哈希后的定长时间比较。`VITE_API_KEY` 会打进前端包，不是用户口令。
- **审计差异与撤销**：第二次保存记下 JSON Patch；拖拽松手记一步，历史栈以快照加补丁存储。
- **组件入参提示**：表格列、表单项、容器标题缺失时抽屉给出警告，不拦截保存。

### 📌 v1.5.0 (2026-09)

- **出码表达式白名单**：只有受限解释器能完整解析的 `{{ }}` 才会内联进生成代码；响应路径只接受标识符和下标，非法片段不会拼进 JavaScript。
- **属性修改可撤销**：直接改属性、数据源和事件时记下变更前快照，连续输入合并成一步；历史栈按体积丢弃最早的快照。
- **大纲跟随当前图层**：进入弹窗或其它图层编辑时，大纲显示该图层的节点树，嵌套子节点可删除。
- **事件目标改为选择**：动作链从组件和图层列表里选目标；某一步失败后停止后续动作。
- **容器内排序**：弹性容器里的子节点可以前移、后移。
- **自定义 HTML 导出隔离**：出码改为 sandbox iframe 的 srcdoc，不再把脚本用 `new Function` 放进页面。
- **数据源请求约束**：仅允许 http(s) 和站内相对路径，拦截云元数据地址，请求 10 秒超时。
- **工具链对齐**：后端与 shared 的 TypeScript 升到 6.x，与前端一致。

### 📌 v1.3.0

- **数据驱动能力**：组件支持 `apiBinding` 接口数据源绑定（URL/方法/参数/响应路径/分页路径/自动请求），设计器"试请求"实时预览，出码产物生成真实前端 `fetch` 调用（不生成后端代码）。
- **表达式绑定真实渲染**：`{{ state.xxx }}` 表达式从属性面板预览升级为画布组件实时求值。
- **事件动作链 (Action Chain)**：组件 `click` 事件可编排动作链（刷新数据 / 打开/关闭弹窗 / Loading 控制 / 消息提示 / 状态更新），页面从展示变为可交互。
- **配套加固**：后端 `X-Api-Key` 认证（可配置开关）、Schema 版本化保存与回滚、备份轮转与恢复接口、并发写保护、嵌套容器递归渲染、导出代码语法高亮、docs 分区、axios 统一错误降级。
- **同一版本内的补强**：主画布与 canvas 图层共用一份 `children`；弹窗出码带上图层内组件；容器可拖入子节点；自定义 HTML 预览改为 sandbox iframe；出码把 HTML/脚本放进转义字符串；备份路径拒绝 `../`；API 默认只监听本机并收紧 CORS。

### 📌 v1.2.0

- **多图层堆叠架构**：新增弹窗 (Dialog)、Loading 遮罩、自定义 HTML 三种业务图层，支持图层显隐切换与 zIndex 层级管理。
- **图层生命周期钩子**：自定义 HTML 图层支持 `onMounted` / `onUpdated` / `onUnmounted` 生命周期脚本注入，实现数据加载、DOM 操作与清理逻辑。
- **出码引擎完整渲染**：Web Component（配套 PageTemplate.vue）与独立 HTML（CDN 渲染）由演示级升级为**完整渲染**。
- **工程化与安全加固**：Vitest 单元测试（59 用例）、ESLint + Prettier（0 error / 0 warning）、GitHub Actions CI、Zod 落盘强校验、受限表达式求值器（移除 `new Function`）、DOMPurify HTML 消毒、`@lowcode/shared` 共享类型包、Element Plus 按需引入（业务代码体积 -95%）、出码输入转义（防注入破坏生成代码）。

### 📌 v1.1.0

- **画布对齐参考线与吸附指示**：拖拽/缩放组件时实时计算与相邻组件的边缘/中心对齐参考线并高亮吸附。
- **键盘方向键微调**：支持方向键 (可组合 Shift 加速) 精确微调选中组件的网格位置。
- **操作审计日志可视化**：操作日志详情支持 JSON 结构化快照查看。

### 📌 v1.0.0 (Base GA)

- **基础正式版发布**：可视化拖拽布局、分类物料库与属性配置抽屉、双通道存储 (JSON 文件 + SQLite 审计) 全链路打通。
- **30 步撤销/重做历史栈**：集成 `Ctrl+Z` / `Ctrl+Y` / `Ctrl+C` / `Ctrl+V` / `Delete` 快捷键。
- **静默 3 分钟自动保存**：无感后台 JSON 保存机制，右下角淡雅加载指示器。
- **多目标出码引擎**：一键生成 Vue 3 Composition API SFC (`.vue`) 源码；Web Component 与独立 HTML 导出当前为**演示级渲染**（规划中升级为完整渲染）。

### 📌 v0.3.0

- **多端响应式视图切换**：画布顶部支持一键切换桌面端 (100%)、笔记本 (1366px)、平板 (768px) 及移动端 (375px) 预览，网格列数自适应缩放。
- **动态 JS 表达式解析**：新增 `frontend/src/utils/expression.ts`，支持组件属性绑定 `{{ ... }}` 动态模板表达式。
- **嵌套弹性容器**：新增 `pro-container` (FlexContainer) 嵌套容器物料，支持组件自由嵌套与布局调整。
- **全项目版本同步**：全量升级 Monorepo (`root`, `frontend`, `backend`) 版本标签至 `v0.3.0`。

### 📌 v0.2.0

- **静默 3 分钟自动保存**：实现无感后台 JSON 保存机制，右下角带有淡雅的加载指示器。
- **多目标零废码出码引擎**：支持一键生成 Vue 3 Composition API SFC (`.vue`)、W3C Web Components (`.js`) 与单页独立 HTML (`.html`)。
- **30 步撤销/重做历史栈**：Pinia 全局撤销/重做支持，集成 `Ctrl+Z` / `Ctrl+Y` / `Ctrl+C` / `Ctrl+V` / `Delete` 快捷键，且自动排除文本输入框焦点。

### 📌 v0.0.1

- **低代码平台基础Scaffold**：搭建基于 Vue 3 + Element Plus + Pinia + `vue3-grid-layout-next` + Node.js + Express + SQLite 的全栈 Monorepo。
- **核心物料与属性抽屉**：实现 `ProTable`（高端表格）、`ProForm`（高端表单）及 Element Plus 原生 UI 物料。
- **存储与审计双通道**：页面 Schema 直接存为本地 `.json` 文件，操作审计日志自动落盘 SQLite (`logs.db`)。

---

## 📄 文档索引 (Documentation Index)

文档按类型分为两个分区，版本规划与技术规范不混放：

- **`docs/implemented/`**：技术规范与优化报告（契约、物料、组件 I/O、管道编排）
- **`docs/roadmap/`**：各版本规划与路线图（含已发布版本的规划记录，以及尚未落地的方向）

### 📘 技术规范 (docs/implemented/)

1. **[Component - API - Event 三角解耦规范](docs/implemented/COMPONENT_API_EVENT_MAPPING.md)**：包含完整的 Schema 契约与 JSON 桥梁模型（部分能力见 v1.3.0 数据驱动实现）。
2. **[低代码物料解析规范与技术对比指南](docs/implemented/MATERIAL_SPECIFICATION.md)**：包含 Vue 源码 (.vue) 与编译 JS (.js) 的解析机制、兼容性、扩展性对比及混合架构最佳落地建议。
3. **[自制组件入参/出参规范与契约强校验指南](docs/implemented/COMPONENT_IO_SPECIFICATION.md)**：包含自制物料组件必填 Inputs/Outputs 参数定义、类型约束、属性抽屉强校验规则。
4. **[数据与事件管道编排技术规范](docs/implemented/PIPELINE_ORCHESTRATION.md)**：包含组件、图层（弹窗/遮罩）、页面路由跳转、生命周期钩子与异步 API 数据流的可视化管道编排架构规范。
5. **[v0.2.0 已实现功能排查与优化报告](docs/implemented/0.2.0_OPTIMIZATIONS.md)**：包含 Web Component Shadow DOM 样式穿透、增量保存、历史栈优化、快捷键上下文隔离与代码美化解析器落地方案。

### 🗺️ 版本规划 (docs/roadmap/)

6. **[0.0.1 里程碑规划](docs/roadmap/0.0.1_PLAN.md)**：包含基础拖拽、属性面板与双存储方案。
7. **[0.1.0 接口与事件联动规划](docs/roadmap/0.1.0_PLAN.md)**：包含 API 数据源绑定、参数映射与事件动作链条。
8. **[架构演进与体验优化深度建议](docs/roadmap/ARCH_RECOMMENDATIONS.md)**：包含零废码源码生成器、沙箱预览、时间旅行撤销历史栈、远程物料插件与规则引擎的落地方案。
9. **[平台演进与优化方向指南](docs/roadmap/FUTURE_DIRECTIONS.md)**：包含画布标尺、可视化联动、微前端发布、协同锁、远程物料等尚未落地的方向。文首标明了 v1.3.0 之前已经完成的条目。
10. **[v0.4.0 功能规划与路线图](docs/roadmap/0.4.0_PLAN.md)**：包含节点式可视化逻辑流编排、在线 API 数据源建模与 Mock 仿真、可视化 CSS 与样式微调编辑器、Schema 版本对比与 Diff 工具、第三方物料 SDK。
11. **[v0.5.0 功能规划与路线图](docs/roadmap/0.5.0_PLAN.md)**：包含多工作区多项目物理隔离、自制组件入参/出参强校验规范、简易操作日志可视化控制台。
12. **[v1.0.0 基础正式版 (Base GA) 规划与路线图](docs/roadmap/1.0.0_PLAN.md)**：包含基础拖拽布局、组件 I/O 契约强校验、JSON 文件存储与 SQLite 审计日志控制台、多目标出码与基础页面发布。
13. **[v1.1.0 体验增强版规划](docs/roadmap/1.1.0_PLAN.md)**：包含画布对齐参考线/吸附指示、键盘方向键微调、操作日志可视化 JSON Diff 比对。
14. **[v1.2.0 多图层架构与生命周期规划](docs/roadmap/1.2.0_PLAN.md)**：包含对话框图层、Loading 加载框图层、自定义 HTML 图层及 JavaScript 生命周期钩子。
15. **[v1.3.0 数据驱动能力与体验加固记录](docs/roadmap/1.3.0_PLAN.md)**：数据源绑定、表达式渲染、事件动作链、E2E、后端认证/版本化/备份轮转。该版本已合入 `main`。
16. **[v1.6.0 正确性与一致性加固](docs/roadmap/1.6.0_PLAN.md)**：出码换行注入、多表单分支、输入框状态、表格占位、行操作与分页、表达式出码、图层可见性、备份隔离、重定向校验、审计差异与撤销补丁。已实现。
17. **[v1.7.0 条件交互](docs/roadmap/1.7.0_PLAN.md)**：表单必填拦截提交、组件显隐表达式、动作条件跳过、页面初始状态面板。已实现。
18. **[v1.8.0 核心闭环收尾](docs/roadmap/1.8.0_PLAN.md)**：页面改名、删除与恢复上一份、纯预览去掉搭建控件、表单下拉选项可编辑。已实现。
19. **[v1.9.0 Mock 与接口文档](docs/roadmap/1.9.0_PLAN.md)**：一键为未填地址的表格和表单补 Mock，并产出前端实际调用的接口文档。已实现。
20. **[v1.10.0 交互打磨](docs/roadmap/1.10.0_PLAN.md)**：编辑数据源时保留 Mock 示例、配置项排序、抽屉不再挡住顶栏。已实现。
21. **[v1.11.0 出码与画布对齐](docs/roadmap/1.11.0_PLAN.md)**：Vue、Web Component 配套组件和独立 HTML 使用画布上的占位、标签宽度、分页和行按钮。已实现。
22. **[v1.12.0 语料库导出](docs/roadmap/1.12.0_PLAN.md)**：同一页面导出为 Vue 组件和 HTML 组件两条语料。已实现。
23. **[v3.0.0 远期企业级架构与生态规划](docs/roadmap/3.0.0_PLAN.md)**：包含企业级 RBAC/SSO 单点登录、PostgreSQL/S3 高可用分布式存储、CRDT 多人实时协同、一键 CI/CD 灰度发布、VS Code 插件与 CLI 工具链。

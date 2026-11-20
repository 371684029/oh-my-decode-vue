# 低代码平台 · 红绿线范围规范

| 属性 | 内容 |
|------|------|
| 状态 | **已采纳**；v2.8.0 起为范围裁决的单一事实源 |
| 当前版本 | **v2.9.0**（`package.json`） |
| 关联 | [README.md](../README.md)、[roadmap/2.9.0_PLAN.md](./roadmap/2.9.0_PLAN.md)、[spec-doc-conventions.md](./spec-doc-conventions.md) |
| 参考纪律 | 文档分区与冻结表述对齐 [oh-my-co-work](https://github.com/371684029/oh-my-co-work) 的 `docs/README.md` 维护原则 |

> **怎么用本文**：写代码、开 Issue、提 PR、排版本计划之前，先对照本节。  
> **绿线** = 允许投入（含核心维护）；**红线** = 永久禁止；**冻结线** = 非核心、到大版本前不接受功能 PR。

---

## 0. 当前开发策略（2026-11 起 · v2.9.0+）

| 规则 | 说明 |
|------|------|
| **主攻** | **七大核心护城河**的正确性、安全性、可维护性；**不扩功能面** |
| **允许版本** | v2.10+ 仅承接**结构/测试债务**（如 composable 单测）；v2.9.0 已收口，见 [2.9.0_PLAN.md](./roadmap/2.9.0_PLAN.md) |
| **冻结** | v3.0 / v4.0 归属能力、锦上添花项、非目标项 —— **不写代码、不立项、不接受功能 PR** |
| **例外** | 阻断核心路径的 **P0 bug**（崩溃、白屏、数据丢失、出码不可运行、保存静默丢数据）可在冻结区修 **最小补丁**，须在本文件或对应 plan 留痕 |
| **解冻** | 必须走 [§8 解冻流程](#8-解冻流程)，并写入对应大版本 `plan` |

```
                    ┌─────────────────────────────────────┐
   绿线（可投入）    │ 核心命题 + 七大护城河 + 安全基线     │
                    │ + v2.x 核心维护（测试/类型/结构）    │
                    └─────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
     红线（永不）          冻结线（v3/v4）      冻结线（锦上添花）
     后端业务出码等        管道/协同/云存储      标尺/i18n/流程图…
```

---

## 1. 一句话核心命题（北极星）

**把可视化搭出来的页面，变成结构清晰、可运行、可再次被平台消化的前端代码。**

实现与文档冲突时：**以本节 + 四条理念为准**，并回写 README 与相关 spec。

### 1.1 四条核心理念

| # | 理念 | 裁决要点 |
|---|------|----------|
| 1 | **JSON 是唯一事实来源** | 画布 / 属性 / 事件 / 数据源 / 图层均可序列化为 Schema；保存、载入、出码、导入可往返 |
| 2 | **产物可运行、可读、可往返** | Vue / HTML 能直接跑；`@lowcode-material` 自描述，平台能「消化」自己的产物 |
| 3 | **零废码、不写后端业务代码** | 只做前端可视化与出码；无运行时 `eval` / `new Function` 表达式引擎 |
| 4 | **安全与容错默认开启** | 受限表达式、DOMPurify、Zod 落盘、原子写 + 写队列、悬空引用安全跳过 |

---

## 2. 绿线 — 核心功能（护城河 · 必须护住）

以下 **7 项** 为本项目存在理由；**v2.x 唯一持续演进的功能面**（注意：演进指契约稳定下的体验与正确性，不是堆新子系统）。

| ID | 能力 | 主要代码落点 | 自 v |
|----|------|--------------|------|
| **C01** | 拖拽画布 + 栅格布局 + 对齐吸附（v1.1） | `frontend/src/components/CanvasContainer.vue`、`App.vue`、`composables/useCanvasGrid*` | 1.x |
| **C02** | 内置 + 自定义物料（含 Element 画布物料） | `frontend/src/registry/*`、`MaterialList.vue` | 1.x |
| **C03** | 属性 / 图层 / 显隐 / 页面 `state` | `PropertyDrawer` 及 `drawer/*`、`PageStatePanel.vue` | 1.x |
| **C04** | 数据源 `apiBinding` + 事件动作链 | `apiBindingForm.ts`、Schema `click` / `when`、设计器 fetch | 1.3+ |
| **C05** | 多目标出码 + 语料库 | `frontend/src/utils/codegen/*`、`codeGenerator.ts`、`CodeExportDialog.vue` | 1.x |
| **C06** | 自我循环物料（打包 / 自描述导出 / 导入） | `materialPacker.ts`、`materialImport.ts`、`materialInject.ts` | 2.0 |
| **C07** | 黑盒引用 + 契约 + 版本（草稿/发布/锁定/升级/回滚/fork） | `materialVersionService.ts`、`MaterialManager.vue`、`materialController.ts` | 2.1 |

**本地持久化（横切绿线）**：页面 JSON（`backend/storage/pages`）、物料目录（`materials/<id>/`）、SQLite 审计、Zod 校验、引用保护 —— 归属 **C01–C07 的支撑面**，随核心一起维护。

### 2.1 绿线 — 核心维护工作面（v2.9+ 候选 · 非新功能）

> 来源：[README 核心优化点三轮](./../README.md) 已全部完成；下表为 **M2 遗留维护项**。

| ID | 条目 | 说明 | 归属 |
|----|------|------|------|
| **M01** | 未标注 `catch` 收口 | 生产代码 `catch` 显式 `unknown`（v2.9.0 ✅） | — |
| **M02** | 拆分模块单测 | store 三模块 + `useMaterialVersions` / `useMaterialIO`（v2.9.0 ✅） | — |
| **M03** | 单文件 ≤400 行纪律 | 新代码不得重新堆出巨型文件；超标先拆再合 | 持续 |
| **M04** | CI 同款质量门 | `typecheck` → `lint` → `test` → `build` 全绿才合入 | 持续 |

### 2.2 绿线 — 安全与工程基线（永远允许加固）

| ID | 条目 | 禁止回退 |
|----|------|----------|
| **S01** | 表达式：自研受限解释器，拒绝 `eval` / `new Function` | 红线 |
| **S02** | 出码与预览：输入转义、SSRF 主机黑名单对齐设计器 | 对齐 `isBlockedFetchHost` |
| **S03** | 自定义 HTML：DOMPurify + sandbox iframe | 禁止 inline `new Function` |
| **S04** | 落盘：Zod + 原子写 + 写队列；PATCH 乐观并发 | 禁止绕过校验直写 |
| **S05** | `API_KEY`：可选；`VITE_API_KEY` 非用户口令 | 文档须保持警示 |

---

## 3. 红线 — 永久禁止（触碰即拒 PR）

| ID | 禁止项 | 原因 |
|----|--------|------|
| **R01** | 生成或托管 **后端业务逻辑**（BFF / CRUD 脚手架 / Server Actions 业务） | 非本项目职责 |
| **R02** | **通用运行时渲染引擎**（在线编译任意 SFC、`vue3-sfc-loader` 动态执行第三方源码） | 安全与边界；单独项目评估 |
| **R03** | **内置物料**为单一业务场景定制组件 | 用户应用「自定义物料」解决 |
| **R04** | 表达式 / 动作链引入 **`eval` / `new Function`** | 安全红线 |
| **R05** | 第二套与 Schema 并行的页面配置真相（如独立 DB 字段驱动的并行模型） | 破坏 JSON 桥梁 |
| **R06** | 导出物内含 **不可读、不可再导入** 的私货格式作为主路径 | 破坏可往返 |

---

## 4. 冻结线 — 非核心（到大版本前 · 功能 PR 拒收）

> **冻结 ≠ 删除**：代码可保留；**不优化体验、不加配置、不加依赖**，除非 P0 阻断核心（见 §0）。

### 4.1 归属 v3.0（详见 [3.0.0_PLAN.md](./roadmap/3.0.0_PLAN.md)）

| 能力 | 文档 |
|------|------|
| 管道编排 / Event Flow Orchestrator / 页面路由跳转 | [PIPELINE_ORCHESTRATION.md](./implemented/PIPELINE_ORCHESTRATION.md)（**规范先行，实现冻结**） |
| GraphQL 数据源 | 3.0.0_PLAN |
| 物料市场 / 远程物料 SDK / Module Federation | 3.0.0_PLAN |
| 可视化逻辑流 / 节点式编排 | [0.4.0_PLAN.md](./roadmap/0.4.0_PLAN.md)、FUTURE_DIRECTIONS §2.3 |
| VS Code 插件 / `@lowcode/cli` | ARCH_RECOMMENDATIONS |

### 4.2 归属 v4.0（规划未单独成文）

| 能力 |
|------|
| 多人实时协同 / CRDT |
| RBAC / SSO / 多租户 |
| PostgreSQL / Redis / OSS / 分布式存储 |
| CI/CD 灰度发布 / 一键上云 |

### 4.3 锦上添花 — 低优先级冻结

来源：[FUTURE_DIRECTIONS.md](./roadmap/FUTURE_DIRECTIONS.md) 中 **v1.3.0 前未落地** 部分，包括但不限于：

- 标尺 / 智能吸附辅助线（v1.1 已有基础对齐线，**不再扩标尺子系统**）
- 右键上下文菜单（v2.3 已用右键开属性，**不扩全功能上下文菜单**）
- 可视化联动规则构建器、LogicFlow 流程图编辑器
- 全局主题 CSS 变量系统、i18n 字典引擎
- 正则规则构建器、离线 Mock 沙箱（**v1.9 Mock 已满足主线**）
- 微前端发布、协同编辑锁

### 4.4 已实现周边能力 — 维护冻结（仅 bugfix）

下列能力 **已在产品内**，但 **不属于七大护城河**；冻结期只修 P0，不做体验迭代：

| 能力 | 说明 |
|------|------|
| 多端预览宽度切换（v0.3） | 不扩断点引擎 |
| 对齐参考线 / 方向键微调（v1.1） | 不扩标尺 |
| Mock + 接口文档（v1.9） | 不扩 Mock 平台 |
| 语料库 JSONL（v1.12） | 不扩语料管线 |
| 操作审计日志 UI（v1.1） | 不扩日志平台 |
| E2E（Playwright） | 随核心路径补冒烟即可，不扩覆盖率战役 |

---

## 5. 代码模块 ↔ 红绿映射（评审用）

| 区域 | 路径 | 分类 |
|------|------|------|
| 设计器 UI | `frontend/src/components/**` | 绿（C01–C04） |
| Store / Schema | `frontend/src/stores/**` | 绿 |
| 出码 | `frontend/src/utils/codegen/**`、`codeGenerator.ts` | 绿（C05） |
| 物料循环 | `materialPacker|Import|Inject|Resolver*` | 绿（C06–C07） |
| 表达式 | `frontend/src/utils/expression/**` | 绿 + S01 |
| 共享 | `shared/src/**` | 绿（横切） |
| Schema API | `backend/src/controllers/schemaController.ts`、`storageService.ts` | 绿 |
| 物料 API | `materialController.ts`、`materialVersionService.ts` | 绿（C07） |
| 远期规范纯文档 | `docs/implemented/PIPELINE_ORCHESTRATION.md` | 冻结（无实现承诺） |
| 远期方向 | `docs/roadmap/0.4+` 中未勾选项、`FUTURE_DIRECTIONS.md` | 冻结 |

---

## 6. 新增功能准入检查（五问）

任一答案不满足，**先改 plan / 本文，禁止直接写功能代码**：

1. 是否直接服务于「JSON 桥梁 + 可运行产物」？
2. 能否用现有 Schema / 物料 / 版本模型表达，而非并行机制？
3. 产物是否仍可读、可往返、可再导入？
4. 是否落在 [§3 红线](#3-红线--永久禁止触碰即拒-pr) 或 [§4 冻结线](#4-冻结线--非核心到大版本前--功能-pr-拒收)？
5. 若属核心维护：是否只减少债务、不扩用户可见面？（v2.9 纪律）

---

## 7. PR / Issue 标签约定（建议）

| 标签语义 | 处理 |
|----------|------|
| `scope:core` | 绿线；优先 review |
| `scope:maint` | M01–M04；v2.9 受理 |
| `scope:frozen` | 默认关闭或转 v3/v4 plan 讨论 |
| `scope:redline` | 自动拒绝 |

---

## 8. 解冻流程

1. 在对应大版本打开或更新 `docs/roadmap/<major>_PLAN.md`，写清动机、与核心命题关系、验收标准。
2. 更新 **本节 §4** 将条目迁至绿线或标「vX 已开工」。
3. README「规划中的核心能力」与 [docs/README.md](./README.md) 索引同步。
4. 首 PR 须带 plan 链接；禁止「顺手一起做」跨多个冻结项。

---

## 9. 版本节奏（与范围关系）

| 大版本 | 主题 | 范围 |
|--------|------|------|
| 0.x–1.x | 基础 GA、数据驱动、出码 | 已封板 |
| **2.x** | 物料闭环 + 体验 + **结构债务** | **当前绿线主场** |
| 3.x | 物料生态、管道、远程 | 冻结至 3.0 plan 解冻 |
| 4.x | 企业协同、分布式 | 冻结 |

---

## 10. 文档维护责任

| 变更类型 | 更新文件 |
|----------|----------|
| 范围 / 红绿线 | **本文**（单一事实源） |
| 用户可见能力 / 安装 | [README.md](../README.md) |
| 文档索引 | [docs/README.md](./README.md) |
| 某版本执行计划 | `docs/roadmap/<version>_PLAN.md` |
| 技术契约（CAE / 物料） | `docs/implemented/*.md` |
| 文档写法 | `docs/spec-doc-conventions.md` |

---

## 11. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-11-20 | 初版：从 README「宪法」抽离并强化；对齐 oh-my-co-work 文档分区与冻结纪律；明确 v2.9 维护绿线与模块映射 |
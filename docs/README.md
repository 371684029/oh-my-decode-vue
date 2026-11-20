# 文档索引

当前产品版本：**v2.8.0**（见仓库根 `package.json`）。

上手与截图请先看 [README.md](../README.md)。**范围裁决（红绿线）** 以 [spec-red-green-lines.md](./spec-red-green-lines.md) 为单一事实源。

---

## 分区说明

本仓库文档按 **职责** 分目录，避免规划与规范混放（纪律参考 [oh-my-co-work/docs](https://github.com/371684029/oh-my-co-work/blob/main/docs/README.md)）：

| 目录 / 前缀 | 类别 | 收录内容 |
|-------------|------|----------|
| `docs/spec-*` | **规范类** | 范围红绿线、工程纪律（新增） |
| `docs/implemented/` | **技术规范·已落地** | CAE、物料、组件 I/O、优化报告 |
| `docs/roadmap/` | **版本规划** | 各版本 PLAN / IMPLEMENTATION、远期方向 |
| `docs/assets/` | **素材** | README 截图与示意图 |

约定：

1. **spec-** 管「能不能做」；**roadmap/** 管「什么时候做」；**implemented/** 管「已经怎么做」。
2. 新文档优先放入对应目录；根目录 `docs/` 下仅保留 `spec-*` 与本文索引。
3. 改行为时：至少更新 README + 相关 spec/plan；动范围时 **必须先改** [spec-red-green-lines.md](./spec-red-green-lines.md)。

---

## spec- 规范类

| 文档 | 用途 |
|------|------|
| [spec-red-green-lines.md](./spec-red-green-lines.md) | **红绿线 / 冻结清单 / PR 准入**；v2.x 开发策略 |

---

## implemented/ 技术规范（已落地契约）

| 文档 | 用途 |
|------|------|
| [COMPONENT_API_EVENT_MAPPING.md](./implemented/COMPONENT_API_EVENT_MAPPING.md) | CAE 三角、Schema 桥梁（部分能力 v1.3+） |
| [MATERIAL_SPECIFICATION.md](./implemented/MATERIAL_SPECIFICATION.md) | 物料解析、Vue/JS 对比 |
| [COMPONENT_IO_SPECIFICATION.md](./implemented/COMPONENT_IO_SPECIFICATION.md) | 自制组件 inputs/outputs 契约 |
| [PIPELINE_ORCHESTRATION.md](./implemented/PIPELINE_ORCHESTRATION.md) | 管道编排 **远期规范**（v3.0 前 **实现冻结**） |
| [0.2.0_OPTIMIZATIONS.md](./implemented/0.2.0_OPTIMIZATIONS.md) | v0.2.0 优化报告（增量保存、历史栈等） |

---

## roadmap/ 版本规划

### 早期 ~ 1.x

| 文档 | 状态 |
|------|------|
| [0.0.1_PLAN.md](./roadmap/0.0.1_PLAN.md) | 已落地 |
| [0.1.0_PLAN.md](./roadmap/0.1.0_PLAN.md) | 已落地 |
| [0.4.0_PLAN.md](./roadmap/0.4.0_PLAN.md) | 远期 / 冻结 |
| [0.5.0_PLAN.md](./roadmap/0.5.0_PLAN.md) | 部分 / 冻结 |
| [1.0.0_PLAN.md](./roadmap/1.0.0_PLAN.md) ~ [1.12.0_PLAN.md](./roadmap/1.12.0_PLAN.md) | 已落地 |
| [ARCH_RECOMMENDATIONS.md](./roadmap/ARCH_RECOMMENDATIONS.md) | 建议集；未采纳项视为冻结 |
| [FUTURE_DIRECTIONS.md](./roadmap/FUTURE_DIRECTIONS.md) | 方向指南；见文首进度 |

### 2.x（当前主线 · 结构债务）

| 文档 | 状态 |
|------|------|
| [2.0.0_PLAN.md](./roadmap/2.0.0_PLAN.md) | 已落地 |
| [2.1.0_PLAN.md](./roadmap/2.1.0_PLAN.md) / [2.1.0_IMPLEMENTATION.md](./roadmap/2.1.0_IMPLEMENTATION.md) | 已落地 |
| [2.3.0_PLAN.md](./roadmap/2.3.0_PLAN.md) / [2.3.0_IMPLEMENTATION.md](./roadmap/2.3.0_IMPLEMENTATION.md) | 已落地 |
| [2.6.0_PLAN.md](./roadmap/2.6.0_PLAN.md) ~ [2.8.0_PLAN.md](./roadmap/2.8.0_PLAN.md) | 已落地 |
| **v2.9.0** | 未单独成文；维护项见 [spec-red-green-lines.md §2.1](./spec-red-green-lines.md) |

### 3.x / 4.x（冻结）

| 文档 | 状态 |
|------|------|
| [3.0.0_PLAN.md](./roadmap/3.0.0_PLAN.md) | 远期企业生态 |
| 4.0.0 | 尚未编写 |

---

## 维护原则

1. **README** = 对外第一入口（能做什么、怎么跑、变更历史）。
2. **spec-red-green-lines** = 能不能做、冻结与否。
3. **roadmap/\*_PLAN** = 某一版的任务与验收；完成后在 README 变更史留勾。
4. **implemented/** = 契约与架构意图；若仅规划未实现，文首须标 **冻结**（如管道编排）。
5. 合并功能当天更新文档修订记录，避免实现与文档漂移。

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-11-20 | 初版索引；新增 spec-red-green-lines；对齐 oh-my-co-work 文档分区纪律 |
# 版本规划索引（roadmap/）

| 属性 | 内容 |
|------|------|
| 类别 | roadmap 子索引 |
| 当前发布线 | **v2.8.0** |
| 进行中 | **v2.9.0**（仅维护，见 [2.9.0_PLAN.md](./2.9.0_PLAN.md)） |

**范围冻结**见 [spec-red-green-lines.md](../spec-red-green-lines.md)。**写法规范**见 [spec-doc-conventions.md](../spec-doc-conventions.md)。

---

## 版本总表（按 semver 排序）

| 版本 | 文档 | 状态 | 主题摘要 |
|------|------|------|----------|
| 0.0.1 | [0.0.1_PLAN.md](./0.0.1_PLAN.md) | ✅ 已落地 | 拖拽、属性抽屉、双存储 |
| 0.1.0 | [0.1.0_PLAN.md](./0.1.0_PLAN.md) | ✅ 已落地 | API 绑定、事件链雏形 |
| 0.4.0 | [0.4.0_PLAN.md](./0.4.0_PLAN.md) | 🧊 冻结 | 逻辑流、远程物料 SDK |
| 0.5.0 | [0.5.0_PLAN.md](./0.5.0_PLAN.md) | 🧊 部分/冻结 | 多工作区、I/O 强校验 |
| 1.0.0 | [1.0.0_PLAN.md](./1.0.0_PLAN.md) | ✅ 已落地 | Base GA |
| 1.1.0 | [1.1.0_PLAN.md](./1.1.0_PLAN.md) | ✅ 已落地 | 对齐线、方向键微调 |
| 1.2.0 | [1.2.0_PLAN.md](./1.2.0_PLAN.md) | ✅ 已落地 | 多图层、生命周期 |
| 1.3.0 | [1.3.0_PLAN.md](./1.3.0_PLAN.md) | ✅ 已落地 | 数据驱动、动作链 |
| 1.6.0 | [1.6.0_PLAN.md](./1.6.0_PLAN.md) | ✅ 已落地 | 出码一致性、安全加固 |
| 1.7.0 | [1.7.0_PLAN.md](./1.7.0_PLAN.md) | ✅ 已落地 | 显隐、条件动作、state |
| 1.8.0 | [1.8.0_PLAN.md](./1.8.0_PLAN.md) | ✅ 已落地 | 预览、页面收尾 |
| 1.9.0 | [1.9.0_PLAN.md](./1.9.0_PLAN.md) | ✅ 已落地 | Mock、接口文档 |
| 1.10.0 | [1.10.0_PLAN.md](./1.10.0_PLAN.md) | ✅ 已落地 | 数据源编辑、排序 |
| 1.11.0 | [1.11.0_PLAN.md](./1.11.0_PLAN.md) | ✅ 已落地 | 出码与画布对齐 |
| 1.12.0 | [1.12.0_PLAN.md](./1.12.0_PLAN.md) | ✅ 已落地 | 语料库 JSONL |
| 2.0.0 | [2.0.0_PLAN.md](./2.0.0_PLAN.md) | ✅ 已落地 | 自我循环物料 |
| 2.1.0 | [2.1.0_PLAN.md](./2.1.0_PLAN.md) · [IMPLEMENTATION](./2.1.0_IMPLEMENTATION.md) | ✅ 已落地 | 黑盒、版本管理 |
| 2.2.0 | —（无独立 plan） | ✅ 已落地 | Inspector、真组件画布；见根 README 变更史 |
| 2.3.0 | [2.3.0_PLAN.md](./2.3.0_PLAN.md) · [IMPLEMENTATION](./2.3.0_IMPLEMENTATION.md) | ✅ 已落地 | 手势、快捷键、Inspector |
| 2.6.0 | [2.6.0_PLAN.md](./2.6.0_PLAN.md) | ✅ 已落地 | PATCH 竞态、SSRF、自动保存 |
| 2.7.0 | [2.7.0_PLAN.md](./2.7.0_PLAN.md) | ✅ 已落地 | shortHash、类型、测试 |
| 2.8.0 | [2.8.0_PLAN.md](./2.8.0_PLAN.md) | ✅ 已落地 | catch、表达式分层、拆文件 |
| **2.9.0** | [2.9.0_PLAN.md](./2.9.0_PLAN.md) | 🔧 维护中 | 拆分模块单测、catch 口径 |
| 3.0.0 | [3.0.0_PLAN.md](./3.0.0_PLAN.md) | 🧊 远期 | 物料生态、管道、GraphQL |
| 4.0.0 | — | 🧊 未编写 | 协同、RBAC、分布式 |

**图例**：✅ 已落地 · 🔧 仅维护/债务 · 🧊 冻结或远期

---

## 横向文档（非 semver）

| 文档 | 状态 | 用途 |
|------|------|------|
| [FUTURE_DIRECTIONS.md](./FUTURE_DIRECTIONS.md) | 🧊 未落地项冻结 | 体验与架构方向目录 |
| [ARCH_RECOMMENDATIONS.md](./ARCH_RECOMMENDATIONS.md) | 🧊 建议集 | 深度技术建议；采纳须改 plan |

---

## 大版本节奏（与范围）

```
0.x–1.x  基础 GA、数据驱动
2.x      物料闭环 + 结构债务（当前绿线主场）
3.x      生态与编排（冻结）
4.x      企业级（冻结）
```
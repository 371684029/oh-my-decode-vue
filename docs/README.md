# 文档中心

| 属性 | 内容 |
|------|------|
| 产品版本 | **v2.10.0**（`package.json`） |
| 维护线 | v2.10.0 已收口；见 [2.10.0_PLAN.md](./roadmap/2.10.0_PLAN.md) |

上手见 [README.md](../README.md)。**能不能做** → [spec-red-green-lines.md](./spec-red-green-lines.md)。**怎么写文档** → [spec-doc-conventions.md](./spec-doc-conventions.md)。

---

## 怎么读（三条路径）

| 路径 | 步骤 |
|------|------|
| **10 分钟入门** | 根 README「快速开始」→ [spec-red-green-lines.md](./spec-red-green-lines.md) §1 核心命题 |
| **开发改 Schema/物料** | [implemented/README.md](./implemented/README.md) → CAE / 物料 / I/O 三规范 |
| **排期或复盘** | [roadmap/README.md](./roadmap/README.md) 版本总表 → 打开对应 `*_PLAN.md` |

---

## 分区地图

```text
docs/
├── README.md                 ← 本文（总入口）
├── spec-red-green-lines.md   ← 红绿线 · 范围裁决（单一事实源）
├── spec-doc-conventions.md   ← 命名、元数据、修订纪律
├── implemented/              ← 技术契约与实现报告
│   └── README.md             ← 子索引 + 代码对照
├── roadmap/                  ← 版本规划
│   ├── README.md             ← 版本总表（semver 刻度）
│   └── *_{PLAN,IMPLEMENTATION}.md
└── assets/                   ← 截图
```

| 分区 | 管什么 |
|------|--------|
| **spec-** | 范围、写法 |
| **implemented/** | 契约、架构意图 |
| **roadmap/** | 版本目标、验收、实施纪要 |

---

## spec- 规范类

| 文档 | 用途 |
|------|------|
| [spec-red-green-lines.md](./spec-red-green-lines.md) | 绿线 / 红线 / 冻结；PR 准入；模块映射 |
| [spec-doc-conventions.md](./spec-doc-conventions.md) | 文首元数据、命名、读者路径 |

---

## implemented/ 与 roadmap/

明细表请直接打开子索引（避免双份维护）：

- **[技术规范一览](./implemented/README.md)** — CAE、物料、I/O、管道（远期）、0.2 优化报告
- **[版本总表](./roadmap/README.md)** — 0.0.1 → 4.0 状态与链接；含 [2.9.0_PLAN.md](./roadmap/2.9.0_PLAN.md)

---

## 维护原则

1. **README（根）** = 对外能力 + 变更历史；长篇文档索引以 **本文 + 子索引** 为准。
2. **spec-red-green-lines** = 范围变更必先改此文。
3. 新 `*_PLAN.md` → 登记 [roadmap/README.md](./roadmap/README.md)。
4. 新契约 → 登记 [implemented/README.md](./implemented/README.md)。
5. 合并当天更新相关 plan 与 **修订记录** 表。

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-11-20 | 初版索引 + spec-red-green-lines |
| 2026-11-20 | 增 spec-doc-conventions、implemented/roadmap 子索引、2.9.0 plan、读者路径 |
# 文档编写与命名规范

| 属性 | 内容 |
|------|------|
| 状态 | **已采纳** |
| 适用范围 | `docs/` 下全部 Markdown |
| 关联 | [README.md](./README.md)、[spec-red-green-lines.md](./spec-red-green-lines.md) |

---

## 1. 目录职责（三区 + 规范）

| 路径 | 回答的问题 | 读者 |
|------|------------|------|
| `docs/spec-*.md` | **能不能做、怎么评审** | 所有人、PR 作者 |
| `docs/implemented/` | **契约是什么、已实现到哪** | 开发、Review |
| `docs/roadmap/` | **哪一版做、验收是什么** | 排期、复盘 |
| `docs/assets/` | 插图素材 | — |

纪律：**spec 管范围 · roadmap 管节奏 · implemented 管契约**。三者不混写进同一文件。

---

## 2. 文件命名

### 2.1 当前约定（保持链接稳定）

| 类型 | 命名模式 | 示例 |
|------|----------|------|
| 规范类 | `spec-<主题>.md`（kebab-case） | `spec-red-green-lines.md` |
| 版本规划 | `<major>.<minor>.<patch>_PLAN.md` | `2.8.0_PLAN.md` |
| 实施纪要 | `<version>_IMPLEMENTATION.md` | `2.1.0_IMPLEMENTATION.md` |
| 技术规范 | `大写_下划线.md`（历史） | `MATERIAL_SPECIFICATION.md` |
| 横向文档 | `大写_下划线.md` | `FUTURE_DIRECTIONS.md` |

### 2.2 新文档优先

- 根目录 `docs/` 新增：**只用** `spec-*` 或 `README.md`。
- 版本规划：**只用** `roadmap/*_PLAN.md`。
- 技术契约：可继续 `implemented/`，文首统一元数据表（见 §3）。

> 历史大写文件名**不批量重命名**（避免全仓断链）；重命名须同步 README、plan 与代码注释。

---

## 3. 文首元数据（必读）

每篇文档在标题下插入属性表 + 一句定位：

```markdown
# 标题

| 属性 | 内容 |
|------|------|
| 类别 | spec / implemented / roadmap |
| 状态 | 已落地 / 部分落地 / 远期规范 / 冻结 |
| 版本 | v2.8.0 或「不限」 |
| 范围 | 绿线 C01–C07 / 冻结 / — |
| 关联 | 相对链接 |

> **一句话**：本文解决什么问题。
```

**状态用词**：

| 状态 | 含义 |
|------|------|
| **已落地** | 代码在 `main`，文档为契约或记录 |
| **部分落地** | 规范大于实现（如 CAE 全量 vs v1.3 子集） |
| **远期规范** | 设计先行，实现冻结（如管道编排） |
| **冻结** | v3+ 或锦上添花，见红绿线 |

远期 / 冻结文档文首加：

```markdown
> **范围**：v2.x 不接受实现 PR；见 [spec-red-green-lines.md](../spec-red-green-lines.md)。
```

---

## 4. 可读性结构

1. **目录**：超过 3 个一级节时，文首放 `## 目录` 或锚点列表。
2. **表格优先**：状态、对照、验收用表格，少用大段列表堆砌。
3. **版本 plan**：固定骨架 —— 目标 → 范围边界 → 任务/优先级 → 验收 → 修订记录。
4. **中英文**：标题可中英并存；正文以中文为主，专有名词保留英文。
5. **链接**：跨文档用相对路径；提及版本时链到对应 `*_PLAN.md`。

---

## 5. 修订记录

每篇长期维护文档文末保留：

```markdown
## 修订记录

| 日期 | 说明 |
|------|------|
| YYYY-MM-DD | 变更摘要 |
```

合并功能当天至少更新：**相关 plan + implemented/spec + docs/README 索引（若新增文件）**。

---

## 6. 读者路径（抄送索引）

| 你是谁 | 先读 | 再读 |
|--------|------|------|
| 新同学 | [../README.md](../README.md) 快速开始 | [spec-red-green-lines.md](./spec-red-green-lines.md) |
| 写功能 | spec-red-green-lines | 对应 [roadmap/README.md](./roadmap/README.md) 版本行 |
| 改 Schema/物料 | [implemented/README.md](./implemented/README.md) | CAE + 物料 + I/O 三份 spec |
| 排 v2.9+ | [roadmap/2.9.0_PLAN.md](./roadmap/2.9.0_PLAN.md) | 2.8.0_PLAN M2 |

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-11-20 | 初版：命名、元数据表、状态词、读者路径 |
# 核心结构债务 · 三轮收口档案

| 属性 | 内容 |
|------|------|
| 状态 | **已收口**（v2.4.0 → v2.8.0） |
| 类别 | 实现报告 / 复盘 |
| 绿线 | C01–C07 维护面 |
| 关联 | [0.2.0_OPTIMIZATIONS.md](./0.2.0_OPTIMIZATIONS.md)、[roadmap/README.md](../roadmap/README.md) |

> **一句话**：护城河内部的 16 项结构/正确性债务已清零；下表保留改造前快照供复盘。  
> **范围裁决**仍以 [spec-red-green-lines.md](../spec-red-green-lines.md) 为准。

---

## 轮次总览

| 轮次 | 版本 | 主题 | 项数 |
|------|------|------|------|
| 第一轮 | v2.4.0 / v2.5.0 | 出码与保存链路 | 6 |
| 第二轮 | v2.6.0 / v2.7.0 | 正确性与结构债务 | 7 |
| 第三轮 | v2.8.0 | 类型收口与表达式分层 | 3 |

v2.9–v2.11 维护项见各版本 `roadmap/*_PLAN.md`。

---

## 第一轮（v2.4.0 / v2.5.0）— 出码与保存链路 ✅

| # | 优化点 | 现状 | 目标 |
|---|--------|------|------|
| 1 | **拆分出码引擎** | `codeGenerator.ts` 单体 1371 行，三种出码目标字符串模板混排 | 按 target 拆为独立生成器 + 共享渲染层；输出经格式化 |
| 2 | **撤销/重做改 patch 式历史** | 全量快照 `JSON.parse(JSON.stringify())`，长会话 GC 压力大 | 结构共享或 Patch；拖拽仅在 `dragstop` 落一步 |
| 3 | **拆巨型组件** | `PropertyDrawer` 981、`App` 645、`CanvasContainer` 608 行 | 子组件/composable，单文件 ≈250 行量级 |
| 4 | **增量保存** | 自动保存全量 `POST /api/schemas` | RFC 6902 JSON Patch（见 0.2.0 优化报告） |
| 5 | **Web Component 样式注入** | Shadow DOM 下 Element Plus CSS 不穿透 | `styles: [elementPlusCss]` + Light DOM 兜底 |
| 6 | **快捷键作用域** | 弹窗/抽屉内 Delete 误删画布节点 | `focusedZone` + `activeModalCount` 门禁 |

---

## 第二轮（v2.6.0 / v2.7.0）— 正确性与结构债务 ✅

| # | 优化点 | 改造前 | 目标 |
|---|--------|--------|------|
| 7 | **PATCH 并发竞态** | `patchSchema` 读写在队列外，TOCTOU 静默丢更新 | 读-校验-应用-写整体入写队列；一 200 一 409 |
| 8 | **导出代码 SSRF 防护分歧** | 嵌入 JS 缺 `::ffff:` 链路本地判定 | 与设计器同一套 `blockedHost` |
| 9 | **自动保存失败静默** | 仅 `console.error` | 失败一次性通知（节流） |
| 10 | **shortHash 三处重复** | FNV-1a 三份拷贝 | `@lowcode/shared` 单一导出 |
| 11 | **`as any` 类型逃逸** | 版本/布局/表达式解析器逃逸 | 最小结构类型 + 受限运算视图 |
| 12 | **watch 全量 stringify** | 拖拽每步 O(n) 序列化 | 手势期间短路 getter |
| 13 | **静默 catch** | 物料拉取/高亮失败吞异常 | 留痕告警 |

### v2.7.0 测试增量（摘录）

| 套件 | 新增 | 覆盖要点 |
|------|------|----------|
| `jsonPatch` 边界语义 | +15 | 根路径、空 ops、数组边界、`/-`、invert |
| `designerStore` 黑盒路径 | +8 | 黑盒添加、智能分发、图层作用域 |
| `materialController` 引用门禁 | +7 | refs 409、force 删、图层内实例 |
| 版本升级与存储 | +14 | `pageUpgradeService`、`StorageService` 非保存路径 |

---

## 第三轮（v2.8.0）— 类型收口与表达式分层 ✅

| # | 优化点 | 改造前 | 目标 |
|---|--------|--------|------|
| 14 | **`catch (err: any)` 逃逸** | 生产 47 处 `any` | `unknown` + `errorMessage` / `errorText` 等 |
| 15 | **表达式求值器单文件过载** | `expression.ts` 473 行 | tokenizer / evaluator / index 分层 |
| 16 | **巨型文件超标** | store / MaterialManager / expression 超 400 行 | 纯函数边界拆分，超标文件数归零 |

拆分纪律：只抽不带 `this` 的代码；action 计数 40→40 护栏见 [2.8.0_PLAN.md](../roadmap/2.8.0_PLAN.md)。

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-11-20 | 从根 README 迁出，避免双份维护 |
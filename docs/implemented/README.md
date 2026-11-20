# 技术规范与实现报告（implemented/）

| 属性 | 内容 |
|------|------|
| 类别 | implemented 子索引 |
| 说明 | 已落地或「规范先行」的**技术契约**；不收录版本排期 |

**排期与状态**见 [roadmap 版本总表](../roadmap/README.md)。**能否做**见 [spec-red-green-lines.md](../spec-red-green-lines.md)。

---

## 文档一览

| 文档 | 状态 | 绿线 | 一句话 |
|------|------|------|--------|
| [COMPONENT_API_EVENT_MAPPING.md](./COMPONENT_API_EVENT_MAPPING.md) | 部分落地 | C03–C04 | JSON 桥梁与 CAE 三角；GraphQL/编排仍远期 |
| [MATERIAL_SPECIFICATION.md](./MATERIAL_SPECIFICATION.md) | 已落地 | C02、C06 | `.vue` / `.js` 物料解析与混合架构 |
| [COMPONENT_IO_SPECIFICATION.md](./COMPONENT_IO_SPECIFICATION.md) | 已落地 | C02、C07 | 黑盒 inputs/outputs 契约与抽屉校验 |
| [PIPELINE_ORCHESTRATION.md](./PIPELINE_ORCHESTRATION.md) | **远期规范 · 冻结** | — | v3.0 管道编排设计，v2.x 不实现 |
| [0.2.0_OPTIMIZATIONS.md](./0.2.0_OPTIMIZATIONS.md) | 报告 · 大多已收口 | C05 维护 | v0.2 技术债；v2.4–v2.8 已逐项落地 |

---

## 与代码对照（速查）

| 主题 | 主要代码 |
|------|----------|
| CAE / 数据源 / 动作链 | `frontend/src/stores/designerStore.ts`、`utils/apiBindingForm.ts`、`utils/pageState.ts` |
| 物料注册与黑盒 | `frontend/src/registry/`、`MaterialBlackBox.vue` |
| 契约校验 | `frontend/src/utils/contractValidator.ts` |
| 出码 | `frontend/src/utils/codegen/`、`codeGenerator.ts` |
| 物料版本后端 | `backend/src/services/materialVersionService.ts` |

---

## 维护

- 改 Schema 契约或物料格式：**先改 implemented，再改代码**。
- 新增 implemented 文档：复制 §3 元数据表（见 [spec-doc-conventions.md](../spec-doc-conventions.md)），并登记到本表与 [docs/README.md](../README.md)。
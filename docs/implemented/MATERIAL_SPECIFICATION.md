# 低代码物料解析规范与技术对比指南 (Material Specification & Parsing Guide)

> **文档定位**：低代码前端平台待选组件（物料）解析机制、Vue SFC vs JS 产物对比与混合架构落地建议
> **状态**：已落盘 (Active Specification)

---

## 📖 概述

在低代码可视化平台（Low-Code Visual Studio）中，“待选组件（物料）”是支撑拖拽画布与最终出码的基础单元。物料既可以是未编译的 **Vue 源码 (`.vue` 单文件组件)**，也可以是编译后的 **JS 文件 (`.js` UMD/ESM 模块或 W3C Web Component)**。

本文档深度剖析两者的解析机制、兼容性差异、扩展性优劣，并给出企业级生产环境下的混合架构设计方案与最佳实践建议。

---

## 🔍 一、 两种物料形式的解析机制对比

| 维度 | Vue 源码 (`.vue`) | JS 编译产物 (`.js` / Web Component) |
| :--- | :--- | :--- |
| **文件结构** | 包含 `<template>`, `<script setup>`, `<style scoped>` 的未经编译源码 | 经过 Vite/Rollup 打包编译美化后的 JS 模块或 Web Component |
| **解析方式** | **编译期/在线编译解析**：<br>1. 本地打包：通过 Vite 的 `@vitejs/plugin-vue` 编译。<br>2. 浏览器动态加载：通过 `vue3-sfc-loader` 在线即时编译 | **运行时动态加载**：<br>1. 原生 `import('./Material.js')` 动态导入 ESM 模块。<br>2. 动态插入 `<script>` 加载 UMD 挂载全局变量。<br>3. `customElements.define()` 注册 Web Component |
| **运行时依赖** | 强依赖平台的 Vue 3 核心运行时及上下文响应式系统 | 自包含依赖，或通过 `external` 读取平台全局 Vue/Element 对象 |

---

## 🛡️ 二、 兼容性深度对比 (Compatibility)

### 1. Vue 源码 (`.vue`) 的兼容性特点
- ❌ **弱跨框架能力**：强绑定 Vue 运行环境，无法在 React、Angular、JSP 或纯静态 HTML 系统中直接渲染。
- ⚠️ **强版本耦合**：若物料使用了 Vue 3.4+ 新特性（如 `defineModel`），在较低版本的宿主环境中解析可能抛错；依赖的 UI 库版本需完全适配。
- ✅ **开发环境零壁垒**：与现有 Vue 3 生态完全无缝融合，出码导出的 `.vue` 源码可直接放入任何 Vue 3 项目中编译运行。

### 2. JS 编译产物 (`.js`) 的兼容性特点
- ✅ **强跨框架能力（尤其是 Web Components）**：编译为标准 W3C Web Component（`defineCustomElement`）后，可在任何前端框架（React, Vue 2/3, Angular, jQuery）或静态 HTML 中使用。
- ✅ **样式与依赖防护**：配合 Shadow DOM 可实现 100% 样式隔离，防止低代码平台全局 CSS 与第三方物料相互污染。
- ⚠️ **体积开销**：若每个 `.js` 物料均未透传依赖而包含独立打包模块，会导致 CDN 流量与加载体积偏大。

---

## 🚀 三、 扩展性深度对比 (Extensibility)

### 1. Vue 源码 (`.vue`) 的扩展性特点
- ✅ **二次开发与二次出码体验极佳**：出码生成的 Vue 代码可读性极强，方便开发人员直接修改。
- ✅ **原生支持复杂插槽与响应式**：天然支持 Vue 3 具名插槽 (`#header`)、作用域插槽 (`v-slot="scope"`)、`v-model` 双向绑定以及复杂的表单/表格联动。
- ❌ **动态插件注册成本高**：若要在运行时动态从远程服务器加载一个未经编译的 `.vue` 文件，浏览器端必须携带完整的 SFC 编译器（约增加 1.5MB 运行时负担）。

### 2. JS 编译产物 (`.js`) 的扩展性特点
- ✅ **极佳的远程动态扩展性 (Remote Plugin Marketplace)**：
  - 允许第三方开发者独立开发物料，打包发布为 `.js` 文件部署到 CDN。
  - 低代码平台通过统一的 SDK（如 `defineMaterial()`）在运行时 `await import('https://cdn.com/my-material.js')` 动态加载，**无需重新打包和发布低代码平台**。
- ✅ **支持 Module Federation (模块联邦)**：轻松对接微前端架构与远程物料仓库。
- ⚠️ **插槽与作用域通信成本较高**：如果包装为 Web Component，原生 Shadow DOM 对 Vue 复杂作用域插槽（Scoped Slots）的处理不如 Vue 原生组件直观。

---

## 💡 四、 低代码平台物料架构设计最佳建议 (Hybrid Architecture)

生产级低代码平台推荐采用 **“内置核心物料 Vue 源码直注册 + 远程扩展物料 JS 动态加载” 的混合架构**：

```text
                                +---------------------------------------+
                                |      低代码物料注册中心 (Registry)     |
                                +---------------------------------------+
                                                    |
                      +-----------------------------+-----------------------------+
                      |                                                           |
                      ▼                                                           ▼
       【内置核心物料 (Built-in Materials)】                         【远程扩展物料 (Remote Plugins)】
       - 物料形式：Vue 3 SFC / Vue 对象                              - 物料形式：编译后的 `.js` (ESM / Web Component)
       - 注册方式：本地 Component 静态引入                           - 注册方式：运行时 `import('https://cdn...')` 动态加载
       - 包含组件：ProTable, ProForm, Element UI                     - SDK 规范：`defineMaterial()` 标准接口
       - 优势：零编译开销、完美支持作用域插槽与二次出码              - 优势：无需重新构建主工程，热插拔生态
```

---

## 📋 五、 规范实施步骤与规范总结

1. **统一 Schema 规范**：无论待选组件是 `.vue` 还是 `.js`，其对应的物料 JSON 描述符（包含 `component`, `label`, `props`, `events`, `slots`）必须保持统一契约。
2. **规范导出策略**：
   - 当导出目标为 **Vue 3 SFC** 时，优先还原原生组件标签。
   - 当导出目标为 **Web Component / Static HTML** 时，自动转化为通用自定义元素引入。
3. **物料 SDK 暴露**：在全局暴露 `window.LowCodeSDK = { defineMaterial, registerComponent }`，供第三方 `.js` 扩展物料完成初始化握手。

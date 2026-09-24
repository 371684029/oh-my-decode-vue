# 自制组件入参/出参规范与契约强校验指南 (Component I/O Parameter Contract)

> **文档定位**：低代码平台自制物料（Custom / Pro Components）入参 (Inputs/Props) 与 出参 (Outputs/Emits) 的强约束定义标准与属性抽屉校验规范
> **状态**：已落盘 (Active Specification)

---

## 📖 概述

在低代码搭建平台中，自制高级组件（如 `ProTable`、`ProForm` 或业务定制物料）往往包含复杂的输入数据与输出事件链条。如果缺乏统一的入参/出参契约规范，会导致：
1. **开发者使用困难**：不清楚组件需要传什么格式的数据（如数组还是对象）。
2. **运行时静默崩溃**：漏传必填参数（如未传 `columns` 或 `api`），导致页面渲染报错甚至整页白屏。
3. **数据链条断裂**：组件抛出的事件参数未标注格式，导致下游事件动作（Action）获取不到期望的数据。

因此，本规范规定：**所有注册入低代码平台的自制组件，必须显式定义入参 (Inputs/Props) 与出参 (Outputs/Emits) 的 JSON Schema 声明，且包含必填项标记与校验规则。**

---

## 📐 一、 入参 (Inputs / Props) 规范与字段契约

自制组件的每个 Input 参数必须包含以下契约定义字段：

```typescript
export interface MaterialPropContract {
  name: string;             // 属性绑定 Key (例如: "tableData")
  label: string;            // 属性中文名 (例如: "表格数据源")
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'expression'; // 数据类型
  required: boolean;        // 是否必填 (true 表示必须配置)
  defaultValue?: any;       // 默认值
  description?: string;     // 参数用途与说明
  validation?: {            // 参数校验规则
    min?: number;
    max?: number;
    pattern?: string;       // 正则表达式
    customValidator?: string;// 自定义校验函数名
  };
}
```

### 示例：高端表格 (`ProTable`) 的入参规范声明
```json
{
  "component": "pro-table",
  "label": "高端表格 (ProTable)",
  "inputs": [
    {
      "name": "columns",
      "label": "列定义",
      "type": "array",
      "required": true,
      "description": "表格列配置数组，每一项包含 prop, label, width 等属性",
      "defaultValue": [
        { "prop": "id", "label": "ID", "width": "80" },
        { "prop": "name", "label": "姓名" }
      ]
    },
    {
      "name": "dataUrl",
      "label": "数据接口地址",
      "type": "string",
      "required": false,
      "description": "远程 RESTful API 接口，若为空则读取本地静态数据"
    }
  ]
}
```

---

## 📤 二、 出参 (Outputs / Emits) 规范与事件契约

自制组件的每个 Output 事件抛出必须包含以下契约定义字段：

```typescript
export interface MaterialEmitContract {
  event: string;            // 事件触发 Key (例如: "row-click")
  label: string;            // 事件中文名 (例如: "行点击事件")
  description?: string;     // 事件触发时机说明
  payloadSchema: {          // 抛出数据 (Payload) 的 JSON Schema 定义
    type: 'object' | 'array' | 'string' | 'number';
    properties?: Record<string, { type: string; description: string }>;
  };
}
```

### 示例：高端表格 (`ProTable`) 的出参规范声明
```json
{
  "outputs": [
    {
      "event": "row-select",
      "label": "行选中事件",
      "description": "当用户在表格中勾选或选中某一行时触发",
      "payloadSchema": {
        "type": "object",
        "properties": {
          "row": { "type": "object", "description": "当前选中的行记录对象" },
          "index": { "type": "number", "description": "当前行的索引" }
        }
      }
    }
  ]
}
```

---

## 🚨 三、 属性抽屉 (Property Drawer) 强校验与提示机制

当用户在低代码设计器画布中选中某个自制组件并进行属性配置时，属性面板将自动触发**入参/出参强校验引擎**：

1. **必填校验高亮警告 (Required Validation Alert)**：
   - 如果某个参数标记为 `"required": true`，但当前组件节点上没有输入值且没有默认值，属性输入框下方显示**红色强提醒**：“⚠️ 该参数为必填项，未配置可能导致渲染失败”。
   - 画布图层对应的组件节点角标上显示红色感叹号警告。
2. **类型校验 (Type Constraint Check)**：
   - 若参数定义为 `type: "number"`，输入非数字字符串时阻止保存并给出提示。
3. **出参事件绑定提示 (Event Payload Binding Helper)**：
   - 在配置该组件的交互事件链时，右侧事件抽屉自动列出出参的 `payloadSchema`，提示用户可在后续逻辑节点中使用 `{{ event.row.id }}` 引用入参数据。

---

## 🛠️ 四、 落地实施步骤

1. **改造物料注册中心 (`materials.ts`)**：为现有的 `pro-table`、`pro-form`、`pro-container` 补充完整的 `inputs` 和 `outputs` 契约定义。
2. **创建校验工具类 (`frontend/src/utils/contractValidator.ts`)**：提供 `validateComponentProps(node, materialSchema)` 函数。
3. **在 `PropertyDrawer.vue` 中接入校验**：实时监听节点属性改动，高亮必填缺失项。

import type { ComponentNode, ActionNode, EventRule, ApiBinding } from '../../types/designer';
import { inlineableExpression } from '../condition';
import { requiredInputFields } from '../formValidation';
import { FORBIDDEN_STATE_KEYS } from '../dataSource';
import { identOf, inlineExpr, renderParamsLiteral, renderPathExpr, tablePageSize } from './shared';

// ============================================================
// v1.3.0 出码辅助：数据源加载与事件动作链生成
// （composition / options API 共用，optionsApi 参数切换 this. 访问）
// ============================================================

/** URL 表达式：全串 {{ expr }} → 内联表达式；部分内嵌 → 字符串拼接 */
export function renderUrlExpr(url: string): string {
  const full = url.match(/^\s*\{\{\s*(.*?)\s*\}\}\s*$/);
  if (full) return inlineExpr(full[1]);
  if (url.includes('{{')) {
    const parts = url.split(/\{\{\s*(.*?)\s*\}\}/);
    return parts.map((p, i) => (i % 2 === 1 ? inlineExpr(p) : JSON.stringify(p))).join(' + ') || JSON.stringify(url);
  }
  return JSON.stringify(url);
}

/** payload 值表达式（{{ expr }} → 内联，对象/数组递归） */
export function renderPayloadExpr(value: unknown): string {
  if (typeof value === 'string') {
    const m = value.match(/^\s*\{\{\s*(.*?)\s*\}\}\s*$/);
    return m ? inlineExpr(m[1]) : JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => renderPayloadExpr(v)).join(', ')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, any>).map(
      ([k, v]) => `${JSON.stringify(k)}: ${renderPayloadExpr(v)}`
    );
    return `{ ${entries.join(', ')} }`;
  }
  return JSON.stringify(value);
}

/** 生成 GET 请求块文本（options API 需 this. 前缀，composition 不需要） */
export function renderFetchRequestBlock(
  urlExpr: string,
  paramsLit: string,
  method: 'GET' | 'POST',
  optionsApi: boolean,
  pageExpr?: string,
  pageSize = 10
): string {
  const call = 'fetchChecked';
  void optionsApi;
  const merged = pageExpr ? `{ page: ${pageExpr}, size: ${pageSize}, ...(${paramsLit}) }` : paramsLit;
  if (method === 'POST') {
    return `    const res = await ${call}(${urlExpr}, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(${merged}), signal: AbortSignal.timeout(10000) });`;
  }
  return `    const params = ${merged};
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.append(k, String(v)); });
    const q = qs.toString();
    const base = ${urlExpr};
    const url = q ? (base.includes('?') ? base + '&' + q : base + '?' + q) : base;
    const res = await ${call}(url, { method: 'GET', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000) });`;
}

/** 生成表格节点加载函数（composition API） */
export function renderTableLoadFunction(node: ComponentNode, binding: ApiBinding, optionsApi = false): string {
  const dataName = `tableData_${identOf(node.id)}`;
  const totalName = `totalCount_${identOf(node.id)}`;
  const method = binding.method ?? 'GET';
  const listExpr = renderPathExpr(binding.responsePath, 'json');
  const totalExpr = binding.totalProp ? renderPathExpr(binding.totalProp, 'json') : 'undefined';
  const pageExpr = optionsApi ? `this.currentPage_${identOf(node.id)}` : `currentPage_${identOf(node.id)}.value`;
  const requestBlock = renderFetchRequestBlock(
    renderUrlExpr(binding.url),
    renderParamsLiteral(binding.params),
    method,
    optionsApi,
    pageExpr,
    tablePageSize(node)
  );

  return `const loadData_${identOf(node.id)} = async () => {
  try {
${requestBlock}
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const list = ${listExpr};
    ${dataName}.value = Array.isArray(list) ? list : [];
    const total = ${totalExpr};
    if (total !== undefined) ${totalName}.value = Number(total) || 0;
  } catch (err) {
    console.error('数据加载失败:', err);
  }
};`;
}

/** 生成表单节点加载函数（composition API） */
export function renderFormLoadFunction(node: ComponentNode, binding: ApiBinding): string {
  const formName = `formData_${identOf(node.id)}`;
  const method = binding.method ?? 'GET';
  const dataExpr = renderPathExpr(binding.responsePath, 'json');
  const requestBlock = renderFetchRequestBlock(
    renderUrlExpr(binding.url),
    renderParamsLiteral(binding.params),
    method,
    false
  );

  return `const loadData_${identOf(node.id)} = async () => {
  try {
${requestBlock}
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const data = ${dataExpr};
    if (data && typeof data === 'object') {
      ${formName}.value = { ...data };
    }
  } catch (err) {
    console.error('表单数据加载失败:', err);
  }
};`;
}

export function enabledEventEntries(node: ComponentNode): Array<[string, EventRule]> {
  return Object.entries(node.events || {}).filter((entry): entry is [string, EventRule] =>
    Boolean(entry[1]?.enabled && (entry[1].actions?.length ?? 0) > 0)
  );
}

function renderStateAssigns(payload: Record<string, any> | undefined, optionsApi: boolean): string {
  return Object.entries(payload ?? {})
    .filter(([key]) => !FORBIDDEN_STATE_KEYS.has(key))
    .map(
      ([key, value]) => `${optionsApi ? 'this.state' : 'state'}[${JSON.stringify(key)}] = ${renderPayloadExpr(value)};`
    )
    .join('\n    ');
}

/** 生成节点事件动作链 handler */
export function renderNodeClickHandler(eventNodes: ComponentNode[], optionsApi = false): string {
  const blocks = eventNodes.flatMap((node) =>
    enabledEventEntries(node).map(([eventKey, rule]) => {
      const stmts = rule.actions
        .map((action) => wrapActionCondition(action, renderActionStatement(action, optionsApi)))
        .filter(Boolean)
        .join('\n    ');
      return `  if (nodeId === ${JSON.stringify(node.id)} && eventKey === ${JSON.stringify(eventKey)}) {\n    ${stmts}\n  }`;
    })
  );
  if (blocks.length === 0) return '';
  if (optionsApi) return `handleNodeClick(nodeId, eventKey, $event) {\n${blocks.join('\n')}\n},`;
  return `const handleNodeClick = async (nodeId: string, eventKey: string, $event: any) => {\n${blocks.join('\n')}\n};`;
}

function wrapActionCondition(action: ActionNode, statement: string): string {
  if (!statement) return '';
  const raw = action.when?.trim();
  if (!raw) return statement;
  const expr = inlineableExpression(raw);
  if (!expr) return '';
  const body = statement.replaceAll('\n', '\n      ');
  return `if (${expr}) {\n      ${body}\n    }`;
}

export function renderSubmitGuards(formNodes: ComponentNode[], optionsApi: boolean): string {
  const lines: string[] = [];
  for (const node of formNodes) {
    const fields = requiredInputFields(node.config?.items);
    for (const field of fields) {
      const access = `${optionsApi ? 'form' : 'form.value'}[${JSON.stringify(field.field)}]`;
      const warn = optionsApi
        ? `ElementPlus.ElMessage.warning(${JSON.stringify(`请填写${field.label}`)})`
        : `ElMessage.warning(${JSON.stringify(`请填写${field.label}`)})`;
      lines.push(
        `if (formId === ${JSON.stringify(node.id)} && (${access} == null || String(${access}).trim() === '')) { ${warn}; return; }`
      );
    }
  }
  return lines.join('\n');
}

/** 单条动作语句；optionsApi=true 时变量经 this. 访问 */
function renderActionStatement(action: ActionNode, optionsApi: boolean): string {
  const refAccess = (name: string) => (optionsApi ? `this.${name}` : `${name}.value`);
  switch (action.type) {
    case 'set_state':
      return renderStateAssigns(action.payload, optionsApi);
    case 'reload_data':
      return action.target ? `await ${optionsApi ? 'this.' : ''}loadData_${identOf(action.target)}();` : '';
    case 'open_dialog': {
      if (!action.target) return '';
      const assigns = renderStateAssigns(action.payload, optionsApi);
      const show = `${refAccess(`dialogVisible_${identOf(action.target)}`)} = true;`;
      return assigns ? `${assigns}\n    ${show}` : show;
    }
    case 'close_dialog':
      return action.target ? `${refAccess(`dialogVisible_${identOf(action.target)}`)} = false;` : '';
    case 'toggle_loading':
      return action.target
        ? `${refAccess(`loadingVisible_${identOf(action.target)}`)} = ${action.payload?.visible ?? true};`
        : '';
    case 'show_message':
      return `ElMessage({ type: ${JSON.stringify(action.payload?.messageType ?? 'success')}, message: ${renderPayloadExpr(action.payload?.messageText ?? '操作完成')} });`;
    default:
      return '';
  }
}

/** 生成 Vue SFC script setup 主体（v1.3.0：数据源 + 事件动作链 + 参数化） */
export function renderFormLookup(formNodes: ComponentNode[], optionsApi: boolean): string {
  const lines = formNodes.map((node) => {
    const name = optionsApi ? `this.formData_${identOf(node.id)}` : `formData_${identOf(node.id)}`;
    return `  if (formId === ${JSON.stringify(node.id)}) return ${name};`;
  });
  return `${lines.join('\n')}\n  return null;`;
}

export function renderFieldRef(node: ComponentNode, optionsApi: boolean): string {
  const name = `formData_${identOf(node.id)}`;
  if (node.type === 'el-switch') {
    const initial = typeof node.props?.value === 'boolean' ? String(node.props.value) : 'false';
    return optionsApi ? `${name}: ${initial},` : `const ${name} = ref(${initial});`;
  }
  const initial = typeof node.props?.value === 'string' ? JSON.stringify(node.props.value) : "''";
  return optionsApi ? `${name}: ${initial},` : `const ${name} = ref(${initial});`;
}

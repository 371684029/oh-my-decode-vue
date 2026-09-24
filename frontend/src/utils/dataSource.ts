import { parseExpression } from './expression';
import type { ActionNode, ApiBinding, ComponentNode, LayerConfig } from '../types/designer';

// ============================================================
// 前端数据接入层 (v1.3.0 L2/L3)
//  - ApiExecutor: 数据源请求 / 参数表达式求值 / 响应路径提取
//  - executeActions: 事件动作链执行器
//  - nodeEventBus: 节点间 reload 通信（设计器预览用）
// ============================================================

/** 对 {{ }} 表达式进行递归求值（字符串 / 数组 / 对象） */
export function resolveTemplatedValue(value: unknown, scope: Record<string, any>): any {
  if (typeof value === 'string') {
    return parseExpression(value, scope);
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveTemplatedValue(v, scope));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      out[k] = resolveTemplatedValue(v, scope);
    }
    return out;
  }
  return value;
}

/**
 * 点路径 / 数组下标提取（支持 "data.list"、"data[0].name"、"total"）
 */
export function extractByPath(response: any, path?: string): any {
  if (!path || !path.trim()) return response;
  const segments: Array<string | number> = [];
  for (const raw of path.split('.')) {
    const arrIdx = raw.match(/^([^\[]*)\[(\d+)\]$/);
    if (arrIdx) {
      if (arrIdx[1]) segments.push(arrIdx[1]);
      segments.push(Number(arrIdx[2]));
    } else if (raw) {
      segments.push(raw);
    }
  }
  return segments.reduce<any>((acc, seg) => {
    if (acc === null || acc === undefined) return undefined;
    return acc[seg];
  }, response);
}

export interface FetchResult {
  data: any;
  total?: number;
}

const FETCH_TIMEOUT_MS = 10000;
const BLOCKED_HOSTS = new Set(['169.254.169.254', 'metadata.google.internal']);

/** 只允许相对路径与 http(s)，拒绝 javascript: 和云元数据地址 */
export function assertFetchableUrl(url: string): void {
  if (url.startsWith('/') && !url.startsWith('//')) return;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('无效的数据源 URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('数据源仅允许 http 或 https');
  }
  if (BLOCKED_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error('不允许访问该地址');
  }
}

function fetchTimeoutSignal(): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(FETCH_TIMEOUT_MS);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return controller.signal;
}

/** 统一请求执行器 */
export class ApiExecutor {
  private scope: Record<string, any>;
  private baseUrl: string;

  constructor(scope: Record<string, any> = {}, baseUrl = '') {
    this.scope = scope;
    this.baseUrl = baseUrl;
  }

  setScope(scope: Record<string, any>): void {
    this.scope = scope;
  }

  /** 按 apiBinding 请求并提取数据 */
  async fetchData(api: ApiBinding): Promise<FetchResult> {
    const rawUrl = resolveTemplatedValue(api.url, this.scope);
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
      throw new Error('数据源 URL 未配置');
    }
    const url = /^https?:\/\//.test(rawUrl) ? rawUrl : this.baseUrl + rawUrl;
    assertFetchableUrl(url);
    const params = resolveTemplatedValue(api.params ?? {}, this.scope) as Record<string, any>;
    const method = api.method ?? 'GET';

    let finalUrl = url;
    const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
    if (method === 'GET') {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') qs.append(k, String(v));
      }
      const q = qs.toString();
      if (q) finalUrl = url + (url.includes('?') ? '&' : '?') + q;
    } else {
      init.body = JSON.stringify(params);
    }

    const res = await fetch(finalUrl, { ...init, signal: fetchTimeoutSignal() });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${finalUrl}`);
    }
    const json = await res.json();
    return {
      data: extractByPath(json, api.responsePath),
      total: api.totalProp ? extractByPath(json, api.totalProp) : undefined
    };
  }
}

// ---------------------------------------------------------------------------
// 事件动作链执行器 (L3)
// ---------------------------------------------------------------------------

export interface ActionContext {
  /** 页面全局状态（可响应式写入） */
  scope: Record<string, any>;
  /** 触发事件携带的数据（如表格行对象） */
  event?: any;
  getNode: (id: string) => ComponentNode | undefined;
  getLayer: (id: string) => LayerConfig | undefined;
  /** 刷新目标节点数据 */
  reloadNode: (id: string) => void | Promise<void>;
  /** 控制图层显隐 */
  setLayerVisible: (layerId: string, visible: boolean) => void;
  notify: (type: 'success' | 'info' | 'warning' | 'error', message: string) => void;
}

/** 按序执行动作链 */
export async function executeActions(actions: ActionNode[], ctx: ActionContext): Promise<void> {
  for (const action of actions) {
    try {
      await executeAction(action, ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : '动作执行失败';
      ctx.notify('error', message);
      break;
    }
  }
}

async function executeAction(action: ActionNode, ctx: ActionContext): Promise<void> {
  switch (action.type) {
    case 'set_state': {
      // 同时注入 event 与 $event（与模板 $event 语义一致，兼容两种写法）
      const entries = resolveTemplatedValue(action.payload ?? {}, {
        ...ctx.scope,
        event: ctx.event,
        $event: ctx.event
      });
      Object.assign(ctx.scope, entries);
      break;
    }
    case 'reload_data':
      if (!action.target) throw new Error('刷新数据缺少目标组件');
      await ctx.reloadNode(action.target);
      break;
    case 'open_dialog':
      if (!action.target) throw new Error('打开弹窗缺少目标图层');
      ctx.setLayerVisible(action.target, true);
      break;
    case 'close_dialog':
      if (!action.target) throw new Error('关闭弹窗缺少目标图层');
      ctx.setLayerVisible(action.target, false);
      break;
    case 'toggle_loading':
      if (!action.target) throw new Error('Loading 动作缺少目标图层');
      ctx.setLayerVisible(action.target, action.payload?.visible ?? true);
      break;
    case 'show_message':
      ctx.notify(action.payload?.messageType ?? 'info', action.payload?.messageText ?? '操作完成');
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// 节点事件总线（设计器内跨组件通信，如按钮触发表格 reload）
// ---------------------------------------------------------------------------

type Listener = (nodeId: string) => void;

const reloadListeners = new Map<string, Set<Listener>>();

export const nodeEventBus = {
  /** 订阅节点 reload（返回取消函数） */
  onReload(nodeId: string, handler: Listener): () => void {
    if (!reloadListeners.has(nodeId)) reloadListeners.set(nodeId, new Set());
    reloadListeners.get(nodeId)!.add(handler);
    return () => {
      reloadListeners.get(nodeId)?.delete(handler);
    };
  },
  /** 触发节点 reload */
  emitReload(nodeId: string): void {
    reloadListeners.get(nodeId)?.forEach((handler) => handler(nodeId));
  },
  /** 测试用：清空所有监听 */
  _clear(): void {
    reloadListeners.clear();
  }
};

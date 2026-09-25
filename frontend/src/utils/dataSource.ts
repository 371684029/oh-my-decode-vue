import { parseExpression } from './expression';
import { shouldRunAction } from './condition';
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
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
export const FORBIDDEN_STATE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function ipv4Parts(host: string): number[] | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const parts = match.slice(1).map((item) => Number(item));
  if (parts.some((item) => item > 255)) return null;
  return parts;
}

/** 云元数据与链路本地地址。本机和私网地址保留，方便对接用户自己的 API。 */
export function isBlockedFetchHost(hostname: string): boolean {
  const host = hostname
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^\[|\]$/g, '');
  if (host === 'metadata.google.internal' || host === 'metadata.google.internal.') return true;
  if (/^0x[0-9a-f]+$/i.test(host) || /^\d+$/.test(host)) return true;
  const ipv4 = ipv4Parts(host);
  if (ipv4 && ipv4[0] === 169 && ipv4[1] === 254) return true;
  if (host.includes(':')) {
    if (/^fe[89ab]/i.test(host)) return true;
    const mapped = /::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(host);
    if (mapped && isBlockedFetchHost(mapped[1])) return true;
  }
  return false;
}

/** URL 解析会把 0x7f000001 收成 127.0.0.1，拦截要看原始主机。 */
function rawHostname(url: string): string {
  const match = /^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i.exec(url);
  if (!match) return '';
  let authority = match[1];
  const at = authority.lastIndexOf('@');
  if (at >= 0) authority = authority.slice(at + 1);
  if (authority.startsWith('[')) {
    const end = authority.indexOf(']');
    return end >= 0 ? authority.slice(1, end) : authority;
  }
  return authority.replace(/:\d+$/, '');
}

/** 只允许相对路径与 http(s)，拒绝 javascript:、云元数据和链路本地地址 */
export function assertFetchableUrl(url: string): void {
  if (url.startsWith('/') && !url.startsWith('//')) return;
  if (isBlockedFetchHost(rawHostname(url))) {
    throw new Error('不允许访问该地址');
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('无效的数据源 URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('数据源仅允许 http 或 https');
  }
  if (isBlockedFetchHost(parsed.hostname)) {
    throw new Error('不允许访问该地址');
  }
}

/** 手动跟随重定向，每一跳都重新校验。 */
export async function fetchChecked(url: string, init: RequestInit = {}): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertFetchableUrl(current);
    const res = await fetch(current, { ...init, redirect: 'manual' });
    if (res.type === 'opaqueredirect' || REDIRECT_STATUSES.has(res.status)) {
      if (hop === MAX_REDIRECTS) throw new Error('重定向次数过多');
      const location = res.headers.get('location');
      if (!location) throw new Error('重定向缺少 Location');
      current = new URL(location, current).toString();
      continue;
    }
    return res;
  }
  throw new Error('重定向次数过多');
}

/** 出码产物内嵌的同一套请求函数（普通 JavaScript，供 SFC 与 HTML 共用）。 */
export const FETCH_CHECKED_SOURCE = `async function fetchChecked(url, init) {
  const maxHops = 3;
  const redirects = new Set([301, 302, 303, 307, 308]);
  const blockedHost = (hostname) => {
    const host = String(hostname || '').toLowerCase().replace(/\\.$/, '').replace(/^\\[|\\]$/g, '');
    if (host === 'metadata.google.internal') return true;
    if (/^0x[0-9a-f]+$/i.test(host) || /^\\d+$/.test(host)) return true;
    const ipv4 = /^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$/.exec(host);
    if (ipv4 && Number(ipv4[1]) === 169 && Number(ipv4[2]) === 254) return true;
    if (host.includes(':') && /^fe[89ab]/i.test(host)) return true;
    return false;
  };
  const rawHost = (value) => {
    const match = /^[a-z][a-z\\d+.-]*:\\/\\/([^/?#]*)/i.exec(value);
    if (!match) return '';
    let authority = match[1];
    const at = authority.lastIndexOf('@');
    if (at >= 0) authority = authority.slice(at + 1);
    if (authority.startsWith('[')) {
      const end = authority.indexOf(']');
      return end >= 0 ? authority.slice(1, end) : authority;
    }
    return authority.replace(/:\\d+$/, '');
  };
  const assertUrl = (value) => {
    if (value.startsWith('/') && !value.startsWith('//')) return;
    if (blockedHost(rawHost(value))) throw new Error('不允许访问该地址');
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('数据源仅允许 http 或 https');
    if (blockedHost(parsed.hostname)) throw new Error('不允许访问该地址');
  };
  let current = url;
  for (let hop = 0; hop <= maxHops; hop++) {
    assertUrl(current);
    const res = await fetch(current, Object.assign({}, init, { redirect: 'manual' }));
    if (res.type === 'opaqueredirect' || redirects.has(res.status)) {
      if (hop === maxHops) throw new Error('重定向次数过多');
      const location = res.headers.get('location');
      if (!location) throw new Error('重定向缺少 Location');
      current = new URL(location, current).toString();
      continue;
    }
    return res;
  }
  throw new Error('重定向次数过多');
}`;

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

    const res = await fetchChecked(finalUrl, { ...init, signal: fetchTimeoutSignal() });
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

function assignState(scope: Record<string, any>, payload: Record<string, any> | undefined, event: unknown): void {
  const entries = resolveTemplatedValue(payload ?? {}, {
    ...scope,
    event,
    $event: event
  });
  if (!entries || typeof entries !== 'object') return;
  for (const [key, value] of Object.entries(entries)) {
    if (FORBIDDEN_STATE_KEYS.has(key)) continue;
    scope[key] = value;
  }
}

async function executeAction(action: ActionNode, ctx: ActionContext): Promise<void> {
  if (!shouldRunAction(action.when, ctx.scope, ctx.event)) return;
  switch (action.type) {
    case 'set_state': {
      assignState(ctx.scope, action.payload, ctx.event);
      break;
    }
    case 'reload_data':
      if (!action.target) throw new Error('刷新数据缺少目标组件');
      await ctx.reloadNode(action.target);
      break;
    case 'open_dialog':
      if (!action.target) throw new Error('打开弹窗缺少目标图层');
      assignState(ctx.scope, action.payload, ctx.event);
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

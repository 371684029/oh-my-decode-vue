import { describe, expect, test, beforeEach, vi } from 'vitest';
import {
  extractByPath,
  resolveTemplatedValue,
  ApiExecutor,
  executeActions,
  nodeEventBus,
  assertFetchableUrl
} from './dataSource';
import type { ActionNode, ApiBinding } from '../types/designer';

beforeEach(() => {
  nodeEventBus._clear();
  vi.restoreAllMocks();
});

describe('extractByPath 响应路径提取', () => {
  const resp = { data: { list: [1, 2, 3], total: 3 }, msg: 'ok' };

  test('点路径提取', () => {
    expect(extractByPath(resp, 'data.list')).toEqual([1, 2, 3]);
    expect(extractByPath(resp, 'data.total')).toBe(3);
  });

  test('数组下标路径', () => {
    expect(extractByPath({ arr: [{ name: 'x' }, { name: 'y' }] }, 'arr[1].name')).toBe('y');
  });

  test('无路径返回原响应，缺失路径返回 undefined', () => {
    expect(extractByPath(resp)).toBe(resp);
    expect(extractByPath(resp, 'missing.path')).toBeUndefined();
    expect(extractByPath(null, 'a.b')).toBeUndefined();
  });
});

describe('resolveTemplatedValue 表达式递归求值', () => {
  const scope = { state: { page: 2 } };

  test('字符串表达式求值', () => {
    expect(resolveTemplatedValue('{{ state.page }}', scope)).toBe(2);
    expect(resolveTemplatedValue('plain', scope)).toBe('plain');
  });

  test('对象与数组递归', () => {
    expect(resolveTemplatedValue({ page: '{{ state.page }}', size: 10 }, scope)).toEqual({ page: 2, size: 10 });
    expect(resolveTemplatedValue(['{{ state.page }}', 3], scope)).toEqual([2, 3]);
  });
});

describe('ApiExecutor 统一请求层', () => {
  test('GET 拼接查询参数并对表达式求值', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { list: [{ id: 1 }], total: 1 } })
    });
    vi.stubGlobal('fetch', fetchMock);

    const executor = new ApiExecutor({ state: { page: 3 } }, 'https://api.example.com');
    const api: ApiBinding = {
      url: '/users',
      method: 'GET',
      params: { page: '{{ state.page }}', size: 10 },
      responsePath: 'data.list',
      totalProp: 'data.total'
    };

    const result = await executor.fetchData(api);
    expect(result.data).toEqual([{ id: 1 }]);
    expect(result.total).toBe(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('https://api.example.com/users?');
    expect(url).toContain('page=3');
    expect(url).toContain('size=10');
    expect(init.method).toBe('GET');
  });

  test('POST 请求体 JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { ok: true } }) });
    vi.stubGlobal('fetch', fetchMock);

    const executor = new ApiExecutor({}, 'https://api.example.com');
    await executor.fetchData({ url: '/login', method: 'POST', params: { user: 'admin', pass: 'x' } });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.com/login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ user: 'admin', pass: 'x' });
  });

  test('HTTP 非 2xx 抛出错误', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const executor = new ApiExecutor();
    await expect(executor.fetchData({ url: '/x' })).rejects.toThrow('HTTP 500');
  });

  test('重定向到元数据地址会被拒绝，本机地址仍允许', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      status: 302,
      ok: false,
      type: 'basic',
      headers: { get: (name: string) => (name.toLowerCase() === 'location' ? 'http://169.254.169.254/latest' : null) }
    });
    vi.stubGlobal('fetch', fetchMock);
    const executor = new ApiExecutor();
    await expect(executor.fetchData({ url: 'https://example.com/redirect' })).rejects.toThrow(/不允许/);
    expect(() => assertFetchableUrl('http://127.0.0.1:3001/api/schemas')).not.toThrow();
    expect(() => assertFetchableUrl('http://0x7f000001/')).toThrow(/不允许/);
  });

  test('拒绝非 http(s) 地址', async () => {
    const executor = new ApiExecutor();
    await expect(executor.fetchData({ url: 'javascript:alert(1)' })).rejects.toThrow(/http/);
    expect(() => assertFetchableUrl('https://169.254.169.254/latest')).toThrow(/不允许/);
    expect(() => assertFetchableUrl('/api/users')).not.toThrow();
  });

  test('未配置 URL 抛出错误', async () => {
    const executor = new ApiExecutor();
    await expect(executor.fetchData({ url: '' })).rejects.toThrow('URL 未配置');
  });
});

describe('nodeEventBus 节点 reload 通信', () => {
  test('订阅与取消订阅', () => {
    const handler = vi.fn();
    const unsub = nodeEventBus.onReload('tbl1', handler);

    nodeEventBus.emitReload('tbl1');
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();
    nodeEventBus.emitReload('tbl1');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('仅通知目标节点', () => {
    const a = vi.fn();
    const b = vi.fn();
    nodeEventBus.onReload('tbl_a', a);
    nodeEventBus.onReload('tbl_b', b);

    nodeEventBus.emitReload('tbl_a');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });
});

describe('executeActions 事件动作链', () => {
  test('when 为假时跳过该动作，下一条仍执行', async () => {
    const notify = vi.fn();
    const scope = { ok: false };
    await executeActions(
      [
        { id: 'a1', type: 'show_message', when: '{{ state.ok === true }}', payload: { messageText: '第一条' } },
        { id: 'a2', type: 'show_message', payload: { messageText: '第二条' } }
      ],
      {
        scope,
        getNode: () => undefined,
        getLayer: () => undefined,
        reloadNode: () => {},
        setLayerVisible: () => {},
        notify
      }
    );
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('info', '第二条');
    scope.ok = true;
    notify.mockClear();
    await executeActions(
      [
        { id: 'a1', type: 'show_message', when: '{{ state.ok === true }}', payload: { messageText: '第一条' } },
        { id: 'a2', type: 'show_message', payload: { messageText: '第二条' } }
      ],
      {
        scope,
        getNode: () => undefined,
        getLayer: () => undefined,
        reloadNode: () => {},
        setLayerVisible: () => {},
        notify
      }
    );
    expect(notify).toHaveBeenCalledTimes(2);
  });

  test('按序执行 set_state 与 show_message', async () => {
    const scope: Record<string, any> = { currentRow: null };
    const notify = vi.fn();

    const actions: ActionNode[] = [
      { id: 'a1', type: 'set_state', payload: { currentRow: '{{ $event.row }}' } },
      { id: 'a2', type: 'show_message', payload: { messageType: 'success', messageText: '操作完成' } }
    ];

    await executeActions(actions, {
      scope,
      event: { row: { id: 5 } },
      getNode: () => undefined,
      getLayer: () => undefined,
      reloadNode: () => {},
      setLayerVisible: () => {},
      notify
    });

    expect(scope.currentRow).toEqual({ id: 5 });
    expect(notify).toHaveBeenCalledWith('success', '操作完成');
  });

  test('open_dialog 写入 payload，并丢弃原型链键', async () => {
    const scope: Record<string, any> = {};
    const setLayerVisible = vi.fn();
    await executeActions(
      [
        {
          id: 'a1',
          type: 'open_dialog',
          target: 'layer_dlg',
          payload: JSON.parse('{"currentRow":"{{ $event.row }}","__proto__":{"polluted":true}}')
        }
      ],
      {
        scope,
        event: { row: { id: 9 } },
        getNode: () => undefined,
        getLayer: () => undefined,
        reloadNode: () => {},
        setLayerVisible,
        notify: () => {}
      }
    );
    expect(scope.currentRow).toEqual({ id: 9 });
    expect(({} as any).polluted).toBeUndefined();
    expect(setLayerVisible).toHaveBeenCalledWith('layer_dlg', true);
  });

  test('open_dialog / close_dialog / reload_data 动作', async () => {
    const setLayerVisible = vi.fn();
    const reload = vi.fn();

    await executeActions(
      [
        { id: 'a1', type: 'open_dialog', target: 'layer_dlg' },
        { id: 'a2', type: 'reload_data', target: 'tbl_users' }
      ],
      {
        scope: {},
        getNode: () => undefined,
        getLayer: () => undefined,
        reloadNode: reload,
        setLayerVisible,
        notify: () => {}
      }
    );

    expect(setLayerVisible).toHaveBeenCalledWith('layer_dlg', true);
    expect(reload).toHaveBeenCalledWith('tbl_users');
  });

  test('toggle_loading 按 payload.visible 控制', async () => {
    const setLayerVisible = vi.fn();
    await executeActions([{ id: 'a1', type: 'toggle_loading', target: 'layer_loading', payload: { visible: false } }], {
      scope: {},
      getNode: () => undefined,
      getLayer: () => undefined,
      reloadNode: () => {},
      setLayerVisible,
      notify: () => {}
    });
    expect(setLayerVisible).toHaveBeenCalledWith('layer_loading', false);
  });

  test('前面的动作失败后不再执行后续动作', async () => {
    const notify = vi.fn();
    const reload = vi.fn();
    await executeActions(
      [
        { id: 'a1', type: 'reload_data' },
        { id: 'a2', type: 'reload_data', target: 'tbl_users' }
      ],
      {
        scope: {},
        getNode: () => undefined,
        getLayer: () => undefined,
        reloadNode: reload,
        setLayerVisible: () => {},
        notify
      }
    );
    expect(notify).toHaveBeenCalledWith('error', '刷新数据缺少目标组件');
    expect(reload).not.toHaveBeenCalled();
  });
});

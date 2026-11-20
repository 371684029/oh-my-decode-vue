import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { MaterialManifest } from '../types/designer';

const { httpGet, httpPost, httpDelete, error, warning } = vi.hoisted(() => ({
  httpGet: vi.fn(),
  httpPost: vi.fn(),
  httpDelete: vi.fn(),
  error: vi.fn(),
  warning: vi.fn()
}));

vi.mock('../utils/http', () => ({
  http: {
    get: httpGet,
    post: httpPost,
    delete: httpDelete
  }
}));

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), warning, error, info: vi.fn() },
  ElMessageBox: { prompt: vi.fn() }
}));

import { useMaterialVersions } from './useMaterialVersions';

const manifest: MaterialManifest = {
  type: 'custom-widget',
  label: 'Widget',
  icon: 'Box',
  category: 'pro',
  kind: 'composite',
  defaultLayout: { w: 4, h: 4 },
  defaultProps: {},
  defaultAttrs: {},
  currentVersion: '1.0.0'
};

describe('useMaterialVersions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('openVersions 拉取版本列表并设置目标物料', async () => {
    httpGet.mockResolvedValue({
      data: { data: [{ version: '1.0.0', publishedAt: '2026-01-01', refCount: 2 }] }
    });
    const versions = useMaterialVersions();
    await versions.openVersions(manifest);
    expect(versions.versionTarget.value?.type).toBe('custom-widget');
    expect(versions.versionList.value).toHaveLength(1);
    expect(httpGet).toHaveBeenCalledWith('/materials/custom-widget/versions');
  });

  test('doUpgrade 缺版本时 warning 不发请求', async () => {
    const versions = useMaterialVersions();
    versions.versionTarget.value = manifest;
    await versions.doUpgrade();
    expect(warning).toHaveBeenCalledWith('请选择 from / to 版本');
    expect(httpPost).not.toHaveBeenCalled();
  });

  test('doRollback 成功后再拉版本列表', async () => {
    httpPost.mockResolvedValue({});
    httpGet.mockResolvedValue({ data: { data: [] } });
    const versions = useMaterialVersions();
    versions.versionTarget.value = manifest;
    await versions.doRollback('1.0.0');
    expect(httpPost).toHaveBeenCalledWith('/materials/custom-widget/rollback', { version: '1.0.0' });
    expect(httpGet).toHaveBeenCalled();
  });

  test('loadVersionList 失败时清空列表', async () => {
    httpGet.mockRejectedValue(new Error('net'));
    const versions = useMaterialVersions();
    versions.versionTarget.value = manifest;
    versions.versionList.value = [{ version: '9.9.9', publishedAt: '', refCount: 0 }];
    await versions.openVersions(manifest);
    expect(versions.versionList.value).toEqual([]);
  });
});
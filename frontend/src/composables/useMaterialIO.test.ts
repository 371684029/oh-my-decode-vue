import { beforeEach, describe, expect, test, vi } from 'vitest';

const { httpPost, warning, error, parseMaterialSource } = vi.hoisted(() => ({
  httpPost: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  parseMaterialSource: vi.fn()
}));

vi.mock('../utils/http', () => ({
  http: { post: httpPost }
}));

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), warning, error }
}));

vi.mock('../utils/materialImport', () => ({
  parseMaterialSource
}));

vi.mock('../registry/materialRegistry', () => ({
  registerMaterial: vi.fn(() => ({ ok: true }))
}));

import { useMaterialIO } from './useMaterialIO';

describe('useMaterialIO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('handlePasteImport 空内容提示 warning', async () => {
    const io = useMaterialIO();
    await io.handlePasteImport();
    expect(warning).toHaveBeenCalledWith('请先粘贴内容');
    expect(httpPost).not.toHaveBeenCalled();
  });

  test('handlePasteImport 解析失败走 errorText 兜底', async () => {
    const io = useMaterialIO();
    io.pasteText.value = 'bad';
    parseMaterialSource.mockImplementation(() => {
      throw new Error('parse boom');
    });
    await io.handlePasteImport();
    expect(error).toHaveBeenCalledWith('parse boom');
  });

  test('handlePasteImport 成功导入并清空粘贴区', async () => {
    const io = useMaterialIO();
    io.pasteText.value = '<!-- material -->';
    io.showPaste.value = true;
    parseMaterialSource.mockReturnValue({
      manifest: {
        type: 'custom-demo',
        label: 'Demo',
        icon: 'Box',
        category: 'pro',
        kind: 'composite',
        defaultLayout: { w: 2, h: 2 },
        defaultProps: {},
        defaultAttrs: {}
      },
      source: 'embedded'
    });
    httpPost.mockResolvedValue({});
    await io.handlePasteImport();
    expect(httpPost).toHaveBeenCalled();
    expect(io.pasteText.value).toBe('');
    expect(io.showPaste.value).toBe(false);
  });
});
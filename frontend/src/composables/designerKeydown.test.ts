import { beforeEach, describe, expect, test, vi } from 'vitest';
import { handleDesignerKeydown, type DesignerHotkeyStore } from './designerKeydown';

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), info: vi.fn() }
}));

function mockStore(overrides: Partial<DesignerHotkeyStore> = {}): DesignerHotkeyStore {
  return {
    selectedNodeId: 'n1',
    canUndo: true,
    canRedo: false,
    copySelectedNode: vi.fn(() => true),
    pasteNode: vi.fn(() => false),
    removeNode: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    openInspector: vi.fn(),
    moveSelectedNodeBy: vi.fn(() => true),
    ...overrides
  };
}

type TestKeyEvent = KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> };

function keyEvent(init: { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }): TestKeyEvent {
  const preventDefault = vi.fn();
  return {
    key: init.key,
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    shiftKey: init.shiftKey ?? false,
    preventDefault
  } as TestKeyEvent;
}

describe('handleDesignerKeydown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('canRun 为 false 时不调用 store', () => {
    const store = mockStore();
    handleDesignerKeydown(keyEvent({ key: 'Delete' }), store, false);
    expect(store.removeNode).not.toHaveBeenCalled();
  });

  test('Delete 删除选中节点并 preventDefault', () => {
    const store = mockStore();
    const e = keyEvent({ key: 'Delete' });
    handleDesignerKeydown(e, store, true);
    expect(store.removeNode).toHaveBeenCalledWith('n1');
    expect(e.preventDefault).toHaveBeenCalled();
  });

  test('Ctrl+Z 撤销', () => {
    const store = mockStore();
    const e = keyEvent({ key: 'z', ctrlKey: true });
    handleDesignerKeydown(e, store, true);
    expect(store.undo).toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
  });

  test('ArrowRight 默认步长 1', () => {
    const store = mockStore();
    const e = keyEvent({ key: 'ArrowRight' });
    handleDesignerKeydown(e, store, true);
    expect(store.moveSelectedNodeBy).toHaveBeenCalledWith(1, 0);
  });

  test('Shift+ArrowDown 步长 2', () => {
    const store = mockStore();
    const e = keyEvent({ key: 'ArrowDown', shiftKey: true });
    handleDesignerKeydown(e, store, true);
    expect(store.moveSelectedNodeBy).toHaveBeenCalledWith(0, 2);
  });
});
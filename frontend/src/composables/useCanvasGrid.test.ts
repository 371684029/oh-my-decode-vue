import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useDesignerStore } from '../stores/designerStore';
import { useCanvasGrid } from './useCanvasGrid';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('useCanvasGrid 历史步时机（v2.5.0 #7）', () => {
  test('onColsPreset 在变更前落历史步，相同列数不落步', () => {
    const store = useDesignerStore();
    const grid = useCanvasGrid(ref(false));
    const colsAtRecord: Array<number | undefined> = [];
    vi.spyOn(store, 'recordHistory').mockImplementation(() => {
      colsAtRecord.push(store.pageSchema.meta.grid?.cols);
    });

    grid.onColsPreset('16');
    // 记录时刻仍是旧列数（桌面默认 12）→ 证明是变更前落步
    expect(colsAtRecord).toEqual([12]);
    expect(store.pageSchema.meta.grid?.cols).toBe(16);

    grid.onColsPreset('16');
    expect(colsAtRecord).toEqual([12]);
  });

  test('onRowHeightChange 在变更前落历史步，无变化不落步', () => {
    const store = useDesignerStore();
    const grid = useCanvasGrid(ref(false));
    const rowAtRecord: Array<number | undefined> = [];
    vi.spyOn(store, 'recordHistory').mockImplementation(() => {
      rowAtRecord.push(store.pageSchema.meta.grid?.rowHeight);
    });

    grid.onRowHeightChange(80);
    expect(rowAtRecord).toEqual([50]);
    expect(store.pageSchema.meta.grid?.rowHeight).toBe(80);

    grid.onRowHeightChange(80);
    grid.onRowHeightChange(undefined);
    expect(rowAtRecord).toEqual([50]);
  });
});

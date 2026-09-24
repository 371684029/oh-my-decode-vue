import { beforeEach, describe, expect, test } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDesignerStore } from '../stores/designerStore';
import type { MaterialItem } from '../types/designer';

const material: MaterialItem = {
  type: 'el-button',
  label: '按钮 (Button)',
  icon: 'Pointer',
  category: 'element',
  defaultLayout: { w: 2, h: 2 },
  defaultProps: { text: '操作按钮', type: 'primary' },
  defaultAttrs: {}
};

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('designerStore 节点操作', () => {
  test('addNodeFromMaterial 添加节点并选中、记录历史', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(material);

    expect(store.pageSchema.children.length).toBe(1);
    const node = store.pageSchema.children[0];
    expect(node.type).toBe('el-button');
    expect(node.layout.w).toBe(2);
    expect(store.selectedNodeId).toBe(node.id);
    expect(store.isDrawerOpen).toBe(true);
    expect(store.canUndo).toBe(true);
  });

  test('undo/redo 撤销与重做', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(material);
    const id = store.pageSchema.children[0].id;

    store.undo();
    expect(store.pageSchema.children.length).toBe(0);
    expect(store.canRedo).toBe(true);

    store.redo();
    expect(store.pageSchema.children.length).toBe(1);
    expect(store.pageSchema.children[0].id).toBe(id);
  });

  test('历史栈上限 30 步', () => {
    const store = useDesignerStore();
    for (let i = 0; i < 35; i++) {
      store.addNodeFromMaterial(material);
    }
    expect(store.historyPast.length).toBe(30);
  });

  test('recordHistory 去重：连续无变化不重复记录', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(material);
    store.recordHistory(); // 记录当前状态
    const len = store.historyPast.length;
    store.recordHistory(); // 页面无变化 → 去重跳过
    store.recordHistory();
    expect(store.historyPast.length).toBe(len);
  });

  test('copySelectedNode / pasteNode 复制粘贴生成新 id', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(material);
    const originalId = store.pageSchema.children[0].id;

    expect(store.copySelectedNode()).toBe(true);
    expect(store.pasteNode()).toBe(true);

    expect(store.pageSchema.children.length).toBe(2);
    expect(store.pageSchema.children[0].id).toBe(originalId);
    expect(store.pageSchema.children[1].id).not.toBe(originalId);
  });

  test('removeNode 删除并清空选中', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(material);
    const id = store.pageSchema.children[0].id;

    store.removeNode(id);
    expect(store.pageSchema.children.length).toBe(0);
    expect(store.selectedNodeId).toBeNull();
    expect(store.isDrawerOpen).toBe(false);
  });

  test('moveSelectedNodeBy 方向键微调且不越界', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(material);

    expect(store.moveSelectedNodeBy(2, 3)).toBe(true);
    const node = store.pageSchema.children[0];
    expect(node.layout.x).toBe(2);
    expect(node.layout.y).toBe(3);

    // 不会移到负坐标
    expect(store.moveSelectedNodeBy(-10, -10)).toBe(true);
    expect(node.layout.x).toBe(0);
    expect(node.layout.y).toBe(0);
  });

  test('updateNodeLayout 记录单次历史', () => {
    const store = useDesignerStore();
    store.addNodeFromMaterial(material);
    const historyBefore = store.historyPast.length;

    store.updateNodeLayout([{ i: store.pageSchema.children[0].id, x: 5, y: 5, w: 2, h: 2 }]);
    expect(store.historyPast.length).toBe(historyBefore + 1);
    expect(store.pageSchema.children[0].layout.x).toBe(5);
  });
});

describe('designerStore 图层管理', () => {
  test('addLayer 三种类型默认 props', () => {
    const store = useDesignerStore();

    const dialogId = store.addLayer('dialog', '业务弹窗');
    expect(store.pageSchema.layers?.length).toBe(2);
    expect(store.activeLayerId).toBe(dialogId);
    expect(store.pageSchema.layers?.find((l) => l.id === dialogId)?.props?.title).toBe('业务弹窗');

    const htmlId = store.addLayer('custom-html', '自定义层');
    const htmlLayer = store.pageSchema.layers?.find((l) => l.id === htmlId);
    expect(htmlLayer?.props?.htmlCode).toContain('自定义 HTML 图层内容');
    expect(htmlLayer?.props?.scriptMounted).toContain('挂载时间');
  });

  test('removeLayer 不允许删除主画布图层', () => {
    const store = useDesignerStore();
    store.addLayer('loading', '加载层');

    store.removeLayer('layer_base_canvas');
    expect(store.pageSchema.layers?.length).toBe(2);
  });

  test('removeLayer 删除后回退主画布激活', () => {
    const store = useDesignerStore();
    const layerId = store.addLayer('loading', '加载层');

    store.removeLayer(layerId);
    expect(store.pageSchema.layers?.length).toBe(1);
    expect(store.activeLayerId).toBe('layer_base_canvas');
  });

  test('toggleLayerVisible 切换显隐并记录历史', () => {
    const store = useDesignerStore();
    const layerId = store.addLayer('dialog', '弹窗');
    const historyBefore = store.historyPast.length;

    store.toggleLayerVisible(layerId);
    expect(store.pageSchema.layers?.find((l) => l.id === layerId)?.visible).toBe(false);
    expect(store.historyPast.length).toBe(historyBefore + 1);
  });

  test('updateLayerProps 合并更新', () => {
    const store = useDesignerStore();
    const layerId = store.addLayer('dialog', '弹窗');

    store.updateLayerProps(layerId, { title: '新标题', width: '600px' });
    const layer = store.pageSchema.layers?.find((l) => l.id === layerId);
    expect(layer?.props?.title).toBe('新标题');
    expect(layer?.props?.width).toBe('600px');
  });
});

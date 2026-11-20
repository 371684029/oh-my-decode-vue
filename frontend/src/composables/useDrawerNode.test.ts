import { beforeEach, describe, expect, test } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDesignerStore } from '../stores/designerStore';
import { useDrawerNode } from './useDrawerNode';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('useDrawerNode', () => {
  test('formatEventPath 包装为插值语法', () => {
    const { formatEventPath } = useDrawerNode();
    expect(formatEventPath('state.foo')).toBe('{{ state.foo }}');
  });

  test('node 跟随 store.selectedNode', () => {
    const store = useDesignerStore();
    const { node } = useDrawerNode();
    expect(node.value).toBeNull();
    store.pageSchema.children.push({
      id: 'n_drawer',
      type: 'el-input',
      label: '输入',
      layout: { x: 0, y: 0, w: 4, h: 2, i: 'n_drawer' },
      props: {},
      attrs: {},
      style: {},
      events: {}
    });
    store.selectNode('n_drawer');
    expect(node.value?.id).toBe('n_drawer');
  });
});
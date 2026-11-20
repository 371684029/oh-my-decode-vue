import { describe, expect, test } from 'vitest';
import { createInitialState, designerGetters, type DesignerState } from './designerState';

describe('designerState', () => {
  test('createInitialState 含主画布图层且 children 同源', () => {
    const state = createInitialState();
    expect(state.editingLayerId).toBeNull();
    expect(state.pageSchema.layers?.some((l) => l.type === 'canvas')).toBe(true);
    const base = state.pageSchema.layers!.find((l) => l.type === 'canvas')!;
    expect(base.children).toBe(state.pageSchema.children);
  });

  test('getters：无选中时 selectedNode 为 null', () => {
    const state = createInitialState();
    expect(designerGetters.selectedNode(state)).toBeNull();
    expect(designerGetters.canUndo(state)).toBe(false);
    expect(designerGetters.canRedo(state)).toBe(false);
  });

  test('getters：editingLayerId 时 activeChildren 指向图层 children', () => {
    const state = createInitialState() as DesignerState;
    const layerId = 'layer_dialog';
    state.pageSchema.layers!.push({
      id: layerId,
      name: 'Dialog',
      type: 'dialog',
      visible: true,
      zIndex: 10,
      children: [
        {
          id: 'in_layer',
          type: 'el-button',
          layout: { x: 0, y: 0, w: 1, h: 1, i: 'in_layer' },
          label: '',
          props: {},
          attrs: {},
          style: {},
          events: {}
        }
      ]
    });
    state.editingLayerId = layerId;
    expect(designerGetters.activeChildren(state)).toBe(
      state.pageSchema.layers!.find((l) => l.id === layerId)!.children
    );
    state.selectedNodeId = 'in_layer';
    expect(designerGetters.selectedNode(state)?.id).toBe('in_layer');
  });
});
import { describe, expect, test } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDesignerStore } from '../stores/designerStore';
import { packNodesToManifest } from './materialPacker';
import { generateMaterialBundle } from './codeGenerator';
import { parseMaterialSource } from './materialImport';
import type { ComponentNode } from '../types/designer';

/**
 * 循环幂等测试 (v2.0.0 核心断言)：
 *   instantiate(package(nodes)) ≅ nodes
 * 即 打包 → 出码 → 导入 → 再打包 → 出码，结构（除 id 外）逐轮稳定。
 */

function node(
  id: string,
  type: string,
  x: number,
  y: number,
  w: number,
  h: number,
  events?: Record<string, any>,
  children?: ComponentNode[]
): ComponentNode {
  return {
    id,
    type,
    label: type,
    layout: { x, y, w, h, i: id },
    props: {},
    attrs: {},
    style: {},
    events: events || {},
    ...(children ? { children } : {})
  };
}

/** 构建一个带事件动作链 + 嵌套容器的手搭页面子树 */
function buildDemoNodes(): ComponentNode[] {
  const table = node('t1', 'pro-table', 0, 0, 12, 6, {
    rowClick: {
      enabled: true,
      actions: [
        { id: 'a1', type: 'set_state', target: 't1', payload: { active: '{{ row }}' } },
        { id: 'a2', type: 'open_dialog', target: 'dialog_x' }
      ]
    }
  });
  const container = node('c1', 'pro-container', 0, 6, 12, 4, undefined, [node('d1', 'el-input', 1, 1, 4, 2)]);
  return [table, container];
}

/** id 归一化：节点 id / layout.i / 树内事件 target 全部替换为 $n1/$n2... */
function normalizeTree(nodes: ComponentNode[]): any[] {
  const map = new Map<string, string>();
  let counter = 0;
  const assign = (list: ComponentNode[]) => {
    for (const n of list) {
      counter++;
      map.set(n.id, `$n${counter}`);
      if (n.children?.length) assign(n.children);
    }
  };
  assign(nodes);
  const rewrite = (list: ComponentNode[]): any[] =>
    list.map((n) => {
      const out: any = { ...n, id: map.get(n.id), layout: { ...n.layout, i: map.get(n.id) } };
      if (n.children?.length) out.children = rewrite(n.children);
      if (n.events) {
        const events = JSON.parse(JSON.stringify(n.events)) as Record<string, { actions?: Array<{ target?: string }> }>;
        for (const rule of Object.values(events)) {
          rule.actions?.forEach((a) => {
            if (a.target && map.has(a.target)) a.target = map.get(a.target);
          });
        }
        out.events = events;
      }
      return out;
    });
  return rewrite(nodes);
}

describe('物料循环幂等 (v2.0.0)', () => {
  test('打包 → 出码 → 导入：结构等价（仅 id 不同）', () => {
    const manifest = packNodesToManifest({
      nodes: buildDemoNodes(),
      label: '演示物料',
      icon: 'Box',
      category: 'pro'
    });
    const bundle = generateMaterialBundle(manifest);
    expect(bundle.vue).toContain('@lowcode-material');

    const parsed = parseMaterialSource(bundle.vue, `${manifest.type}.vue`);
    expect(parsed.source).toBe('embedded-comment');

    expect(JSON.stringify(normalizeTree(parsed.manifest.schema!))).toBe(
      JSON.stringify(normalizeTree(manifest.schema!))
    );
  });

  test('连续 3 轮循环后结构稳定（无漂移）', () => {
    let current = packNodesToManifest({
      nodes: buildDemoNodes(),
      label: '演示物料',
      icon: 'Box',
      category: 'pro'
    });
    const baseline = JSON.stringify(normalizeTree(current.schema!));

    for (let round = 1; round <= 3; round++) {
      const bundle = generateMaterialBundle(current);
      const parsed = parseMaterialSource(bundle.vue, `${current.type}.vue`);
      expect(parsed.source).toBe('embedded-comment');
      expect(parsed.manifest.type).toBe(current.type);
      expect(JSON.stringify(normalizeTree(parsed.manifest.schema!))).toBe(baseline);
      current = parsed.manifest;
    }
  });

  test('实例化后子树与原始打包源等价（循环不变式 instantiate(package(nodes)) ≅ nodes）', () => {
    setActivePinia(createPinia());
    const store = useDesignerStore();

    const manifest = packNodesToManifest({
      nodes: buildDemoNodes(),
      label: '演示物料',
      icon: 'Box',
      category: 'pro'
    });
    store.addCompositeFromMaterial(manifest, 0, 0);

    expect(JSON.stringify(normalizeTree(store.pageSchema.children))).toBe(
      JSON.stringify(normalizeTree(manifest.schema!))
    );
  });
});

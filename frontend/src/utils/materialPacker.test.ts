import { beforeEach, describe, expect, test } from 'vitest';
import { packNodesToManifest, slugifyType } from './materialPacker';
import { registerMaterial, resetMaterialRegistry } from '../registry/materialRegistry';
import type { ComponentNode, MaterialManifest } from '../types/designer';

function node(id: string, type = 'el-button', x = 0, y = 0, w = 2, h = 2, children?: ComponentNode[]): ComponentNode {
  return {
    id,
    type,
    label: type,
    layout: { x, y, w, h, i: id },
    props: {},
    attrs: {},
    style: {},
    events: {},
    ...(children ? { children } : {})
  };
}

beforeEach(() => {
  resetMaterialRegistry();
});

describe('slugifyType', () => {
  test('英文名转小写连字符', () => {
    expect(slugifyType('Search Bar')).toBe('search-bar');
    expect(slugifyType('!!!')).toBe('material-2d53a7');
  });

  test('纯中文无 ASCII 时退化带短哈希后缀', () => {
    const slug = slugifyType('用户卡片');
    expect(slug).toMatch(/^material-[a-f0-9]{6}$/);
    // 相同 label 稳定生成相同 type
    expect(slugifyType('用户卡片')).toBe(slug);
  });
});

describe('packNodesToManifest 映射规则', () => {
  test('包围盒尺寸与坐标归一化', () => {
    const manifest = packNodesToManifest({
      nodes: [node('a', 'el-button', 2, 1, 2, 2), node('b', 'el-tag', 6, 3, 2, 2)],
      label: '用户卡片',
      icon: 'Box',
      category: 'pro'
    });
    // 包围盒: x 2..8, y 1..5 → w=6, h=4
    expect(manifest.defaultLayout).toEqual({ w: 6, h: 4 });
    // 归一化后最小坐标为 0
    const xs = manifest.schema!.map((n) => n.layout.x);
    const ys = manifest.schema!.map((n) => n.layout.y);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.min(...ys)).toBe(0);
    expect(manifest.type).toMatch(/^custom-material-/);
    expect(manifest.kind).toBe('composite');
  });

  test('嵌套容器 children 一并归一化与统计', () => {
    const container = node('c', 'pro-container', 1, 1, 8, 4, [node('d', 'el-input', 1, 1, 3, 2)]);
    const manifest = packNodesToManifest({ nodes: [container], label: '搜索区', icon: 'Box', category: 'pro' });
    expect(manifest.defaultLayout.w).toBe(8);
    expect(manifest.defaultLayout.h).toBe(4);
    const inner = manifest.schema![0].children![0];
    expect(inner.layout.x).toBe(0);
    expect(inner.layout.y).toBe(0);
    expect(manifest.summary).toContain('pro-container');
    expect(manifest.summary).toContain('el-input');
  });

  test('复合物料节点展开为其 schema 快照', () => {
    registerMaterial({
      type: 'custom-inner',
      label: '内部物料',
      icon: 'Box',
      category: 'pro',
      defaultLayout: { w: 4, h: 4 },
      defaultProps: {},
      defaultAttrs: {},
      kind: 'composite',
      schema: [node('x1', 'el-card', 0, 0, 4, 4)],
      summary: ['el-card']
    });
    // 画布上有一个 custom-inner 节点（位置 5,5）
    const manifest = packNodesToManifest({
      nodes: [node('outer', 'custom-inner', 5, 5, 4, 4)],
      label: '外层物料',
      icon: 'Box',
      category: 'pro'
    });
    // 展开后 schema 是 el-card（位置平移到 5,5 → 归一化 0,0）
    expect(manifest.schema!.length).toBe(1);
    expect(manifest.schema![0].type).toBe('el-card');
    expect(manifest.schema![0].layout.x).toBe(0);
    expect(manifest.schema![0].layout.y).toBe(0);
    expect(manifest.summary).toEqual(['el-card']);
  });

  test('循环引用物料拒绝打包', () => {
    // A 的 schema 含 B；B 的 schema 含 A → 打包时检测到环
    const manifestA = {
      type: 'custom-loop-a',
      label: '环A',
      icon: 'Box',
      category: 'pro',
      defaultLayout: { w: 4, h: 4 },
      defaultProps: {},
      defaultAttrs: {},
      kind: 'composite' as const,
      summary: ['custom-loop-b']
    } as MaterialManifest;
    const manifestB = {
      type: 'custom-loop-b',
      label: '环B',
      icon: 'Box',
      category: 'pro',
      defaultLayout: { w: 4, h: 4 },
      defaultProps: {},
      defaultAttrs: {},
      kind: 'composite' as const,
      summary: ['custom-loop-a']
    } as MaterialManifest;
    // 直接构造环：A.schema 含 B 节点，B.schema 含 A 节点
    manifestA.schema = [node('b-node', 'custom-loop-b', 0, 0, 4, 4)];
    manifestB.schema = [node('a-node', 'custom-loop-a', 0, 0, 4, 4)];
    registerMaterial(manifestA);
    registerMaterial(manifestB);

    expect(() =>
      packNodesToManifest({ nodes: [node('root', 'custom-loop-a', 0, 0, 4, 4)], label: '环测试', icon: 'Box', category: 'pro' })
    ).toThrow(/循环引用/);
  });

  test('空选中或空名称拒绝打包', () => {
    expect(() => packNodesToManifest({ nodes: [], label: 'x', icon: 'Box', category: 'pro' })).toThrow(/选中/);
    expect(() => packNodesToManifest({ nodes: [node('a')], label: '', icon: 'Box', category: 'pro' })).toThrow(/名称/);
  });
});

import { describe, expect, test } from 'vitest';
import { parseMaterialSource } from './materialImport';
import { buildMaterialManifestComment } from './codeGenerator';
import type { MaterialManifest } from '../types/designer';

function sampleManifest(type = 'custom-user-card'): MaterialManifest {
  return {
    type,
    label: '用户卡片',
    icon: 'Avatar',
    category: 'pro',
    defaultLayout: { w: 6, h: 4 },
    defaultProps: {},
    defaultAttrs: {},
    kind: 'composite',
    schema: [
      {
        id: 'n1',
        type: 'el-card',
        label: '卡片',
        layout: { x: 0, y: 0, w: 6, h: 4, i: 'n1' },
        props: { header: '标题--带横线' },
        attrs: {},
        style: {},
        events: {}
      }
    ],
    summary: ['el-card']
  };
}

describe('parseMaterialSource 导入管道', () => {
  test('.json 直接解析为 manifest', () => {
    const result = parseMaterialSource(JSON.stringify(sampleManifest()), 'user-card.json');
    expect(result.source).toBe('manifest-json');
    expect(result.manifest.type).toBe('custom-user-card');
    expect(result.manifest.schema?.length).toBe(1);
  });

  test('无文件名但以 { 开头也按 JSON 处理', () => {
    const result = parseMaterialSource(JSON.stringify(sampleManifest()));
    expect(result.source).toBe('manifest-json');
  });

  test('.vue 内嵌注释块提取（含 -- 转义往返）', () => {
    const vue = buildMaterialManifestComment(sampleManifest()) + '<template><div>组件</div></template>';
    const result = parseMaterialSource(vue, 'user-card.vue');
    expect(result.source).toBe('embedded-comment');
    // -- 经 \u002d 转义后 JSON.parse 还原
    expect(result.manifest.schema?.[0].props.header).toBe('标题--带横线');
    expect(result.manifest.type).toBe('custom-user-card');
  });

  test('无注释块的第三方源码降级为空快照物料', () => {
    const source = '<template><div>第三方组件</div></template>\n<script setup>const a = 1</script>';
    const result = parseMaterialSource(source, 'my-widget.vue');
    expect(result.source).toBe('degraded');
    expect(result.manifest.type).toBe('custom-my-widget');
    expect(result.manifest.kind).toBe('composite');
    expect(result.manifest.schema).toEqual([]);
  });

  test('非法 JSON 拒绝', () => {
    expect(() => parseMaterialSource('{"type": broken', 'x.json')).toThrow();
  });

  test('非 custom- 前缀的 type 拒绝', () => {
    const bad = JSON.stringify({ ...sampleManifest('pro-table') });
    expect(() => parseMaterialSource(bad, 'x.json')).toThrow(/custom-/);
  });

  test('空文件拒绝', () => {
    expect(() => parseMaterialSource('   ', 'x.json')).toThrow(/为空/);
  });
});

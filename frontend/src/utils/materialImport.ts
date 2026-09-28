import type { MaterialManifest } from '../types/designer';

/**
 * 物料导入管道 (v2.0.0)
 * 1. .json → 直接解析为 MaterialManifest（manifest-json）
 * 2. .vue/.html/.js → 提取 @lowcode-material 注释块（embedded-comment，零猜测还原）
 * 3. 无注释块 → 降级为空快照物料（degraded，注册成功但不可拖拽，需编辑定义）
 */

export type MaterialImportSource = 'manifest-json' | 'embedded-comment' | 'degraded';

export interface MaterialImportResult {
  manifest: MaterialManifest;
  source: MaterialImportSource;
}

/** 内嵌注释块提取：<!-- @lowcode-material {json} -->。贪婪匹配到最后一个 }（JSON 根闭合）。 */
const MANIFEST_COMMENT_RE = /<!--\s*@lowcode-material\s+(\{[\s\S]*\})\s*-->/;

/** 前端基本结构校验（完整强校验在后端 Zod；这里拦截明显非法输入） */
function validateBasic(manifest: unknown): asserts manifest is MaterialManifest {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('不是合法的物料定义');
  }
  const m = manifest as Record<string, any>;
  if (typeof m.type !== 'string' || !m.type.startsWith('custom-')) {
    throw new Error('物料 type 必须以 custom- 前缀开头');
  }
  if (m.kind !== 'composite') {
    throw new Error('导入物料必须是 composite 类型');
  }
  if (!Array.isArray(m.schema)) {
    throw new Error('物料缺少 schema 快照');
  }
}

/** 无注释块降级：从文件名猜名称，空快照（不可拖拽） */
function degradedManifest(filename: string): MaterialManifest {
  const base = filename.replace(/\.(vue|html|js|json)$/i, '').trim() || '导入物料';
  const slug =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'material';
  return {
    type: `custom-${slug}`,
    label: base,
    icon: 'Box',
    category: 'pro',
    defaultLayout: { w: 4, h: 4 },
    defaultProps: {},
    defaultAttrs: {},
    kind: 'composite',
    schema: [],
    summary: []
  };
}

export function parseMaterialSource(text: string, filename = ''): MaterialImportResult {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) {
    throw new Error('文件内容为空');
  }

  const isJsonFile = /\.json$/i.test(filename);
  if (isJsonFile || (!filename && trimmed.startsWith('{'))) {
    const manifest = JSON.parse(trimmed) as unknown;
    validateBasic(manifest);
    return { manifest, source: 'manifest-json' };
  }

  const match = trimmed.match(MANIFEST_COMMENT_RE);
  if (match) {
    const manifest = JSON.parse(match[1]) as unknown;
    validateBasic(manifest);
    return { manifest, source: 'embedded-comment' };
  }

  return { manifest: degradedManifest(filename), source: 'degraded' };
}

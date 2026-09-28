import type { ComponentNode, MaterialCategory, MaterialContract, MaterialInput, MaterialManifest, MaterialOutput } from '@lowcode/shared';
import { getMaterial } from '../registry/materialRegistry';

/**
 * 物料打包映射 (v2.0.0)：画布节点组 → MaterialManifest
 * - 扁平化：复合物料节点展开为其 schema 快照（visited 防环 + 深度上限）
 * - 包围盒：外接矩形尺寸 → defaultLayout
 * - 坐标归一化：所有 layout 减去包围盒左上角，存相对布局
 * - summary：聚合组件类型清单（展示用）
 */

export const MAX_MATERIAL_DEPTH = 5;

export interface PackOptions {
  nodes: ComponentNode[];
  label: string;
  icon: string;
  category: MaterialCategory;
  /** 打包形态：expand = v2.0 展开物料（默认）；blackbox = v2.1 黑盒物料（附带契约） */
  mode?: 'expand' | 'blackbox';
}

/** FNV-1a 短哈希（与出码引擎一致），用于纯中文等无 ASCII 字符的 label 生成稳定后缀 */
function shortHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}

export function slugifyType(label: string): string {
  const slug = String(label ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug) return slug;
  // 纯中文等：附加短哈希，避免多个物料全部退化为同一 type
  return `material-${shortHash(String(label ?? ''))}`;
}

/** 树遍历：整体平移坐标 */
function translateAll(nodes: ComponentNode[], tx: number, ty: number): void {
  for (const node of nodes) {
    node.layout.x += tx;
    node.layout.y += ty;
    if (node.children?.length) translateAll(node.children, tx, ty);
  }
}

/** 树遍历：收集最小/最大边界 */
function measureBounds(nodes: ComponentNode[], bounds: { minX: number; minY: number; maxX: number; maxY: number }): void {
  for (const node of nodes) {
    bounds.minX = Math.min(bounds.minX, node.layout.x);
    bounds.minY = Math.min(bounds.minY, node.layout.y);
    bounds.maxX = Math.max(bounds.maxX, node.layout.x + node.layout.w);
    bounds.maxY = Math.max(bounds.maxY, node.layout.y + node.layout.h);
    if (node.children?.length) measureBounds(node.children, bounds);
  }
}

/**
 * 扁平化展开：普通节点原样复制（children 保留）；
 * 复合物料节点替换为其 schema 快照（快照已 0 起点归一化，平移到该节点位置）。
 * visited + depth 上限防循环引用与无限嵌套。
 */
function expandNodes(nodes: ComponentNode[], visited: Set<string>, depth: number): ComponentNode[] {
  if (depth > MAX_MATERIAL_DEPTH) {
    throw new Error(`物料嵌套深度超过上限 ${MAX_MATERIAL_DEPTH}，无法打包`);
  }
  const out: ComponentNode[] = [];
  for (const node of nodes) {
    const material = getMaterial(node.type);
    if (material?.kind === 'composite' && material.schema?.length) {
      if (visited.has(material.type)) {
        throw new Error(`检测到循环引用物料: ${material.type}，无法打包`);
      }
      visited.add(material.type);
      const snapshot = JSON.parse(JSON.stringify(material.schema)) as ComponentNode[];
      translateAll(snapshot, node.layout.x, node.layout.y);
      out.push(...expandNodes(snapshot, visited, depth + 1));
      visited.delete(material.type);
    } else {
      out.push(JSON.parse(JSON.stringify(node)) as ComponentNode);
    }
  }
  return out;
}

/** 树遍历：聚合去重组件类型清单 */
function collectSummary(nodes: ComponentNode[], seen: Set<string>, summary: string[]): void {
  for (const node of nodes) {
    if (!seen.has(node.type)) {
      seen.add(node.type);
      summary.push(node.type);
    }
    if (node.children?.length) collectSummary(node.children, seen, summary);
  }
}

export function packNodesToManifest(opts: PackOptions): MaterialManifest {
  if (!opts.nodes || opts.nodes.length === 0) {
    throw new Error('请先选中要打包的组件');
  }
  if (!opts.label || !opts.label.trim()) {
    throw new Error('请填写物料名称');
  }

  const expanded = expandNodes(opts.nodes, new Set(), 1);

  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  measureBounds(expanded, bounds);
  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) {
    throw new Error('选中节点缺少有效布局信息，无法打包');
  }

  // 归一化：包围盒左上角归零
  const schema = JSON.parse(JSON.stringify(expanded)) as ComponentNode[];
  translateAll(schema, -bounds.minX, -bounds.minY);

  const summary: string[] = [];
  collectSummary(schema, new Set(), summary);

  const type = `custom-${slugifyType(opts.label)}`;
  const manifest: MaterialManifest = {
    type,
    label: opts.label.trim(),
    icon: opts.icon,
    category: opts.category,
    defaultLayout: {
      w: Math.max(1, Math.round(bounds.maxX - bounds.minX)),
      h: Math.max(1, Math.round(bounds.maxY - bounds.minY))
    },
    defaultProps: {},
    defaultAttrs: {},
    kind: 'composite',
    schema,
    summary
  };
  if (opts.mode === 'blackbox') {
    manifest.contract = buildContract(schema);
    manifest.currentVersion = '1.0.0';
  }
  return manifest;
}

/** 自动生成契约：顶层可暴露字段 → inputs；已配置事件 → outputs（黑盒模式） */
export function buildContract(schema: ComponentNode[]): MaterialContract {
  const inputs: MaterialInput[] = [];
  const outputs: MaterialOutput[] = [];
  const inputCandidates: Array<[string, string]> = [
    ['props.title', '标题'],
    ['props.text', '文本'],
    ['props.header', '标题'],
    ['props.placeholder', '占位提示'],
    ['props.content', '内容'],
    ['props.label', '标签']
  ];
  const seenInput = new Set<string>();
  const seenOutput = new Set<string>();

  const walk = (nodes: ComponentNode[]) => {
    for (const node of nodes) {
      for (const [fieldPath, label] of inputCandidates) {
        const segments = fieldPath.split('.');
        let value: unknown = node;
        for (const seg of segments) {
          value = (value as Record<string, unknown> | undefined)?.[seg];
        }
        if (typeof value === 'string' && value.length > 0) {
          const name = `${node.id}_${segments[segments.length - 1]}`;
          if (!seenInput.has(name)) {
            seenInput.add(name);
            inputs.push({ name, label, type: 'string', nodeId: node.id, fieldPath, required: false });
          }
        }
      }
      for (const eventName of Object.keys(node.events || {})) {
        const name = `${node.id}_${eventName}`;
        if (!seenOutput.has(name)) {
          seenOutput.add(name);
          outputs.push({ name, label: eventName, nodeId: node.id, event: eventName });
        }
      }
      if (node.children?.length) walk(node.children);
    }
  };
  walk(schema);
  return { inputs, outputs };
}

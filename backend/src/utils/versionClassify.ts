import type { MaterialContract, MaterialVersion } from '../types/schema';
import { shortHash } from '@lowcode/shared';
import { createPatch } from './jsonPatch';

/**
 * 版本号判定 (v2.1.0)
 * 规则：
 * 1. 契约签名不同 → major（破坏性：注入点/出口变化）
 * 2. 存在 add/remove 结构操作（节点、字段、配置项增删）→ minor
 * 3. 仅 replace（值级变化：文案、样式值、布局）→ patch
 * 4. 完全无差异 → none（禁止发布空版本）
 */

/** 契约签名：inputs/outputs 规范化（key 排序）后哈希 */
export function contractSignature(contract: MaterialContract): string {
  const canon = {
    inputs: (contract.inputs || [])
      .map((i) => ({ name: i.name, type: i.type, nodeId: i.nodeId, fieldPath: i.fieldPath, required: i.required }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    outputs: (contract.outputs || [])
      .map((o) => ({ name: o.name, nodeId: o.nodeId, event: o.event }))
      .sort((a, b) => a.name.localeCompare(b.name))
  };
  return shortHash(JSON.stringify(canon));
}

/**
 * 版本判定用最小节点结构：只声明实际访问的字段（替代 any，v2.5 类型收口）。
 * ComponentNode 结构上可赋值给本接口，生产调用方零改动。
 */
export interface VersionTreeNode {
  id: string;
  type?: string;
  children?: VersionTreeNode[];
  props?: Record<string, unknown>;
  config?: Record<string, unknown>;
  events?: Record<string, unknown>;
  layout?: Record<string, unknown>;
}

/** id 归一化：节点 id / layout.i 替换为 $n0/$n1...（先序），避免重新打包导致的 id 漂移污染 diff */
export function normalizeNodeIds(nodes: VersionTreeNode[]): VersionTreeNode[] {
  const map = new Map<string, string>();
  let counter = 0;
  const assign = (list: VersionTreeNode[]) => {
    for (const n of list) {
      counter++;
      map.set(n.id, `$n${counter}`);
      if (Array.isArray(n.children)) assign(n.children);
    }
  };
  assign(nodes);
  const rewrite = (list: VersionTreeNode[]): VersionTreeNode[] =>
    list.map((n) => {
      const id = map.get(n.id) ?? n.id;
      const out: VersionTreeNode = { ...n, id, layout: { ...n.layout, i: id } };
      if (Array.isArray(n.children)) out.children = rewrite(n.children);
      return out;
    });
  return rewrite(nodes);
}

export type VersionBump = 'major' | 'minor' | 'patch' | 'none';

export interface VersionClassifyResult {
  bump: VersionBump;
  schemaOpsCount: number;
  contractChanged: boolean;
}

/**
 * 结构签名：忽略值、只保留结构特征的树哈希
 * 节点 type / props key 集 / config key 集 / events key 集 / children 递归。
 * 结构变化 = 组件增删、字段增删、事件增删 → minor；结构相同仅值变化 → patch。
 */
export function structuralSignature(nodes: VersionTreeNode[]): string {
  const build = (n: VersionTreeNode): unknown => ({
    t: n.type,
    p: Object.keys(n.props || {}).sort(),
    g: n.config ? Object.keys(n.config).sort() : null,
    e: Object.keys(n.events || {}).sort(),
    k: n.children && n.children.length ? n.children.map(build) : null
  });
  return shortHash(JSON.stringify(nodes.map(build)));
}

/** 判定建议版本类型 */
export function classifyVersionChange(prev: MaterialVersion, next: MaterialVersion): VersionClassifyResult {
  const prevSig = contractSignature(prev.contract);
  const nextSig = contractSignature(next.contract);
  const contractChanged = prevSig !== nextSig;
  if (contractChanged) {
    return { bump: 'major', schemaOpsCount: 0, contractChanged };
  }
  // 结构签名不同 → minor（组件/字段/事件增删）
  if (structuralSignature(prev.schema) !== structuralSignature(next.schema)) {
    return { bump: 'minor', schemaOpsCount: 0, contractChanged };
  }
  // 结构相同：值级对比
  const ops = createPatch(normalizeNodeIds(prev.schema), normalizeNodeIds(next.schema));
  if (ops.length === 0) {
    return { bump: 'none', schemaOpsCount: 0, contractChanged };
  }
  return { bump: 'patch', schemaOpsCount: ops.length, contractChanged };
}

/** 按 bump 推进版本号：1.2.3 → major=2.0.0 / minor=1.3.0 / patch=1.2.4 */
export function suggestVersion(current: string, bump: VersionBump): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(current || ''));
  const major = match ? Number(match[1]) : 1;
  const minor = match ? Number(match[2]) : 0;
  const patch = match ? Number(match[3]) : 0;
  switch (bump) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      return current || '1.0.0';
  }
}

/** 变更摘要自动生成（基于判定中间产物） */
export function buildChangelog(prev: MaterialVersion | null, next: MaterialVersion, bump: VersionBump): string {
  const parts: string[] = [];
  const contractChanged = prev ? contractSignature(prev.contract) !== contractSignature(next.contract) : false;
  if (contractChanged) parts.push('契约变更（inputs/outputs 增删改）');
  if (prev) {
    if (structuralSignature(prev.schema) !== structuralSignature(next.schema)) {
      parts.push('结构变更（组件/字段/事件增删）');
    }
    const ops = createPatch(normalizeNodeIds(prev.schema), normalizeNodeIds(next.schema));
    const replaced = ops.filter((op) => op.op === 'replace').length;
    if (replaced > 0) parts.push(`调整 ${replaced} 处配置值`);
  }
  if (parts.length === 0) return '首次发布';
  return `${bump === 'major' ? '[破坏性] ' : ''}${parts.join('；')}`;
}

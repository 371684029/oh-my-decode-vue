import type { ComponentNode } from '../types/designer';

/** 在节点树中按 id 查找（含 pro-container 等嵌套 children） */
export function findNode(nodes: ComponentNode[] | undefined, id: string): ComponentNode | null {
  for (const node of nodes || []) {
    if (node.id === id) return node;
    const nested = findNode(node.children, id);
    if (nested) return nested;
  }
  return null;
}

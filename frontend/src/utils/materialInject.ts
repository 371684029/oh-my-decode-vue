import type { ComponentNode, MaterialContract } from '../types/designer';

/**
 * 黑盒注入 (v2.1.0)
 * - injectInputs：实例 inputs 值 → 快照对应注入点（深拷贝后写入，不污染物料定义）
 * - mapOutputEvents：内部事件与实例 output 绑定对齐（output 由实例动作链接管，其余保留内部链）
 * - findOutputFor：内部节点事件 → 匹配的 output（反向映射）
 */

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function findNodeById(nodes: ComponentNode[], id: string): ComponentNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children?.length) {
      const found = findNodeById(n.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** 实例 inputs 注入：未配置的值不注入（用快照默认值） */
export function injectInputs(snapshot: ComponentNode[], instance: ComponentNode, contract: MaterialContract): ComponentNode[] {
  const clone = deepClone(snapshot);
  for (const input of contract.inputs || []) {
    const value = instance.props?.[input.name];
    if (value === undefined) continue;
    const node = findNodeById(clone, input.nodeId);
    if (!node) continue; // 注入点失效 → 跳过（容错）
    const segments = input.fieldPath.split('.');
    let cursor: any = node;
    let ok = true;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (cursor[seg] === undefined || typeof cursor[seg] !== 'object') {
        ok = false;
        break;
      }
      cursor = cursor[seg];
    }
    if (ok && cursor && typeof cursor === 'object') {
      cursor[segments[segments.length - 1]] = value;
    }
  }
  return clone;
}

/** 内部节点事件 → 匹配的 output（无则 null） */
export function findOutputFor(
  contract: MaterialContract,
  nodeId: string,
  eventName: string
): { name: string; label: string } | null {
  const out = (contract.outputs || []).find((o) => o.nodeId === nodeId && o.event === eventName);
  return out ? { name: out.name, label: out.label } : null;
}

/**
 * outputs 对齐：把快照内匹配 output 的内部事件替换为实例绑定的动作链（事件 key 改为 output.name）。
 * 未匹配 output 的事件保留内部动作链；实例未绑定该 output 时降级为内部链。
 */
export function mapOutputEvents(
  snapshot: ComponentNode[],
  instance: ComponentNode,
  contract: MaterialContract
): ComponentNode[] {
  const clone = injectInputs(snapshot, instance, contract);
  const walk = (nodes: ComponentNode[]) => {
    for (const n of nodes) {
      if (n.events && Object.keys(n.events).length > 0) {
        const nextEvents: Record<string, any> = {};
        for (const [key, rule] of Object.entries(n.events)) {
          const out = findOutputFor(contract, n.id, key);
          const instanceRule = out ? instance.events?.[out.name] : undefined;
          if (out && instanceRule) {
            nextEvents[out.name] = instanceRule; // 实例动作链接管
          } else if (out) {
            nextEvents[key] = rule; // 实例未绑定 → 保留内部链
          } else {
            nextEvents[key] = rule;
          }
        }
        n.events = nextEvents;
      }
      if (n.children?.length) walk(n.children);
    }
  };
  walk(clone);
  return clone;
}

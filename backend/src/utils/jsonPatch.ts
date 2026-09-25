/** 与前端撤销栈共用的 JSON Patch 子集，供审计日志记录字段差异。 */

export interface JsonPatchOp {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
}

function encodeToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diff(from: unknown, to: unknown, path: string, ops: JsonPatchOp[]): void {
  if (sameJson(from, to)) return;
  if (Array.isArray(from) || Array.isArray(to) || !isPlainObject(from) || !isPlainObject(to)) {
    ops.push({ op: 'replace', path, value: to });
    return;
  }
  const keys = new Set([...Object.keys(from), ...Object.keys(to)]);
  for (const key of keys) {
    const child = `${path}/${encodeToken(key)}`;
    if (!Object.prototype.hasOwnProperty.call(from, key)) {
      ops.push({ op: 'add', path: child, value: to[key] });
    } else if (!Object.prototype.hasOwnProperty.call(to, key)) {
      ops.push({ op: 'remove', path: child });
    } else {
      diff(from[key], to[key], child, ops);
    }
  }
}

export function createPatch(from: unknown, to: unknown): JsonPatchOp[] {
  const ops: JsonPatchOp[] = [];
  diff(from, to, '', ops);
  return ops;
}

export function buildSaveLogDetails(input: {
  title: string;
  nodeCount: number;
  version: string;
  prevVersion?: string;
  previous: unknown | null;
  saved: unknown;
}): Record<string, unknown> {
  if (!input.previous) {
    return {
      title: input.title,
      nodeCount: input.nodeCount,
      version: input.version,
      prevVersion: null,
      initial: true
    };
  }
  const patch = createPatch(input.previous, input.saved);
  const truncated = patch.length > 200;
  return {
    title: input.title,
    nodeCount: input.nodeCount,
    version: input.version,
    prevVersion: input.prevVersion ?? null,
    initial: false,
    truncated,
    patch: truncated ? patch.slice(0, 200) : patch
  };
}

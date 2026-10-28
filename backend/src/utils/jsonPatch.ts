/** 与前端撤销栈共用的 JSON Patch 子集（RFC 6902 的 add / remove / replace），供增量保存与审计日志差异使用。 */

export interface JsonPatchOp {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
}

/** Patch 应用 / 解析失败。调用方映射为 400，落盘前即中止，不触碰已存文件。 */
export class JsonPatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JsonPatchError';
  }
}

function encodeToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

function decodeToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
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

function isPatchOp(value: unknown): value is JsonPatchOp {
  if (!isPlainObject(value)) return false;
  if (value.op !== 'add' && value.op !== 'remove' && value.op !== 'replace') return false;
  if (typeof value.path !== 'string' || value.path === '') return false;
  if (value.op !== 'remove' && !('value' in value)) return false;
  return true;
}

/** 解析请求体里的 patch ops；形状不合法直接抛 JsonPatchError（调用方回 400）。 */
export function parsePatchOps(value: unknown): JsonPatchOp[] {
  if (!Array.isArray(value) || !value.every(isPatchOp)) {
    throw new JsonPatchError('Invalid patch ops: expected an array of { op: add|remove|replace, path, value? }');
  }
  return value;
}

function pathSegments(path: string): string[] {
  if (!path.startsWith('/')) throw new JsonPatchError(`Invalid JSON patch path: ${path}`);
  return path
    .slice(1)
    .split('/')
    .map((segment) => decodeToken(segment));
}

function toIndex(segment: string, path: string): number {
  const index = Number(segment);
  if (!Number.isInteger(index) || index < 0 || String(index) !== segment) {
    throw new JsonPatchError(`Invalid array index in patch path: ${path}`);
  }
  return index;
}

function descend(parent: unknown, segment: string, path: string): unknown {
  if (Array.isArray(parent)) {
    const index = toIndex(segment, path);
    if (index >= parent.length) {
      throw new JsonPatchError(`Patch path out of bounds: ${path}`);
    }
    return parent[index];
  }
  if (isPlainObject(parent)) {
    if (!Object.prototype.hasOwnProperty.call(parent, segment)) {
      throw new JsonPatchError(`Patch path not found: ${path}`);
    }
    return parent[segment];
  }
  throw new JsonPatchError(`Patch path traverses a non-container: ${path}`);
}

function applyAt(parent: unknown, segment: string, op: JsonPatchOp): unknown {
  if (Array.isArray(parent)) {
    const isAppend = segment === '-';
    const index = isAppend ? parent.length : toIndex(segment, op.path);
    switch (op.op) {
      case 'add': {
        if (index > parent.length) {
          throw new JsonPatchError(`Patch index out of bounds: ${op.path}`);
        }
        parent.splice(index, 0, op.value);
        return parent;
      }
      case 'replace': {
        if (index >= parent.length) {
          throw new JsonPatchError(`Patch replace target missing: ${op.path}`);
        }
        parent[index] = op.value;
        return parent;
      }
      case 'remove': {
        if (isAppend || index >= parent.length) {
          throw new JsonPatchError(`Patch remove target missing: ${op.path}`);
        }
        parent.splice(index, 1);
        return parent;
      }
    }
  }
  if (isPlainObject(parent)) {
    const exists = Object.prototype.hasOwnProperty.call(parent, segment);
    if (op.op === 'remove') {
      if (!exists) {
        throw new JsonPatchError(`Patch remove target missing: ${op.path}`);
      }
      delete parent[segment];
      return parent;
    }
    if (op.op === 'replace' && !exists) {
      throw new JsonPatchError(`Patch replace target missing: ${op.path}`);
    }
    parent[segment] = op.value;
    return parent;
  }
  throw new JsonPatchError(`Patch target is not a container: ${op.path}`);
}

/**
 * 在深拷贝上按序应用 RFC 6902 子集 patch，返回新文档。
 * 任何路径/下标/目标不存在都在落盘前抛 JsonPatchError。
 */
export function applyPatch<T>(doc: T, ops: JsonPatchOp[]): T {
  const result: unknown = JSON.parse(JSON.stringify(doc));
  for (const op of ops) {
    const segments = pathSegments(op.path);
    let parent: unknown = result;
    for (let i = 0; i < segments.length - 1; i++) {
      parent = descend(parent, segments[i], op.path);
    }
    applyAt(parent, segments[segments.length - 1], op);
  }
  return result as T;
}

export function buildSaveLogDetails(input: {
  title: string;
  nodeCount: number;
  version: string;
  prevVersion?: string;
  previous: unknown | null;
  saved: unknown;
  /** 增量保存时客户端提交的原始 patch ops，一并记入审计 */
  incomingOps?: JsonPatchOp[];
}): Record<string, unknown> {
  let details: Record<string, unknown>;
  if (!input.previous) {
    details = {
      title: input.title,
      nodeCount: input.nodeCount,
      version: input.version,
      prevVersion: null,
      initial: true
    };
  } else {
    const patch = createPatch(input.previous, input.saved);
    const truncated = patch.length > 200;
    details = {
      title: input.title,
      nodeCount: input.nodeCount,
      version: input.version,
      prevVersion: input.prevVersion ?? null,
      initial: false,
      truncated,
      patch: truncated ? patch.slice(0, 200) : patch
    };
  }
  if (input.incomingOps) {
    details.incomingOps = input.incomingOps;
  }
  return details;
}

/**
 * JSON Patch 统一实现（RFC 6902 的 add / remove / replace 子集）。
 * 前端撤销/增量保存与后端增量落盘/审计差异共用此一份实现（v2.5.0 #5 合并自
 * frontend/utils/jsonPatch 与 backend/utils/jsonPatch 两份分叉实现）。
 *
 * 语义约定：
 * - createPatch：对象字段递归 + 数组逐下标 diff（共享前缀递归、尾部 add、
 *   从高下标起 remove），产出小而细的差异；审计与版本差异因此逐项可读。
 * - applyPatch：严格子集——路径必须以 `/` 起（`-` 表示数组尾部追加），
 *   越界 / 缺失 / 非法下标抛 JsonPatchError；数组 add 为插入、remove 为删除；
 *   对象 replace/remove 要求目标存在。空指针 `''` 仅支持 replace/add（整文档替换）。
 * - invertPatch：给定应用前的文档，把正向 ops 翻转为可撤销的反向 ops。
 * - parsePatchOps：网络输入防御——拒绝空 path、非法 op、add/replace 缺 value。
 */

export interface JsonPatchOp {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
}

/** Patch 应用 / 解析失败。服务端映射为 400，落盘前即中止，不触碰已存文件。 */
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

function pathSegments(path: string): string[] {
  if (!path.startsWith('/')) throw new JsonPatchError(`Invalid JSON patch path: ${path}`);
  return path
    .slice(1)
    .split('/')
    .map((segment) => decodeToken(segment));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ============================================================
// createPatch：字段递归 + 数组逐下标
// ============================================================

function diff(from: unknown, to: unknown, path: string, ops: JsonPatchOp[]): void {
  if (sameJson(from, to)) return;
  if (Array.isArray(from) && Array.isArray(to)) {
    // 逐下标 diff：共享前缀递归、尾部增补 add、尾部裁剪 remove（从高下标起删，保证 apply 时下标不漂移）
    const shared = Math.min(from.length, to.length);
    for (let i = 0; i < shared; i++) diff(from[i], to[i], `${path}/${i}`, ops);
    if (to.length > shared) {
      for (let i = shared; i < to.length; i++) ops.push({ op: 'add', path: `${path}/${i}`, value: to[i] });
    } else if (from.length > shared) {
      for (let i = from.length - 1; i >= shared; i--) ops.push({ op: 'remove', path: `${path}/${i}` });
    }
    return;
  }
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

// ============================================================
// applyPatch：严格子集
// ============================================================

function toIndex(token: string, path: string): number {
  if (!/^(0|[1-9][0-9]*)$/.test(token)) {
    throw new JsonPatchError(`Invalid array index in patch path: ${path}`);
  }
  return Number(token);
}

function applyOp<T>(doc: T, op: JsonPatchOp): T {
  if (op.path === '') {
    // 空指针 = 整文档（RFC 6902）；remove 整文档无意义，拒绝
    if (op.op === 'remove') throw new JsonPatchError('Cannot remove the whole document');
    return clone(op.value) as T;
  }
  const segments = pathSegments(op.path);
  let parent: unknown = doc;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (Array.isArray(parent)) {
      const index = toIndex(segment, op.path);
      if (index >= parent.length) throw new JsonPatchError(`Patch path out of bounds: ${op.path}`);
      parent = parent[index];
    } else if (isPlainObject(parent)) {
      if (!Object.prototype.hasOwnProperty.call(parent, segment)) {
        throw new JsonPatchError(`Patch path not found: ${op.path}`);
      }
      parent = parent[segment];
    } else {
      throw new JsonPatchError(`Patch path traverses a non-container: ${op.path}`);
    }
  }

  const last = segments[segments.length - 1];
  if (Array.isArray(parent)) {
    const isAppend = last === '-';
    const index = isAppend ? parent.length : toIndex(last, op.path);
    switch (op.op) {
      case 'add': {
        if (index > parent.length) throw new JsonPatchError(`Patch index out of bounds: ${op.path}`);
        parent.splice(index, 0, op.value);
        return doc;
      }
      case 'replace': {
        if (isAppend || index >= parent.length) throw new JsonPatchError(`Patch replace target missing: ${op.path}`);
        parent[index] = op.value;
        return doc;
      }
      case 'remove': {
        if (isAppend || index >= parent.length) throw new JsonPatchError(`Patch remove target missing: ${op.path}`);
        parent.splice(index, 1);
        return doc;
      }
    }
  }
  if (isPlainObject(parent)) {
    const exists = Object.prototype.hasOwnProperty.call(parent, last);
    if (op.op === 'remove') {
      if (!exists) throw new JsonPatchError(`Patch remove target missing: ${op.path}`);
      delete parent[last];
      return doc;
    }
    if (op.op === 'replace' && !exists) throw new JsonPatchError(`Patch replace target missing: ${op.path}`);
    parent[last] = op.value;
    return doc;
  }
  throw new JsonPatchError(`Patch target is not a container: ${op.path}`);
}

export function applyPatch<T>(doc: T, ops: JsonPatchOp[]): T {
  let result = clone(doc);
  for (const op of ops) {
    result = applyOp(result, op);
  }
  return result;
}

// ============================================================
// invertPatch：正向 ops + 应用前文档 → 可撤销的反向 ops
// ============================================================

/** 路径定位：缺失 / 越界返回 found=false；路径本身非法抛 JsonPatchError */
function lookupValue(doc: unknown, path: string): { found: boolean; value: unknown } {
  if (path === '') return { found: true, value: doc };
  const segments = pathSegments(path);
  let parent: unknown = doc;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (Array.isArray(parent)) {
      const index = toIndex(segment, path);
      if (index >= parent.length) return { found: false, value: undefined };
      parent = parent[index];
    } else if (isPlainObject(parent)) {
      if (!Object.prototype.hasOwnProperty.call(parent, segment)) return { found: false, value: undefined };
      parent = parent[segment];
    } else {
      throw new JsonPatchError(`Patch path traverses a non-container: ${path}`);
    }
  }
  const last = segments[segments.length - 1];
  if (Array.isArray(parent)) {
    const isAppend = last === '-';
    const index = isAppend ? parent.length : toIndex(last, path);
    if (index >= parent.length) return { found: false, value: undefined };
    return { found: true, value: parent[index] };
  }
  if (isPlainObject(parent)) {
    if (!Object.prototype.hasOwnProperty.call(parent, last)) return { found: false, value: undefined };
    return { found: true, value: parent[last] };
  }
  throw new JsonPatchError(`Patch target is not a container: ${path}`);
}

function readValue(doc: unknown, path: string): unknown {
  const hit = lookupValue(doc, path);
  if (!hit.found) throw new JsonPatchError(`Patch path not found: ${path}`);
  return hit.value;
}

function targetExists(doc: unknown, path: string): boolean {
  return lookupValue(doc, path).found;
}

/** 数组尾部追加 add('/x/-') 的反向 = 删除追加后的显式下标 */
function invertAppendAdd(doc: unknown, op: JsonPatchOp): JsonPatchOp {
  const parentPath = op.path.slice(0, -2);
  const parent = parentPath === '' ? doc : readValue(doc, parentPath);
  if (!Array.isArray(parent)) throw new JsonPatchError(`Invalid array append path: ${op.path}`);
  return { op: 'remove', path: `${parentPath}/${parent.length}` };
}

/**
 * 翻转补丁：invertPatch(before, ops) 得到反向 ops，
 * 满足 applyPatch(applyPatch(before, ops), inverse) ≅ before。
 * 逐条以渐进文档求旧值，最后整体倒序。
 */
export function invertPatch(before: unknown, ops: JsonPatchOp[]): JsonPatchOp[] {
  let doc = clone(before);
  const inverse: JsonPatchOp[] = [];
  for (const op of ops) {
    if (op.op === 'add') {
      if (op.path.endsWith('/-') && op.path.length > 2) {
        inverse.push(invertAppendAdd(doc, op));
      } else if (targetExists(doc, op.path)) {
        // add 到已存在的键/下标 = 覆盖旧值 → 反向 replace
        inverse.push({ op: 'replace', path: op.path, value: readValue(doc, op.path) });
      } else {
        inverse.push({ op: 'remove', path: op.path });
      }
    } else {
      const oldValue = readValue(doc, op.path);
      inverse.push(
        op.op === 'remove'
          ? { op: 'add', path: op.path, value: oldValue }
          : { op: 'replace', path: op.path, value: oldValue }
      );
    }
    doc = applyOp(doc, op);
  }
  return inverse.reverse();
}

// ============================================================
// parsePatchOps：网络输入防御
// ============================================================

function isPatchOp(value: unknown): value is JsonPatchOp {
  if (!isPlainObject(value)) return false;
  if (value.op !== 'add' && value.op !== 'remove' && value.op !== 'replace') return false;
  if (typeof value.path !== 'string' || value.path === '') return false;
  if (value.op !== 'remove' && !('value' in value)) return false;
  return true;
}

export function parsePatchOps(value: unknown): JsonPatchOp[] {
  if (!Array.isArray(value) || !value.every(isPatchOp)) {
    throw new JsonPatchError('Invalid patch ops: expected an array of { op: add|remove|replace, path, value? }');
  }
  return value;
}

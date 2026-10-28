/** RFC 6902 的一个子集：对象字段与数组元素的 add / remove / replace。 */

export interface JsonPatchOp {
  op: 'add' | 'remove' | 'replace';
  path: string;
  value?: unknown;
}

function encodeToken(token: string): string {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

function decodeToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

function pathSegments(path: string): string[] {
  if (!path) return [];
  if (!path.startsWith('/')) throw new Error(`Invalid JSON patch path: ${path}`);
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

export function applyPatch<T>(doc: T, ops: JsonPatchOp[]): T {
  let clone = JSON.parse(JSON.stringify(doc)) as T;
  for (const op of ops) {
    if (!op.path) {
      clone = (op.op === 'remove' ? undefined : op.value) as T;
      continue;
    }
    const segments = pathSegments(op.path);
    let parent: any = clone;
    for (let i = 0; i < segments.length - 1; i++) {
      parent = parent[segments[i]];
    }
    const last = segments[segments.length - 1];
    if (op.op === 'remove') {
      if (Array.isArray(parent)) parent.splice(Number(last), 1);
      else delete parent[last];
    } else if (Array.isArray(parent)) {
      parent[Number(last)] = op.value;
    } else {
      parent[last] = op.value;
    }
  }
  return clone;
}

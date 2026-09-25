import { FORBIDDEN_STATE_KEYS } from './dataSource';

const STATE_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function acceptStateKey(key: string): boolean {
  return STATE_KEY.test(key) && !FORBIDDEN_STATE_KEYS.has(key);
}

export function parseStateValue(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/**
 * 只改动这一个键。键名不合法或 JSON 无法解析时不写入。
 * 重命名时删掉旧键，其它键保持不动。
 */
export function applyStateEntry(
  state: Record<string, unknown>,
  previousKey: string,
  nextKey: string,
  rawValue: string
): string | null {
  const key = nextKey.trim();
  if (!acceptStateKey(key)) return '键名只允许字母、数字和下划线，且不能是保留字';
  const parsed = parseStateValue(rawValue);
  if (!parsed.ok) return '值需要是 JSON，例如 false、"admin" 或 1';
  if (previousKey && previousKey !== key && Object.prototype.hasOwnProperty.call(state, previousKey)) {
    delete state[previousKey];
  }
  state[key] = parsed.value;
  return null;
}

export function removeStateKey(state: Record<string, unknown>, key: string): void {
  if (Object.prototype.hasOwnProperty.call(state, key)) delete state[key];
}

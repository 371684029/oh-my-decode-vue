import { canInlineExpression, parseExpression } from './expression';

/** 整段 {{ expr }} 且能安全内联时返回表达式正文。 */
export function inlineableExpression(source: string | undefined | null): string | null {
  if (!source || !source.trim()) return null;
  const match = source.trim().match(/^\{\{\s*([\s\S]*?)\s*\}\}$/);
  if (!match) return null;
  const inner = match[1].trim();
  if (!inner || !canInlineExpression(inner)) return null;
  return inner;
}

/** 显隐：未填或无法安全求值时保持显示。 */
export function visibleByExpression(source: string | undefined, state: Record<string, unknown>): boolean {
  const raw = source?.trim() ?? '';
  if (!raw || !inlineableExpression(raw)) return true;
  const value = parseExpression(raw, { state });
  if (value === raw) return true;
  return Boolean(value);
}

/** 动作条件：未填则执行；无法安全求值或结果为假则跳过。 */
export function shouldRunAction(when: string | undefined, state: Record<string, unknown>, event?: unknown): boolean {
  const raw = when?.trim() ?? '';
  if (!raw) return true;
  if (!inlineableExpression(raw)) return false;
  const value = parseExpression(raw, { state, event, $event: event });
  if (value === raw) return false;
  return Boolean(value);
}

/**
 * 安全表达式求解对外 API (v2.8.0 分层后的门面)。
 *
 * 核心范式：把字符串中的 {{ expression }} 转换为运行时真实值。
 * 词法在 `./tokenizer`、求值在 `./evaluator`，本文件只做模板扫描与门面。
 */

import { evaluateRawExpression, parsesCleanly } from './evaluator';

/**
 * 动态 JS 表达式计算求解器 (Safe Expression Evaluator)
 * - 整串 `{{ expr }}` → 求值结果（可非字符串）
 * - 混写 `前缀 {{ expr }} 后缀` → 逐段替换为字符串（v2.3 行操作文案等）
 */
export function parseExpression(exprString: unknown, contextScope: Record<string, unknown> = {}): unknown {
  if (typeof exprString !== 'string') return exprString;

  // 整串双大括号
  const fullPattern = /^\s*\{\{\s*(.*?)\s*\}\}\s*$/;
  const fullMatch = exprString.match(fullPattern);
  if (fullMatch) {
    try {
      return evaluateRawExpression(fullMatch[1], contextScope);
    } catch (e) {
      console.warn(`[Expression Evaluator] Failed to evaluate expression: "${fullMatch[1]}"`, e);
      return exprString;
    }
  }

  // 混写插值：保留非表达式片段，逐段求值 {{ ... }}
  if (!exprString.includes('{{')) return exprString;
  return exprString.replace(/\{\{\s*(.*?)\s*\}\}/g, (whole, raw: string) => {
    try {
      const result = evaluateRawExpression(raw, contextScope);
      return result === undefined || result === null ? '' : String(result);
    } catch (e) {
      console.warn(`[Expression Evaluator] Failed to evaluate embedded expression: "${raw}"`, e);
      return whole;
    }
  });
}

/**
 * 判断当前属性字符串是否包含 {{ ... }} 表达式
 */
export function isExpression(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  return /^\s*\{\{\s*.*?\s*\}\}\s*$/.test(val);
}

/**
 * 表达式能否原样内联进生成的 JavaScript。
 * 必须被受限解释器完整解析，且源码不含 `<`，避免打断 HTML 里的 script。
 */
export function canInlineExpression(source: string): boolean {
  if (typeof source !== 'string') return false;
  const raw = source.trim();
  // 不把含 `<` 的片段内联进生成的 JavaScript，避免打断 HTML 里的 script
  if (!raw || /<\/|<\s*script/i.test(raw)) return false;
  return parsesCleanly(raw);
}

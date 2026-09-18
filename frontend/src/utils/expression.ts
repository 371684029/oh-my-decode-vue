/**
 * 动态 JS 表达式计算求解器 (Safe Expression Evaluator)
 * 核心范式:支持将字符串中的 {{ expression }} 转换为运行时真实值
 */

export function parseExpression(exprString: string, contextScope: Record<string, any> = {}): any {
  if (typeof exprString !== 'string') return exprString;

  // 匹配双大括号模式: {{ state.user.name || '默认' }}
  const pattern = /^\s*\{\{\s*(.*?)\s*\}\}\s*$/;
  const match = exprString.match(pattern);

  if (!match) {
    return exprString;
  }

  const rawExpression = match[1];

  try {
    const keys = Object.keys(contextScope);
    const values = Object.values(contextScope);
    // 安全求值函数构建
    const evaluator = new Function(...keys, `return (${rawExpression});`);
    return evaluator(...values);
  } catch (e) {
    console.warn(`[Expression Evaluator] Failed to evaluate expression: "${rawExpression}"`, e);
    return exprString; // 异常时回退原始文本
  }
}

/**
 * 判断当前属性字符串是否包含 {{ ... }} 表达式
 */
export function isExpression(val: any): boolean {
  if (typeof val !== 'string') return false;
  return /^\s*\{\{\s*.*?\s*\}\}\s*$/.test(val);
}

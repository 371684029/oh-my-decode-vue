/**
 * 受限表达式求值器 (Safe Expression Evaluator) — v2.8.0 从 expression.ts 分层而来。
 *
 * 安全性：不依赖 `new Function` / `eval`，递归下降、parse 即求值。
 * 仅支持表达式语法（字面量、变量、属性访问、运算、三元、括号），
 * 拒绝函数调用、赋值、原型链敏感属性访问（__proto__ / prototype / constructor）。
 */

import { EOF, tokenize, type Token } from './tokenizer';

// ---------------------------------------------------------------------------

const FORBIDDEN_PROPS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * 运算符操作数视图（仅编译期生效）：受限解释器沿用 JS 动态强制转换语义，
 * cast 在编译后擦除，生成的运行时代码与原生运算符逐字节一致，不改变任何求值行为。
 * （严格模式下 unknown 不可直接参与算术/关系运算，此视图替代 any 逃逸。）
 */
function num(value: unknown): number {
  return value as number;
}

class ExpressionEvaluator {
  private pos = 0;
  private tokens: Token[];
  private scope: Record<string, unknown>;

  constructor(tokens: Token[], scope: Record<string, unknown>) {
    this.tokens = tokens;
    this.scope = scope;
  }

  peek(): Token {
    return this.tokens[this.pos] ?? EOF;
  }

  private next(): Token {
    return this.tokens[this.pos++] ?? EOF;
  }

  private expect(value: string): void {
    const t = this.next();
    if (t.value !== value) {
      throw new Error(`Expected "${value}" but got "${t.value}"`);
    }
  }

  private match(value: string): boolean {
    if (this.peek().value === value) {
      this.pos++;
      return true;
    }
    return false;
  }

  /** 安全读取属性，拦截原型链敏感键 */
  private getProp(obj: unknown, key: unknown): unknown {
    if (obj === null || obj === undefined) return undefined;
    const k = String(key);
    if (FORBIDDEN_PROPS.has(k)) {
      throw new Error(`Access to "${k}" is not allowed`);
    }
    return (obj as Record<string, unknown>)[k];
  }

  // ternary → or → and → equality → comparison → additive → multiplicative → unary → primary
  parse(): unknown {
    return this.parseTernary();
  }

  private parseTernary(): unknown {
    const cond = this.parseOr();
    if (this.match('?')) {
      const yes = this.parseTernary();
      this.expect(':');
      const no = this.parseTernary();
      return cond ? yes : no;
    }
    return cond;
  }

  private parseOr(): unknown {
    let left = this.parseAnd();
    while (this.match('||')) {
      const right = this.parseAnd();
      left = left || right;
    }
    return left;
  }

  private parseAnd(): unknown {
    let left = this.parseEquality();
    while (this.match('&&')) {
      const right = this.parseEquality();
      left = left && right;
    }
    return left;
  }

  private parseEquality(): unknown {
    let left = this.parseComparison();
    while (true) {
      if (this.match('==')) {
        left = num(left) == num(this.parseComparison());
      } else if (this.match('!=')) {
        left = num(left) != num(this.parseComparison());
      } else if (this.match('===')) {
        left = left === this.parseComparison();
      } else if (this.match('!==')) {
        left = left !== this.parseComparison();
      } else {
        break;
      }
    }
    return left;
  }

  private parseComparison(): unknown {
    let left = this.parseAdditive();
    while (true) {
      if (this.match('<')) {
        left = num(left) < num(this.parseAdditive());
      } else if (this.match('<=')) {
        left = num(left) <= num(this.parseAdditive());
      } else if (this.match('>')) {
        left = num(left) > num(this.parseAdditive());
      } else if (this.match('>=')) {
        left = num(left) >= num(this.parseAdditive());
      } else {
        break;
      }
    }
    return left;
  }

  private parseAdditive(): unknown {
    let left = this.parseMultiplicative();
    while (true) {
      if (this.match('+')) {
        left = num(left) + num(this.parseMultiplicative());
      } else if (this.match('-')) {
        left = num(left) - num(this.parseMultiplicative());
      } else {
        break;
      }
    }
    return left;
  }

  private parseMultiplicative(): unknown {
    let left = this.parseUnary();
    while (true) {
      if (this.match('*')) {
        left = num(left) * num(this.parseUnary());
      } else if (this.match('/')) {
        left = num(left) / num(this.parseUnary());
      } else if (this.match('%')) {
        left = num(left) % num(this.parseUnary());
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): unknown {
    if (this.match('!')) return !this.parseUnary();
    if (this.match('-')) return -num(this.parseUnary());
    if (this.match('+')) return +num(this.parseUnary());
    if (this.peek().value === 'typeof' && this.peek().type === 'ident') {
      this.pos++;
      return typeof this.parseUnary();
    }
    return this.parsePostfix();
  }

  private parsePostfix(): unknown {
    let value = this.parsePrimary();

    // 属性访问链：.prop / ['expr'] / [expr]
    for (;;) {
      if (this.match('.')) {
        const t = this.next();
        if (t.type !== 'ident') throw new Error('Expected property name after "."');
        if (this.peek().value === '(') {
          throw new Error(`Function call "${t.value}" is not allowed`);
        }
        value = this.getProp(value, t.value);
      } else if (this.match('[')) {
        const idx = this.parseTernary();
        this.expect(']');
        value = this.getProp(value, idx);
      } else {
        break;
      }
    }
    return value;
  }

  private parsePrimary(): unknown {
    const t = this.peek();

    if (t.type === 'number') {
      this.pos++;
      return t.value;
    }
    if (t.type === 'string') {
      this.pos++;
      return t.value;
    }
    if (t.type === 'ident') {
      this.pos++;
      switch (t.value) {
        case 'true':
          return true;
        case 'false':
          return false;
        case 'null':
          return null;
        case 'undefined':
          return undefined;
        default:
          break;
      }
      if (this.peek().value === '(') {
        throw new Error(`Function call "${t.value}" is not allowed`);
      }
      return this.scope[t.value];
    }
    if (this.match('(')) {
      const val = this.parseTernary();
      this.expect(')');
      return val;
    }
    if (this.match('[')) {
      const arr: unknown[] = [];
      if (!this.match(']')) {
        do {
          arr.push(this.parseTernary());
        } while (this.match(','));
        this.expect(']');
      }
      return arr;
    }
    if (this.match('{')) {
      const obj: Record<string, unknown> = {};
      if (!this.match('}')) {
        do {
          const keyToken = this.next();
          let key: string;
          if (keyToken.type === 'string' || keyToken.type === 'ident') {
            key = String(keyToken.value);
          } else {
            throw new Error(`Invalid object key "${keyToken.value}"`);
          }
          if (FORBIDDEN_PROPS.has(key)) {
            throw new Error(`Object key "${key}" is not allowed`);
          }
          this.expect(':');
          obj[key] = this.parseTernary();
        } while (this.match(','));
        this.expect('}');
      }
      return obj;
    }

    throw new Error(`Unexpected token "${t.value}"`);
  }
}

// ---------------------------------------------------------------------------
// 对外 API
// ---------------------------------------------------------------------------

/**
 * 安全求值 {{ ... }} 表达式，失败时回退原始文本
 */
export function evaluateRawExpression(rawExpression: string, contextScope: Record<string, unknown>): unknown {
  const tokens = tokenize(rawExpression);
  const evaluator = new ExpressionEvaluator(tokens, contextScope);
  const result = evaluator.parse();
  const remaining = evaluator.peek();
  if (remaining.type !== 'eof') {
    throw new Error(`Unexpected token after expression: "${remaining.value}"`);
  }
  return result;
}

/**
 * 表达式能否被受限解释器完整解析（无残留 token）。
 * 供出码层判断是否可以原样内联进生成的 JavaScript。
 */
export function parsesCleanly(source: string): boolean {
  try {
    const evaluator = new ExpressionEvaluator(tokenize(source), {});
    evaluator.parse();
    return evaluator.peek().type === 'eof';
  } catch {
    return false;
  }
}

/**
 * 动态 JS 表达式计算求解器 (Safe Expression Evaluator)
 * 核心范式：支持将字符串中的 {{ expression }} 转换为运行时真实值。
 *
 * 安全性：不依赖 `new Function` / `eval`，采用手写 tokenizer + 递归下降
 * 解释器，仅支持表达式语法（字面量、变量、属性访问、运算、三元、括号），
 * 拒绝函数调用、赋值、原型链敏感属性访问（__proto__ / prototype / constructor）。
 */

type TokenType = 'number' | 'string' | 'ident' | 'punc' | 'eof';

interface Token {
  type: TokenType;
  value: string | number;
}

const EOF: Token = { type: 'eof', value: '' };

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;

  const isDigit = (c: string) => c >= '0' && c <= '9';
  const isIdentStart = (c: string) => /[A-Za-z_$]/.test(c);
  const isIdentPart = (c: string) => /[A-Za-z0-9_$]/.test(c);

  while (i < n) {
    const c = input[i];

    // 空白
    if (/\s/.test(c)) {
      i++;
      continue;
    }

    // 数字
    if (isDigit(c) || (c === '.' && isDigit(input[i + 1] ?? ''))) {
      let j = i;
      while (j < n && isDigit(input[j])) j++;
      if (input[j] === '.') {
        j++;
        while (j < n && isDigit(input[j])) j++;
      }
      if (input[j] === 'e' || input[j] === 'E') {
        j++;
        if (input[j] === '+' || input[j] === '-') j++;
        while (j < n && isDigit(input[j])) j++;
      }
      tokens.push({ type: 'number', value: parseFloat(input.slice(i, j)) });
      i = j;
      continue;
    }

    // 字符串（单引号 / 双引号，支持基础转义）
    if (c === "'" || c === '"') {
      const quote = c;
      let j = i + 1;
      let str = '';
      while (j < n && input[j] !== quote) {
        if (input[j] === '\\' && j + 1 < n) {
          const esc = input[j + 1];
          switch (esc) {
            case 'n':
              str += '\n';
              break;
            case 't':
              str += '\t';
              break;
            case 'r':
              str += '\r';
              break;
            case '\\':
              str += '\\';
              break;
            case "'":
              str += "'";
              break;
            case '"':
              str += '"';
              break;
            default:
              str += esc;
          }
          j += 2;
        } else {
          str += input[j];
          j++;
        }
      }
      if (j >= n) throw new Error('Unterminated string literal');
      tokens.push({ type: 'string', value: str });
      i = j + 1;
      continue;
    }

    // 标识符 / 关键字
    if (isIdentStart(c)) {
      let j = i;
      while (j < n && isIdentPart(input[j])) j++;
      tokens.push({ type: 'ident', value: input.slice(i, j) });
      i = j;
      continue;
    }

    // 运算符与标点（贪心最长匹配：三字符 → 两字符 → 单字符）
    const threeChar = input.slice(i, i + 3);
    if (threeChar === '===' || threeChar === '!==') {
      tokens.push({ type: 'punc', value: threeChar });
      i += 3;
      continue;
    }
    const twoChar = input.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(twoChar)) {
      tokens.push({ type: 'punc', value: twoChar });
      i += 2;
      continue;
    }
    if ('+-*/%<>!?:()[],.{}'.includes(c)) {
      tokens.push({ type: 'punc', value: c });
      i++;
      continue;
    }

    throw new Error(`Unexpected character "${c}" at position ${i}`);
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// 受限求值器（递归下降，parse 即求值）
// ---------------------------------------------------------------------------

const FORBIDDEN_PROPS = new Set(['__proto__', 'prototype', 'constructor']);

class ExpressionEvaluator {
  private pos = 0;
  private tokens: Token[];
  private scope: Record<string, any>;

  constructor(tokens: Token[], scope: Record<string, any>) {
    this.tokens = tokens;
    this.scope = scope;
  }

  private peek(): Token {
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
  private getProp(obj: any, key: any): any {
    if (obj === null || obj === undefined) return undefined;
    const k = String(key);
    if (FORBIDDEN_PROPS.has(k)) {
      throw new Error(`Access to "${k}" is not allowed`);
    }
    return (obj as Record<string, any>)[k];
  }

  // ternary → or → and → equality → comparison → additive → multiplicative → unary → primary
  parse(): any {
    return this.parseTernary();
  }

  private parseTernary(): any {
    const cond = this.parseOr();
    if (this.match('?')) {
      const yes = this.parseTernary();
      this.expect(':');
      const no = this.parseTernary();
      return cond ? yes : no;
    }
    return cond;
  }

  private parseOr(): any {
    let left = this.parseAnd();
    while (this.match('||')) {
      const right = this.parseAnd();
      left = left || right;
    }
    return left;
  }

  private parseAnd(): any {
    let left = this.parseEquality();
    while (this.match('&&')) {
      const right = this.parseEquality();
      left = left && right;
    }
    return left;
  }

  private parseEquality(): any {
    let left = this.parseComparison();
    while (true) {
      if (this.match('==')) {
        left = left == this.parseComparison();
      } else if (this.match('!=')) {
        left = left != this.parseComparison();
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

  private parseComparison(): any {
    let left = this.parseAdditive();
    while (true) {
      if (this.match('<')) {
        left = left < this.parseAdditive();
      } else if (this.match('<=')) {
        left = left <= this.parseAdditive();
      } else if (this.match('>')) {
        left = left > this.parseAdditive();
      } else if (this.match('>=')) {
        left = left >= this.parseAdditive();
      } else {
        break;
      }
    }
    return left;
  }

  private parseAdditive(): any {
    let left = this.parseMultiplicative();
    while (true) {
      if (this.match('+')) {
        left = left + this.parseMultiplicative();
      } else if (this.match('-')) {
        left = left - this.parseMultiplicative();
      } else {
        break;
      }
    }
    return left;
  }

  private parseMultiplicative(): any {
    let left = this.parseUnary();
    while (true) {
      if (this.match('*')) {
        left = left * this.parseUnary();
      } else if (this.match('/')) {
        left = left / this.parseUnary();
      } else if (this.match('%')) {
        left = left % this.parseUnary();
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): any {
    if (this.match('!')) return !this.parseUnary();
    if (this.match('-')) return -this.parseUnary();
    if (this.match('+')) return +this.parseUnary();
    if (this.peek().value === 'typeof' && this.peek().type === 'ident') {
      this.pos++;
      return typeof this.parseUnary();
    }
    return this.parsePostfix();
  }

  private parsePostfix(): any {
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

  private parsePrimary(): any {
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
      const arr: any[] = [];
      if (!this.match(']')) {
        do {
          arr.push(this.parseTernary());
        } while (this.match(','));
        this.expect(']');
      }
      return arr;
    }
    if (this.match('{')) {
      const obj: Record<string, any> = {};
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
export function parseExpression(exprString: unknown, contextScope: Record<string, any> = {}): any {
  if (typeof exprString !== 'string') return exprString;

  // 匹配双大括号模式: {{ state.user.name || '默认' }}
  const pattern = /^\s*\{\{\s*(.*?)\s*\}\}\s*$/;
  const match = exprString.match(pattern);

  if (!match) {
    return exprString;
  }

  const rawExpression = match[1];

  try {
    const tokens = tokenize(rawExpression);
    const evaluator = new ExpressionEvaluator(tokens, contextScope);
    const result = evaluator.parse();
    // 校验剩余 token 均为 EOF，拒绝尾部垃圾输入
    const remaining = evaluator['peek']();
    if (remaining.type !== 'eof') {
      throw new Error(`Unexpected token after expression: "${remaining.value}"`);
    }
    return result;
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

/**
 * 表达式能否原样内联进生成的 JavaScript。
 * 必须被受限解释器完整解析，且源码不含 `<`，避免打断 HTML 里的 script。
 */
export function canInlineExpression(source: string): boolean {
  if (typeof source !== 'string') return false;
  const raw = source.trim();
  if (!raw || /<\/|<\s*script/i.test(raw)) return false;
  try {
    const tokens = tokenize(raw);
    const evaluator = new ExpressionEvaluator(tokens, {});
    evaluator.parse();
    return evaluator['peek']().type === 'eof';
  } catch {
    return false;
  }
}

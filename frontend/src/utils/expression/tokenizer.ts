/**
 * 表达式词法分析器 (Tokenizer) — v2.8.0 从 expression.ts 分层而来。
 *
 * 把 `{{ }}` 内的表达式源码切成 token。与求值器分离后可单独测试，
 * 且安全边界（拒绝的字符）在这一层最先暴露。
 */

export type TokenType = 'number' | 'string' | 'ident' | 'punc' | 'eof';

export interface Token {
  type: TokenType;
  value: string | number;
}

export const EOF: Token = { type: 'eof', value: '' };


// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

export function tokenize(input: string): Token[] {
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

// ============================================================
// 出码格式化管线 (v2.4.0 P2-2)
// 纯函数、确定性：无 Date / random / 环境读取，相同输入必得相同输出，
// 且全部满足幂等 format(format(x)) === format(x)。
// 自研行级格式化而非引入 Prettier：导出产物必须零运行时依赖，
// 且模板片段的嵌套结构由本模块的标签扫描器保证，而非通用 JS 解析器。
// ============================================================

/** 单级缩进（2 空格，与三产物手写模板保持一致） */
export const INDENT_UNIT = '  ';

/**
 * 块缩进：每个非空行前加 spaces 个空格。
 * 空行保持为空（不带尾随空格），相对结构原样保留。
 */
export function indentBlock(text: string, spaces: number): string {
  if (!text || spaces <= 0) return text;
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.trim() ? pad + line : ''))
    .join('\n');
}

/** 去掉每行行尾空白（空格 / Tab），保证产物可 diff、无噪声行 */
export function stripTrailingWhitespace(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n');
}

/** 连续空行压缩为至多一行空行 */
export function collapseBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n');
}

/**
 * 整产物收尾：去行尾空白 → 压缩空行 → 保证恰好一个结尾换行。
 * 幂等；三产物出口统一走此函数。
 */
export function finalizeArtifact(text: string): string {
  return `${collapseBlankLines(stripTrailingWhitespace(text)).replace(/\n+$/, '')}\n`;
}

// ============================================================
// HTML / Vue 模板片段重排缩进（标签嵌套感知）
// ============================================================

interface ScanState {
  /** 多行标签（属性换行）扫描中 */
  inTag: boolean;
  /** 多行注释扫描中 */
  inComment: boolean;
  /** 标签内未闭合的引号 */
  quote: string | null;
}

type TagScan = { complete: true; end: number; selfClosing: boolean } | { complete: false; quote: string | null };

const TAG_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;

/**
 * 从 from（指向标签名首字符的下一位置）扫描至标签结束。
 * 引号内的 `>` 不截断标签；`>` 前一字符为 `/` 判定自闭合。
 */
function scanTagBody(line: string, from: number, initialQuote: string | null): TagScan {
  let i = from;
  let quote = initialQuote;
  let lastCode = '';
  while (i < line.length) {
    const ch = line.charAt(i);
    if (quote) {
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === '>') return { complete: true, end: i + 1, selfClosing: lastCode === '/' };
    lastCode = ch;
    i += 1;
  }
  return { complete: false, quote };
}

/** 行首连续闭合标签数（闭合行应对齐其父级） */
function leadingCloseCount(line: string): number {
  let count = 0;
  let pos = 0;
  while (line.startsWith('</', pos)) {
    const gt = line.indexOf('>', pos);
    if (gt === -1) break;
    const name = line.slice(pos + 2, gt).trim();
    if (!TAG_NAME.test(name)) break;
    count += 1;
    pos = gt + 1;
  }
  return count;
}

/** 在文本态扫描一行，更新深度与扫描状态；`<` 后非字母视为字面量 */
function scanTextLine(line: string, state: ScanState, depth: number): number {
  let i = 0;
  while (i < line.length) {
    const lt = line.indexOf('<', i);
    if (lt === -1) break;
    if (line.startsWith('<!--', lt)) {
      const end = line.indexOf('-->', lt + 4);
      if (end === -1) {
        state.inComment = true;
        return depth;
      }
      i = end + 3;
      continue;
    }
    const next = line.charAt(lt + 1);
    if (next === '/') {
      const gt = line.indexOf('>', lt + 2);
      if (gt === -1) break;
      if (TAG_NAME.test(line.slice(lt + 2, gt).trim())) depth -= 1;
      i = gt + 1;
      continue;
    }
    if (!/[A-Za-z]/.test(next)) {
      i = lt + 1;
      continue;
    }
    // 插值文本中的 `<`（如 {{ a < b }}）不含 `}}` 的标签会误判，保守按文本处理
    const scan = scanTagBody(line, lt + 1, null);
    if (!scan.complete) {
      if (line.slice(lt).includes('}}')) {
        i = lt + 1;
        continue;
      }
      state.inTag = true;
      state.quote = scan.quote;
      return depth;
    }
    if (!scan.selfClosing) depth += 1;
    i = scan.end;
  }
  return depth;
}

/**
 * 模板片段重排缩进：按标签嵌套把每行归一到 baseLevel 起步的 2 空格层级。
 * - 开启行对齐当前深度，行后深度 +1；
 * - 闭合行对齐父级（深度 -1）；
 * - 自闭合 / 同行开闭净深度 0；
 * - 多行标签：属性续行 +1 级，`/>` 收口行与开启行同级；
 * - 注释、空行、文本行保持原样语义，仅归一前导空白。
 * 幂等；不解析 JS，引号内 `>` / `</` 不参与计数。
 */
export function reindentHtmlFragment(text: string, baseLevel = 0): string {
  const state: ScanState = { inTag: false, inComment: false, quote: null };
  let depth = 0;
  const out: string[] = [];
  const pad = (level: number): string => INDENT_UNIT.repeat(Math.max(0, level) + baseLevel);

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) {
      out.push('');
      continue;
    }
    if (state.inComment) {
      out.push(pad(depth) + line);
      if (line.includes('-->')) state.inComment = false;
      continue;
    }
    if (state.inTag) {
      const scan = scanTagBody(line, 0, state.quote);
      if (!scan.complete) {
        out.push(pad(depth + 1) + line);
        continue;
      }
      out.push(pad(depth) + line);
      state.inTag = false;
      state.quote = null;
      if (!scan.selfClosing) depth += 1;
      continue;
    }
    out.push(pad(depth - leadingCloseCount(line)) + line);
    depth = Math.max(0, scanTextLine(line, state, depth));
  }
  return out.join('\n');
}

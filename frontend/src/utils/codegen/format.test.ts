import { describe, expect, test } from 'vitest';
import {
  INDENT_UNIT,
  indentBlock,
  stripTrailingWhitespace,
  collapseBlankLines,
  finalizeArtifact,
  reindentHtmlFragment
} from './format';

describe('indentBlock', () => {
  test('非空行整体加前缀，空行保持为空', () => {
    expect(indentBlock('a\n\nb', 4)).toBe('    a\n\n    b');
  });

  test('spaces <= 0 或空文本原样返回', () => {
    expect(indentBlock('a', 0)).toBe('a');
    expect(indentBlock('', 4)).toBe('');
  });
});

describe('stripTrailingWhitespace', () => {
  test('去掉行尾空格与 Tab，保留行内空白', () => {
    expect(stripTrailingWhitespace('a  \nb\t\t\nc ')).toBe('a\nb\nc');
  });

  test('幂等', () => {
    const once = stripTrailingWhitespace('a \nb\n');
    expect(stripTrailingWhitespace(once)).toBe(once);
  });
});

describe('collapseBlankLines', () => {
  test('连续空行压缩为一行', () => {
    expect(collapseBlankLines('a\n\n\n\nb')).toBe('a\n\nb');
    expect(collapseBlankLines('a\n\nb')).toBe('a\n\nb');
  });

  test('幂等', () => {
    const once = collapseBlankLines('a\n\n\n\nb');
    expect(collapseBlankLines(once)).toBe(once);
  });
});

describe('finalizeArtifact', () => {
  test('去行尾空白 + 压缩空行 + 恰好一个结尾换行', () => {
    expect(finalizeArtifact('a  \n\n\n\nb\n\n\n')).toBe('a\n\nb\n');
  });

  test('幂等：finalize(format(x)) === format(x)', () => {
    const once = finalizeArtifact('a  \n\n\nb\n\n');
    expect(finalizeArtifact(once)).toBe(once);
  });
});

describe('reindentHtmlFragment', () => {
  test('嵌套块按标签嵌套对齐到 2 空格层级', () => {
    const messy = ['<el-form>', '<el-row>', '<el-col>', '<el-input />', '</el-col>', '</el-row>', '</el-form>'].join('\n');
    expect(reindentHtmlFragment(messy)).toBe(
      ['<el-form>', '  <el-row>', '    <el-col>', '      <el-input />', '    </el-col>', '  </el-row>', '</el-form>'].join(
        '\n'
      )
    );
  });

  test('baseLevel 起步缩进生效', () => {
    expect(reindentHtmlFragment('<div>\n<p>x</p>\n</div>', 2)).toBe('    <div>\n      <p>x</p>\n    </div>');
  });

  test('同行开闭标签与自闭合不改变深度', () => {
    const fragment = ['<div>', '<el-button type="primary">提交</el-button>', '<el-alert />', '</div>'].join('\n');
    expect(reindentHtmlFragment(fragment)).toBe(
      ['<div>', '  <el-button type="primary">提交</el-button>', '  <el-alert />', '</div>'].join('\n')
    );
  });

  test('多行标签：属性续行 +1 级，收口行与开启行同级', () => {
    const fragment = ['<div>', '<el-pagination', 'v-model:current-page="page"', 'size="small"', '/>', '</div>'].join('\n');
    expect(reindentHtmlFragment(fragment)).toBe(
      ['<div>', '  <el-pagination', '    v-model:current-page="page"', '    size="small"', '  />', '</div>'].join('\n')
    );
  });

  test('引号内的 > 不截断标签', () => {
    const fragment = ['<div>', '<el-button @click="if (a > b) { c(); }">x</el-button>', '</div>'].join('\n');
    expect(reindentHtmlFragment(fragment)).toBe(
      ['<div>', '  <el-button @click="if (a > b) { c(); }">x</el-button>', '</div>'].join('\n')
    );
  });

  test('注释行归一缩进且不改变深度', () => {
    const fragment = ['<div>', '<!-- 高端表单 Component -->', '<el-form>', '</el-form>', '</div>'].join('\n');
    expect(reindentHtmlFragment(fragment)).toBe(
      ['<div>', '  <!-- 高端表单 Component -->', '  <el-form>', '  </el-form>', '</div>'].join('\n')
    );
  });

  test('空行保持为空（不带尾随空格）', () => {
    expect(reindentHtmlFragment('<div>\n\n</div>')).toBe('<div>\n\n</div>');
  });

  test('行首闭合标签对齐父级', () => {
    expect(reindentHtmlFragment('<a>\n<b>\n</b>\n</a>')).toBe('<a>\n  <b>\n  </b>\n</a>');
  });

  test('嵌套错位输入被归一，且幂等：format(format(x)) === format(x)', () => {
    const messy = [
      '      <el-form :model="f">',
      '<el-row :gutter="16">',
      '  <el-col :span="12">',
      '<el-form-item label="名称" prop="name">',
      '        <el-input v-model=\'f["name"]\' />',
      '      </el-form-item>',
      '</el-col>',
      '        </el-row>',
      '</el-form>'
    ].join('\n');
    const once = reindentHtmlFragment(messy);
    expect(once).toBe(
      [
        '<el-form :model="f">',
        '  <el-row :gutter="16">',
        '    <el-col :span="12">',
        '      <el-form-item label="名称" prop="name">',
        '        <el-input v-model=\'f["name"]\' />',
        '      </el-form-item>',
        '    </el-col>',
        '  </el-row>',
        '</el-form>'
      ].join('\n')
    );
    expect(reindentHtmlFragment(once)).toBe(once);
  });

  test('幂等性对含多行标签 / 注释 / 空行的片段同样成立', () => {
    const fragment = [
      '<!-- 注释 -->',
      '',
      '<el-card>',
      '  <el-pagination',
      '    size="small"',
      '  />',
      '',
      '</el-card>'
    ].join('\n');
    const once = reindentHtmlFragment(fragment);
    expect(reindentHtmlFragment(once)).toBe(once);
  });

  test('INDENT_UNIT 为 2 空格（三产物统一约定）', () => {
    expect(INDENT_UNIT).toBe('  ');
  });
});

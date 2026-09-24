import { describe, expect, test } from 'vitest';
import { parseExpression, isExpression } from './expression';

const scope = {
  state: { user: { name: '张三' }, count: 3 },
  count: 3,
  list: [1, 2, 3],
  flag: true,
  empty: ''
};

describe('parseExpression 正常求值', () => {
  test('算术运算', () => {
    expect(parseExpression('{{ 1 + 2 * 3 }}')).toBe(7);
    expect(parseExpression('{{ (1 + 2) * 3 }}')).toBe(9);
    expect(parseExpression('{{ 10 / 4 }}')).toBe(2.5);
    expect(parseExpression('{{ 7 % 3 }}')).toBe(1);
  });

  test('字符串拼接与字面量', () => {
    expect(parseExpression('{{ "a" + "b" }}')).toBe('ab');
    expect(parseExpression("{{ 'hello' }}")).toBe('hello');
    expect(parseExpression('{{ true }}')).toBe(true);
    expect(parseExpression('{{ null }}')).toBe(null);
    expect(parseExpression('{{ undefined }}')).toBeUndefined();
  });

  test('比较与严格比较', () => {
    expect(parseExpression('{{ 10 > 5 }}')).toBe(true);
    expect(parseExpression('{{ 10 <= 10 }}')).toBe(true);
    expect(parseExpression('{{ count === 3 }}', scope)).toBe(true);
    expect(parseExpression('{{ count !== 4 }}', scope)).toBe(true);
    expect(parseExpression('{{ count == "3" }}', scope)).toBe(true);
  });

  test('逻辑运算', () => {
    expect(parseExpression('{{ count >= 3 && count < 5 }}', scope)).toBe(true);
    expect(parseExpression('{{ count > 3 || flag }}', scope)).toBe(true);
    expect(parseExpression('{{ !flag }}', scope)).toBe(false);
  });

  test('三元表达式', () => {
    expect(parseExpression('{{ 10 > 5 ? "yes" : "no" }}')).toBe('yes');
    expect(parseExpression('{{ 10 < 5 ? "yes" : "no" }}')).toBe('no');
  });

  test('属性访问（点 / 方括号 / 链式）', () => {
    expect(parseExpression('{{ state.user.name }}', scope)).toBe('张三');
    expect(parseExpression("{{ state.user['name'] || '默认' }}", scope)).toBe('张三');
    expect(parseExpression('{{ list[1] }}', scope)).toBe(2);
    expect(parseExpression('{{ list.length }}', scope)).toBe(3);
  });

  test('数组与对象字面量', () => {
    expect(parseExpression('{{ [1, 2, 3].length }}')).toBe(3);
    expect(parseExpression('{{ {a: 1, b: 2}.b }}')).toBe(2);
    expect(parseExpression("{{ {name: 'x', age: 18}['age'] }}")).toBe(18);
  });

  test('typeof 一元运算', () => {
    expect(parseExpression('{{ typeof count === "number" }}', scope)).toBe(true);
    expect(parseExpression('{{ typeof missing === "undefined" }}', scope)).toBe(true);
  });

  test('非表达式字符串原样返回', () => {
    expect(parseExpression('plain text')).toBe('plain text');
    expect(parseExpression('包含 {{ 半截 }')).toBe('包含 {{ 半截 }');
    expect(parseExpression(123)).toBe(123);
  });
});

describe('parseExpression 安全防护', () => {
  test('拒绝函数调用并回退原文', () => {
    expect(parseExpression('{{ toString() }}', scope)).toBe('{{ toString() }}');
    expect(parseExpression('{{ state.user.getName() }}', scope)).toBe('{{ state.user.getName() }}');
  });

  test('拒绝原型链敏感属性访问', () => {
    expect(parseExpression('{{ state.__proto__ }}', scope)).toBe('{{ state.__proto__ }}');
    expect(parseExpression('{{ state.constructor }}', scope)).toBe('{{ state.constructor }}');
    expect(parseExpression('{{ constructor.prototype }}', scope)).toBe('{{ constructor.prototype }}');
  });

  test('拒绝赋值语句', () => {
    expect(parseExpression('{{ a = 1 }}', scope)).toBe('{{ a = 1 }}');
  });

  test('拒绝模板字符串与未知字符', () => {
    expect(parseExpression('{{ `x` }}')).toBe('{{ `x` }}');
    expect(parseExpression('{{ a; b }}', scope)).toBe('{{ a; b }}');
  });

  test('拒绝恶意函数构造链', () => {
    const evil = '{{ constructor.constructor("return globalThis")() }}';
    expect(parseExpression(evil, scope)).toBe(evil);
  });
});

describe('isExpression', () => {
  test('识别 {{ }} 表达式', () => {
    expect(isExpression('{{ x }}')).toBe(true);
    expect(isExpression('{{ state.user.name || "默认" }}')).toBe(true);
  });

  test('拒绝非表达式', () => {
    expect(isExpression('plain text')).toBe(false);
    expect(isExpression('{{ 不完整')).toBe(false);
    expect(isExpression(123)).toBe(false);
    expect(isExpression(null)).toBe(false);
  });
});

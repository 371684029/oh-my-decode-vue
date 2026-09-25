import { describe, expect, test } from 'vitest';
import { mergeApiBinding, moveListItem } from './apiBindingForm';
import type { ApiBinding } from '../types/designer';

const mockBinding: ApiBinding = {
  url: '/api/mock/tbl_1',
  method: 'GET',
  params: { page: '{{ state.page }}', size: 10 },
  responsePath: 'data.list',
  totalProp: 'data.total',
  example: { data: { list: [{ name: '张三' }], total: 1 } }
};

describe('mergeApiBinding', () => {
  test('URL 不变时保留 example', () => {
    const { binding, paramsError } = mergeApiBinding(mockBinding, {
      url: '/api/mock/tbl_1',
      method: 'GET',
      paramsText: JSON.stringify(mockBinding.params),
      responsePath: 'data.list',
      totalProp: 'data.total',
      autoFetch: true
    });
    expect(paramsError).toBe(false);
    expect(binding?.example).toEqual(mockBinding.example);
  });

  test('非法 JSON 不替换已保存参数', () => {
    const { binding, paramsError } = mergeApiBinding(mockBinding, {
      url: '/api/mock/tbl_1',
      method: 'GET',
      paramsText: '{"page":',
      responsePath: 'data.list',
      totalProp: 'data.total',
      autoFetch: true
    });
    expect(paramsError).toBe(true);
    expect(binding?.params).toEqual(mockBinding.params);
    expect(binding?.example).toEqual(mockBinding.example);
  });

  test('改掉 URL 后不再保留 example', () => {
    const { binding } = mergeApiBinding(mockBinding, {
      url: 'https://api.example.com/users',
      method: 'GET',
      paramsText: '{}',
      responsePath: 'data.list',
      totalProp: '',
      autoFetch: true
    });
    expect(binding?.example).toBeUndefined();
    expect(binding?.url).toBe('https://api.example.com/users');
  });
});

describe('moveListItem', () => {
  test('下移交换相邻项，越界不动', () => {
    const list = ['用户名', '性别'];
    moveListItem(list, 0, 1);
    expect(list).toEqual(['性别', '用户名']);
    moveListItem(list, 1, 1);
    expect(list).toEqual(['性别', '用户名']);
  });
});

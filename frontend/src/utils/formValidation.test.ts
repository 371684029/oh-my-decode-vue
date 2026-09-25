import { describe, expect, test, vi } from 'vitest';
import { emptyRequiredFields, submitDesignerForm } from './formValidation';

describe('emptyRequiredFields', () => {
  const items = [
    { field: 'username', label: '用户名', component: 'input', required: true },
    { field: 'role', label: '角色', component: 'select', required: true },
    { field: 'on', label: '开关', component: 'switch', required: true }
  ];

  test('空字符串、空白和 null 算未填，开关的 false 不算', () => {
    const missing = emptyRequiredFields(items, { username: '  ', role: null, on: false });
    expect(missing.map((item) => item.field)).toEqual(['username', 'role']);
  });
});

describe('submitDesignerForm', () => {
  const items = [
    { field: 'username', label: '用户名', component: 'input', required: true },
    { field: 'nickname', label: '昵称', component: 'input', required: true }
  ];

  test('只填一半时不提示成功，也不跑 submit 动作', async () => {
    const notify = vi.fn();
    const runActions = vi.fn();
    const result = await submitDesignerForm(
      { submit: { enabled: true, actions: [{ id: 'a1', type: 'show_message' }] } },
      items,
      { username: '张三', nickname: '' },
      { notify, runActions }
    );
    expect(result.ok).toBe(false);
    expect(result.missing.map((item) => item.label)).toEqual(['昵称']);
    expect(notify).not.toHaveBeenCalled();
    expect(runActions).not.toHaveBeenCalled();
  });

  test('填完后执行 submit 动作并提示成功', async () => {
    const notify = vi.fn();
    const runActions = vi.fn();
    const result = await submitDesignerForm(
      { submit: { enabled: true, actions: [{ id: 'a1', type: 'show_message' }] } },
      items,
      { username: '张三', nickname: '小张' },
      { notify, runActions }
    );
    expect(result.ok).toBe(true);
    expect(runActions).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith('success', '表单提交成功');
  });
});

import { describe, expect, test } from 'vitest';
import { formatRowActionMessage, rowSummary } from './rowActionMessage';

describe('rowActionMessage', () => {
  test('优先 name 摘要', () => {
    expect(rowSummary({ id: 1, name: '李四' })).toBe('李四');
  });

  test('查看友好文案', () => {
    const r = formatRowActionMessage('view', { name: '李四' }, [
      { label: '查看', type: 'primary', eventKey: 'view' }
    ]);
    expect(r.message).toBe('查看 · 李四');
    expect(r.type).toBe('info');
  });

  test('删除用 warning', () => {
    const r = formatRowActionMessage('delete', { name: '张三' }, [
      { label: '删除', type: 'danger', eventKey: 'delete' }
    ]);
    expect(r.message).toBe('删除 · 张三');
    expect(r.type).toBe('warning');
  });
});

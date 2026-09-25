import { describe, expect, test } from 'vitest';
import { parseRestoreIndex } from '../utils/restoreIndex';

describe('parseRestoreIndex', () => {
  test('接受 index，也兼容 backup', () => {
    expect(parseRestoreIndex({ index: 2 }, {})).toBe(2);
    expect(parseRestoreIndex({ backup: 3 }, {})).toBe(3);
    expect(parseRestoreIndex({}, { index: '4' })).toBe(4);
    expect(parseRestoreIndex({}, {})).toBe(1);
    expect(parseRestoreIndex({ index: 0 }, {})).toBe(1);
  });
});
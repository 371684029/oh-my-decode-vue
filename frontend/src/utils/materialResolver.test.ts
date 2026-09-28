import { describe, expect, test } from 'vitest';
import { pickFollowVersion } from './materialResolver';
import type { MaterialRef } from '../types/designer';

const base: MaterialRef = { id: 'custom-x', version: '1.2.0', follow: 'pin' };
const all = ['1.0.0', '1.1.0', '1.2.0', '1.2.3', '2.0.0'];

describe('pickFollowVersion（follow 策略选版本）', () => {
  test('pin：精确锁定', () => {
    expect(pickFollowVersion({ ...base, follow: 'pin' }, all)).toBe('1.2.0');
    expect(pickFollowVersion(base, all)).toBe('1.2.0');
  });

  test('follow-patch：同 major.minor 最新', () => {
    expect(pickFollowVersion({ ...base, follow: 'patch' }, all)).toBe('1.2.3');
  });

  test('follow-minor：同 major 最新', () => {
    expect(pickFollowVersion({ ...base, follow: 'minor' }, all)).toBe('1.2.3');
    expect(pickFollowVersion({ ...base, version: '1.0.0', follow: 'minor' }, all)).toBe('1.2.3');
  });

  test('无满足版本返回 null', () => {
    expect(pickFollowVersion({ ...base, version: '3.0.0', follow: 'minor' }, all)).toBeNull();
  });
});

import { beforeEach, describe, expect, test } from 'vitest';
import {
  getShortcutContext,
  registerModalClose,
  registerModalOpen,
  resetShortcutContext,
  setFocusedZone,
  shouldRunCanvasHotkey
} from './shortcutContext';

describe('shouldRunCanvasHotkey', () => {
  test('returns true when focused on canvas with no modal open', () => {
    expect(shouldRunCanvasHotkey({ focusedZone: 'canvas', activeModalCount: 0 })).toBe(true);
  });

  test('returns false when a modal is open even on canvas', () => {
    expect(shouldRunCanvasHotkey({ focusedZone: 'canvas', activeModalCount: 1 })).toBe(false);
  });

  test.each(['drawer', 'dialog', 'input'] as const)('returns false when focusedZone is %s', (zone) => {
    expect(shouldRunCanvasHotkey({ focusedZone: zone, activeModalCount: 0 })).toBe(false);
  });

  test('returns false for non-canvas zone with stacked modals', () => {
    expect(shouldRunCanvasHotkey({ focusedZone: 'dialog', activeModalCount: 2 })).toBe(false);
  });
});

describe('module-level context state', () => {
  beforeEach(() => {
    resetShortcutContext();
  });

  test('starts with canvas zone and zero modals', () => {
    expect(getShortcutContext()).toEqual({ focusedZone: 'canvas', activeModalCount: 0 });
  });

  test('setFocusedZone updates context and blocks hotkeys outside canvas', () => {
    setFocusedZone('dialog');
    expect(getShortcutContext().focusedZone).toBe('dialog');
    expect(shouldRunCanvasHotkey(getShortcutContext())).toBe(false);
    setFocusedZone('canvas');
    expect(shouldRunCanvasHotkey(getShortcutContext())).toBe(true);
  });

  test('registerModalOpen increments and registerModalClose decrements', () => {
    registerModalOpen();
    expect(getShortcutContext().activeModalCount).toBe(1);
    expect(shouldRunCanvasHotkey(getShortcutContext())).toBe(false);
    registerModalClose();
    expect(getShortcutContext().activeModalCount).toBe(0);
    expect(shouldRunCanvasHotkey(getShortcutContext())).toBe(true);
  });

  test('nested modals stack and unwind', () => {
    registerModalOpen();
    registerModalOpen();
    expect(getShortcutContext().activeModalCount).toBe(2);
    registerModalClose();
    expect(getShortcutContext().activeModalCount).toBe(1);
    expect(shouldRunCanvasHotkey(getShortcutContext())).toBe(false);
    registerModalClose();
    expect(getShortcutContext().activeModalCount).toBe(0);
    expect(shouldRunCanvasHotkey(getShortcutContext())).toBe(true);
  });

  test('registerModalClose never goes below zero', () => {
    registerModalClose();
    registerModalClose();
    expect(getShortcutContext().activeModalCount).toBe(0);
  });

  test('getShortcutContext returns a snapshot, not internal state', () => {
    const snapshot = getShortcutContext();
    snapshot.focusedZone = 'dialog';
    snapshot.activeModalCount = 99;
    expect(getShortcutContext()).toEqual({ focusedZone: 'canvas', activeModalCount: 0 });
  });

  test('resetShortcutContext restores defaults after mixed changes', () => {
    setFocusedZone('input');
    registerModalOpen();
    registerModalOpen();
    resetShortcutContext();
    expect(getShortcutContext()).toEqual({ focusedZone: 'canvas', activeModalCount: 0 });
  });
});

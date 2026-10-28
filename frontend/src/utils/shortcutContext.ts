/**
 * 快捷键上下文 (v2.4.0 P2-1 · 快捷键 Context Manager)
 *
 * 画布级快捷键（撤销/重做/删除/微调等）只在 `focusedZone === 'canvas'`
 * 且没有打开的弹窗（activeModalCount === 0）时生效。
 *
 * 纯逻辑 + 轻量 DOM 适配：核心谓词与计数不依赖 Vue / DOM，
 * 可在 node 环境直接单测；DOM 探测是同模块导出的薄包装，
 * 供 App.vue 的全局 keydown 适配层调用。
 */

/** 快捷键作用域：当前键盘事件应归属的区域 */
export type ShortcutZone = 'canvas' | 'drawer' | 'dialog' | 'input';

/** 快捷键上下文快照 */
export interface ShortcutContextState {
  focusedZone: ShortcutZone;
  activeModalCount: number;
}

/**
 * 纯谓词：是否允许执行画布级快捷键。
 * 仅当焦点在画布且没有任何弹窗/抽屉 Modal 打开时为 true。
 */
export function shouldRunCanvasHotkey(ctx: ShortcutContextState): boolean {
  return ctx.focusedZone === 'canvas' && ctx.activeModalCount === 0;
}

/** 模块级默认上下文（App.vue 全局 keydown 与弹窗监听共用） */
const defaultContext: ShortcutContextState = {
  focusedZone: 'canvas',
  activeModalCount: 0
};

/** 读取当前上下文快照（拷贝，避免外部改动内部状态） */
export function getShortcutContext(): ShortcutContextState {
  return { ...defaultContext };
}

/** 设置当前焦点作用域 */
export function setFocusedZone(zone: ShortcutZone): void {
  defaultContext.focusedZone = zone;
}

/** 弹窗/抽屉/消息框打开时计数 +1 */
export function registerModalOpen(): void {
  defaultContext.activeModalCount += 1;
}

/** 弹窗/抽屉/消息框关闭时计数 -1（不小于 0） */
export function registerModalClose(): void {
  if (defaultContext.activeModalCount > 0) {
    defaultContext.activeModalCount -= 1;
  }
}

/** 重置为默认上下文（供单测隔离状态） */
export function resetShortcutContext(): void {
  defaultContext.focusedZone = 'canvas';
  defaultContext.activeModalCount = 0;
}

/**
 * DOM 适配：根据当前聚焦元素推断快捷键作用域。
 * INPUT / SELECT / TEXTAREA / contenteditable → input；
 * 属性抽屉内 → drawer；Element Plus 弹层/弹窗内 → dialog；其余 → canvas。
 */
export function resolveZoneFromElement(activeEl: Element | null): ShortcutZone {
  if (!activeEl) return 'canvas';
  const tag = activeEl.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return 'input';
  if (activeEl instanceof HTMLElement && activeEl.isContentEditable) return 'input';
  if (activeEl.closest('.inspector-pane')) return 'drawer';
  if (activeEl.closest('.el-dialog, .el-drawer, .el-overlay')) return 'dialog';
  return 'canvas';
}

/**
 * 单一决策点（DOM 兜底版）：keydown 到达时综合
 * 1) 当前 activeElement 推断的 focusedZone
 * 2) 注册的 activeModalCount（App.vue 弹窗 v-model 监听维护）
 * 3) DOM 中仍挂着的可见 Element Plus 遮罩层（未显式注册的弹窗兜底）
 * 判断本次按键是否允许走画布级快捷键。副作用：同步 focusedZone。
 */
export function shouldRunCanvasHotkeyFromDom(activeEl: Element | null): boolean {
  setFocusedZone(resolveZoneFromElement(activeEl));
  if (!shouldRunCanvasHotkey(defaultContext)) return false;
  if (typeof document !== 'undefined' && document.querySelector('.el-overlay:not([style*="display: none"])')) {
    return false;
  }
  return true;
}

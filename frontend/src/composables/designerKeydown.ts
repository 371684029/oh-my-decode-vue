import { ElMessage } from 'element-plus';

/** `useDesignerHotkeys` 依赖的 store 子集（v2.11.0 抽出以便单测） */
export interface DesignerHotkeyStore {
  selectedNodeId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  copySelectedNode(): boolean;
  pasteNode(): boolean;
  removeNode(id: string): void;
  undo(): void;
  redo(): void;
  openInspector(): void;
  moveSelectedNodeBy(deltaX: number, deltaY: number): boolean;
}

/**
 * 画布级快捷键逻辑（与 DOM 监听分离）。
 * `canRun` 为 false 时直接返回（对应 Context Manager 门禁）。
 */
export function handleDesignerKeydown(e: KeyboardEvent, store: DesignerHotkeyStore, canRun: boolean): void {
  if (!canRun) return;

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
    if (store.copySelectedNode()) {
      e.preventDefault();
      ElMessage.success('已复制选中的组件节点');
    }
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
    if (store.pasteNode()) {
      e.preventDefault();
      ElMessage.success('已粘贴组件节点');
    }
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (store.selectedNodeId) {
      e.preventDefault();
      store.removeNode(store.selectedNodeId);
      ElMessage.info('已删除选中节点');
    }
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    if (store.canUndo) {
      e.preventDefault();
      store.undo();
      ElMessage.info('已撤销上一步操作');
    }
  } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
    if (store.canRedo) {
      e.preventDefault();
      store.redo();
      ElMessage.info('已重做操作');
    }
  } else if (e.key === 'Enter') {
    if (store.selectedNodeId) {
      e.preventDefault();
      store.openInspector();
    }
  } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    if (store.selectedNodeId) {
      e.preventDefault();
      const step = e.shiftKey ? 2 : 1;
      let deltaX = 0;
      let deltaY = 0;
      if (e.key === 'ArrowUp') deltaY = -step;
      else if (e.key === 'ArrowDown') deltaY = step;
      else if (e.key === 'ArrowLeft') deltaX = -step;
      else if (e.key === 'ArrowRight') deltaX = step;
      store.moveSelectedNodeBy(deltaX, deltaY);
    }
  }
}
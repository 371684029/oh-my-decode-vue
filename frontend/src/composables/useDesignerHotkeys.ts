import { onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useDesignerStore } from '../stores/designerStore';
import { shouldRunCanvasHotkeyFromDom } from '../utils/shortcutContext';

/**
 * 全局画布级快捷键（复制/粘贴/删除/撤销/重做/开属性/方向键微调）。
 * v2.4.0 P2-1: 仅在画布聚焦且无弹窗/抽屉/输入焦点时响应
 * （替代旧的 INPUT/TEXTAREA/contenteditable 判断，现同时覆盖 dialog/drawer/属性抽屉）。
 */
export function useDesignerHotkeys() {
  const designerStore = useDesignerStore();

  const handleKeydown = (e: KeyboardEvent) => {
    if (!shouldRunCanvasHotkeyFromDom(document.activeElement)) {
      return;
    }

    // Ctrl + C -> Copy
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      if (designerStore.copySelectedNode()) {
        e.preventDefault();
        ElMessage.success('已复制选中的组件节点');
      }
    }
    // Ctrl + V -> Paste
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      if (designerStore.pasteNode()) {
        e.preventDefault();
        ElMessage.success('已粘贴组件节点');
      }
    }
    // Delete / Backspace -> Delete Selected Node
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (designerStore.selectedNodeId) {
        e.preventDefault();
        designerStore.removeNode(designerStore.selectedNodeId);
        ElMessage.info('已删除选中节点');
      }
    }
    // Ctrl + Z -> Undo
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      if (designerStore.canUndo) {
        e.preventDefault();
        designerStore.undo();
        ElMessage.info('已撤销上一步操作');
      }
    }
    // Ctrl + Y or Ctrl + Shift + Z -> Redo
    else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      if (designerStore.canRedo) {
        e.preventDefault();
        designerStore.redo();
        ElMessage.info('已重做操作');
      }
    }
    // Enter -> 打开属性栏
    else if (e.key === 'Enter') {
      if (designerStore.selectedNodeId) {
        e.preventDefault();
        designerStore.openInspector();
      }
    }
    // 方向键微调选中组件位置 (ArrowUp, ArrowDown, ArrowLeft, ArrowRight)
    else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (designerStore.selectedNodeId) {
        e.preventDefault();
        const step = e.shiftKey ? 2 : 1;
        let deltaX = 0;
        let deltaY = 0;
        if (e.key === 'ArrowUp') deltaY = -step;
        else if (e.key === 'ArrowDown') deltaY = step;
        else if (e.key === 'ArrowLeft') deltaX = -step;
        else if (e.key === 'ArrowRight') deltaX = step;

        designerStore.moveSelectedNodeBy(deltaX, deltaY);
      }
    }
  };

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
  });
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
}

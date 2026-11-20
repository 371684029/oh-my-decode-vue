import { onMounted, onUnmounted } from 'vue';
import { useDesignerStore } from '../stores/designerStore';
import { shouldRunCanvasHotkeyFromDom } from '../utils/shortcutContext';
import { handleDesignerKeydown } from './designerKeydown';

/**
 * 全局画布级快捷键（复制/粘贴/删除/撤销/重做/开属性/方向键微调）。
 * v2.4.0 P2-1: 仅在画布聚焦且无弹窗/抽屉/输入焦点时响应
 * （替代旧的 INPUT/TEXTAREA/contenteditable 判断，现同时覆盖 dialog/drawer/属性抽屉）。
 */
export function useDesignerHotkeys() {
  const designerStore = useDesignerStore();

  const handleKeydown = (e: KeyboardEvent) => {
    handleDesignerKeydown(e, designerStore, shouldRunCanvasHotkeyFromDom(document.activeElement));
  };

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
  });
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
}
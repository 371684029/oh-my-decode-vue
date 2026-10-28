import { computed } from 'vue';
import { useDesignerStore } from '../stores/designerStore';

/**
 * 属性抽屉各 Tab 子组件共享的 store 与当前选中节点。
 * node 来自全局 store（与拆分前 PropertyDrawer 内联 computed 等价）。
 */
export function useDrawerNode() {
  const designerStore = useDesignerStore();
  const node = computed(() => designerStore.selectedNode);
  const formatEventPath = (path: string) => `{{ ${path} }}`;
  return { designerStore, node, formatEventPath };
}

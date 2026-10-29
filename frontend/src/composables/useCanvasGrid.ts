import { ref, computed, type Ref } from 'vue';
import { useDesignerStore } from '../stores/designerStore';

export type CanvasViewportMode = 'desktop' | 'laptop' | 'tablet' | 'mobile';

/**
 * 画布网格几何（v2.4.0 拆分）：视口模式、列数/行高/常显、
 * 列切换重排、淡虚线网格背景与视口宽度样式。
 */
export function useCanvasGrid(preview: Ref<boolean>) {
  const designerStore = useDesignerStore();

  const viewportMode = ref<CanvasViewportMode>('desktop');

  const viewportDefaultCols = computed(() => {
    switch (viewportMode.value) {
      case 'mobile':
        return 4;
      case 'tablet':
        return 8;
      default:
        return 12;
    }
  });

  const ensureGridMeta = () => {
    const meta = designerStore.pageSchema.meta;
    if (!meta.grid) {
      meta.grid = { cols: viewportDefaultCols.value, rowHeight: 50, showAlways: false };
    }
    return meta.grid;
  };

  const colNum = computed(() => designerStore.pageSchema.meta.grid?.cols ?? viewportDefaultCols.value);
  const rowHeight = computed(() => designerStore.pageSchema.meta.grid?.rowHeight ?? 50);
  const showAlways = computed(() => Boolean(designerStore.pageSchema.meta.grid?.showAlways));

  const remapLayouts = (fromCols: number, toCols: number) => {
    if (fromCols === toCols || fromCols <= 0) return;
    for (const node of designerStore.activeChildren) {
      const layout = node.layout;
      layout.x = Math.min(toCols - 1, Math.round((layout.x * toCols) / fromCols));
      layout.w = Math.max(1, Math.min(toCols - layout.x, Math.round((layout.w * toCols) / fromCols) || 1));
    }
  };

  const onColsPreset = (val: string) => {
    const next = Number(val);
    if (!Number.isFinite(next) || next < 4) return;
    const grid = ensureGridMeta();
    const prev = grid.cols;
    if (prev === next) return;
    // 变更前落历史步（v2.5.0 #7）：变更后调用会留下空 pending 步并无谓清空 redo
    designerStore.recordHistory();
    remapLayouts(prev, next);
    grid.cols = next;
  };

  const onRowHeightChange = (val: number | undefined) => {
    if (val == null) return;
    const grid = ensureGridMeta();
    if (grid.rowHeight === val) return;
    designerStore.recordHistory();
    grid.rowHeight = val;
  };

  const onShowAlwaysChange = (val: boolean | string | number) => {
    const grid = ensureGridMeta();
    grid.showAlways = Boolean(val);
  };

  const showGridOverlay = computed(
    () => !preview.value && (showAlways.value || Boolean(designerStore.layoutGesture))
  );

  /** 淡虚线网格：SVG 短划线铺在 canvas 背景上 */
  const gridCanvasStyle = computed(() => {
    if (!showGridOverlay.value) {
      return { backgroundColor: '#ffffff' };
    }
    const cols = colNum.value;
    const rh = rowHeight.value;
    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="${rh}">` +
        `<path d="M99.5 0 V${rh}" fill="none" stroke="rgba(64,158,255,0.22)" stroke-width="1" stroke-dasharray="3 5"/>` +
        `<path d="M0 ${rh - 0.5} H100" fill="none" stroke="rgba(64,158,255,0.18)" stroke-width="1" stroke-dasharray="3 5"/>` +
        `</svg>`
    );
    return {
      backgroundColor: '#ffffff',
      backgroundImage: `url("data:image/svg+xml,${svg}")`,
      backgroundSize: `calc(100% / ${cols}) ${rh}px`
    };
  });

  const viewportStyle = computed(() => {
    switch (viewportMode.value) {
      case 'laptop':
        return { width: '1366px', margin: '0 auto' };
      case 'tablet':
        return { width: '768px', margin: '0 auto' };
      case 'mobile':
        return { width: '375px', margin: '0 auto' };
      default:
        return { width: '100%' };
    }
  });

  return {
    viewportMode,
    colNum,
    rowHeight,
    showAlways,
    onColsPreset,
    onRowHeightChange,
    onShowAlwaysChange,
    showGridOverlay,
    gridCanvasStyle,
    viewportStyle
  };
}

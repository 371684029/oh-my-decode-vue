// ============================================================
// 低代码平台共享类型定义 (Shared Type Definitions)
// 前后端统一从此处导入，消除类型漂移 (DRY)
// ============================================================

/** 画布组件节点 */
export interface ComponentNode {
  id: string;
  type: string;
  label: string;
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
    i: string;
  };
  props: Record<string, any>;
  attrs: Record<string, any>;
  config?: Record<string, any>;
  style: Record<string, any>;
  events: Record<string, any>;
  children?: ComponentNode[];
}

/** 图层类型 */
export type LayerType = 'canvas' | 'dialog' | 'loading' | 'custom-html';

/** 图层属性（按图层类型细分） */
export interface LayerProps {
  title?: string;
  width?: string;
  loadingText?: string;
  htmlCode?: string;
  cssCode?: string;
  scriptMounted?: string;
  scriptUnmounted?: string;
  scriptUpdated?: string;
}

/** 图层配置 */
export interface LayerConfig {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  zIndex: number;
  props?: LayerProps;
  children: ComponentNode[];
}

/** 页面 Schema */
export interface PageSchema {
  id: string;
  title: string;
  type: 'page' | 'component';
  meta: {
    author: string;
    description: string;
    version: string;
  };
  state: Record<string, any>;
  children: ComponentNode[];
  layers?: LayerConfig[];
}

/** 物料类型分类 */
export type MaterialCategory = 'pro' | 'element' | 'layout';

/** 物料注册项 */
export interface MaterialItem {
  type: string;
  label: string;
  icon: string;
  category: MaterialCategory;
  defaultLayout: {
    w: number;
    h: number;
  };
  defaultProps: Record<string, any>;
  defaultAttrs: Record<string, any>;
  defaultConfig?: Record<string, any>;
}

/** 操作审计日志 */
export interface OperationLog {
  id?: number;
  page_id: string;
  action: string;
  operator: string;
  details?: string;
  created_at?: string;
}

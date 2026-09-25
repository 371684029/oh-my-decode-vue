// ============================================================
// 低代码平台共享类型定义 (Shared Type Definitions)
// 前后端统一从此处导入，消除类型漂移 (DRY)
// ============================================================

/** 接口数据源绑定（v1.3.0 L2） */
export interface ApiBinding {
  url: string; // 接口地址（支持 {{ }} 表达式）
  method?: 'GET' | 'POST'; // 默认 GET
  params?: Record<string, any>; // 请求参数（值支持 {{ }} 表达式求值）
  autoFetch?: boolean; // 挂载时自动请求，默认 true
  responsePath?: string; // 数据列表提取路径（如 "data.list"）
  totalProp?: string; // 分页总数提取路径（如 "data.total"）
}

/** 动作类型（v1.3.0 L3 最小可行动作集） */
export type ActionType =
  | 'reload_data' // 刷新目标节点数据（如表格 reload）
  | 'open_dialog' // 打开指定图层弹窗（可携带行数据 payload）
  | 'close_dialog' // 关闭指定图层弹窗
  | 'toggle_loading' // 显示/隐藏 Loading 图层
  | 'show_message' // 消息提示
  | 'set_state'; // 更新页面 state（联动表达式绑定）

/** 动作节点 */
export interface ActionNode {
  id: string;
  type: ActionType;
  target?: string; // 目标节点 id 或图层 id
  payload?: Record<string, any>;
  /** 整段 {{ expr }}。为空则始终执行；无法安全求值时跳过。 */
  when?: string;
}

/** 事件规则：监听某事件并按序执行动作链 */
export interface EventRule {
  enabled: boolean;
  actions: ActionNode[];
}

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
  /** 事件规则映射（key 为事件名，如 click/change） */
  events: Record<string, EventRule>;
  children?: ComponentNode[];
  /** 接口数据源绑定（缺省 = 不请求，沿用 mock） */
  apiBinding?: ApiBinding;
  /** 整段 {{ expr }}。为空则始终显示；无法安全求值时保持显示。 */
  visibleWhen?: string;
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

/** 页面元信息（v1.3.0 P1-4 版本化） */
export interface PageMeta {
  author: string;
  description: string;
  version: string; // 保存时自动递增（如 1.0.0 → 1.0.1）
  prevVersion?: string; // 记录上一版本号，供回滚
}

/** 页面 Schema */
export interface PageSchema {
  id: string;
  title: string;
  type: 'page' | 'component';
  meta: PageMeta;
  state: Record<string, any>;
  children: ComponentNode[];
  layers?: LayerConfig[];
}

/** 物料类型分类 */
export type MaterialCategory = 'pro' | 'element' | 'layout';

/** 物料入参契约（缺必填项时只警告） */
export interface MaterialInputContract {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'expression';
  required: boolean;
}

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
  inputs?: MaterialInputContract[];
  outputs?: Array<{ name: string; label: string }>;
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

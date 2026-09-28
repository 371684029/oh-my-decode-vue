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
  /** 设计器本地 Mock 的完整响应。出码不嵌入该字段。 */
  example?: unknown;
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

/** 黑盒实例的物料引用（v2.1.0） */
export interface MaterialRef {
  id: string; // 物料 type，如 "custom-user-card"
  version: string; // 锁定版本号（精确锁定，无 range）
  follow?: 'pin' | 'minor' | 'patch'; // 跟随策略，默认 'pin'
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
  /** 黑盒实例引用（存在 = 黑盒模式，渲染/出码按引用解析物料定义；v2.1.0） */
  materialRef?: MaterialRef;
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

/** 物料种类：atomic = 内置原子；composite = 用户生成复合（v2.0.0） */
export type MaterialKind = 'atomic' | 'composite';

/** 物料 Manifest（v2.0.0）：复合物料 = MaterialItem 描述 + schema 快照 */
export interface MaterialManifest extends MaterialItem {
  kind: MaterialKind;
  /** 复合物料核心：画布节点子树快照（拖入时展开实例化） */
  schema?: ComponentNode[];
  /** 包含组件类型清单（展示用，非契约）：如 ["pro-table", "el-button"] */
  summary?: string[];
  /** 当前版本号（v2.1.0 版本管理；manifest.json 索引不含 schema） */
  currentVersion?: string;
  /** 版本索引：version → 元信息（含契约签名 / 发布时间 / 引用数） */
  versions?: Record<string, MaterialVersionMeta>;
  /** 被引用实例数（扫描得出，提示用；删除前实时复核） */
  refCount?: number;
  /** 当前版本的契约（黑盒模式下才有运行时意义） */
  contract?: MaterialContract;
}

// ============================================================
// v2.1.0 物料版本管理与黑盒引用类型
// ============================================================

/** 契约输入：实例配置值注入快照的定位声明 */
export interface MaterialInput {
  name: string; // 实例 props 上的 key，如 "title"
  label: string; // 面板显示名，如 "标题"
  type: 'string' | 'number' | 'boolean' | 'expression' | 'data';
  nodeId: string; // 快照内目标节点 id（黑盒不展开，id 稳定）
  fieldPath: string; // 点路径，如 "props.title" / "config.columns"
  required: boolean;
  default?: unknown;
}

/** 契约输出：内部事件出口声明 */
export interface MaterialOutput {
  name: string; // 事件出口名，如 "submit"
  label: string;
  nodeId: string; // 快照内事件源节点 id
  event: string; // 内部事件名，如 "click" / "submit"
}

export interface MaterialContract {
  inputs: MaterialInput[];
  outputs: MaterialOutput[];
}

/** 不可变版本快照（发布后永不改写） */
export interface MaterialVersion {
  version: string; // 严格 \d+\.\d+\.\d+
  schema: ComponentNode[]; // 归一化快照（id 为种子）
  contract: MaterialContract;
  contractSignature: string; // 契约规范化哈希（major 判定硬标准）
  summary: string[];
  changelog: string; // 发布时变更摘要
  publishedAt: string; // ISO 时间戳
  releasedBy: string;
}

/** 版本索引元信息（manifest.versions 的值） */
export interface MaterialVersionMeta {
  version: string;
  contractSignature: string;
  publishedAt: string;
  refCount: number;
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

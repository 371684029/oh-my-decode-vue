/**
 * 物料/图层 → 画布对象工厂 (v2.8.0 巨型文件拆分 #2)。
 *
 * 从 designerStore 抽出的**纯构造函数**：只负责「物料定义 → 节点」「图层类型 → 图层」，
 * 生成 id、平移落点、深拷贝默认值、重写子树 id 与事件 target，不接触任何 store 状态。
 *
 * 同样以「没有 `this` 的代码」为抽出边界，因此不会改变 store 行为，可独立测试。
 */
import type { ComponentNode, LayerProps, MaterialItem, MaterialManifest } from '../types/designer';
import { generateUniqueId, rewriteActionTargets, rewriteNodeIds } from './designerSchema';

/** 深拷贝（丢弃 undefined / 函数等不可序列化值，与原实现一致） */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** 原子物料 → 普通画布节点 */
export function createNodeFromMaterial(material: MaterialItem, x: number, y: number): ComponentNode {
  const id = generateUniqueId(material.type);
  return {
    id,
    type: material.type,
    label: material.label,
    layout: {
      x,
      y,
      w: material.defaultLayout.w,
      h: material.defaultLayout.h,
      i: id
    },
    props: cloneJson(material.defaultProps || {}),
    attrs: cloneJson(material.defaultAttrs || {}),
    config: material.defaultConfig ? cloneJson(material.defaultConfig) : undefined,
    style: {},
    events:
      material.type === 'pro-table'
        ? {
            view: {
              enabled: true,
              actions: [
                {
                  id: 'default-view-msg',
                  type: 'show_message',
                  payload: {
                    messageType: 'info',
                    messageText: "查看 · {{ event.row.name || event.row.title || event.row.id || '当前行' }}"
                  }
                }
              ]
            },
            delete: {
              enabled: true,
              actions: [
                {
                  id: 'default-delete-msg',
                  type: 'show_message',
                  payload: {
                    messageType: 'warning',
                    messageText: "删除 · {{ event.row.name || event.row.title || event.row.id || '当前行' }}"
                  }
                }
              ]
            }
          }
        : {}
  };
}

/**
 * 黑盒物料 → 单一实例节点（带 materialRef，渲染/出码按引用解析）。
 * 实例默认 pin 到 manifest.currentVersion（缺省 1.0.0）。
 */
export function createBlackBoxNode(manifest: MaterialManifest, x: number, y: number): ComponentNode {
  const id = generateUniqueId(manifest.type);
  return {
    id,
    type: manifest.type,
    label: manifest.label,
    layout: { x, y, w: manifest.defaultLayout.w, h: manifest.defaultLayout.h, i: id },
    props: {},
    attrs: {},
    style: {},
    events: {},
    materialRef: { id: manifest.type, version: manifest.currentVersion || '1.0.0', follow: 'pin' }
  };
}

/**
 * 复合物料快照 → 实例化子树 (v2.0.0)。
 *
 * 深拷贝快照 → 按包围盒原点整体平移到落点 → 重写全部子孙 id → 统一重写事件 target。
 * 返回节点数组（空快照返回空数组）。跨顶层节点的事件引用也正确（共用一张 idMap）。
 */
export function instantiateCompositeSnapshot(
  manifest: MaterialManifest,
  dropX: number,
  dropY: number
): ComponentNode[] {
  const snapshot = manifest.schema || [];
  if (snapshot.length === 0) return [];
  const nodes = cloneJson(snapshot);

  // 克隆快照包围盒原点（兼容非 0 起点快照），整体平移到落点
  let minX = Infinity;
  let minY = Infinity;
  const measure = (list: ComponentNode[]) => {
    for (const node of list) {
      minX = Math.min(minX, node.layout.x);
      minY = Math.min(minY, node.layout.y);
      if (node.children?.length) measure(node.children);
    }
  };
  measure(nodes);
  const tx = dropX - (Number.isFinite(minX) ? minX : 0);
  const ty = dropY - (Number.isFinite(minY) ? minY : 0);
  const translate = (list: ComponentNode[]) => {
    for (const node of list) {
      node.layout.x += tx;
      node.layout.y += ty;
      if (node.children?.length) translate(node.children);
    }
  };
  translate(nodes);

  // 先共享 idMap 重写全部子孙 id，再统一重写事件 target（跨顶层节点的引用也正确）
  const idMap = new Map<string, string>();
  for (const node of nodes) {
    const map = rewriteNodeIds(node, generateUniqueId);
    map.forEach((next, prev) => idMap.set(prev, next));
  }
  for (const node of nodes) {
    rewriteActionTargets(node, idMap);
  }
  return nodes;
}

/** 图层类型 → 默认 props（业务弹窗 / Loading 遮罩 / 自定义 HTML 的种子内容） */
function layerDefaults(type: 'dialog' | 'loading' | 'custom-html', name: string): LayerProps {
  const defaultProps: LayerProps = {};
  if (type === 'custom-html') {
    defaultProps.htmlCode =
      '<div class="custom-card">\n  <h3>自定义 HTML 图层内容</h3>\n  <p id="time-text">正在加载...</p>\n</div>';
    defaultProps.cssCode =
      '.custom-card { padding: 12px; background: #f0f9eb; border: 1px solid #67c23a; border-radius: 6px; color: #303133; }';
    defaultProps.scriptMounted =
      'const el = container.querySelector("#time-text"); if (el) { el.innerText = "挂载时间: " + new Date().toLocaleTimeString(); }';
    defaultProps.scriptUnmounted = 'console.log("自定义 HTML 图层已被卸载!");';
  } else if (type === 'dialog') {
    defaultProps.title = name || '业务弹窗图层';
    defaultProps.width = '50%';
  } else if (type === 'loading') {
    defaultProps.loadingText = '全屏数据加载中，请稍候...';
  }
  return defaultProps;
}

/**
 * 新建图层 (v2.8.0 巨型文件拆分 #2)：按类型填默认 props 并决定初始可见性。
 * 可见性约定：custom-html 默认可见（有内容可看），dialog / loading 默认隐藏。
 */
export function createLayer(
  type: 'dialog' | 'loading' | 'custom-html',
  name: string,
  layerId: string,
  zIndex: number
) {
  return {
    id: layerId,
    name:
      name || (type === 'dialog' ? '业务弹窗图层' : type === 'loading' ? 'Loading 遮罩图层' : '自定义 HTML 图层'),
    type,
    visible: type === 'custom-html',
    zIndex,
    props: layerDefaults(type, name),
    children: []
  };
}

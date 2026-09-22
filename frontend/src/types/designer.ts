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

export type LayerType = 'canvas' | 'dialog' | 'loading' | 'custom-html';

export interface LayerConfig {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  zIndex: number;
  props?: {
    title?: string;
    width?: string;
    loadingText?: string;
    htmlCode?: string;
    cssCode?: string;
    scriptMounted?: string;
    scriptUnmounted?: string;
    scriptUpdated?: string;
  };
  children: ComponentNode[];
}

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

export interface MaterialItem {
  type: string;
  label: string;
  icon: string;
  category: 'pro' | 'element' | 'basic' | 'layout';
  defaultLayout: {
    w: number;
    h: number;
  };
  defaultProps: Record<string, any>;
  defaultAttrs: Record<string, any>;
  defaultConfig?: Record<string, any>;
}

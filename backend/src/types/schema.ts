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
  props?: Record<string, any>;
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

export interface OperationLog {
  id?: number;
  page_id: string;
  action: string;
  operator: string;
  details?: string;
  created_at?: string;
}

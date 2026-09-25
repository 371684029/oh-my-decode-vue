import type { LayerConfig } from '../types/designer';
import { sanitizeCss } from './sanitizeCss';

/**
 * 自定义 HTML 文档。设计器 iframe 与出码 srcdoc 都走这里，保证预览和导出一致。
 * htmlCode 去掉 script 与内联事件；生命周期脚本只放进独立的 script 块。
 */
export function sanitizeHtmlFragment(html: string): string {
  const stripped = String(html ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*$/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
  return stripped;
}

/** 避免用户脚本里的闭合标签提前结束 srcdoc 中的 script。 */
export function embedUserScript(code: string): string {
  return String(code ?? '').replace(/<\/script/gi, '<\\/script');
}

export function buildCustomHtmlSrcdoc(layer: Pick<LayerConfig, 'props'>): string {
  const html = sanitizeHtmlFragment(layer.props?.htmlCode || '<div>无 HTML 内容</div>');
  const css = sanitizeCss(layer.props?.cssCode || '');
  const mounted = embedUserScript(layer.props?.scriptMounted || '');
  const updated = embedUserScript(layer.props?.scriptUpdated || '');
  const unmounted = embedUserScript(layer.props?.scriptUnmounted || '');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}<script>(function(){var container=document.body;var state={};window.addEventListener('pagehide',function(){try{${unmounted}}catch(err){console.error(err)}});try{${mounted}}catch(err){console.error(err)}try{${updated}}catch(err){console.error(err)}})();</script></body></html>`;
}

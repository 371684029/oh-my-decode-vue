/**
 * 自定义 CSS 消毒：避免样式文本打断 <style> 或引入外部脚本。
 * 设计器 iframe 与出码样式共用。
 */
export function sanitizeCss(css: string): string {
  return String(css ?? '')
    .replace(/<\/style/gi, '')
    .replace(/@import/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/behavior\s*:/gi, '')
    .replace(/-moz-binding/gi, '');
}

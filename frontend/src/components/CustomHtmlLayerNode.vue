<template>
  <iframe
    class="custom-html-frame"
    sandbox="allow-scripts"
    referrerpolicy="no-referrer"
    :title="layer.name || '自定义 HTML 图层'"
    :srcdoc="srcdoc"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { LayerConfig } from '../types/designer';
import DOMPurify from 'dompurify';
import { sanitizeCss } from '../utils/sanitizeCss';

const props = defineProps<{
  layer: LayerConfig;
}>();

const SCRIPT_OPEN = '<' + 'script>';
const SCRIPT_CLOSE = '<' + '/script>';

/** 把用户脚本放进 iframe 文档时，避免提前结束 script 标签 */
function embedScript(code: string): string {
  return code.split(SCRIPT_CLOSE).join('\\u003c/script>');
}

/**
 * 自定义 HTML 在 sandbox iframe 中预览（无 allow-same-origin）。
 * 样式与脚本留在独立文档里，不进入设计器页面，也不在父窗口使用 new Function。
 */
const srcdoc = computed(() => {
  const html = DOMPurify.sanitize(props.layer.props?.htmlCode || '<div>无 HTML 内容</div>');
  const css = sanitizeCss(props.layer.props?.cssCode || '');
  const mounted = embedScript(props.layer.props?.scriptMounted || '');
  const updated = embedScript(props.layer.props?.scriptUpdated || '');
  const unmounted = embedScript(props.layer.props?.scriptUnmounted || '');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>${css}</style>
</head>
<body>
${html}
${SCRIPT_OPEN}
(function () {
  var container = document.body;
  var state = {};
  window.addEventListener('pagehide', function () {
    try { ${unmounted} } catch (err) { console.error(err); }
  });
  try { ${mounted} } catch (err) { console.error(err); }
  try { ${updated} } catch (err) { console.error(err); }
})();
${SCRIPT_CLOSE}
</body>
</html>`;
});
</script>

<style scoped>
.custom-html-frame {
  width: 100%;
  min-height: 160px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #fff;
}
</style>

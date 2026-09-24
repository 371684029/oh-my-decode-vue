<template>
  <div ref="containerRef" class="custom-html-layer-container">
    <component :is="'style'" v-if="layer.props?.cssCode">
      {{ layer.props.cssCode }}
    </component>
    <!-- v-html 内容已经过 DOMPurify 消毒（见 sanitizedHtml computed），此处豁免 XSS 告警 -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-html="sanitizedHtml"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onUpdated, watch } from 'vue';
import type { LayerConfig } from '../types/designer';
import DOMPurify from 'dompurify';

const props = defineProps<{
  layer: LayerConfig;
}>();

const containerRef = ref<HTMLElement | null>(null);

/** 自定义 HTML 经 DOMPurify 消毒后渲染（剥离 script / on* 事件等危险内容） */
const sanitizedHtml = computed(() => {
  return DOMPurify.sanitize(props.layer.props?.htmlCode || '<div>无 HTML 内容</div>');
});

/**
 * 执行图层生命周期脚本。
 * 注意：脚本在浏览器本地执行（等价于低代码平台的"自定义脚本节点"），
 * 仅用于设计器内预览；导出代码时脚本将原样嵌入目标代码，由页面所有者负责安全。
 */
const executeScript = (scriptCode?: string, lifecycleName?: string) => {
  if (!scriptCode || !scriptCode.trim()) return;
  try {
    const fn = new Function('container', 'state', scriptCode);
    fn(containerRef.value, {});
  } catch (err) {
    console.error(`[Custom HTML Layer ${props.layer.name}] ${lifecycleName} Error:`, err);
  }
};

onMounted(() => {
  executeScript(props.layer.props?.scriptMounted, 'onMounted');
});

onUpdated(() => {
  executeScript(props.layer.props?.scriptUpdated, 'onUpdated');
});

onUnmounted(() => {
  executeScript(props.layer.props?.scriptUnmounted, 'onUnmounted');
});

watch(
  () => props.layer.props?.scriptMounted,
  () => {
    executeScript(props.layer.props?.scriptMounted, 'onMounted (watch)');
  }
);
</script>

<style scoped>
.custom-html-layer-container {
  width: 100%;
  position: relative;
}
</style>

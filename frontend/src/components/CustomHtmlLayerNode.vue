<template>
  <div ref="containerRef" class="custom-html-layer-container">
    <component :is="'style'" v-if="layer.props?.cssCode">
      {{ layer.props.cssCode }}
    </component>
    <div v-html="layer.props?.htmlCode || '<div>无 HTML 内容</div>'"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, onUpdated, watch } from 'vue';
import type { LayerConfig } from '../types/designer';

const props = defineProps<{
  layer: LayerConfig;
}>();

const containerRef = ref<HTMLElement | null>(null);

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

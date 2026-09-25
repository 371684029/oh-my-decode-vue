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
import { buildCustomHtmlSrcdoc } from '../utils/customHtmlDocument';

const props = defineProps<{
  layer: LayerConfig;
}>();

/** 与出码共用同一份 srcdoc，脚本留在 sandbox iframe 内。 */
const srcdoc = computed(() => buildCustomHtmlSrcdoc(props.layer));
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

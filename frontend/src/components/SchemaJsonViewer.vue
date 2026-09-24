<template>
  <div class="schema-json-viewer">
    <div class="viewer-actions">
      <el-button type="primary" size="small" icon="CopyDocument" @click="handleCopy"> 复制 JSON </el-button>
    </div>
    <pre class="json-code"><code>{{ jsonString }}</code></pre>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useDesignerStore } from '../stores/designerStore';
import { ElMessage } from 'element-plus';

const designerStore = useDesignerStore();

const jsonString = computed(() => {
  return JSON.stringify(designerStore.pageSchema, null, 2);
});

const handleCopy = () => {
  navigator.clipboard.writeText(jsonString.value);
  ElMessage.success('JSON 已成功复制到剪贴板');
};
</script>

<style scoped>
.schema-json-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.viewer-actions {
  margin-bottom: 10px;
  display: flex;
  justify-content: flex-end;
}
.json-code {
  background-color: #1e1e1e;
  color: #9cdcfe;
  padding: 12px;
  border-radius: 6px;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  overflow: auto;
  max-height: 500px;
}
</style>

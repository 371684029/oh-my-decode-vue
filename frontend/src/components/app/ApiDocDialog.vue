<template>
  <el-dialog :model-value="visible" title="前端接口文档" width="720px" @update:model-value="emit('update:visible', $event)">
    <pre class="api-doc">{{ markdown }}</pre>
    <template #footer>
      <el-button @click="emit('update:visible', false)">关闭</el-button>
      <el-button type="primary" @click="copyApiDoc">复制</el-button>
      <el-button type="success" @click="downloadApiDoc">下载 api.md</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus';

const props = defineProps<{
  visible: boolean;
  markdown: string;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const copyApiDoc = () => {
  navigator.clipboard.writeText(props.markdown);
  ElMessage.success('接口文档已复制');
};

const downloadApiDoc = () => {
  const blob = new Blob([props.markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'api.md';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
</script>

<style scoped>
.api-doc {
  margin: 0;
  max-height: 420px;
  overflow: auto;
  white-space: pre-wrap;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
}
</style>

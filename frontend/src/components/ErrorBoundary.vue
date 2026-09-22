<template>
  <div v-if="hasError" class="error-boundary">
    <el-alert
      title="组件渲染捕获到错误"
      type="error"
      description="该组件属性或表达式存在异常，已被错误边界隔离防护，不影响页面其他节点运行。"
      show-icon
    />
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';

const hasError = ref(false);

onErrorCaptured((err, instance, info) => {
  console.error('ErrorBoundary captured error:', err, instance, info);
  hasError.value = true;
  return false; // 阻止错误向上继续冒泡造成全局崩溃
});
</script>

<style scoped>
.error-boundary {
  padding: 8px;
  margin: 4px 0;
}
</style>

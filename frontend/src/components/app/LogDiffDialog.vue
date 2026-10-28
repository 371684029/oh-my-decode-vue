<template>
  <el-dialog
    :model-value="visible"
    title="操作日志 Schema 细节 & JSON Diff 快照"
    width="650px"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-if="log">
      <el-descriptions border :column="2" style="margin-bottom: 16px">
        <el-descriptions-item label="日志 ID">{{ log.id }}</el-descriptions-item>
        <el-descriptions-item label="操作类型">{{ log.action }}</el-descriptions-item>
        <el-descriptions-item label="关联 Page ID">{{ log.page_id }}</el-descriptions-item>
        <el-descriptions-item label="记录时间">{{ log.created_at }}</el-descriptions-item>
      </el-descriptions>
      <div style="font-weight: 600; font-size: 13px; margin-bottom: 8px; color: #303133">
        {{ logDetailsTitle }}
      </div>
      <pre class="diff-json-code">{{ formattedLogDetails }}</pre>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AuditLogRow } from './LogsDialog.vue';

const props = defineProps<{
  visible: boolean;
  log: AuditLogRow | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const logDetailsTitle = computed(() => {
  try {
    const raw = props.log?.details;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed?.initial) return '首次保存';
    if (Array.isArray(parsed?.patch)) return '保存差异 (JSON Patch)';
  } catch {
    /* 旧日志保持原样展示 */
  }
  return '操作详情';
});

const formattedLogDetails = computed(() => {
  if (!props.log || !props.log.details) return '{}';
  try {
    const parsed = typeof props.log.details === 'string' ? JSON.parse(props.log.details) : props.log.details;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return props.log.details;
  }
});
</script>

<style scoped>
.diff-json-code {
  background-color: #1e1e1e;
  color: #a9b7c6;
  padding: 12px;
  border-radius: 6px;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 12px;
  max-height: 300px;
  overflow: auto;
  margin: 0;
}
</style>

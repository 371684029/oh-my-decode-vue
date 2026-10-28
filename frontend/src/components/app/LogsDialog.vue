<template>
  <el-dialog :model-value="visible" title="SQLite 操作审计日志" width="800px" @update:model-value="emit('update:visible', $event)">
    <el-table :data="logs" style="width: 100%" max-height="400px">
      <el-table-column prop="created_at" label="时间" width="170" />
      <el-table-column prop="action" label="操作类型" width="130" />
      <el-table-column prop="page_id" label="关联ID" width="130" />
      <el-table-column prop="operator" label="操作人" width="110" />
      <el-table-column label="改动详情 / Schema Diff" align="center">
        <template #default="scope">
          <el-button type="primary" size="small" plain @click="emit('view-diff', scope.row as AuditLogRow)">
            查看 Details Diff
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>

<script setup lang="ts">
/** SQLite 审计日志行（/logs 返回项） */
export interface AuditLogRow {
  id: number | string;
  created_at: string;
  action: string;
  page_id: string;
  operator: string;
  details?: string;
}

defineProps<{
  visible: boolean;
  logs: AuditLogRow[];
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  'view-diff': [log: AuditLogRow];
}>();
</script>

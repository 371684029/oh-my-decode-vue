<template>
  <div class="pro-table-wrapper">
    <el-table
      :data="mockData"
      :border="node.props.border"
      :stripe="node.props.stripe"
      :size="node.props.size || 'default'"
      style="width: 100%"
    >
      <el-table-column
        v-for="col in columns"
        :key="col.prop"
        :prop="col.prop"
        :label="col.label"
        :width="col.width"
        :align="col.align || 'left'"
        :sortable="col.sortable"
      />
      <el-table-column v-if="actions.length > 0" label="操作" align="center" width="160">
        <template #default="scope">
          <el-button
            v-for="action in actions"
            :key="action.eventKey"
            :type="action.type || 'primary'"
            link
            size="small"
            @click="handleAction(action.eventKey, scope.row)"
          >
            {{ action.label }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="pagination.enabled" class="pagination-bar">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pagination.pageSize || 10"
        layout="total, prev, pager, next"
        :total="4"
        size="small"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ComponentNode } from '../types/designer';
import { ElMessage } from 'element-plus';

const props = defineProps<{
  node: ComponentNode;
}>();

const currentPage = ref(1);

const mockData = ref([
  { id: '101', name: '张三', role: '系统管理员', status: '正常', updatedAt: '2026-09-15 10:00' },
  { id: '102', name: '李四', role: '前端开发者', status: '启用', updatedAt: '2026-09-15 10:30' },
  { id: '103', name: '王五', role: '测试工程师', status: '禁用', updatedAt: '2026-09-15 11:00' },
  { id: '104', name: '赵六', role: '产品经理', status: '正常', updatedAt: '2026-09-15 11:15' }
]);

const columns = computed(() => props.node.config?.columns || []);
const actions = computed(() => props.node.config?.actions || []);
const pagination = computed(() => props.node.config?.pagination || { enabled: true, pageSize: 10 });

const handleAction = (key: string, row: any) => {
  ElMessage.info(`触发按钮 [${key}], 选中行: ${row.name}`);
};
</script>

<style scoped>
.pro-table-wrapper {
  width: 100%;
}
.pagination-bar {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}
</style>

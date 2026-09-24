<template>
  <div class="pro-table-wrapper">
    <el-table
      v-loading="loading"
      :data="rows"
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
        :total="totalCount"
        size="small"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { ComponentNode } from '../types/designer';
import { ElMessage } from 'element-plus';
import { ApiExecutor } from '../utils/dataSource';
import { useDesignerStore } from '../stores/designerStore';
import { nodeEventBus } from '../utils/dataSource';

const props = defineProps<{
  node: ComponentNode;
}>();

const currentPage = ref(1);
const totalCount = ref(4);
const loading = ref(false);

/** 数据行：优先 apiBinding 数据源，缺省为占位 mock */
const rows = ref<any[]>([]);

const executor = new ApiExecutor();

const columns = computed(() => props.node.config?.columns || []);
const actions = computed(() => props.node.config?.actions || []);
const pagination = computed(() => props.node.config?.pagination || { enabled: true, pageSize: 10 });

/** 加载数据（供 autoFetch 与动作链 reload 调用） */
const loadData = async () => {
  const binding = props.node.apiBinding;
  if (!binding?.url) {
    // 未配置数据源：使用占位 mock
    rows.value = [
      { id: '101', name: '张三', role: '系统管理员', status: '正常', updatedAt: '2026-09-15 10:00' },
      { id: '102', name: '李四', role: '前端开发者', status: '启用', updatedAt: '2026-09-15 10:30' },
      { id: '103', name: '王五', role: '测试工程师', status: '禁用', updatedAt: '2026-09-15 11:00' },
      { id: '104', name: '赵六', role: '产品经理', status: '正常', updatedAt: '2026-09-15 11:15' }
    ];
    return;
  }
  try {
    loading.value = true;
    const designerStore = useDesignerStore();
    executor.setScope(designerStore.pageSchema.state);
    const { data, total } = await executor.fetchData(binding);
    rows.value = Array.isArray(data) ? data : [];
    if (total !== undefined) totalCount.value = Number(total) || 0;
  } catch (err: any) {
    ElMessage.error('数据加载失败: ' + (err.message || err));
    rows.value = [];
  } finally {
    loading.value = false;
  }
};

const handlePageChange = (page: number) => {
  // 分页参数通过 state.page 与表达式绑定联动
  const designerStore = useDesignerStore();
  designerStore.pageSchema.state.page = page;
  loadData();
};

const handleAction = (key: string, row: any) => {
  ElMessage.info(`触发按钮 [${key}], 选中行: ${row.name}`);
};

let unsubscribe: (() => void) | undefined;

onMounted(() => {
  const binding = props.node.apiBinding;
  if (binding?.url && binding.autoFetch !== false) {
    loadData();
  }
  // 订阅动作链 reload
  unsubscribe = nodeEventBus.onReload(props.node.id, () => loadData());
});

onUnmounted(() => {
  unsubscribe?.();
});
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
